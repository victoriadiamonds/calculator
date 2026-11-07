const test=require('node:test'),assert=require('node:assert/strict');
const {discountedAmounts}=require('../klubby-offer');
test('Klubby is ten percent before deposit calculation',()=>{
 const q=discountedAmounts({fullAmount:1100,paymentPercentage:50,metal:'gold',deliveryCountry:'GB'});
 assert.deepEqual(q,{discount:110,fullAmount:990,amount:495,balance:495});
});
test('silver and non-UK deliveries remain excluded',()=>{
 for(const entry of [{metal:'silver',deliveryCountry:'GB'},{metal:'gold',deliveryCountry:'US'}])assert.throws(()=>discountedAmounts({fullAmount:1100,paymentPercentage:100,...entry}));
});
