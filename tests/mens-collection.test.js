const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const pricing = require('../pricing');
const controls = {};
const context = vm.createContext({ document: { addEventListener() {}, getElementById(id) { return controls[id] ||= { value: '' }; } }, window: {}, console });
for (const script of fs.readFileSync(require.resolve('../index.html'), 'utf8').matchAll(/<script>([\s\S]*?)<\/script>/g)) vm.runInContext(script[1], context);
const products = pricing.PRODUCTS_BY_COLLECTION.mens.essentials;
const browserProducts = JSON.parse(vm.runInContext('JSON.stringify(PRODUCTS_BY_COLLECTION.mens.essentials)',context));
const expected = [1575,825,1575,1375,1613,3075,1375,1875,1575,1375,5220,6732,6732,6732,6732,1625,1975,1375,1375,1875];
function params(product) {
  return { collection:'mens', productId:product.id, typeFilter:product.type, metal:product.defaultMetal, karat:18, braceletMetalTier:product.defaultBraceletTier,
    diamonds:[product.diamondPreset,...(product.diamondPreset.additional || [])].map(s => ({quality:s.q,carat:s.c,qty:s.qty})), quantity:1, discount:0, profit:0, designFee:0 };
}
test('all 20 current men’s browser configurations agree with checkout', () => {
  assert.equal(products.length,20);
  assert.deepEqual(browserProducts.map(p=>p.id), products.map(p=>p.id));
  browserProducts.forEach((product,index) => {
    const input=params(product);
    Object.entries({collection:'mens',product:product.id,typeFilter:product.type,pieceSearch:'',metal:input.metal,karat:'18',braceletMetalTier:input.braceletMetalTier || 'essential',quantity:'1',discount:'0',profit:'0',designFee:'0'}).forEach(([id,value]) => controls[id]={value});
    for(let i=0;i<4;i++) { const d=input.diamonds[i] || {quality:'select',carat:'0',qty:1}; controls['dq'+i]={value:d.quality};controls['dc'+i]={value:d.carat};controls['dqt'+i]={value:String(d.qty)}; }
    assert.equal(vm.runInContext('computePricing().finalTotal',context),expected[index],product.name);
    assert.equal(pricing.computePricing(input).finalTotal,expected[index],product.name);
  });
});
test('men’s bracelet minimum tiers survive altered checkout input', () => {
  browserProducts.filter(p => p.type==='bracelet').forEach(product => {
    const result=pricing.computePricing({...params(product),braceletMetalTier:'essential'});
    assert.equal(result.packageKey,product.minBraceletTier);
    assert.equal(result.finalTotal,expected[browserProducts.indexOf(product)]);
  });
});
test('men’s pendants filter separately from rings and bracelets', () => {
  assert.equal(pricing.getProductsForCollection('mens','pendant').length,5);
  assert.equal(pricing.getProductsForCollection('mens','ring').length,10);
  assert.equal(pricing.getCollectionName('mens'),"Men's Collection");
});
