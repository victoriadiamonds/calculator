const { createHmac, randomBytes } = require('node:crypto');

function codeDigest(code, secret) {
  if (typeof secret !== 'string' || Buffer.byteLength(secret) < 32) throw new Error('A dedicated Klubby secret is required.');
  const normalized = String(code).trim().toUpperCase();
  if (!/^VDK-[0-9A-F]{24}$/.test(normalized)) throw new Error('Invalid Klubby code.');
  return createHmac('sha256', secret).update(normalized).digest('hex');
}

function generateCodes(count, secret) {
  if (!Number.isSafeInteger(count) || count < 1 || count > 5000) throw new Error('Invalid batch size.');
  const codes = new Map();
  while (codes.size < count) {
    const code = `VDK-${randomBytes(12).toString('hex').toUpperCase()}`;
    codes.set(code, codeDigest(code, secret));
  }
  return codes;
}

// Supply the final, server-validated order total and metal, never client values.
function discountedAmounts({ fullAmount, paymentPercentage, metal, deliveryCountry, fixedPrice }) {
  if (!['gold', 'platinum'].includes(metal) || deliveryCountry !== 'GB') throw new Error('The Klubby offer applies to eligible non-silver jewellery for UK delivery.');
  const pennies = Math.round(fullAmount * 100);
  if (!Number.isSafeInteger(pennies) || pennies <= 0 || pennies > Math.floor(Number.MAX_SAFE_INTEGER / 100)) throw new Error('Invalid order amount.');
  if (!fixedPrice && (!Number.isFinite(paymentPercentage) || paymentPercentage < 30 || paymentPercentage > 100)) throw new Error('Invalid payment percentage.');
  const discount = Math.round(pennies * 10 / 100);
  const total = pennies - discount;
  const payable = fixedPrice ? total : Math.round(total * paymentPercentage / 100);
  return { discount: discount / 100, fullAmount: total / 100, amount: payable / 100, balance: (total - payable) / 100 };
}


let pool;
function database() {
  if (!process.env.KLUBBY_DATABASE_URL || !process.env.KLUBBY_CODE_SECRET || !process.env.AIRWALLEX_WEBHOOK_SECRET) {
    throw new OfferError(503, 'Klubby checkout is temporarily unavailable.');
  }
  if (!pool) {
    const { Pool } = require('pg');
    pool = new Pool({ connectionString: process.env.KLUBBY_DATABASE_URL, max: 3, connectionTimeoutMillis: 5000, query_timeout: 5000 });
  }
  return pool;
}

class OfferError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

async function applyOffer(body, quote) {
  if (body.klubbyCode == null || body.klubbyCode === '') return quote;
  if (!['gold', 'platinum'].includes(quote.params.metal) || body.deliveryCountry !== 'GB') {
    throw new OfferError(400, 'Klubby applies to eligible gold or platinum jewellery for UK delivery.');
  }
  const db = database();
  let digest;
  try { digest = codeDigest(body.klubbyCode, process.env.KLUBBY_CODE_SECRET); }
  catch { throw new OfferError(400, 'This Klubby code is unavailable.'); }
  const { rows } = await db.query(
    `SELECT 1 FROM promotions.klubby_code c JOIN promotions.klubby_campaign p ON c.campaign_id=p.id
     WHERE c.digest=$1 AND c.order_id IS NULL AND c.redeemed_at IS NULL
       AND now() >= p.starts_at AND now() < p.expires_at`, [digest]);
  if (!rows.length) throw new OfferError(400, 'This Klubby code is unavailable.');
  const adjusted = discountedAmounts({ fullAmount: quote.total, paymentPercentage: quote.paymentPercentage,
    metal: quote.params.metal, deliveryCountry: body.deliveryCountry });
  return { ...quote, total: adjusted.fullAmount, due: adjusted.amount, balance: adjusted.balance,
    klubbyDiscount: adjusted.discount, digest };
}

async function reserve(digest, order) {
  const { rows } = await database().query('SELECT promotions.reserve_klubby_code($1,$2) AS reserved', [digest, order]);
  if (!rows[0].reserved) throw new OfferError(409, 'This Klubby code is already reserved or unavailable.');
}

async function redeem(order) {
  await database().query('SELECT promotions.redeem_klubby_code($1)', [order]);
}

module.exports = { applyOffer, reserve, redeem, OfferError, discountedAmounts };
