/* Natural diamond selection uses the exact workbook catalogue, not interpolated prices. */
const NaturalSelector = (() => {
  const data=NATURAL_DIAMOND_DATA.items;
  const state={origin:'lab',groups:[],page:0};
  const unavailableReason=()=>getCurrentProduct()?.id.startsWith('halo_')?'Natural Halo rings start with a 1 ct oval centre. Complete pricing requires an appointment because 0.05 ct natural accents are unavailable.':collectionIsSilver()?'Silver Collection has a fixed specification. Choose Lab-grown or another collection.':ORDER_CONFIGURATION_RULES[getCurrentProduct()?.id]?.labOnly?'This design uses its listed lab-grown diamonds. Choose Lab-grown or another piece.':'';
  const money=n=>'£'+Number(n).toLocaleString('en-GB',{minimumFractionDigits:2,maximumFractionDigits:2});
  const gradeHelp={carat:'Diamond weight, measured in carats.',colour:'Letter grade describing diamond colour.',clarity:'Grade describing inclusions and blemishes.',cut:'The cut grade listed for this diamond.'};
  const clarityNames={FL:'Flawless',IF:'Internally flawless',VVS1:'Very very slightly included 1',VVS2:'Very very slightly included 2',VS1:'Very slightly included 1',VS2:'Very slightly included 2',SI1:'Slightly included 1',SI2:'Slightly included 2'};
  const clarityOrder=['FL','IF','VVS1','VVS2','VS1','VS2','SI1','SI2'];
  const filterValues=key=>[...new Set(data.map(d=>d[key]))].sort((a,b)=>key==='clarity'?clarityOrder.indexOf(a)-clarityOrder.indexOf(b):key==='carat'?a-b:String(a).localeCompare(String(b)));
  function diamondIcon(name){
    const outlines={
      Round:'<circle cx="32" cy="32" r="26"/>',
      Cushion:'<rect x="8" y="8" width="48" height="48" rx="12"/>',
      Emerald:'<path d="M22 5H42L51 14V50L42 59H22L13 50V14Z"/>',
      Oval:'<ellipse cx="32" cy="32" rx="23" ry="28"/>',
      Marquise:'<path d="M32 3C59 24 59 40 32 61C5 40 5 24 32 3Z"/>'
    };
    const vertices={
      Round:[[32,6],[50.4,13.6],[58,32],[50.4,50.4],[32,58],[13.6,50.4],[6,32],[13.6,13.6]],
      Cushion:[[22,8],[42,8],[56,22],[56,42],[42,56],[22,56],[8,42],[8,22]],
      Emerald:[[22,5],[42,5],[51,14],[51,50],[42,59],[22,59],[13,50],[13,14]],
      Oval:[[32,4],[48.3,12.2],[55,32],[48.3,51.8],[32,60],[15.7,51.8],[9,32],[15.7,12.2]],
      Marquise:[[32,3],[46,18],[52,32],[46,46],[32,61],[18,46],[12,32],[18,18]]
    };
    const outer=vertices[name],scale=name==='Emerald'?.69:.55;
    const inner=outer.map(([x,y])=>[32+(x-32)*scale,32+(y-32)*scale]);
    const points=list=>list.map(p=>p.join(',')).join(' ');
    const facets=outer.map((p,i)=>`<polygon points="${points([p,outer[(i+1)%8],inner[(i+1)%8],inner[i]])}" fill="currentColor" fill-opacity="${i%2?.035:.10}" stroke-opacity=".65"/>`).join('');
    const extra=name==='Emerald'?'<path d="M24 12H40L45 17V47L40 52H24L19 47V17Z" stroke-opacity=".55"/>':outer.map((p,i)=>`<path d="M${p.join(' ')}L${inner[(i+1)%8].join(' ')}" stroke-opacity=".36"/>`).join('');
    return `<svg class="diamond-shape-art" viewBox="0 0 64 64" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linejoin="round">${facets}${extra}<polygon points="${points(inner)}" fill="currentColor" fill-opacity=".07" stroke-width="1.3"/><g stroke-width="1.6">${outlines[name]}</g></svg>`;
  }
  const grades=d=>`<dl class="diamond-grades"><div class="grade-colour"><dt>Colour</dt><dd>${d.colour}</dd></div><div class="grade-clarity"><dt>Clarity</dt><dd><abbr title="${clarityNames[d.clarity]||d.clarity}">${d.clarity}</abbr></dd></div><div class="grade-cut"><dt>Cut</dt><dd>${d.cut}</dd></div></dl>`;
  const section=document.querySelector('[aria-labelledby="diamondHeading"]');
  const labNodes=[...section.children].filter(n=>n.id!=='diamondHeading');
  const toolbar=document.createElement('div');toolbar.className='origin-toolbar';
  toolbar.innerHTML='<span id="diamondOriginLabel">Lab-grown diamonds</span><button type="button" id="changeDiamondOrigin">Change diamond type</button>';
  section.querySelector('h2').after(toolbar);
  const panel=document.createElement('div');panel.id='naturalSelector';panel.hidden=true;
  const shapes=['Round','Cushion','Emerald','Oval','Marquise'];
  panel.innerHTML=`<p class="muted">Choose a priced natural diamond combination, then add it to your piece. Prices are per diamond in GBP.</p><p class="small muted">0.05, 0.10 and 0.15ct natural diamonds are not currently priced.</p>
    <fieldset class="natural-shapes"><legend>Diamond shape</legend>${shapes.map(name=>`<button type="button" data-shape="${name}" aria-pressed="false">${diamondIcon(name)}<span class="shape-name">${name}</span></button>`).join('')}</fieldset>
    <div class="natural-filters">${['carat','colour','clarity','cut'].map(key=>`<label class="filter-${key}"><span class="grade-filter-label">${key==='carat'?'Carat':key[0].toUpperCase()+key.slice(1)}</span><small id="natural-${key}-help">${gradeHelp[key]}</small><select id="natural-${key}" aria-describedby="natural-${key}-help"><option value="">Any ${key}</option>${filterValues(key).map(v=>`<option value="${v}">${key==='clarity'?v+' — '+clarityNames[v]:key==='carat'?v+' ct':v}</option>`).join('')}</select></label>`).join('')}
    <label>Maximum price per diamond (£)<input id="natural-budget" type="number" min="0" step="1" placeholder="Any budget" aria-describedby="natural-budget-help"><small id="natural-budget-help">Filters results only; excludes metal and other diamonds.</small></label>
    <label>Sort by<select id="natural-sort"><option value="asc">Lowest price first</option><option value="desc">Highest price first</option></select></label></div>
    <button type="button" id="natural-clear">Clear filters</button><p id="natural-count" role="status"></p>
    <div id="natural-results" class="natural-results"></div><div class="natural-pagination"><button type="button" id="natural-prev">Previous</button><button type="button" id="natural-next">Next</button></div>
    <h3>Your natural diamonds</h3><p class="small muted">Add up to four groups. Quantity is the number of identical diamonds in that group.</p><div id="natural-selected"></div><button type="button" id="natural-add-another">Add another diamond</button><p id="natural-warning" role="status"></p>`;
  section.append(panel);
  let shape='Round';
  panel.querySelector('[data-shape="Round"]').setAttribute('aria-pressed','true');
  function refreshQuote(){destroyAirwallexDropin();updateLiveTotal();document.getElementById('calc').disabled=state.origin==='natural'&&(!state.groups.length||!!unavailableReason());}
  function renderResults(){
    const filters=Object.fromEntries(['carat','colour','clarity','cut'].map(k=>[k,document.getElementById('natural-'+k).value]));
    const budget=Number(document.getElementById('natural-budget').value);
    const list=data.filter(d=>(!shape||shape===d.shape)&&Object.entries(filters).every(([k,v])=>!v||String(d[k])===v)&&(!budget||d.price<=budget));
    list.sort((a,b)=>document.getElementById('natural-sort').value==='asc'?a.price-b.price:b.price-a.price);
    const pages=Math.max(1,Math.ceil(list.length/12));state.page=Math.min(state.page,pages-1);
    document.getElementById('natural-count').textContent=`${list.length} priced combinations · Page ${state.page+1} of ${pages}`;
    document.getElementById('natural-results').innerHTML=list.slice(state.page*12,state.page*12+12).map(d=>`<article class="natural-result"><strong>${d.shape} · ${d.carat}ct</strong>${grades(d)}<b>${money(d.price)}</b><button type="button" data-add="${d.id}" ${state.groups.length>=4?'disabled':''}>Add diamond</button></article>`).join('')||'<p>No priced combinations match. Try clearing a filter or increasing your budget.</p>';
    document.getElementById('natural-prev').disabled=state.page===0;document.getElementById('natural-next').disabled=state.page>=pages-1;
  }
  function renderSelected(){
    if(getCurrentProduct()?.id.startsWith('halo_')){document.getElementById('natural-carat').value='1';panel.querySelectorAll('[data-shape]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.shape==='Oval')));}
    document.getElementById('natural-selected').innerHTML=state.groups.map((g,i)=>{const d=data.find(d=>d.id===g.naturalId);return `<article class="natural-selected"><div><strong>${d.shape} · ${d.carat}ct</strong>${grades(d)}<p>${money(d.price)} each</p></div><label>Quantity<input aria-label="Quantity for natural diamond group ${i+1}" type="number" min="1" max="100" value="${g.qty}" data-quantity="${i}"></label><strong>${money(d.price*g.qty)}</strong><button type="button" data-remove="${i}" aria-label="Remove natural diamond group ${i+1}">Remove</button></article>`;}).join('')||'<p>Select a diamond above to calculate your quote.</p>';
    document.getElementById('natural-warning').textContent=unavailableReason();
    refreshQuote();renderResults();
    document.getElementById('natural-add-another').disabled=state.groups.length>=4;
  }
  panel.addEventListener('click',e=>{
    const button=e.target.closest('button');if(!button)return;
    if(button.dataset.shape){shape=button.dataset.shape;panel.querySelectorAll('[data-shape]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.shape===shape));state.page=0;renderResults();}
    if(button.dataset.add&&state.groups.length<4){state.groups.push({naturalId:button.dataset.add,qty:1});renderSelected();}
    if(button.dataset.remove!==undefined){state.groups.splice(Number(button.dataset.remove),1);renderSelected();}
  });
  panel.addEventListener('change',e=>{
    if(e.target.dataset.quantity!==undefined){const qty=Number(e.target.value);if(!Number.isInteger(qty)||qty<1||qty>100){e.target.value=state.groups[Number(e.target.dataset.quantity)].qty;return;}state.groups[Number(e.target.dataset.quantity)].qty=qty;renderSelected();}
    else {state.page=0;renderResults();}
  });
  document.getElementById('natural-prev').onclick=()=>{state.page--;renderResults();};document.getElementById('natural-next').onclick=()=>{state.page++;renderResults();};
  document.getElementById('natural-add-another').onclick=()=>{panel.querySelector('.natural-shapes').scrollIntoView({behavior:'smooth',block:'start'});panel.querySelector('[aria-pressed="true"]').focus({preventScroll:true});document.getElementById('natural-warning').textContent='Choose the specifications above and add the next diamond. Your existing selections are kept.';};
  document.getElementById('natural-clear').textContent='Clear other filters';
  document.getElementById('natural-clear').onclick=()=>{panel.querySelectorAll('.natural-filters input,.natural-filters select').forEach(e=>e.value=e.id==='natural-sort'?'asc':'');state.page=0;renderResults();};
  const dialog=document.createElement('dialog');dialog.id='diamondOriginDialog';dialog.setAttribute('aria-labelledby','originTitle');
  dialog.innerHTML='<h2 id="originTitle">Which diamonds are we calculating?</h2><p>Choose your diamond type, then begin with your jewelry piece.</p><div class="origin-choices"><button type="button" data-origin="lab"><strong>Lab-grown diamonds</strong><span>Our existing Select and Luxe pricing</span></button><button type="button" data-origin="natural"><strong>Natural diamonds</strong><span>Choose shape, carat, colour, clarity and cut</span></button></div>';
  document.body.append(dialog);
  dialog.addEventListener('cancel',e=>e.preventDefault());
  dialog.addEventListener('click',e=>{const button=e.target.closest('[data-origin]');if(!button)return;state.origin=button.dataset.origin;panel.hidden=state.origin!=='natural';labNodes.forEach(n=>n.hidden=state.origin==='natural');document.getElementById('diamondOriginLabel').textContent=state.origin==='natural'?'Natural diamonds':'Lab-grown diamonds';dialog.close();document.getElementById('collection').focus();if(state.origin==='lab')applyDesignLocks();renderSelected();});
  document.getElementById('changeDiamondOrigin').onclick=()=>dialog.showModal();
  document.getElementById('collection').addEventListener('change',()=>{state.groups=[];renderSelected();});
  document.getElementById('product').addEventListener('change',()=>{state.groups=[];renderSelected();});
  document.getElementById('reset').addEventListener('click',()=>{state.groups=[];renderSelected();});
  dialog.showModal();
  return {get origin(){return state.origin;},get unavailableReason(){return unavailableReason();},payload:()=>state.groups.map(g=>({...g})),entries:()=>state.groups.map(g=>{const d=data.find(d=>d.id===g.naturalId);return {...d,quality:`Natural · ${d.shape} · ${d.colour} · ${d.clarity} · ${d.cut}`,carat:String(d.carat),caratNum:d.carat,qty:g.qty,unpriced:false,total:Math.round(d.price*g.qty*100)/100};})};
})();
