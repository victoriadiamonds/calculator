const express = require('express');
const path = require('path');
const crypto = require('crypto');
const cors = require('cors');
const axios = require('axios');
const PDFDocument = require('pdfkit');
require('dotenv').config();

const pricing = require('./pricing');

const app = express();

app.use(cors({
  origin: [
    'https://victoriadiamonds.github.io',
    'https://victoria-diamonds.com',
    'https://www.victoria-diamonds.com',
    'http://localhost:3000'
  ],
  credentials: true
}));

// Preserve the exact raw body for webhook signature verification.
app.use(express.json({
  verify: (req, res, buffer) => {
    if (req.originalUrl === '/airwallex/webhook') {
      req.rawBody = Buffer.from(buffer);
    }
  }
}));

app.use(express.static(path.join(__dirname)));

// =========================
// AIRWALLEX CONFIGURATION
// =========================

const AIRWALLEX_CLIENT_ID = process.env.AIRWALLEX_CLIENT_ID;
const AIRWALLEX_API_KEY = process.env.AIRWALLEX_API_KEY;
const AIRWALLEX_WEBHOOK_SECRET = process.env.AIRWALLEX_WEBHOOK_SECRET;
const AIRWALLEX_ENV = String(process.env.AIRWALLEX_ENV || 'sandbox').toLowerCase();

const IS_PRODUCTION =
  AIRWALLEX_ENV === 'production' ||
  AIRWALLEX_ENV === 'prod';

const AIRWALLEX_BASE_URL = IS_PRODUCTION
  ? 'https://api.airwallex.com'
  : 'https://api.sandbox.airwallex.com';

// Airwallex access tokens are reusable until expiry.
let cachedAccessToken = null;
let cachedTokenExpiresAt = 0;

function hasAirwallexCredentials() {
  return Boolean(
    AIRWALLEX_CLIENT_ID &&
    AIRWALLEX_API_KEY
  );
}

function safeAirwallexError(error) {
  const status = error.response?.status || null;
  const data = error.response?.data;

  if (data && typeof data === 'object') {
    return {
      status,
      code: data.code || data.error || null,
      message:
        data.message ||
        data.error_description ||
        error.message
    };
  }

  return {
    status,
    code: null,
    message:
      error.message ||
      'Unknown Airwallex error'
  };
}

// =========================
// AIRWALLEX AUTHENTICATION
// =========================

async function getAirwallexAccessToken(forceRefresh = false) {
  if (!hasAirwallexCredentials()) {
    throw new Error(
      'Airwallex credentials are missing on the server'
    );
  }

  const now = Date.now();

  // Refresh one minute before expiry.
  if (
    !forceRefresh &&
    cachedAccessToken &&
    cachedTokenExpiresAt > now + 60 * 1000
  ) {
    return cachedAccessToken;
  }

  const response = await axios.post(
    `${AIRWALLEX_BASE_URL}/api/v1/authentication/login`,
    {},
    {
      timeout: 20000,
      headers: {
        'Content-Type': 'application/json',
        'x-client-id': AIRWALLEX_CLIENT_ID,
        'x-api-key': AIRWALLEX_API_KEY
      }
    }
  );

  const token = response.data?.token;
  const expiresAt = response.data?.expires_at;

  if (!token) {
    throw new Error(
      'Airwallex authentication did not return an access token'
    );
  }

  const parsedExpiry = expiresAt
    ? Date.parse(expiresAt)
    : NaN;

  cachedAccessToken = token;

  cachedTokenExpiresAt = Number.isFinite(parsedExpiry)
    ? parsedExpiry
    : Date.now() + 25 * 60 * 1000;

  console.log(
    '[Airwallex] Access token obtained successfully:',
    {
      environment: IS_PRODUCTION
        ? 'production'
        : 'sandbox',
      expiresAt: expiresAt || 'estimated'
    }
  );

  return cachedAccessToken;
}

// =========================
// AIRWALLEX API REQUEST
// =========================

async function airwallexRequest(
  method,
  endpoint,
  data = undefined,
  retried = false
) {
  const token = await getAirwallexAccessToken(retried);

  try {
    const response = await axios({
      method,
      url: `${AIRWALLEX_BASE_URL}${endpoint}`,
      data,
      timeout: 25000,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    return response.data;

  } catch (error) {

    // If token expired or became invalid,
    // authenticate once more and retry.
    if (
      error.response?.status === 401 &&
      !retried
    ) {
      console.warn(
        '[Airwallex] Received 401. Refreshing access token and retrying once.'
      );

      cachedAccessToken = null;
      cachedTokenExpiresAt = 0;

      return airwallexRequest(
        method,
        endpoint,
        data,
        true
      );
    }

    throw error;
  }
}

// =========================
// ORDER HELPERS
// =========================

const orders = new Map();

function generateMerchantOrderId() {
  const date = new Date();

  const dateStr = date
    .toISOString()
    .slice(0, 10)
    .replace(/-/g, '');

  const random = crypto
    .randomBytes(5)
    .toString('hex')
    .toUpperCase();

  return `VD-${dateStr}-${random}`;
}

function storeOrder(
  merchantOrderId,
  orderData
) {
  orders.set(merchantOrderId, {
    ...orderData,
    merchantOrderId,
    status: 'PENDING',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
}

function updateOrderStatus(
  merchantOrderId,
  status,
  paymentIntentId = null
) {
  const order = orders.get(merchantOrderId);

  if (!order) return;

  order.status = status;

  if (paymentIntentId) {
    order.paymentIntentId = paymentIntentId;
  }

  order.updatedAt = new Date().toISOString();

  orders.set(
    merchantOrderId,
    order
  );
}

// =========================
// WEBHOOK SIGNATURE
// =========================

function verifyWebhookSignature(
  rawPayload,
  timestamp,
  signature
) {
  if (
    !AIRWALLEX_WEBHOOK_SECRET ||
    !rawPayload ||
    !timestamp ||
    !signature
  ) {
    return false;
  }

  const expectedSignature = crypto
    .createHmac(
      'sha256',
      AIRWALLEX_WEBHOOK_SECRET
    )
    .update(
      `${timestamp}${rawPayload.toString('utf8')}`
    )
    .digest('hex');

  const received = Buffer.from(
    String(signature),
    'utf8'
  );

  const expected = Buffer.from(
    expectedSignature,
    'utf8'
  );

  return (
    received.length === expected.length &&
    crypto.timingSafeEqual(
      received,
      expected
    )
  );
}

// =========================
// PRICING PARAMETERS
// =========================

function buildPricingParams(body) {
  return {
    collection: body.collection,
    productId: body.productId,
    typeFilter: body.typeFilter || 'all',

    braceletMetalTier:
      body.braceletMetalTier ||
      body.braceletTier ||
      body.braceletTierKey ||
      'essential',

    metal: body.metal,

    karat:
      Number(body.karat) || 18,

    purity:
      Number(body.purity) || 999,

    diamonds:
      Array.isArray(body.diamonds)
        ? body.diamonds
        : [],

    quantity:
      Number(body.quantity) || 1,

    discount:
      Number(body.discount) || 0,

    profit:
      Number(body.profit) || 0,

    designFee:
      Number(body.designFee) || 0
  };
}

// =========================
// CHECKOUT VALIDATION
// =========================

function validateCheckoutRequest(body) {

  const required = [
    'productId',
    'collection',
    'metal',
    'customerName',
    'customerEmail'
  ];

  for (const key of required) {

    if (
      !body[key] ||
      !String(body[key]).trim()
    ) {
      return `Missing required field: ${key}`;
    }
  }

  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      String(body.customerEmail).trim()
    )
  ) {
    return 'Invalid email address';
  }

  // Validate payment percentage if provided
  if (body.paymentPercentage !== undefined && body.paymentPercentage !== null) {
    const percentage = Number(body.paymentPercentage);
    if (!Number.isFinite(percentage) || percentage < 30 || percentage > 100) {
      return 'Payment percentage must be between 30 and 100';
    }
  }

  return null;
}

// =========================
// HEALTH CHECK
// =========================

app.get('/health', (req, res) => {

  res.json({
    status: 'ok',

    environment:
      IS_PRODUCTION
        ? 'production'
        : 'sandbox',

    timestamp:
      new Date().toISOString()
  });

});

// =========================
// CREATE + EMAIL PAYMENT LINK
// =========================

app.post(
  '/create-payment-link',
  async (req, res) => {

    console.log(
      '[PaymentLink] ===== NEW REQUEST ====='
    );

    try {

      if (!hasAirwallexCredentials()) {

        console.error(
          '[PaymentLink] Airwallex credentials are missing'
        );

        return res.status(503).json({
          error:
            'Payments are temporarily unavailable. Please contact us.'
        });
      }

      const validationError =
        validateCheckoutRequest(req.body);

      if (validationError) {

        return res.status(400).json({
          error: validationError
        });
      }

      const customerName =
        String(
          req.body.customerName
        ).trim();

      const customerEmail =
        String(
          req.body.customerEmail
        )
          .trim()
          .toLowerCase();

      // IMPORTANT:
      // Price is always recalculated on the server.
      const pricingResult =
        pricing.computePricing(
          buildPricingParams(req.body)
        );

      if (!pricingResult) {

        return res.status(400).json({
          error:
            'Invalid product or configuration'
        });
      }

      if (pricingResult.priceOnRequest) {

        return res.status(400).json({
          error:
            'This item is priced on request and cannot be paid online.'
        });
      }

      // Calculate payment amount based on percentage (30-100%, default 100%)
      const paymentPercentage = Math.max(30, Math.min(100, Number(req.body.paymentPercentage) || 100));
      const fullAmount = Math.round(Number(pricingResult.finalTotal) * 100) / 100;
      const amount = Math.round(fullAmount * (paymentPercentage / 100) * 100) / 100;

      if (
        !Number.isFinite(amount) ||
        amount <= 0
      ) {

        return res.status(400).json({
          error: 'Invalid order amount'
        });
      }

      const merchantOrderId =
        generateMerchantOrderId();

      const isDeposit = paymentPercentage < 100;
      const paymentTypeLabel = isDeposit ? `Deposit (${paymentPercentage}%)` : 'Full Payment';

      const paymentLinkData = {

        amount,

        currency: 'GBP',

        reusable: false,

        title:
          `Victoria Diamonds — ${pricingResult.prod.name} — ${paymentTypeLabel}`,

        description:
          `${paymentTypeLabel} for order ${merchantOrderId}`,

        reference:
          merchantOrderId,

        metadata: {

          merchant_order_id:
            merchantOrderId,

          collection:
            String(req.body.collection),

          product_id:
            String(req.body.productId),

          product_name:
            String(pricingResult.prod.name),

          customer_email:
            customerEmail,

          bracelet_tier:
            String(
              req.body.braceletMetalTier ||
              pricingResult.braceletTierKey ||
              ''
            ),

          payment_percentage:
            String(paymentPercentage),

          is_deposit:
            String(isDeposit),

          full_amount:
            String(fullAmount)
        },

        collectable_shopper_info: {

          message: false,

          phone_number: false,

          reference: false,

          shipping_address: false,

          billing_address: false
        }
      };

      console.log(
        '[PaymentLink] Creating link:',
        {
          environment:
            IS_PRODUCTION
              ? 'production'
              : 'sandbox',

          merchantOrderId,

          amount,

          fullAmount,

          paymentPercentage,

          currency: 'GBP',

          customerEmail,

          product:
            pricingResult.prod.name
        }
      );

      // Create Airwallex Payment Link
      const paymentLink =
        await airwallexRequest(
          'post',
          '/api/v1/pa/payment_links/create',
          paymentLinkData
        );

      const paymentLinkId =
        paymentLink?.id;

      const paymentLinkUrl =
        paymentLink?.url;

      if (
        !paymentLinkId ||
        !paymentLinkUrl
      ) {

        console.error(
          '[PaymentLink] Unexpected create response:',
          paymentLink
        );

        throw new Error(
          'Airwallex did not return a valid payment link'
        );
      }

      console.log(
        '[PaymentLink] Link created successfully:',
        paymentLinkId
      );

      // Ask Airwallex to email
      // the secure payment link directly
      // to the shopper.
      await airwallexRequest(
        'post',

        `/api/v1/pa/payment_links/${encodeURIComponent(
          paymentLinkId
        )}/notify_shopper`,

        {
          shopper_email:
            customerEmail
        }
      );

      console.log(
        '[PaymentLink] Shopper notification sent:',
        customerEmail
      );

      storeOrder(
        merchantOrderId,
        {

          paymentLinkId,

          paymentLinkUrl,

          amount,

          fullAmount,

          paymentPercentage,

          isDeposit,

          currency: 'GBP',

          customerName,

          customerEmail,

          product:
            pricingResult.prod,

          collection:
            req.body.collection,

          pricing:
            pricingResult
        }
      );

      return res.status(200).json({

        success: true,

        paymentLinkId,

        merchantOrderId,

        amount,

        fullAmount,

        paymentPercentage,

        isDeposit,

        currency: 'GBP',

        message:
          isDeposit
            ? `Deposit payment link (${paymentPercentage}%) sent successfully.`
            : 'Payment link sent successfully.'
      });

    } catch (error) {

      const details =
        safeAirwallexError(error);

      console.error(
        '[PaymentLink] FAILED:',
        {

          status:
            details.status,

          code:
            details.code,

          message:
            details.message
        }
      );

      // Never expose credentials,
      // access tokens or internal
      // configuration to the browser.

      if (details.status === 401) {

        return res.status(502).json({
          error:
            'Payment provider authentication failed. Please contact Victoria Diamonds.'
        });
      }

      if (details.status === 403) {

        return res.status(502).json({
          error:
            'Payment provider access is not enabled for this API key. Please contact Victoria Diamonds.'
        });
      }

      if (
        details.status &&
        details.status >= 400 &&
        details.status < 500
      ) {

        return res.status(400).json({
          error:
            details.message ||
            'The payment link could not be created.'
        });
      }

      return res.status(500).json({
        error:
          'Unable to create the payment link right now. Please try again.'
      });
    }
  }
);

// =========================
// AIRWALLEX WEBHOOK
// =========================

app.post(
  '/airwallex/webhook',
  async (req, res) => {

    try {

      const signature =
        req.headers['x-signature'];

      const timestamp =
        req.headers['x-timestamp'];

      if (AIRWALLEX_WEBHOOK_SECRET) {

        if (
          !verifyWebhookSignature(
            req.rawBody,
            timestamp,
            signature
          )
        ) {

          console.warn(
            '[Webhook] Invalid Airwallex signature'
          );

          return res.status(401).json({
            error:
              'Invalid signature'
          });
        }
      }

      const event =
        req.body || {};

      const eventType =
        event.type || 'unknown';

      const object =
        event.data?.object ||
        event.data ||
        {};

      const paymentIntentId =
        object.id || null;

      const merchantOrderId =
        object.merchant_order_id ||
        object.reference ||
        null;

      console.log(
        '[Webhook] Received:',
        {

          eventType,

          merchantOrderId,

          paymentIntentId
        }
      );

      if (
        merchantOrderId &&
        orders.has(merchantOrderId)
      ) {

        if (
          eventType ===
          'payment_intent.succeeded'
        ) {

          updateOrderStatus(
            merchantOrderId,
            'PAID',
            paymentIntentId
          );

        } else if (
          eventType ===
          'payment_intent.failed'
        ) {

          updateOrderStatus(
            merchantOrderId,
            'FAILED',
            paymentIntentId
          );

        } else if (
          eventType ===
          'payment_intent.canceled'
        ) {

          updateOrderStatus(
            merchantOrderId,
            'CANCELED',
            paymentIntentId
          );
        }

      } else if (merchantOrderId) {

        // Render can restart/sleep,
        // so in-memory orders may disappear.
        // Still acknowledge webhook.

        console.warn(
          '[Webhook] Order not present in memory:',
          merchantOrderId
        );
      }

      return res.status(200).json({
        received: true
      });

    } catch (error) {

      console.error(
        '[Webhook] Processing failed:',
        error.message
      );

      return res.status(500).json({
        error:
          'Webhook processing failed'
      });
    }
  }
);

// =========================
// RECEIPT HELPERS
// =========================

function formatCurrency(value) {
  return '£' + Math.round(Number(value) || 0).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });
}

function formatCurrencyDecimal(value) {
  const rounded = Math.round(Number(value) * 100) / 100;
  return '£' + rounded.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function getCollectionDisplayName(collection) {
  const names = {
    dailySparkle: 'Daily Sparkle',
    occasionWear: 'Occasion Wear',
    foreverBond: 'Forever Bond',
    singleLady: 'Single Lady Collection'
  };
  return names[collection] || collection;
}

function getTierDisplayName(tierKey) {
  const tiers = {
    essential: 'Essential',
    signature: 'Signature',
    atelier: 'Atelier',
    premium: 'Premium',
    supreme: 'Supreme',
    essentials: 'Essentials'
  };
  return tiers[tierKey] || tierKey;
}

function generateOrderReceiptHTML(order) {
  const { merchantOrderId, amount, fullAmount, paymentPercentage, isDeposit, currency, customerName, customerEmail, product, collection, pricing, createdAt } = order;
  const isFullPayment = !isDeposit || paymentPercentage === 100;
  const amountDue = amount;
  const depositLabel = isDeposit ? `Deposit (${paymentPercentage}%)` : 'Full Payment';
  
  const date = new Date(createdAt).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'long', year: 'numeric'
  });

  const diamondRows = [];
  if (pricing && pricing.entries) {
    pricing.entries.forEach((entry, idx) => {
      if (entry.caratNum > 0) {
        const qualityLabel = entry.quality === 'luxe' ? 'Luxe' : entry.quality === 'select' ? 'Select' : entry.quality;
        diamondRows.push(`
          <tr>
            <td>${['Main Diamond', 'Diamond 2', 'Diamond 3', 'Diamond 4'][idx]}</td>
            <td>${qualityLabel}</td>
            <td>${entry.carat} ct</td>
            <td>× ${entry.qty}</td>
            <td>${entry.unpriced ? 'Price on request' : formatCurrency(entry.total)}</td>
          </tr>
        `);
      }
    });
  }

  const metalLabel = product.metal === 'gold' 
    ? `${pricing.karat || 18}K Gold` 
    : product.metal === 'silver' 
      ? `${pricing.purity || 925} Silver` 
      : 'Platinum';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Order Receipt - ${merchantOrderId}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; color: #333; }
    .receipt { max-width: 800px; margin: 0 auto; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    .header { text-align: center; border-bottom: 2px solid #b8860b; padding-bottom: 20px; margin-bottom: 30px; }
    .logo { font-size: 28px; font-weight: 300; letter-spacing: 4px; color: #2c2c2c; margin-bottom: 8px; }
    .tagline { font-size: 14px; color: #888; letter-spacing: 2px; text-transform: uppercase; }
    .receipt-type { display: inline-block; background: ${isDeposit ? '#fff3e0' : '#e8f5e9'}; color: ${isDeposit ? '#e65100' : '#2e7d32'}; padding: 6px 16px; border-radius: 4px; font-size: 14px; font-weight: 600; margin-top: 16px; }
    .details-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 30px; }
    .detail-item { background: #fafafa; padding: 16px; border-radius: 6px; border: 1px solid #eee; }
    .detail-label { font-size: 12px; color: #888; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; }
    .detail-value { font-size: 15px; color: #333; }
    .section-title { font-size: 16px; font-weight: 600; color: #2c2c2c; margin: 30px 0 16px; padding-bottom: 8px; border-bottom: 1px solid #eee; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #eee; font-size: 14px; }
    th { background: #fafafa; color: #888; font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; }
    .totals { background: #fafafa; padding: 20px; border-radius: 6px; border: 1px solid #eee; margin-top: 20px; }
    .total-row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 15px; }
    .total-row.final { border-top: 2px solid #b8860b; margin-top: 12px; padding-top: 16px; font-size: 18px; font-weight: 600; color: #2c2c2c; }
    .total-row.deposit { color: #e65100; }
    .actions { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; }
    .btn { display: inline-block; padding: 12px 24px; background: #b8860b; color: white; text-decoration: none; border-radius: 4px; font-weight: 500; margin: 0 8px; transition: background 0.2s; }
    .btn:hover { background: #9a7209; }
    .btn-secondary { background: #666; }
    .btn-secondary:hover { background: #555; }
    @media print { .actions { display: none; } body { background: white; } .receipt { box-shadow: none; padding: 0; } }
  </style>
</head>
<body>
  <div class="receipt">
    <div class="header">
      <div class="logo">VICTORIA DIAMONDS</div>
      <div class="tagline">Luxury Jewellery</div>
      <div class="receipt-type">ORDER RECEIPT — ${depositLabel}</div>
    </div>

    <div class="details-grid">
      <div class="detail-item">
        <div class="detail-label">Order Reference</div>
        <div class="detail-value">${merchantOrderId}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Date</div>
        <div class="detail-value">${date}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Customer</div>
        <div class="detail-value">${customerName}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Email</div>
        <div class="detail-value">${customerEmail}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Collection</div>
        <div class="detail-value">${getCollectionDisplayName(collection)}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Product</div>
        <div class="detail-value">${product.name}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Metal</div>
        <div class="detail-value">${metalLabel}</div>
      </div>
      ${pricing && pricing.braceletTier ? `
      <div class="detail-item">
        <div class="detail-label">Bracelet Spec</div>
        <div class="detail-value">${pricing.braceletTier.label} — ${pricing.braceletTier.weight}</div>
      </div>
      ` : ''}
    </div>

    ${diamondRows.length > 0 ? `
    <h3 class="section-title">Diamond Details</h3>
    <table>
      <thead>
        <tr>
          <th>Section</th>
          <th>Quality</th>
          <th>Carat</th>
          <th>Qty</th>
          <th>Total</th>
        </tr>
      </thead>
      <tbody>
        ${diamondRows.join('')}
      </tbody>
    </table>
    ` : ''}

    <div class="totals">
      <h3 class="section-title" style="margin-top:0">Price Summary</h3>
      <div class="total-row">
        <span>Design / Labour Fee</span>
        <span>${formatCurrency(pricing?.designComplexityFee || 0)}</span>
      </div>
      <div class="total-row">
        <span>Diamond Total</span>
        <span>${formatCurrency(pricing?.diamondPrice || 0)}</span>
      </div>
      ${pricing && pricing.designFee > 0 ? `
      <div class="total-row">
        <span>Design Customization</span>
        <span>${formatCurrency(pricing.designFee)}</span>
      </div>
      ` : ''}
      <div class="total-row">
        <span>Subtotal</span>
        <span>${formatCurrency(pricing?.subtotal || 0)}</span>
      </div>
      ${pricing && pricing.profitPct > 0 ? `
      <div class="total-row">
        <span>Profit (${pricing.profitPct}%)</span>
        <span>${formatCurrency(pricing.profitAmount)}</span>
      </div>
      ` : ''}
      ${pricing && pricing.discount > 0 ? `
      <div class="total-row">
        <span>Discount (${pricing.discount}%)</span>
        <span>−${formatCurrency(pricing.discountAmount)}</span>
      </div>
      ` : ''}
      <div class="total-row final">
        <span>Order Total (${depositLabel})</span>
        <span>${formatCurrency(amountDue)}</span>
      </div>
      ${isDeposit ? `
      <div class="total-row deposit">
        <span>Full Amount (100%)</span>
        <span>${formatCurrency(fullAmount)}</span>
      </div>
      <div class="total-row deposit">
        <span>Balance Remaining</span>
        <span>${formatCurrency(fullAmount - amountDue)}</span>
      </div>
      ` : ''}
    </div>

    <div class="actions">
      <a href="?format=pdf" class="btn">Download PDF</a>
      <a href="/payment-receipt/${merchantOrderId}" class="btn btn-secondary">View Payment Receipt</a>
    </div>
  </div>
</body>
</html>
  `;
}

function generatePaymentReceiptHTML(order) {
  const { merchantOrderId, amount, fullAmount, paymentPercentage, isDeposit, currency, customerName, customerEmail, product, collection, pricing, paymentIntentId, updatedAt, status } = order;
  const isPaid = status === 'PAID';
  const depositLabel = isDeposit ? `Deposit (${paymentPercentage}%)` : 'Full Payment';
  
  const date = new Date(updatedAt || createdAt).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'long', year: 'numeric'
  });

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Receipt - ${merchantOrderId}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; color: #333; }
    .receipt { max-width: 800px; margin: 0 auto; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    .header { text-align: center; border-bottom: 2px solid #b8860b; padding-bottom: 20px; margin-bottom: 30px; }
    .logo { font-size: 28px; font-weight: 300; letter-spacing: 4px; color: #2c2c2c; margin-bottom: 8px; }
    .tagline { font-size: 14px; color: #888; letter-spacing: 2px; text-transform: uppercase; }
    .status-badge { display: inline-block; background: ${isPaid ? '#e8f5e9' : '#fff3e0'}; color: ${isPaid ? '#2e7d32' : '#e65100'}; padding: 8px 20px; border-radius: 4px; font-size: 14px; font-weight: 600; margin-top: 16px; }
    .details-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 30px; }
    .detail-item { background: #fafafa; padding: 16px; border-radius: 6px; border: 1px solid #eee; }
    .detail-label { font-size: 12px; color: #888; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; }
    .detail-value { font-size: 15px; color: #333; }
    .payment-details { background: ${isPaid ? '#e8f5e9' : '#fff8e1'}; border: 1px solid ${isPaid ? '#c8e6c9' : '#ffecb3'}; border-radius: 6px; padding: 24px; margin: 20px 0; }
    .payment-details h3 { margin-top: 0; color: ${isPaid ? '#2e7d32' : '#f57f17'}; }
    .payment-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid ${isPaid ? '#c8e6c9' : '#ffecb3'}; }
    .payment-row:last-child { border-bottom: none; }
    .payment-row.final { font-weight: 700; font-size: 18px; color: ${isPaid ? '#2e7d32' : '#e65100'}; }
    .actions { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; }
    .btn { display: inline-block; padding: 12px 24px; background: #b8860b; color: white; text-decoration: none; border-radius: 4px; font-weight: 500; margin: 0 8px; }
    .btn:hover { background: #9a7209; }
    .btn-secondary { background: #666; }
    @media print { .actions { display: none; } body { background: white; } .receipt { box-shadow: none; padding: 0; } }
  </style>
</head>
<body>
  <div class="receipt">
    <div class="header">
      <div class="logo">VICTORIA DIAMONDS</div>
      <div class="tagline">Luxury Jewellery</div>
      <div class="status-badge">${isPaid ? 'PAYMENT CONFIRMED' : 'PAYMENT PENDING'}</div>
    </div>

    <div class="details-grid">
      <div class="detail-item">
        <div class="detail-label">Order Reference</div>
        <div class="detail-value">${merchantOrderId}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Date</div>
        <div class="detail-value">${date}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Customer</div>
        <div class="detail-value">${customerName}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Email</div>
        <div class="detail-value">${customerEmail}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Payment Type</div>
        <div class="detail-value">${depositLabel}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Payment Intent</div>
        <div class="detail-value">${paymentIntentId || 'N/A'}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Collection</div>
        <div class="detail-value">${getCollectionDisplayName(collection)}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Product</div>
        <div class="detail-value">${product.name}</div>
      </div>
    </div>

    <div class="payment-details">
      <h3>Payment Summary</h3>
      <div class="payment-row">
        <span>Order Total</span>
        <span>${formatCurrency(fullAmount)}</span>
      </div>
      ${isDeposit ? `
      <div class="payment-row">
        <span>Deposit Percentage</span>
        <span>${paymentPercentage}%</span>
      </div>
      <div class="payment-row">
        <span>Deposit Amount</span>
        <span>${formatCurrency(amount)}</span>
      </div>
      <div class="payment-row">
        <span>Balance Remaining</span>
        <span>${formatCurrency(fullAmount - amount)}</span>
      </div>
      ` : ''}
      <div class="payment-row final">
        <span>Amount Paid</span>
        <span>${formatCurrency(amount)}</span>
      </div>
    </div>

    <div class="actions">
      <a href="?format=pdf" class="btn">Download PDF</a>
      <a href="/order-receipt/${merchantOrderId}" class="btn btn-secondary">View Order Receipt</a>
    </div>
  </div>
</body>
</html>
  `;
}

function generateOrderReceiptPDF(order, res) {
  const { merchantOrderId, amount, fullAmount, paymentPercentage, isDeposit, currency, customerName, customerEmail, product, collection, pricing, createdAt } = order;
  const isFullPayment = !isDeposit || paymentPercentage === 100;
  const amountDue = amount;
  const depositLabel = isDeposit ? `Deposit (${paymentPercentage}%)` : 'Full Payment';
  
  const date = new Date(createdAt).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'long', year: 'numeric'
  });

  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="order-receipt-${merchantOrderId}.pdf"`);
  doc.pipe(res);

  // Header
  doc.fontSize(28).font('Helvetica-Bold').text('VICTORIA DIAMONDS', { align: 'center' });
  doc.fontSize(12).font('Helvetica').text('Luxury Jewellery', { align: 'center' });
  doc.moveDown();
  doc.fontSize(12).font('Helvetica-Bold').text(`ORDER RECEIPT — ${depositLabel}`, { align: 'center' });
  doc.moveDown(2);

  // Details
  const details = [
    ['Order Reference', merchantOrderId],
    ['Date', date],
    ['Customer', customerName],
    ['Email', customerEmail],
    ['Collection', getCollectionDisplayName(collection)],
    ['Product', product.name],
    ['Metal', product.metal === 'gold' ? `${pricing.karat || 18}K Gold` : product.metal === 'silver' ? `${pricing.purity || 925} Silver` : 'Platinum']
  ];

  if (pricing && pricing.braceletTier) {
    details.push(['Bracelet Spec', `${pricing.braceletTier.label} — ${pricing.braceletTier.weight}`]);
  }

  let y = doc.y;
  details.forEach(([label, value], i) => {
    const x = i % 2 === 0 ? 50 : 300;
    const rowY = y + Math.floor(i / 2) * 30;
    doc.fontSize(8).font('Helvetica-Bold').text(label, x, rowY, { width: 120 });
    doc.fontSize(10).font('Helvetica').text(value, x, rowY + 12, { width: 220 });
  });
  doc.y = y + Math.ceil(details.length / 2) * 30 + 20;

  // Diamonds
  if (pricing && pricing.entries) {
    doc.fontSize(12).font('Helvetica-Bold').text('Diamond Details');
    doc.moveDown(0.5);
    const diamondEntries = pricing.entries.filter(e => e.caratNum > 0);
    if (diamondEntries.length > 0) {
      diamondEntries.forEach((entry, idx) => {
        const qualityLabel = entry.quality === 'luxe' ? 'Luxe' : entry.quality === 'select' ? 'Select' : entry.quality;
        doc.fontSize(10).font('Helvetica-Bold').text(`${['Main Diamond', 'Diamond 2', 'Diamond 3', 'Diamond 4'][idx]}`);
        doc.fontSize(10).font('Helvetica').text(`  ${qualityLabel}, ${entry.carat} ct × ${entry.qty} = ${entry.unpriced ? 'Price on request' : formatCurrency(entry.total)}`);
      });
      doc.moveDown();
    }
  }

  // Totals
  doc.fontSize(12).font('Helvetica-Bold').text('Price Summary');
  doc.moveDown(0.5);
  
  const totals = [
    ['Design / Labour Fee', formatCurrency(pricing?.designComplexityFee || 0)],
    ['Diamond Total', formatCurrency(pricing?.diamondPrice || 0)],
  ];
  if (pricing && pricing.designFee > 0) totals.push(['Design Customization', formatCurrency(pricing.designFee)]);
  totals.push(['Subtotal', formatCurrency(pricing?.subtotal || 0)]);
  if (pricing && pricing.profitPct > 0) totals.push([`Profit (${pricing.profitPct}%)`, formatCurrency(pricing.profitAmount)]);
  if (pricing && pricing.discount > 0) totals.push([`Discount (${pricing.discount}%)`, `−${formatCurrency(pricing.discountAmount)}`]);
  totals.push([`Order Total (${depositLabel})`, formatCurrency(amountDue)]);
  if (isDeposit) {
    totals.push(['Full Amount (100%)', formatCurrency(fullAmount)]);
    totals.push(['Balance Remaining', formatCurrency(fullAmount - amountDue)]);
  }

  totals.forEach(([label, value]) => {
    doc.fontSize(10).font('Helvetica').text(label, { continued: true });
    doc.font('Helvetica-Bold').text(value);
    doc.font('Helvetica');
  });

  doc.end();
}

function generatePaymentReceiptPDF(order, res) {
  const { merchantOrderId, amount, fullAmount, paymentPercentage, isDeposit, currency, customerName, customerEmail, product, collection, pricing, paymentIntentId, updatedAt, status, createdAt } = order;
  const isPaid = status === 'PAID';
  const depositLabel = isDeposit ? `Deposit (${paymentPercentage}%)` : 'Full Payment';
  
  const date = new Date(updatedAt || createdAt).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'long', year: 'numeric'
  });

  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="payment-receipt-${merchantOrderId}.pdf"`);
  doc.pipe(res);

  // Header
  doc.fontSize(28).font('Helvetica-Bold').text('VICTORIA DIAMONDS', { align: 'center' });
  doc.fontSize(12).font('Helvetica').text('Luxury Jewellery', { align: 'center' });
  doc.moveDown();
  doc.fontSize(12).font('Helvetica-Bold').text(isPaid ? 'PAYMENT RECEIPT — CONFIRMED' : 'PAYMENT RECEIPT — PENDING', { align: 'center' });
  doc.moveDown(2);

  // Details
  const details = [
    ['Order Reference', merchantOrderId],
    ['Date', date],
    ['Customer', customerName],
    ['Email', customerEmail],
    ['Payment Type', depositLabel],
    ['Payment Intent', paymentIntentId || 'N/A'],
    ['Collection', getCollectionDisplayName(collection)],
    ['Product', product.name]
  ];

  let y = doc.y;
  details.forEach(([label, value], i) => {
    const x = i % 2 === 0 ? 50 : 300;
    const rowY = y + Math.floor(i / 2) * 30;
    doc.fontSize(8).font('Helvetica-Bold').text(label, x, rowY, { width: 120 });
    doc.fontSize(10).font('Helvetica').text(value, x, rowY + 12, { width: 220 });
  });
  doc.y = y + Math.ceil(details.length / 2) * 30 + 20;

  // Payment Summary
  doc.fontSize(12).font('Helvetica-Bold').text('Payment Summary');
  doc.moveDown(0.5);
  
  const paymentRows = [
    ['Order Total', formatCurrency(fullAmount)],
  ];
  if (isDeposit) {
    paymentRows.push(['Deposit Percentage', `${paymentPercentage}%`]);
    paymentRows.push(['Deposit Amount', formatCurrency(amount)]);
    paymentRows.push(['Balance Remaining', formatCurrency(fullAmount - amount)]);
  }
  paymentRows.push(['Amount Paid', formatCurrency(amount)]);

  paymentRows.forEach(([label, value], i) => {
    const isFinal = i === paymentRows.length - 1;
    doc.fontSize(10).font(isFinal ? 'Helvetica-Bold' : 'Helvetica').text(label, { continued: true });
    doc.font(isFinal ? 'Helvetica-Bold' : 'Helvetica').text(value);
    doc.font('Helvetica');
  });

  doc.end();
}

// =========================
// RECEIPT ROUTES
// =========================

// Order Receipt (before payment)
app.get('/order-receipt/:merchantOrderId', (req, res) => {
  const order = orders.get(req.params.merchantOrderId);
  
  if (!order) {
    return res.status(404).send('Order not found');
  }

  const format = req.query.format || 'html';
  
  if (format === 'pdf') {
    return generateOrderReceiptPDF(order, res);
  }

  res.send(generateOrderReceiptHTML(order));
});

// Payment Receipt (after payment)
app.get('/payment-receipt/:merchantOrderId', (req, res) => {
  const order = orders.get(req.params.merchantOrderId);
  
  if (!order) {
    return res.status(404).send('Order not found');
  }

  const format = req.query.format || 'html';
  
  if (format === 'pdf') {
    return generatePaymentReceiptPDF(order, res);
  }

  res.send(generatePaymentReceiptHTML(order));
});

// Test endpoint: Create mock order for receipt testing
app.post('/test/create-mock-order', (req, res) => {
  const {
    customerName = 'John Smith',
    customerEmail = 'john@example.com',
    productName = 'Solenne Ring',
    collection = 'dailySparkle',
    metal = 'gold',
    karat = 18,
    fullAmount = 3000,
    paymentPercentage = 50,
    status = 'PAID'
  } = req.body;

  const merchantOrderId = generateMerchantOrderId();
  const isDeposit = paymentPercentage < 100;
  const amount = Math.round(fullAmount * (paymentPercentage / 100));
  const depositLabel = isDeposit ? `Deposit (${paymentPercentage}%)` : 'Full Payment';
  
  const mockOrder = {
    merchantOrderId,
    amount,
    fullAmount,
    paymentPercentage,
    isDeposit,
    currency: 'GBP',
    customerName,
    customerEmail,
    product: {
      name: productName,
      type: 'ring',
      metal
    },
    collection,
    pricing: {
      designComplexityFee: 1125,
      diamondPrice: 1500,
      designFee: 0,
      subtotal: 2625,
      profitPct: 0,
      profitAmount: 0,
      discount: 0,
      discountAmount: 0,
      finalTotal: fullAmount,
      entries: [
        { quality: 'luxe', carat: '1.00', caratNum: 1, qty: 1, price: 594, unpriced: false, total: 594 },
        { quality: 'select', carat: '0.50', caratNum: 0.5, qty: 2, price: 150, unpriced: false, total: 300 },
        { quality: 'luxe', carat: '0.25', caratNum: 0.25, qty: 4, price: 149, unpriced: false, total: 596 },
        { quality: 'select', carat: '0', caratNum: 0, qty: 1, price: 0, unpriced: false, total: 0 }
      ],
      karat,
      braceletTier: null
    },
    paymentIntentId: status === 'PAID' ? 'pi_test_12345' : null,
    status,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  orders.set(merchantOrderId, mockOrder);
  
  res.json({
    success: true,
    merchantOrderId,
    orderReceiptUrl: `/order-receipt/${merchantOrderId}`,
    paymentReceiptUrl: `/payment-receipt/${merchantOrderId}`
  });
});

// =========================
// START SERVER
// =========================

const port =
  process.env.PORT || 3000;

app.listen(
  port,
  '0.0.0.0',
  () => {

    console.log(
      `Victoria Diamonds calculator server running on port ${port}`
    );

    console.log(
      `[Airwallex] Environment: ${
        IS_PRODUCTION
          ? 'production'
          : 'sandbox'
      }`
    );
  }
);