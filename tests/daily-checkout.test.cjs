const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const pricing=require(path.join(root,'pricing'));
const {quoteDaily}=require(path.join(root,'daily-checkout'));
const routes=new Map(),calls=[];
const app={use(){},get(){},post(paths,handler){for(const p of [].concat(paths))routes.set(p,handler);},listen(){}};
const express=()=>app;express.json=express.static=()=>()=>{};
const axios=async options=>{calls.push(options);return {data:options.url.endsWith('/create')?{id:'preview-link',url:'https://example.invalid/payment'}:{}};};
axios.post=async()=>({data:{token:'test-only',expires_at:'2099-01-01'}});
const context=vm.createContext({require(id){if(id==='express')return express;if(id==='cors')return ()=>()=>{};if(id==='axios')return axios;if(id==='pdfkit')return function(){};if(id==='dotenv')return {config(){}};if(id==='./pricing')return pricing;if(id==='./daily-checkout')return {quoteDaily};return require(id);},__dirname:root,process:{env:{AIRWALLEX_CLIENT_ID:'test',AIRWALLEX_API_KEY:'test'}},console:{log(){},warn(){},error(){}},Buffer});
vm.runInContext(fs.readFileSync(path.join(root,'server.js'),'utf8'),context);
const sample={productId:'ds_s_solenne',metal:'gold',karat:14,purity:925,quantity:2,paymentPercentage:30,diamonds:[{carat:'1.00',qty:1,quality:'luxe'}],customerName:'Preview',customerEmail:'preview@example.com'};
async function request(route,body){const response={code:200,status(code){this.code=code;return this;},set(){return this;},json(data){this.data=data;return this;}};await routes.get(route)({path:route,body},response);return response;}
test('quote endpoint performs no payment or email operation',async()=>{const before=calls.length,res=await request('/daily-sparkle/quote',sample);assert.equal(res.code,200);assert.equal(res.data.total,quoteDaily(sample).total);assert.equal(calls.length,before);assert.equal(res.data.params,undefined);});
test('payment route rejects changed prices and invalid configurations before payment creation',async()=>{const before=calls.length;assert.equal((await request('/daily-sparkle/payment-link',{...sample,expectedTotal:1})).code,409);assert.equal((await request('/daily-sparkle/payment-link',{...sample,productId:'missing'})).code,400);assert.equal(calls.length,before);});
test('payment link uses confirmed deposit and preserves selected specification in order',async()=>{const q=quoteDaily(sample);const res=await request('/daily-sparkle/payment-link',{...sample,expectedTotal:q.total,discount:100,designFee:-10000});assert.equal(res.code,200);assert.equal(res.data.amount,q.due);assert.equal(res.data.fullAmount,q.total);const create=calls.find(c=>c.url.endsWith('/create'));assert.equal(create.data.amount,q.due);const order=vm.runInContext('Array.from(orders.values()).at(-1)',context);assert.equal(order.pricing.karat,14);assert.equal(order.pricing.metal,'gold');assert.equal(order.pricing.qty,2);assert.equal(order.pricing.discount,0);assert.equal(calls.filter(c=>c.url.endsWith('/notify_shopper')).length,1);});
test('selected silver purity and metal are preserved for receipts',()=>{const result=pricing.computePricing(quoteDaily({...sample,metal:'silver',purity:999}).params);assert.equal(result.prod.metal,'silver');assert.equal(result.purity,999);});
