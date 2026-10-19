const data = require('./natural-diamonds-data');
const byId = new Map(data.items.map(item => [item.id, item]));
function resolve(groups) {
  if (!Array.isArray(groups) || !groups.length || groups.length > 4) throw new Error('Select one to four natural diamond groups.');
  return groups.map(group => {
    const item = byId.get(group?.naturalId);
    const qty = Number(group?.qty);
    if (!item || !Number.isInteger(qty) || qty < 1 || qty > 100) throw new Error('Choose a valid natural diamond and quantity (1–100).');
    return { ...item, naturalId:item.id, quality:`Natural · ${item.shape} · ${item.colour} · ${item.clarity} · ${item.cut}`, carat:String(item.carat), caratNum:item.carat, qty, unpriced:false, total:Math.round(item.price * qty * 100)/100 };
  });
}
function search(filters={}) {
  let items=data.items.filter(item => ['shape','colour','clarity','cut'].every(key=>!filters[key]||item[key]===filters[key]) && (!filters.carat||item.carat===Number(filters.carat)) && (!filters.maxPrice||item.price<=Number(filters.maxPrice)));
  items.sort((a,b)=> filters.sort==='price-desc'?b.price-a.price:a.price-b.price);
  const offset=Math.max(0,Number(filters.offset)||0),limit=Math.min(100,Math.max(1,Number(filters.limit)||40));
  return {currency:'GBP',total:items.length,items:items.slice(offset,offset+limit),offset,limit};
}
const facets=Object.fromEntries(['shape','carat','colour','cut','clarity'].map(key=>[key,[...new Set(data.items.map(item=>item[key]))]]));
module.exports={resolve,search,facets};
