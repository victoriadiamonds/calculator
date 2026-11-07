// This module belongs in the calculator repository as daily-checkout.js.
const pricing=require('./pricing');
const orderRules=require('./order-configuration-rules.json');
function quoteDaily(body={}, collection='dailySparkle') {
 if(require('./tennis-products.json').migratedIds.includes(body.productId)&&['occasionWear','mens'].includes(collection))collection='tennis';
 if(!['dailySparkle','occasionWear','foreverBond','singleLady','mens','keepsake','tennis','halo','christmas','prism'].includes(collection))throw new Error('Unsupported online collection.');
 const product=pricing.getProductsForCollection(collection,'all').find(p=>p.id===body.productId);
 if(!product)throw new Error('Please choose a valid piece from this collection.');
 if(!['gold','silver','platinum'].includes(body.metal))throw new Error('Please choose a valid metal.');
 const karat=Number(body.karat),purity=Number(body.purity);
 if(body.metal==='gold'&&![9,14,18,22].includes(karat))throw new Error('Please choose a valid gold karat.');
 if(body.metal==='silver'&&purity!==925)throw new Error('Please choose a valid silver purity.');
 const quantity=Number(body.quantity),paymentPercentage=Number(body.paymentPercentage);
 if(!Number.isInteger(quantity)||quantity<1||quantity>10)throw new Error('Quantity must be between 1 and 10.');
 if(![50,100].includes(paymentPercentage))throw new Error('Choose a 50% deposit or full payment.');
 if(!Array.isArray(body.diamonds)||body.diamonds.length<(['foreverBond','singleLady'].includes(collection)?0:1)||body.diamonds.length>4)throw new Error('Please check the diamond specifications (up to four groups).');
 const rule=orderRules[product.id];
 if(rule?.initialRequired&&!/^[A-Z]$/.test(String(body.initial||'')))throw new Error('Choose one initial from A to Z.');
 if(rule?.diamondColours){
  if(!rule.diamondColours.includes(body.diamondColour||'pink'))throw new Error('Choose an available diamond colour.');
  if(body.diamonds.length!==1||!rule.diamondCarats.includes(body.diamonds[0]?.carat)||Number(body.diamonds[0]?.qty)!==rule.stoneCount)throw new Error('Choose an available Prism stone size and the fixed design count.');
 }
 const natural=body.diamondOrigin==='natural';
 if(rule?.labOnly&&natural)throw new Error('This design uses its listed lab-grown diamonds.');
 if(body.diamondOrigin&&!['lab','natural'].includes(body.diamondOrigin))throw new Error('Invalid diamond origin.');
 const requestedDiamonds=collection==='halo'?require('./halo-configuration').normalize(product.id,body.diamonds,natural):natural?body.diamonds:(rule?.fixedDiamonds||body.diamonds);
 const diamonds=requestedDiamonds.map(d=>{
  if(natural){require('./natural-diamonds').resolve([d]);return {naturalId:d.naturalId,qty:Number(d.qty)};}
  if(!d||!['select','luxe'].includes(d.quality)||!pricing.DIAMOND_CARATS.includes(d.carat)||!Number.isInteger(Number(d.qty))||Number(d.qty)<1||Number(d.qty)>100)throw new Error('Please check the diamond specifications.');
  return {quality:d.quality,carat:d.carat,qty:Number(d.qty)};
 });
 const braceletMetalTier=rule?.braceletMetalTier||body.braceletMetalTier;
 if(product.type==='bracelet'&&!Object.hasOwn(pricing.PRICING_PACKAGE_MATRIX,braceletMetalTier))throw new Error('Please choose a bracelet specification.');
 const params={collection,productId:product.id,typeFilter:'all',metal:body.metal,karat:karat||18,purity:purity||925,quantity,diamonds,diamondOrigin:body.diamondOrigin||'lab',braceletMetalTier,discount:0,profit:0,designFee:0};
 if(!natural&&rule?.diamondPriceOptions){const carat=Number(diamonds[0]?.carat).toFixed(2);if(!Object.hasOwn(rule.diamondPriceOptions,carat))throw new Error('Choose an available bracelet diamond size.');params.diamonds=[{quality:'select',carat,qty:1}];}
 if(rule?.necklaceLengths){const length=Number(body.necklaceLength||16);if(!rule.necklaceLengths.includes(length))throw new Error("Choose a valid necklace length.");params.necklaceLength=length;}
 if(body.braceletSize!=null){if(product.type!=='bracelet'||!['2.5|6.5','2.5|7','3|6.5','3|7'].includes(body.braceletSize))throw new Error('Choose a valid bracelet size.');params.braceletSize=body.braceletSize;}
 if(rule?.initialRequired)params.initial=body.initial;
 if(rule?.diamondColours)params.diamondColour=body.diamondColour||'pink';
 const result=pricing.computePricing(params);
 if(!result||result.priceOnRequest||result.hasUnpricedDiamond||!Number.isFinite(result.finalTotal)||result.finalTotal<=0)throw new Error('This configuration needs a personal quote.');
 const total=Math.round(result.finalTotal*100)/100,due=Math.round(total*paymentPercentage)/100;
 return {params,paymentPercentage,total,due,balance:Math.round((total-due)*100)/100,currency:'GBP'};
}
module.exports={quoteDaily};
