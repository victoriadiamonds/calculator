const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..'),pricing=require(root+'/pricing'),{quoteDaily}=require(root+'/daily-checkout'),catalogue=require(root+'/tennis-products.json');
const routes=new Map(),calls=[];const app={use(){},get(){},post(paths,handler){for(const p of [].concat(paths))routes.set(p,handler);},listen(){}};const express=()=>app;express.json=express.static=()=>()=>{};
const axios=async options=>{calls.push(options);return {data:options.url.endsWith('/create')?{id:'test-link',url:'https://example.invalid/payment'}:{}};};axios.post=async()=>({data:{token:'test-only',expires_at:'2099-01-01'}});
const c=vm.createContext({require(id){if(id==='express')return express;if(id==='cors')return ()=>()=>{};if(id==='axios')return axios;if(id==='pdfkit')return function(){};if(id==='dotenv')return {config(){}};if(id==='./pricing')return pricing;if(id==='./daily-checkout')return {quoteDaily};return require(id);},__dirname:root,process:{env:{AIRWALLEX_CLIENT_ID:'test',AIRWALLEX_API_KEY:'test'}},console:{log(){},warn(){},error(){}},Buffer});vm.runInContext(fs.readFileSync(root+'/server.js','utf8'),c);
async function request(route,body){const res={code:200,status(v){this.code=v;return this;},set(){return this;},json(v){this.data=v;return this;}};await routes.get(route)({path:route,body},res);return res;}
test('all thirteen tennis pieces produce quotes and mocked payment links with locked design-specific tier',async()=>{
 assert.equal(pricing.getProductsForCollection('tennis','bracelet').length,13);
 for(const p of catalogue.products){const body={productId:p.id,metal:'gold',karat:18,purity:925,quantity:1,paymentPercentage:30,braceletMetalTier:'essential',diamonds:[{quality:'select',carat:'0.25',qty:1}],customerName:'Test',customerEmail:'test@example.invalid'};
 const before=calls.length,q=await request('/tennis/quote',body);assert.equal(q.code,200);assert.equal(q.data.total,p.id==='mens_pillar_tennis_bracelet'?6232:4720);assert.equal(calls.length,before);
 const pay=await request('/tennis/payment-link',{...body,expectedTotal:q.data.total});assert.equal(pay.code,200);assert.equal(pay.data.fullAmount,q.data.total);assert.equal(pay.data.amount,q.data.due);
 const order=vm.runInContext('Array.from(orders.values()).at(-1)',c);assert.equal(order.collection,'tennis');assert.equal(order.pricing.packageKey,p.defaultBraceletTier);
 }
});
test('tennis payment refuses stale totals before contacting payment provider',async()=>{const before=calls.length;const r=await request('/tennis/payment-link',{productId:catalogue.products[0].id,metal:'gold',karat:18,purity:925,quantity:1,paymentPercentage:100,diamonds:[{quality:'select',carat:'0.25',qty:1}],expectedTotal:1});assert.equal(r.code,409);assert.equal(calls.length,before);});
