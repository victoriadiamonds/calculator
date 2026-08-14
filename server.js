const express = require('express');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const cors = require('cors');
const { Airwallex } = require('@airwallex/node-sdk');
require('dotenv').config();
const pricing = require('./pricing');

const app = express();
app.use(cors());
// Airwallex signatures cover the original payload, not a re-serialized object.
app.use(express.json({
  verify: (req, res, buffer) => {
    if (req.originalUrl === '/airwallex/webhook') req.rawBody = Buffer.from(buffer);
  }
}));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Temporary diagnostic endpoint to retrieve full PaymentIntent from Airwallex
app.get('/debug/payment-intent/:id', async (req, res) => {
  try {
    const paymentIntentId = req.params.id;
    if (!paymentIntentId) {
      return res.status(400).json({ error: 'PaymentIntent ID required' });
    }

    console.log(`[DEBUG] Retrieving PaymentIntent: ${paymentIntentId}`);

    const response = await airwallexClient.paymentAcceptance.paymentIntents.retrievePaymentIntent(paymentIntentId);
    const pi = response;

    console.log('[DEBUG] PaymentIntent status:', pi.status);
    console.log('[DEBUG] latest_payment_attempt:', JSON.stringify(pi.latest_payment_attempt, null, 2));
    
    if (pi.latest_payment_attempt) {
      console.log('[DEBUG] latest_payment_attempt.status:', pi.latest_payment_attempt.status);
      console.log('[DEBUG] latest_payment_attempt.failure_code:', pi.latest_payment_attempt.failure_code);
      console.log('[DEBUG] latest_payment_attempt.failure_details:', pi.latest_payment_attempt.failure_details);
      console.log('[DEBUG] latest_payment_attempt.payment_method.type:', pi.latest_payment_attempt.payment_method?.type);
    }
    
    console.log('[DEBUG] next_action:', JSON.stringify(pi.next_action, null, 2));
    console.log('[DEBUG] merchant_order_id:', pi.merchant_order_id);

    res.json(pi);
  } catch (error) {
    console.error('[DEBUG] Error retrieving PaymentIntent:', error.message);
    console.error('[DEBUG] Error response:', error.response?.data);
    res.status(500).json({ 
      error: 'Failed to retrieve PaymentIntent', 
      details: error.response?.data || error.message 
    });
  }
});

// Serve static files (the calculator)
app.use(express.static(path.join(__dirname)));

// Airwallex Configuration
const AIRWALLEX_CLIENT_ID = process.env.AIRWALLEX_CLIENT_ID;
const AIRWALLEX_API_KEY = process.env.AIRWALLEX_API_KEY;
const AIRWALLEX_WEBHOOK_SECRET = process.env.AIRWALLEX_WEBHOOK_SECRET;
const AIRWALLEX_ENV = process.env.AIRWALLEX_ENV || 'sandbox';

// Initialize Airwallex Client
const airwallexClient = new Airwallex({
  clientId: AIRWALLEX_CLIENT_ID,
  apiKey: AIRWALLEX_API_KEY,
  env: AIRWALLEX_ENV === 'production' ? 'prod' : 'demo'
});

// In-memory order store (replace with database in production)
const orders = new Map();

function generateMerchantOrderId() {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.random().toString(36).substring(2, 10).toUpperCase();
  return `VD-${dateStr}-${random}`;
}

function storeOrder(merchantOrderId, orderData) {
  orders.set(merchantOrderId, {
    ...orderData,
    merchantOrderId,
    status: 'PENDING',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
}

function getOrder(merchantOrderId) {
  return orders.get(merchantOrderId);
}

function updateOrderStatus(merchantOrderId, status, paymentIntentId = null) {
  const order = orders.get(merchantOrderId);
  if (order) {
    order.status = status;
    if (paymentIntentId) order.paymentIntentId = paymentIntentId;
    order.updatedAt = new Date().toISOString();
    orders.set(merchantOrderId, order);
  }
}

function verifyWebhookSignature(rawPayload, timestamp, signature) {
  if (!AIRWALLEX_WEBHOOK_SECRET || !rawPayload || !timestamp || !signature) return false;

  const expectedSignature = crypto
    .createHmac('sha256', AIRWALLEX_WEBHOOK_SECRET)
    .update(`${timestamp}${rawPayload.toString('utf8')}`)
    .digest('hex');

  const received = Buffer.from(signature, 'utf8');
  const expected = Buffer.from(expectedSignature, 'utf8');
  return received.length === expected.length && crypto.timingSafeEqual(received, expected);
}

// Create PaymentIntent endpoint
app.post('/create-payment-intent', async (req, res) => {
  try {
    if (!AIRWALLEX_CLIENT_ID || !AIRWALLEX_API_KEY) {
      return res.status(503).json({ error: 'Payments are not configured. Add Airwallex API credentials on the server.' });
    }
    const {
      productId,
      collection,
      typeFilter,
      metal,
      karat,
      purity,
      diamonds,
      quantity,
      discount,
      profit,
      designFee,
      customerName,
      customerEmail
    } = req.body;

    // Validate required fields
    if (!productId || !collection || !metal || !customerName || !customerEmail) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Compute pricing server-side
    const pricingParams = {
      collection,
      productId,
      typeFilter: typeFilter || 'all',
      metal,
      karat: Number(karat) || 18,
      purity: Number(purity) || 999,
      diamonds: diamonds || [],
      quantity: Number(quantity) || 1,
      discount: Number(discount) || 0,
      profit: Number(profit) || 0,
      designFee: Number(designFee) || 0
    };

    const pricingResult = pricing.computePricing(pricingParams);

    if (!pricingResult) {
      return res.status(400).json({ error: 'Invalid product or configuration' });
    }

    if (pricingResult.priceOnRequest) {
      return res.status(400).json({ error: 'This item is priced on request and cannot be paid online' });
    }

    const amount = Math.round(pricingResult.finalTotal * 100) / 100; // GBP with 2 decimal places

    if (amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    // Generate unique merchant order ID
    const merchantOrderId = generateMerchantOrderId();
    const requestId = uuidv4();

    const paymentIntentData = {
      amount: amount,
      currency: 'GBP',
      merchant_order_id: merchantOrderId,
      request_id: requestId,
      return_url: 'https://calculator-oofl.onrender.com/',
      metadata: {
        collection: collection,
        product_id: productId,
        product_name: pricingResult.prod.name,
        quantity: String(pricingResult.qty),
        customer_email: customerEmail
      },
      customer: {
        email: customerEmail,
        first_name: customerName.split(/\s+/, 1)[0],
        last_name: customerName.split(/\s+/).slice(1).join(' ') || undefined
      }
    };

    const paymentIntentResponse = await airwallexClient.paymentAcceptance.paymentIntents.createPaymentIntent(paymentIntentData);
    const paymentIntentId = paymentIntentResponse.id;
    const client_secret = paymentIntentResponse.client_secret;
    console.log('Airwallex PaymentIntent created:', paymentIntentId);

    // Store order
    storeOrder(merchantOrderId, {
      paymentIntentId,
      clientSecret: client_secret,
      amount,
      currency: 'GBP',
      customerName,
      customerEmail,
      product: pricingResult.prod,
      collection,
      pricing: pricingResult
    });

    res.json({
      paymentIntentId,
      clientSecret: client_secret,
      merchantOrderId,
      amount,
      currency: 'GBP'
    });

  } catch (error) {
    console.error('PaymentIntent creation failed:');
    console.error('  Status:', error.response?.status);
    console.error('  Data:', JSON.stringify(error.response?.data, null, 2));
    console.error('  Message:', error.message);
    res.status(500).json({ error: 'Failed to create payment intent' });
  }
});

// Airwallex Webhook endpoint
app.post('/airwallex/webhook', async (req, res) => {
  try {
    const signature = req.headers['x-signature'];
    const timestamp = req.headers['x-timestamp'];

    // Verify webhook signature
    if (!verifyWebhookSignature(req.rawBody, timestamp, signature)) {
      console.warn('Invalid or missing Airwallex webhook signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }
    const ageInMs = Math.abs(Date.now() - Number(timestamp));
    if (!Number.isFinite(ageInMs) || ageInMs > 5 * 60 * 1000) {
      return res.status(401).json({ error: 'Webhook timestamp is outside the accepted window' });
    }

    const event = req.body;
    const eventType = event.type;
    const paymentIntent = event.data?.object || event.data;

    if (!paymentIntent || !paymentIntent.id) {
      console.warn('Invalid webhook payload: missing payment intent');
      return res.status(400).json({ error: 'Invalid payload' });
    }

    const paymentIntentId = paymentIntent.id;
    const merchantOrderId = paymentIntent.merchant_order_id;

    console.log(`Received webhook: ${eventType} for PaymentIntent ${paymentIntentId}, Order ${merchantOrderId}`);

    // Find order by merchant_order_id or paymentIntentId
    let order = null;
    let orderKey = null;

    for (const [key, value] of orders.entries()) {
      if (value.merchantOrderId === merchantOrderId || value.paymentIntentId === paymentIntentId) {
        order = value;
        orderKey = key;
        break;
      }
    }

    if (!order) {
      console.warn(`Order not found for PaymentIntent ${paymentIntentId} / merchant_order_id ${merchantOrderId}`);
      return res.status(404).json({ error: 'Order not found' });
    }

    // Idempotency: skip if already processed
    const processedEvents = order.processedEvents || [];
    const eventId = event.id || `${eventType}_${paymentIntentId}_${Date.now()}`;
    if (processedEvents.includes(eventId)) {
      console.log(`Event ${eventId} already processed, skipping`);
      return res.json({ received: true });
    }

    // Handle different event types
    switch (eventType) {
      case 'payment_intent.succeeded':
        if (order.status !== 'PAID') {
          updateOrderStatus(orderKey, 'PAID', paymentIntentId);
          order.processedEvents = [...processedEvents, eventId];
          orders.set(orderKey, order);
          console.log(`Order ${merchantOrderId} marked as PAID`);
        }
        break;

      case 'payment_intent.failed':
        if (order.status !== 'FAILED') {
          updateOrderStatus(orderKey, 'FAILED', paymentIntentId);
          order.processedEvents = [...processedEvents, eventId];
          orders.set(orderKey, order);
          console.log(`Order ${merchantOrderId} marked as FAILED`);
        }
        break;

      case 'payment_intent.canceled':
        if (order.status !== 'CANCELED') {
          updateOrderStatus(orderKey, 'CANCELED', paymentIntentId);
          order.processedEvents = [...processedEvents, eventId];
          orders.set(orderKey, order);
          console.log(`Order ${merchantOrderId} marked as CANCELED`);
        }
        break;

      case 'payment_intent.requires_action':
      case 'payment_intent.processing':
        if (order.status === 'PENDING') {
          updateOrderStatus(orderKey, 'REQUIRES_CUSTOMER_ACTION', paymentIntentId);
          order.processedEvents = [...processedEvents, eventId];
          orders.set(orderKey, order);
          console.log(`Order ${merchantOrderId} requires customer action`);
        }
        break;

      default:
        console.log(`Unhandled event type: ${eventType}`);
    }

    res.json({ received: true });

  } catch (error) {
    console.error('Webhook processing error:', error.message);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, '0.0.0.0', () => console.log(`Server running on http://localhost:${port}`));
