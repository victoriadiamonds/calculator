const test=require('node:test');
const assert=require('node:assert/strict');
const catalogue=require('../natural-diamonds-data');
const natural=require('../natural-diamonds');
const pricing=require('../pricing');
const {quoteDaily}=require('../daily-checkout');
const product=pricing.getProductsForCollection('dailySparkle','ring')[0];
const input={collection:'dailySparkle',productId:product.id,metal:'gold',karat:18,quantity:1,paymentPercentage:50,diamondOrigin:'natural',diamonds:[{naturalId:catalogue.items[0].id,qty:2}]};
test('all workbook combinations have a 10 percent reduction rounded to pennies',()=>{
 assert.equal(catalogue.items.filter(i=>i.id.startsWith('nd-')).length,1808);assert.equal(new Set(catalogue.items.map(i=>i.id)).size,catalogue.items.length);
 assert.deepEqual([...natural.facets.shape].sort(),['Cushion','Emerald','Marquise','Oval','Round']);
 assert.equal(catalogue.items[0].sourcePrice,950.83);
 assert.equal(catalogue.items[0].price,855.75);
 assert.equal(catalogue.priceReductionPercent,10);
 for(const item of catalogue.items) assert.equal(item.price,Math.floor((Math.round(item.sourcePrice*100)*9+5)/10)/100);
});
test('natural quotes use authoritative prices, preserve pence and deposits',()=>{
 const q=quoteDaily({...input,diamonds:[{...input.diamonds[0],price:1,carat:'5.00',quality:'select'}]});
 const base=pricing.computePricing(input);assert.equal(q.total,base.ringPrice+base.designFee+855.75*2);assert.equal(q.due,Math.round(q.total*50)/100);assert.equal(q.balance,q.due);
 const r=pricing.computePricing(input);assert.equal(r.entries[0].shape,'Round');assert.equal(r.entries[0].clarity,'SI2');
 assert.equal(r.designFee,0,'Natural diamonds do not add automatic customization charges');
});
test('reject missing, fabricated, over-limit and fractional natural selections',()=>{
 for(const groups of [[],[{naturalId:'fake',qty:1}],[{naturalId:'nd-0002',qty:0}],[{naturalId:'nd-0002',qty:1.5}],Array(5).fill({naturalId:'nd-0002',qty:1})])assert.throws(()=>pricing.computePricing({...input,diamonds:groups}));
 assert.throws(()=>pricing.computePricing({...input,collection:'silver'}));
});
test('filters return only workbook matches and support pagination',()=>{
 const results=natural.search({shape:'Oval',carat:2,colour:'D',maxPrice:20000});
 assert.ok(results.total>0);assert.ok(results.items.every(i=>i.shape==='Oval'&&i.carat===2&&i.colour==='D'&&i.price<=20000));
 assert.equal(natural.search({limit:10,offset:10}).items.length,10);
});
test('additional natural diamond groups retain individual grades, quantities and prices',()=>{
 const one=catalogue.items[0],two=catalogue.items.find(d=>d.shape==='Oval');
 const r=pricing.computePricing({...input,diamonds:[{naturalId:one.id,qty:1},{naturalId:two.id,qty:2}]});
 assert.equal(r.entries.length,2);assert.equal(r.entries[0].shape,'Round');assert.equal(r.entries[1].shape,'Oval');
 assert.equal(r.diamondPrice,Math.round((one.price+two.price*2)*100)/100);
 const q=quoteDaily({...input,diamonds:[{naturalId:one.id,qty:1},{naturalId:two.id,qty:2}]});
 assert.equal(q.total,Math.round(r.finalTotal*100)/100);
});
test('audited smaller sizes have source evidence, correct grades and exactly one reduction',()=>{
 const audit=require('../natural-diamond-audit.json');
 assert.equal(audit.audit.length,135);
 assert.ok(audit.audit.every(task=>task.complete&&task.seen===task.total));
 const added=catalogue.items.filter(i=>i.id.startsWith('77-'));
 assert.equal(added.length,audit.items.length);
 assert.equal(added.length,1369);
 assert.deepEqual([...new Set(added.map(d=>d.carat))].sort((a,b)=>a-b),[.25,.5,.75]);
 assert.ok(added.every(d=>d.sourceDiamondCode&&d.source&&d.auditedAt&&d.priceBasis));
 assert.ok(!catalogue.items.some(d=>[.05,.1,.15].includes(d.carat)));
 const stone=added.find(d=>d.carat===.5);
 const result=pricing.computePricing({...input,diamonds:[{naturalId:stone.id,qty:3},{naturalId:added[0].id,qty:1}]});
 assert.equal(result.diamondPrice,Math.round((stone.price*3+added[0].price)*100)/100);
});
