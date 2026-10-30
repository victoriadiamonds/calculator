const test=require('node:test');
const assert=require('node:assert/strict');
const {quoteDaily}=require('../daily-checkout');
const pricing=require('../pricing');
const rules=require('../order-configuration-rules.json');

test('small tennis options use configured stone counts and authoritative rates across metals and deposits',()=>{
 const designs=Object.entries(rules).filter(([,rule])=>rule.stoneCount);
 assert.equal(designs.length,13);
 for(const [productId,rule]of designs)for(const [carat,rate]of [['0.05',12.5],['0.10',23],['0.20',90]])for(const metal of ['gold','silver','platinum'])for(const paymentPercentage of [30,50,100]){
  const body={productId,metal,karat:18,purity:925,quantity:1,paymentPercentage,diamonds:[{quality:'select',carat,qty:99}]};
  const quote=quoteDaily(body,'tennis');
  const expected=pricing.PRICING_PACKAGE_MATRIX[rule.braceletMetalTier][metal==='gold'?'18K':metal]+rule.stoneCount*rate;
  assert.equal(quote.total,expected,productId+' '+carat);
  assert.equal(quote.due,Math.round(expected*paymentPercentage)/100);
  assert.equal(quote.params.diamonds[0].qty,1,'whole-piece price must not multiply client-supplied quantity');
 }
});

test('0.20 ct uses the temporarily approved 0.25 ct per-stone rate',()=>{
 assert.equal(pricing.DIAMOND_PRICES.select['0.20'],pricing.DIAMOND_PRICES.select['0.25']);
 assert.equal(pricing.DIAMOND_PRICES.luxe['0.20'],pricing.DIAMOND_PRICES.luxe['0.25']);
});
