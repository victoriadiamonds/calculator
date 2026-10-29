const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const pricing=require('../pricing');
const rules=require('../order-configuration-rules.json');
const controls={};const ctx=vm.createContext({document:{addEventListener(){},getElementById(id){return controls[id]||={value:''};}},window:{},console});
for(const [,script] of fs.readFileSync(require.resolve('../index.html'),'utf8').matchAll(/<script>([\s\S]*?)<\/script>/g))vm.runInContext(script,ctx);
const catalogue=JSON.parse(vm.runInContext('JSON.stringify(PRODUCTS_BY_COLLECTION)',ctx));
test('every current browser lab configuration agrees with checkout, including newer collections and stacking sets',()=>{
 let count=0;
 for(const [collection,tiers] of Object.entries(catalogue))for(const product of Object.values(tiers).flat()){
  const metal=product.defaultMetal||'gold';
  for(const [id,value] of Object.entries({collection,product:product.id,typeFilter:'all',pieceSearch:'',metal,karat:'18',purity:'925',quantity:'1',profit:'0',discount:'0',designFee:'0',initial:'A',braceletMetalTier:product.defaultBraceletTier||'essential'}))controls[id]={value};
  const preset=product.diamondPreset,stones=preset?[preset,...(preset.additional||[])]:[];
  const diamonds=Array.from({length:4},(_,i)=>{const s=stones[i]||{q:'select',c:'0',qty:1};controls['dq'+i]={value:s.q};controls['dc'+i]={value:s.c};controls['dqt'+i]={value:String(s.qty)};return {quality:s.q,carat:s.c,qty:s.qty};});
  if(rules[product.id]?.diamondPriceOptions&&!Object.hasOwn(rules[product.id].diamondPriceOptions,Number(diamonds[0].carat).toFixed(2))){diamonds[0].carat='0.25';controls.dc0.value='0.25';}
  const input={collection,productId:product.id,typeFilter:'all',metal,karat:18,purity:925,quantity:1,profit:0,discount:0,designFee:0,initial:'A',braceletMetalTier:product.defaultBraceletTier||'essential',diamonds};
  const front=vm.runInContext('computePricing()',ctx),back=pricing.computePricing(input);
  if(front.priceOnRequest){assert.equal(back.priceOnRequest,true);continue;}
  assert.equal(front.designFee,0,`${product.id}: no automatic browser customization fee`);
  assert.equal(back.designFee,0,`${product.id}: no automatic checkout customization fee`);
  assert.equal(Math.round(front.finalTotal*100),Math.round(back.finalTotal*100),product.id);count++;
 }
 assert.equal(count,204);
});
