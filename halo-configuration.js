// Document-approved hidden halo schedules. All accents are retained in every online quote.
const products=require('./halo-products.json');
function normalize(id,diamonds,natural){
 const product=products.find(p=>p.id===id);if(!product)throw new Error('Choose a valid Halo ring.');
 if(natural){
  const stones=require('./natural-diamonds').resolve(diamonds);
  const count=product.haloStones+product.paveStones;
  if(stones.length!==2||stones[0].qty!==1||stones[0].caratNum<0.25||
    stones[1].qty!==count||stones[1].naturalId!=='natural-accent-5'){
   throw new Error('Choose one natural centre diamond and the complete matching accent set.');
  }
  return stones.map(({naturalId,qty})=>({naturalId,qty}));
 }
 if(!Array.isArray(diamonds)||!diamonds[0])throw new Error('Choose the centre diamond.');
 return [{quality:diamonds[0].quality,carat:diamonds[0].carat,qty:1},{quality:diamonds[1]?.quality||diamonds[0].quality,carat:'0.05',qty:product.haloStones+product.paveStones}];
}
module.exports={normalize};
