// Document-approved hidden halo schedules. All accents are retained in every online quote.
const products=require('./halo-products.json');
function normalize(id,diamonds,natural){
 const product=products.find(p=>p.id===id);if(!product)throw new Error('Choose a valid Halo ring.');
 if(natural)throw new Error('Natural Halo rings start with a 1 ct centre and require a complete personal quotation: 0.05 ct natural accents are not priced.');
 if(!Array.isArray(diamonds)||!diamonds[0])throw new Error('Choose the centre diamond.');
 return [{quality:diamonds[0].quality,carat:diamonds[0].carat,qty:1},{quality:diamonds[1]?.quality||diamonds[0].quality,carat:'0.05',qty:product.haloStones+product.paveStones}];
}
module.exports={normalize};
