const express = require('express');
const path = require('path');
const crypto = require('crypto');
const cors = require('cors');
const axios = require('axios');
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

      const amount =
        Math.round(
          Number(
            pricingResult.finalTotal
          ) * 100
        ) / 100;

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

      const paymentLinkData = {

        amount,

        currency: 'GBP',

        reusable: false,

        title:
          `Victoria Diamonds — ${pricingResult.prod.name}`,

        description:
          `Secure payment for order ${merchantOrderId}`,

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
            )
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

        currency: 'GBP',

        message:
          'Payment link sent successfully.'
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