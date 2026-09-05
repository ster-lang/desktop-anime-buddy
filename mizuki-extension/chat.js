(() => {
  const api=typeof browser!=='undefined'?browser:chrome;
  const $=id=>document.getElementById(id);
  let pending=false, epoch=0, draftWrites=Promise.resolve();
  function saveDraft(value) {
    draftWrites=draftWrites.catch(()=>{}).then(()=>api.storage.local.set({draft:value}));
    return draftWrites;
  }
  function render(turns) {
    $('transcript').replaceChildren();
    for(const turn of turns) {
      const entry=document.createElement('article');entry.className=turn.role==='user'?'user':'assistant';
      const name=document.createElement('strong');name.textContent=turn.role==='user'?'You':'Mizuki';
      const text=document.createElement('p');text.textContent=turn.content;
      entry.append(name,text);$('transcript').append(entry);
    }
    $('transcript').scrollTop=$('transcript').scrollHeight;
  }
  function setPending(value) {pending=value;$('send').disabled=value;$('message').readOnly=value;$('chatForm').setAttribute('aria-busy',String(value));}
  async function submit(e) {
    e.preventDefault();
    const text=$('message').value.trim();
    if(pending || !text) return;
    const current=epoch;setPending(true);$('status').textContent='Thinking… Your message is kept until the reply arrives.';
    try {
      await saveDraft($('message').value);
      const reply=await api.runtime.sendMessage({type:'mizuki-chat',text});
      if(current!==epoch) return;
      if(!reply?.ok) throw new Error(reply?.error || 'No response. Your message is kept.');
      $('message').value='';await saveDraft('');
      $('status').textContent='Reply received.';
    } catch(error) {if(current===epoch)$('status').textContent=error.message;}
    finally {if(current===epoch){setPending(false);$('message').focus();}}
  }
  $('chatForm').addEventListener('submit',submit);
  $('message').addEventListener('input',()=>{saveDraft($('message').value).catch(()=>$('status').textContent='Could not save the draft locally. Keep this tab open.');});
  $('message').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();$('chatForm').requestSubmit();}});
  $('clear').addEventListener('click',async()=>{
    epoch++;setPending(true);
    try {
      await draftWrites.catch(()=>{});
      const reply=await api.runtime.sendMessage({type:'mizuki-clear'});
      if(!reply?.ok) throw new Error(reply?.error || 'Unable to clear history.');
      $('status').textContent=reply?.revoked ? 'Local history cleared; server copies are not deleted. Session revoked (server-side deletion depends on the server).' : 'Local history and draft cleared. Server copies are not deleted.';
    } catch(error){$('status').textContent=error.message;}
    finally{setPending(false);}
  });
  api.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes.conversation)render(changes.conversation.newValue || []);});
  $('send').disabled=true;
  // Draft is shared; each chat restores from it and updates it live.
  api.storage.local.get({...Mizuki.DEFAULTS,conversation:[],draft:null}).then(stored=>{
    render(stored.conversation);$('message').value=stored.draft||'';
    const outfit=Mizuki.OUTFITS.includes(stored.outfit)?stored.outfit:'sweater';$('portrait').src=api.runtime.getURL(`sprites/companion-${outfit}-idle.png`);
    $('status').textContent=stored.consentBase===stored.apiBase?'Ready.':'Network access is off. Open Settings & privacy to allow your chosen server.';
    $('send').disabled=false;
  }).catch(error=>{$('status').textContent=error.message;});
})();
