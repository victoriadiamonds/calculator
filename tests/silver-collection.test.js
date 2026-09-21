const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const pricing = require('../pricing');

// Published Silver Collection prices verified on 2026-09-21.
const expected = [79, 142, 79, 87, 97, 79, 129, 134, 98, 87, 87, 87, 131, 134, 134, 131];
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match => match[1]);
const controls = {};
const context = vm.createContext({
  document: { addEventListener() {}, getElementById(id) { return controls[id] || (controls[id] = { value: '' }); } },
  window: {}, console
});
scripts.forEach(script => vm.runInContext(script, context));
const frontend = vm.runInContext('PRODUCTS_BY_COLLECTION.silver.essentials', context);
const backend = pricing.PRODUCTS_BY_COLLECTION.silver.essentials;

test('all 16 published products and prices agree across frontend and checkout', () => {
  assert.equal(backend.length, 16);
  assert.deepEqual(backend.map(product => product.fixedPrice), expected);
  assert.deepEqual(JSON.parse(JSON.stringify(frontend.map(({ id, name, type, fixedPrice, diamondPreset }) => ({ id, name, type, fixedPrice, diamondPreset })))),
    backend.map(({ id, name, type, fixedPrice, diamondPreset }) => ({ id, name, type, fixedPrice, diamondPreset })));
  for (const product of backend) {
    controls.collection = { value: 'silver' };
    controls.typeFilter = { value: product.type };
    controls.product = { value: product.id };
    const front = vm.runInContext('computePricing()', context);
    const back = pricing.computePricing({ collection: 'silver', productId: product.id, typeFilter: product.type, metal: 'silver' });
    assert.equal(front.finalTotal, product.fixedPrice, product.name);
    assert.equal(back.finalTotal, front.finalTotal, product.name);
    const summary = vm.runInContext('buildResultMarkup(getCurrentProduct(), computePricing())', context);
    assert.match(summary, /Fixed price:/);
    assert.doesNotMatch(summary, /Base price|Specification:|Profit/);
  }
});

test('server enforces Silver specifications despite altered checkout input', () => {
  for (const product of backend) {
    const result = pricing.computePricing({ collection: 'silver', productId: product.id, typeFilter: 'all', metal: 'gold', karat: 22,
      purity: 999, quantity: 100, discount: 100, profit: 500, designFee: 1000,
      diamonds: [{ quality: 'luxe', carat: '5.00', qty: 20 }] });
    assert.equal(result.finalTotal, product.fixedPrice);
    assert.equal(result.qty, 1);
    assert.equal(result.metal, 'silver');
    assert.equal(result.prod.metal, 'silver');
    assert.equal(result.purity, 925);
    assert.equal(result.discount, 0);
    assert.equal(result.profitPct, 0);
    assert.equal(result.designFee, 0);
  }
  assert.equal(pricing.computePricing({ collection: 'silver', productId: 'missing', typeFilter: 'all' }), null);
});

test('ordinary collection pricing remains configurable', () => {
  const params = { collection: 'dailySparkle', productId: 'ds_s_solenne', typeFilter: 'ring', metal: 'gold', karat: 18,
    diamonds: [], quantity: 1, discount: 0, profit: 0, designFee: 0 };
  const base = pricing.computePricing(params);
  const adjusted = pricing.computePricing({ ...params, quantity: 2, discount: 10 });
  assert.equal(adjusted.finalTotal, base.finalTotal * 2 * 0.9);
  assert.notEqual(base.fixedPrice, true);
});

test('deposit display retains pence for fixed prices', () => {
  controls.paymentPercentage = { value: '50' };
  vm.runInContext('currentOrderTotal = 131; updateDepositHint()', context);
  assert.match(controls.depositAmountHint.textContent, /£65\.50/);
  controls.paymentPercentage.value = '30';
  vm.runInContext('currentOrderTotal = 79; updateDepositHint()', context);
  assert.match(controls.depositAmountHint.textContent, /£23\.70/);
});
