(() => {
  const api = typeof browser !== 'undefined' ? browser : chrome;
  if (document.getElementById('mizuki-root')) return;
  let settings = {...Mizuki.DEFAULTS}, lastActivity = Date.now(), lastAttempt = 0, generation = 0;
  let busy = false, leftAt = 0, blinkTimer, unblinkTimer, dragging = null, suppressClick = false;
  const host = document.createElement('div'); host.id = 'mizuki-root';
  // Shadow DOM is style isolation only. Private chat never enters this document.
  const shadow = host.attachShadow({mode:'open'});
  const style = document.createElement('style'); style.textContent = `
    :host { all: initial; }
    * { box-sizing: border-box; }
    #anchor { position:relative; font:13px/1.4 system-ui,sans-serif; color:#1b2340; }
    button { font:inherit; color:inherit; cursor:pointer; }
    #mizuki-launch { display:block; border:0; padding:0; background:transparent; touch-action:none; }
    #mizuki-launch:focus-visible { outline:3px solid #6859ba; outline-offset:3px; border-radius:8px; }
    #mizuki-sprite { display:block; width:100%; height:auto; user-select:none; filter:drop-shadow(3px 4px 0 #1b234055); animation:float 4s ease-in-out infinite; }
    #mizuki-sprite.shake { animation:shake 400ms ease-in-out 2; }
    #anchor.dragging #mizuki-sprite { animation:none; cursor:grabbing; }
    #bubble { position:absolute; right:0; bottom:calc(100% + 8px); width:min(284px,calc(100vw - 16px)); max-height: min(180px,45vh); overflow:auto; padding:10px; background:#fdf3e3; border:2px solid #1b2340; border-radius:6px; box-shadow:3px 3px 0 #1b234055; overflow-wrap:anywhere; }
    #bubble.below { bottom:auto; top:calc(100% + 8px); }
    #bubble[hidden] { display:none; }
    #dismiss { float:right; padding:0 5px; margin-left:8px; background:none; border:1px solid #1b2340; border-radius:3px; }
    .name { font-size:10px; letter-spacing:.1em; margin-bottom:5px; }
    @keyframes float { 0%,100% { transform:translateY(0); } 50% { transform:translateY(-3px); } }
    @keyframes shake { 0%,100% {transform:translateX(0);} 25% {transform:translateX(-3px);} 75% {transform:translateX(3px);} }
    @media (prefers-reduced-motion:reduce) { #mizuki-sprite, #mizuki-sprite.shake {animation:none;} }
  `;
  const anchor=document.createElement('div'); anchor.id='anchor';
  const launch=document.createElement('button'); launch.id='mizuki-launch'; launch.type='button';
  launch.setAttribute('aria-label','Open private chat with Mizuki'); launch.title='Click or press Enter to chat privately. Drag to move.';
  const sprite=document.createElement('img'); sprite.id='mizuki-sprite'; sprite.alt=''; sprite.draggable=false; sprite.dataset.mood='idle';
  launch.append(sprite);
  const bubble=document.createElement('section'); bubble.id='bubble'; bubble.hidden=true; bubble.setAttribute('aria-label','Mizuki page reaction');
  const dismiss=document.createElement('button'); dismiss.id='dismiss'; dismiss.type='button'; dismiss.textContent='×'; dismiss.setAttribute('aria-label','Dismiss reaction');
  const name=document.createElement('div'); name.className='name'; name.textContent='MIZUKI · PAGE REACTION';
  const line=document.createElement('div'); line.setAttribute('role','status'); line.setAttribute('aria-live','polite');
  bubble.append(dismiss,name,line); anchor.append(launch,bubble); shadow.append(style,anchor);
  document.documentElement.append(host);
  host.style.cssText='all:initial !important; position:fixed !important; z-index:2147483647 !important; display:none;';
  function allowed() { return settings.enabled && !Mizuki.excluded(location.hostname,settings.excludedSites); }
  function automatic() { return allowed() && settings.consentBase === settings.apiBase && settings.sharePageContext && ['occasional','conversational'].includes(settings.mode); }
  function spriteURL(mood) {
    const outfit=Mizuki.OUTFITS.includes(settings.outfit)?settings.outfit:'sweater';
    return api.runtime.getURL(`sprites/companion-${outfit}-${mood}.png`);
  }
  function mood(value) {
    clearTimeout(unblinkTimer);
    sprite.dataset.mood=Mizuki.MOODS.includes(value)?value:'idle';
    sprite.src=spriteURL(sprite.dataset.mood);
    sprite.classList.remove('shake');
    if(value==='flustered' && !matchMedia('(prefers-reduced-motion: reduce)').matches) { void sprite.offsetWidth; sprite.classList.add('shake'); }
  }
  function position() {
    // Anchor the sprite, not the speech stack, and reserve room for the floating animation.
    const width=Math.max(1,Math.min(118*(Number(settings.scale)||2),innerWidth-16,(innerHeight-16)*512/700));
    launch.style.width=`${width}px`;
    const height=launch.getBoundingClientRect().height || width*700/512;
    const p=Mizuki.clampPosition(settings.pos,width,height+4,innerWidth,innerHeight);
    host.style.setProperty('left',`${p.x}px`,'important');
    host.style.setProperty('top',`${Math.max(4,p.y)}px`,'important');
    const availableAbove=p.y-8, availableBelow=innerHeight-p.y-height-8;
    const below=availableAbove<100 && availableBelow>availableAbove;
    bubble.classList.toggle('below',below);
    bubble.style.maxHeight=`${Math.max(40,Math.min(180,below?availableBelow:availableAbove))}px`;
    const bubbleWidth=Math.min(284,Math.max(1,innerWidth-16));
    const bubbleX=Math.max(8,Math.min(innerWidth-bubbleWidth-8,p.x+width-bubbleWidth));
    bubble.style.right='auto'; bubble.style.left=`${bubbleX-p.x}px`;
  }
  function blink() {
    clearTimeout(blinkTimer);
    if(!allowed() || document.hidden || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    blinkTimer=setTimeout(()=>{
      if(sprite.dataset.mood==='idle') {
        sprite.src=spriteURL('blink');
        unblinkTimer=setTimeout(()=>{sprite.src=spriteURL(sprite.dataset.mood);},180);
      }
      blink();
    },3000+Math.random()*4000);
  }
  function apply() {
    generation++;
    host.style.setProperty('display',allowed()?'block':'none','important');
    if(!automatic()) bubble.hidden=true;
    mood(sprite.dataset.mood); position(); blink();
    lastActivity=Date.now();
  }
  async function react(kind) {
    if(!automatic() || !currentVisible || document.hidden || busy || !bubble.hidden || Date.now()-lastAttempt<120000) return;
    busy=true; lastAttempt=Date.now(); const current=generation;
    try {
      const reply=await api.runtime.sendMessage({type:'mizuki-auto',kind,tabId:currentTabId||null,context:{title:document.title.slice(0,200),headline:(document.querySelector('h1')?.textContent || '').trim().slice(0,90)}});
      if(current!==generation || !automatic() || document.hidden) return;
      if(reply?.ok && reply.data) { line.textContent=reply.data.line; mood(reply.data.mood); bubble.hidden=false; position(); }
      // Automatic failures stay quiet; manual chat displays actionable errors.
    } catch { /* Extension reload or unavailable worker: never disrupt the host page. */ }
    finally { busy=false; }
  }
  dismiss.addEventListener('click',()=>{bubble.hidden=true;launch.focus();});
  sprite.addEventListener('load',position);
  sprite.addEventListener('animationend',()=>sprite.classList.remove('shake'));
  launch.addEventListener('click',async e=>{
    if(suppressClick && e.detail!==0) {suppressClick=false;return;}
    suppressClick=false;
    try {await api.runtime.sendMessage({type:'mizuki-open-chat'});} catch { launch.title='Reload this tab after updating Mizuki.'; }
  });
  launch.addEventListener('pointerdown',e=>{
    if(e.button!==0) return;
    const rect=host.getBoundingClientRect();
    dragging={id:e.pointerId,startX:e.clientX,startY:e.clientY,dx:e.clientX-rect.left,dy:e.clientY-rect.top,moved:false};
    launch.setPointerCapture(e.pointerId);
  });
  launch.addEventListener('pointermove',e=>{
    if(!dragging || e.pointerId!==dragging.id) return;
    if(Math.hypot(e.clientX-dragging.startX,e.clientY-dragging.startY)<5 && !dragging.moved) return;
    dragging.moved=true;anchor.classList.add('dragging');
    settings.pos={x:e.clientX-dragging.dx,y:e.clientY-dragging.dy};position();
  });
  function endDrag(e) {
    if(!dragging || e.pointerId!==dragging.id) return;
    suppressClick=dragging.moved || e.type==='pointercancel';
    if(dragging.moved) {
      const r=host.getBoundingClientRect(); settings.pos={x:r.x,y:r.y};
      api.storage.local.set({pos:settings.pos}).catch(()=>{});
    }
    dragging=null;anchor.classList.remove('dragging');
    if(launch.hasPointerCapture(e.pointerId)) launch.releasePointerCapture(e.pointerId);
  }
  launch.addEventListener('pointerup',endDrag);launch.addEventListener('pointercancel',endDrag);
  shadow.addEventListener('keydown',e=>{if(e.key==='Escape'){bubble.hidden=true;launch.focus();}});
  const bump=()=>{lastActivity=Date.now();};
  for(const event of ['pointerdown','pointermove','keydown','scroll','wheel','touchstart']) window.addEventListener(event,bump,{capture:true,passive:true});
  window.addEventListener('resize',position);
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden) {leftAt=Date.now();clearTimeout(blinkTimer);clearTimeout(unblinkTimer);sprite.src=spriteURL(sprite.dataset.mood);}
    else {bump();blink();if(leftAt && Date.now()-leftAt>20000) void react('return');}
  });
  // One stable scheduler; every callback consults live settings, including enable-after-disable.
  setInterval(()=>{if(Date.now()-lastActivity>90000) {lastActivity=Date.now();void react('idle');}},15000);
  api.storage.onChanged.addListener((changes,area)=>{
    if(area!=='local') return;
    let changed=false;
    for(const key of Object.keys(Mizuki.DEFAULTS)) if(changes[key]) {settings[key]=changes[key].newValue ?? Mizuki.DEFAULTS[key];changed=true;}
    if(changed) apply();
  });
  // Per-tab visibility: only the active, visible tab reacts automatically.
  let currentTabId = null, currentVisible = false;
  function updateTabState() {
    api.tabs.getCurrent().then(tab => {
      currentTabId = tab?.id; currentVisible = !document.hidden;
    }).catch(() => { currentTabId = null; currentVisible = false; });
  }
  window.addEventListener('visibilitychange', () => { updateTabState(); });
  window.addEventListener('focus', () => { updateTabState(); });
  api.storage.local.get({lastActiveTabAt:{}}).catch(()=>{});
  api.storage.local.get(Mizuki.DEFAULTS).then(stored=>{settings=stored;apply();void react('page');updateTabState();}).catch(()=>{});
})();
