(() => {
  const api=typeof browser!=='undefined'?browser:chrome;
  const $=id=>document.getElementById(id);
  let savedBase='', writes=Promise.resolve();
  function save(values) {
    writes=writes.catch(()=>{}).then(()=>api.storage.local.set(values));
    writes.then(()=>$('status').textContent='Saved. Changes apply immediately.',error=>$('status').textContent=error.message);
    return writes;
  }
  function destination(){ $('destination').textContent=`Saved destination: ${savedBase}. Changing it requires consent again.`; }
  $('openChat').addEventListener('click',()=>api.runtime.sendMessage({type:'mizuki-open-chat'}).catch(error=>$('status').textContent=error.message));
  api.storage.local.get(Mizuki.DEFAULTS).then(s=>{
    savedBase=s.apiBase;$('apiBase').value=s.apiBase;destination();
    $('consent').checked=s.consentBase===s.apiBase;
    for(const key of ['enabled','sharePageContext']) $(key).checked=s[key];
    for(const key of ['mode','outfit','persona','language','scale']) $(key).value=s[key];
    $('scaleVal').textContent=Number(s.scale).toFixed(2);
    $('excludedSites').value=s.excludedSites.join('\n');$('controls').disabled=false;
  }).catch(error=>$('status').textContent=error.message);
  $('saveServer').addEventListener('click',async()=>{
    try {
      const base=Mizuki.serverBase($('apiBase').value);
      await save({apiBase:base,consentBase:'',sharePageContext:false,mode:'manual'});
      savedBase=base;$('apiBase').value=base;$('consent').checked=false;$('sharePageContext').checked=false;$('mode').value='manual';destination();
    } catch(error){$('status').textContent=error.message;}
  });
  $('consent').addEventListener('change',()=>{
    if($('apiBase').value.trim()!==savedBase){$('consent').checked=false;$('status').textContent='Save the changed server first, then allow it.';return;}
    save({consentBase:$('consent').checked?savedBase:''});
  });
  for(const key of ['enabled','sharePageContext']) $(key).addEventListener('change',()=>save({[key]:$(key).checked}));
  for(const key of ['mode','outfit','persona','language']) $(key).addEventListener('change',()=>save({[key]:$(key).value}));
  $('scale').addEventListener('input',()=>{$('scaleVal').textContent=Number($('scale').value).toFixed(2);save({scale:Number($('scale').value)});});
  $('resetPos').addEventListener('click',()=>save({pos:null}));
  $('saveSites').addEventListener('click',()=>{
    try{const sites=Mizuki.parseSites($('excludedSites').value);save({excludedSites:sites});$('excludedSites').value=sites.join('\n');}
    catch(error){$('status').textContent=error.message;}
  });
})();
