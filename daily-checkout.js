// This module belongs in the calculator repository as daily-checkout.js.
const pricing=require('./pricing');
function quoteDaily(body={}, collection='dailySparkle') {
 if(!['dailySparkle','occasionWear','foreverBond','singleLady','mens'].includes(collection))throw new Error('Unsupported online collection.');
 const product=pricing.getProductsForCollection(collection,'all').find(p=>p.id===body.productId);
 if(!product)throw new Error('Please choose a valid piece from this collection.');
 if(!['gold','silver','platinum'].includes(body.metal))throw new Error('Please choose a valid metal.');
 const karat=Number(body.karat),purity=Number(body.purity);
 if(body.metal==='gold'&&![9,14,18,22].includes(karat))throw new Error('Please choose a valid gold karat.');
 if(body.metal==='silver'&&![925,990,999].includes(purity))throw new Error('Please choose a valid silver purity.');
 const quantity=Number(body.quantity),paymentPercentage=Number(body.paymentPercentage);
 if(!Number.isInteger(quantity)||quantity<1||quantity>10)throw new Error('Quantity must be between 1 and 10.');
 if(![30,50,100].includes(paymentPercentage))throw new Error('Choose a 30% deposit, 50% deposit, or full payment.');
 if(!Array.isArray(body.diamonds)||body.diamonds.length<(['foreverBond','singleLady'].includes(collection)?0:1)||body.diamonds.length>4)throw new Error('Please check the diamond specifications (up to four groups).');
 const diamonds=body.diamonds.map(d=>{
  if(!d||!['select','luxe'].includes(d.quality)||!pricing.DIAMOND_CARATS.includes(d.carat)||!Number.isInteger(Number(d.qty))||Number(d.qty)<1||Number(d.qty)>100)throw new Error('Please check the diamond specifications.');
  return {quality:d.quality,carat:d.carat,qty:Number(d.qty)};
 });
 const braceletMetalTier=body.braceletMetalTier;
 if(product.type==='bracelet'&&!Object.hasOwn(pricing.PRICING_PACKAGE_MATRIX,braceletMetalTier))throw new Error('Please choose a bracelet specification.');
 const params={collection,productId:product.id,typeFilter:'all',metal:body.metal,karat:karat||18,purity:purity||925,quantity,diamonds,braceletMetalTier,discount:0,profit:0,designFee:0};
 const result=pricing.computePricing(params);
 if(!result||result.priceOnRequest||result.hasUnpricedDiamond||!Number.isFinite(result.finalTotal)||result.finalTotal<=0)throw new Error('This configuration needs a personal quote.');
 const total=Math.round(result.finalTotal*100)/100,due=Math.round(total*paymentPercentage)/100;
 return {params,paymentPercentage,total,due,balance:Math.round((total-due)*100)/100,currency:'GBP'};
}
module.exports={quoteDaily};
