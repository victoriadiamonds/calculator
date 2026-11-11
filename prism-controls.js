/* Colour is retained in the order; other collections retain their own design locks. */
(()=>{
 let wasPrism=false;
 const update=()=>{const rule=ORDER_CONFIGURATION_RULES[getCurrentProduct()?.id],active=!!rule?.diamondColours;document.getElementById('prismColourWrap').hidden=!active;
  document.getElementById('prismIntensityWrap').hidden=!active;
  applyDesignLocks();
  document.getElementById('dq0').disabled=active;
  if(active){document.getElementById('dq0').value='select';const carat=document.getElementById('dc0');if(!rule.diamondCarats.includes(Number(carat.value).toFixed(2)))carat.value='1.00';document.getElementById('additionalDiamonds').hidden=true;for(let i=1;i<4;i++)document.getElementById('dc'+i).value='0';}
  else if(wasPrism)document.getElementById('additionalDiamonds').hidden=false;
  wasPrism=active;
 };
 ['collection','product','typeFilter','dc0'].forEach(id=>document.getElementById(id).addEventListener('change',()=>{update();updateLiveTotal();}));document.getElementById('prismColour').addEventListener('change',updateLiveTotal);document.getElementById('prismIntensity').addEventListener('change',updateLiveTotal);update();
})();
