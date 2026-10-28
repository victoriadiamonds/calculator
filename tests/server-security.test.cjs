const test = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
process.env.NODE_ENV = 'test';
// Security tests never contact Airwallex or send real email.
process.env.AIRWALLEX_CLIENT_ID = '';
process.env.AIRWALLEX_API_KEY = '';
process.env.AIRWALLEX_WEBHOOK_SECRET = '';
const app = require('../server');
const { escapeHtml } = require('../server-security');
let server, base;
test.before(async () => {
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  base = `http://127.0.0.1:${server.address().port}`;
});
test.after(() => new Promise(resolve => server.close(resolve)));
const post = (route, body) => fetch(base + route, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

test('only public browser assets are served; private source and archives are inaccessible', async () => {
  for (const name of ['server.js', 'pricing.js', 'server-security.js', 'package.json', 'package-lock.json', 'files2.zip', '.env', '.git/config', 'tests/daily-checkout.test.cjs']) {
    assert.equal((await fetch(`${base}/${name}`)).status, 404, name);
  }
  for (const name of ['style.css', 'natural-selector.js', 'natural-diamonds-data.js']) {
    assert.equal((await fetch(`${base}/${name}`)).status, 200, name);
  }
});
test('calculator inline scripts have fresh CSP nonces and storefront embedding stays allowed', async () => {
  const response = await fetch(base);
  const html = await response.text();
  const nonce = html.match(/<script nonce="([^"]+)"/)[1];
  assert.ok(response.headers.get('content-security-policy').includes(`'nonce-${nonce}'`));
  assert.ok(response.headers.get('content-security-policy').includes('https://victoria-diamonds.com'));
  assert.ok(!html.includes('<script>'));
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('x-powered-by'), null);
  assert.ok(!(await (await fetch(base)).text()).includes(`nonce="${nonce}"`));
});
test('invalid and excessive request bodies return safe errors', async () => {
  assert.equal((await post('/api/v1/quote', [])).status, 400);
  assert.equal((await post('/api/v1/quote', { padding: 'x'.repeat(40000) })).status, 413);
  const bad = await fetch(base + '/api/v1/quote', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{broken' });
  assert.equal(bad.status, 400);
  assert.deepEqual(await bad.json(), { error: 'Invalid request body.' });
});
test('webhooks fail closed without a verification secret', async () => {
  assert.equal((await post('/airwallex/webhook', { type: 'payment_intent.succeeded' })).status, 503);
});
test('mock-order endpoint is disabled outside test mode', async () => {
  process.env.NODE_ENV = 'production';
  try { assert.equal((await post('/test/create-mock-order', {})).status, 404); }
  finally { process.env.NODE_ENV = 'test'; }
});
test('receipt HTML escapes customer data and private receipts are not cached', async () => {
  const created = await post('/test/create-mock-order', { customerName: '<img src=x onerror=alert(1)>', productName: '<script>alert(1)</script>' });
  const order = await created.json();
  for (const route of [order.orderReceiptUrl, order.paymentReceiptUrl]) {
    const res = await fetch(base + route), html = await res.text();
    assert.equal(res.headers.get('cache-control'), 'no-store');
    assert.ok(html.includes('&lt;img'));
    assert.ok(!html.includes('<img src=x'));
    assert.ok(!html.includes('<script>alert'));
  }
  assert.equal(escapeHtml(`&<>"'`), '&amp;&lt;&gt;&quot;&#39;');
});
test('payment requests are rate limited before reaching provider code', async () => {
  for (let i = 0; i < 10; i++) assert.equal((await post('/api/v1/payment-link', {})).status, 400);
  assert.equal((await post('/api/v1/payment-link', {})).status, 429);
});
