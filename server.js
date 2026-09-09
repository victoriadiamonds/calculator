const express = require('express');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const cors = require('cors');
const { Airwallex } = require('@airwallex/node-sdk');
require('dotenv').config();
const pricing = require('./pricing');

function normalizeAirwallexEnvironment(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'production' || normalized === 'prod') return 'production';
  if (normalized === 'sandbox' || normalized === 'demo') return 'sandbox';
  return 'sandbox';
}

const app = express();
app.use(cors({
  origin: ['https://victoriadiamonds.github.io', 'http://localhost:3000'],
  credentials: true
}));
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
    console.log('[DEBUG] Using Airwallex client config:', {
      clientId: AIRWALLEX_CLIENT_ID ? 'SET' : 'NOT SET',
      apiKey: AIRWALLEX_API_KEY ? 'SET' : 'NOT SET',
      env: AIRWALLEX_SDK_ENV
    });

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
    console.error('[DEBUG] Error response status:', error.response?.status);
    console.error('[DEBUG] Error response data:', JSON.stringify(error.response?.data, null, 2));
    console.error('[DEBUG] Error response headers:', error.response?.headers);
    res.status(500).json({ 
      error: 'Failed to retrieve PaymentIntent', 
      details: error.response?.data || error.message 
    });
  }
});

const AIRWALLEX_CLIENT_ID = process.env.AIRWALLEX_CLIENT_ID;
const AIRWALLEX_API_KEY = process.env.AIRWALLEX_API_KEY;
const AIRWALLEX_WEBHOOK_SECRET = process.env.AIRWALLEX_WEBHOOK_SECRET;
const AIRWALLEX_ENV = normalizeAirwallexEnvironment(process.env.AIRWALLEX_ENV);
const AIRWALLEX_SDK_ENV = AIRWALLEX_ENV === 'production' ? 'prod' : 'demo';

function logAirwallexStartupDiagnostics() {
  console.log('[Airwallex Startup] clientId:', AIRWALLEX_CLIENT_ID ? 'SET' : 'NOT SET');
  console.log('[Airwallex Startup] apiKey:', AIRWALLEX_API_KEY ? 'SET' : 'NOT SET');
  console.log('[Airwallex Startup] selected environment:', AIRWALLEX_ENV);
}

const indexHtmlPath = path.join(__dirname, 'index.html');
const indexTemplate = fs.readFileSync(indexHtmlPath, 'utf8');
const injectedIndexHtml = indexTemplate.replace("window.AIRWALLEX_ENV = 'sandbox';", `window.AIRWALLEX_ENV = '${AIRWALLEX_ENV}';`);

app.get(['/', '/index.html'], (req, res) => {
  res.send(injectedIndexHtml);
});

// Serve static files (the calculator)
app.use(express.static(path.join(__dirname)));

// Initialize Airwallex Client
const airwallexClient = new Airwallex({
  clientId: AIRWALLEX_CLIENT_ID,
  apiKey: AIRWALLEX_API_KEY,
  env: AIRWALLEX_SDK_ENV
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
    console.log('[CREATE] PaymentIntent full response:', JSON.stringify(paymentIntentResponse, null, 2));
    console.log('[CREATE] Using Airwallex client config:', {
      clientId: AIRWALLEX_CLIENT_ID ? 'SET' : 'NOT SET',
      apiKey: AIRWALLEX_API_KEY ? 'SET' : 'NOT SET',
      env: AIRWALLEX_SDK_ENV
    });

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

// Create Payment Link endpoint
app.post('/create-payment-link', async (req, res) => {
  try {
    console.log('[PaymentLink] ===== CREATE PAYMENT LINK REQUEST =====');
    console.log('[PaymentLink] Environment:', AIRWALLEX_ENV);
    console.log('[PaymentLink] Credentials:', {
      clientId: AIRWALLEX_CLIENT_ID ? 'SET' : 'NOT SET',
      apiKey: AIRWALLEX_API_KEY ? 'SET' : 'NOT SET'
    });
    console.log('[PaymentLink] Request body keys:', Object.keys(req.body));

    if (!AIRWALLEX_CLIENT_ID || !AIRWALLEX_API_KEY) {
      console.error('[PaymentLink] ERROR: Missing Airwallex credentials');
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
      console.error('[PaymentLink] ERROR: Missing required fields');
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
      console.error('[PaymentLink] ERROR: Invalid email format');
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Compute pricing server-side (same as PaymentIntent)
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
      console.error('[PaymentLink] ERROR: Invalid product or configuration');
      return res.status(400).json({ error: 'Invalid product or configuration' });
    }

    if (pricingResult.priceOnRequest) {
      console.error('[PaymentLink] ERROR: Price on request');
      return res.status(400).json({ error: 'This item is priced on request and cannot be paid online' });
    }

    const amount = Math.round(pricingResult.finalTotal * 100) / 100; // GBP with 2 decimal places

    if (amount <= 0) {
      console.error('[PaymentLink] ERROR: Invalid amount');
      return res.status(400).json({ error: 'Invalid amount' });
    }

    // Generate unique merchant order ID
    const merchantOrderId = generateMerchantOrderId();
    const requestId = uuidv4();

    console.log('[PaymentLink] Order details:', {
      requestId,
      merchantOrderId,
      amount,
      currency: 'GBP',
      productId,
      collection,
      customerEmail
    });

    const firstName = customerName.split(/\s+/, 1)[0];
    const lastName = customerName.split(/\s+/).slice(1).join(' ') || undefined;

    // Create Payment Link
    const paymentLinkData = {
      amount: amount,
      currency: 'GBP',
      title: `Victoria Diamonds — ${pricingResult.prod.name}`,
      description: `Order ${merchantOrderId}`,
      reference: merchantOrderId,
      reusable: false,
      metadata: {
        collection: collection,
        product_id: productId,
        product_name: pricingResult.prod.name,
        quantity: String(pricingResult.qty),
        customer_email: customerEmail,
        customer_name: customerName,
        merchant_order_id: merchantOrderId
      },
      customer: {
        email: customerEmail,
        first_name: firstName,
        last_name: lastName
      }
    };

    console.log('[PaymentLink] Creating Payment Link:', JSON.stringify(paymentLinkData, null, 2));

    // Use the existing airwallexClient which handles OAuth2 Bearer token authentication automatically
    // This matches the working PaymentIntent flow authentication
    console.log('[PaymentLink] Calling Airwallex Payment Links API via SDK client');

    // Create Payment Link
    const createResponse = await airwallexClient.post('/api/v1/pa/payment_links/create', paymentLinkData);

    console.log('[PaymentLink] SDK create response:', JSON.stringify(createResponse, null, 2));

    // SDK post() may return parsed data directly (like specific SDK methods) or axios-style response
    const paymentLink = createResponse.data || createResponse;
    const paymentLinkId = paymentLink?.id;
    const paymentLinkUrl = paymentLink?.url;
    const paymentLinkStatus = paymentLink?.status;

    if (!paymentLinkId || !paymentLinkUrl) {
      console.error('[PaymentLink] ERROR: Invalid payment link response - missing id or url');
      console.error('[PaymentLink] Full response:', JSON.stringify(createResponse, null, 2));
      throw new Error('Invalid payment link response from Airwallex');
    }

    console.log('[PaymentLink] Created:', paymentLinkId, paymentLinkUrl, 'Status:', paymentLinkStatus);

    // Send notification email to shopper
    console.log('[PaymentLink] Sending email notification to:', customerEmail);
    const notifyResponse = await airwallexClient.post(
      `/api/v1/pa/payment_links/${paymentLinkId}/notify_shopper`,
      { shopper_email: customerEmail }
    );

    console.log('[PaymentLink] SDK notify response:', JSON.stringify(notifyResponse, null, 2));
    console.log('[PaymentLink] Email notification sent');

    // Store order (similar to PaymentIntent but with paymentLinkId)
    storeOrder(merchantOrderId, {
      paymentLinkId,
      paymentLinkUrl,
      amount,
      currency: 'GBP',
      customerName,
      customerEmail,
      product: pricingResult.prod,
      collection,
      pricing: pricingResult
    });

    console.log('[PaymentLink] ===== CREATE PAYMENT LINK SUCCESS =====');
    res.json({
      paymentLinkId,
      paymentLinkUrl,
      merchantOrderId,
      amount,
      currency: 'GBP'
    });

  } catch (error) {
    console.error('[PaymentLink] ===== CREATE PAYMENT LINK ERROR =====');
    console.error('[PaymentLink] Error message:', error.message);
    console.error('[PaymentLink] Error response status:', error.response?.status);
    console.error('[PaymentLink] Error response statusText:', error.response?.statusText);
    console.error('[PaymentLink] Error response headers:', JSON.stringify(error.response?.headers, null, 2));
    console.error('[PaymentLink] Error response data:', JSON.stringify(error.response?.data, null, 2));
    console.error('[PaymentLink] Request config URL:', error.config?.url);
    console.error('[PaymentLink] Request config method:', error.config?.method);
    console.error('[PaymentLink] Request config data:', error.config?.data ? JSON.stringify(error.config.data, null, 2) : 'undefined');
    
    // Return actual Airwallex error to frontend for diagnosis (temporary)
    const airwallexError = error.response?.data;
    let errorMessage = 'Failed to create payment link';
    if (airwallexError) {
      // Extract safe error message from Airwallex response
      if (airwallexError.message) {
        errorMessage = `Airwallex: ${airwallexError.message}`;
      } else if (airwallexError.error) {
        errorMessage = `Airwallex: ${airwallexError.error}`;
      } else if (airwallexError.code) {
        errorMessage = `Airwallex error code: ${airwallexError.code}`;
      } else {
        errorMessage = `Airwallex error: ${JSON.stringify(airwallexError).slice(0, 200)}`;
      }
    }
    res.status(500).json({ error: errorMessage, details: airwallexError || error.message });
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
    
    // Handle both payment_intent and payment_link webhook payloads
    const paymentLink = event.data?.object || event.data;
    const paymentIntent = event.data?.object || event.data;

    let paymentLinkId = null;
    let paymentIntentId = null;
    let merchantOrderId = null;

    if (eventType.startsWith('payment_link.')) {
      // Payment Link webhook
      paymentLinkId = paymentLink.id;
      merchantOrderId = paymentLink.reference;
      console.log(`Received webhook: ${eventType} for PaymentLink ${paymentLinkId}, Order ${merchantOrderId}`);
    } else {
      // PaymentIntent webhook (existing)
      paymentIntentId = paymentIntent.id;
      merchantOrderId = paymentIntent.merchant_order_id;
      console.log(`Received webhook: ${eventType} for PaymentIntent ${paymentIntentId}, Order ${merchantOrderId}`);
    }

    // Find order by merchant_order_id, paymentLinkId, or paymentIntentId
    let order = null;
    let orderKey = null;

    for (const [key, value] of orders.entries()) {
      if (value.merchantOrderId === merchantOrderId || 
          value.paymentLinkId === paymentLinkId || 
          value.paymentIntentId === paymentIntentId) {
        order = value;
        orderKey = key;
        break;
      }
    }

    if (!order) {
      console.warn(`Order not found for PaymentLink ${paymentLinkId} / PaymentIntent ${paymentIntentId} / merchant_order_id ${merchantOrderId}`);
      return res.status(404).json({ error: 'Order not found' });
    }

    // Idempotency: skip if already processed
    const processedEvents = order.processedEvents || [];
    const eventId = event.id || `${eventType}_${paymentLinkId || paymentIntentId}_${Date.now()}`;
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

      case 'payment_link.paid':
        // Supplementary event: log and associate paymentLinkId, but do NOT mark PAID here.
        // The authoritative event for marking PAID is payment_intent.succeeded (fired for the underlying PaymentIntent).
        if (!order.paymentLinkId && paymentLinkId) {
          order.paymentLinkId = paymentLinkId;
          order.processedEvents = [...processedEvents, eventId];
          orders.set(orderKey, order);
          console.log(`Order ${merchantOrderId}: associated paymentLinkId ${paymentLinkId} via payment_link.paid`);
        }
        break;

      case 'payment_link.expired':
      case 'payment_link.canceled':
        // These can mark CANCELED if order is still PENDING (no payment_intent.succeeded will come)
        if (order.status === 'PENDING') {
          updateOrderStatus(orderKey, 'CANCELED', paymentIntentId);
          order.processedEvents = [...processedEvents, eventId];
          orders.set(orderKey, order);
          console.log(`Order ${merchantOrderId} marked as CANCELED via payment_link.${eventType.split('.')[1]}`);
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
logAirwallexStartupDiagnostics();
app.listen(port, '0.0.0.0', () => console.log(`Server running on http://localhost:${port}`));
