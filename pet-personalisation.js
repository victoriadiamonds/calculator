'use strict';
function read(product,body,required=false){
 const result={},config=product.personalisation||{};
 const name=String(body.petName||'').normalize('NFKC').trim();
 if(required&&config.petNameRequired&&!name)throw Error('Enter a pet name (up to 8 characters).');
 if(name){if(!config.petNameRequired||[...name].length>8||!/^[-\p{L}\p{N} ']+$/u.test(name))throw Error('Pet name must contain up to 8 letters, numbers, spaces, apostrophes or hyphens.');result.petName=name;}
 const size=String(body.ringSize||'').trim().toUpperCase();
 if(required&&config.ringSizeRequired&&!size)throw Error('Enter your UK ring size.');
 if(size){if(!config.ringSizeRequired||!/^[A-Z](?: 1\/2|\+[12])?$/.test(size))throw Error('Enter a UK ring size such as M or M 1/2.');result.ringSize=size;}
 const reverse=String(body.reverseEngraving||'').normalize('NFKC').trim();
 if(reverse){if([...reverse].length>40||!/^[-\p{L}\p{N} +().,'/]+$/u.test(reverse))throw Error('Reverse engraving must use up to 40 letters, numbers or standard punctuation.');result.reverseEngraving=reverse;}
 return result;
}
module.exports={read};
