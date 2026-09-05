// Run with NODE_PATH pointing to an installed playwright package; uses system Chromium.
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
(async()=>{
  const root=path.resolve(__dirname,'..');
  const requests=[]; let replyMode='normal';
  const server=http.createServer((req,res)=>{
    if(req.url==='/api/public/companion') {
      let text='';req.on('data',x=>text+=x);req.on('end',()=>{
        requests.push(JSON.parse(text));
        if(replyMode==='hang') return;
        res.writeHead(replyMode==='error'?503:200,{'content-type':'application/json'});
        res.end(JSON.stringify({line:'Local fixture response',mood:'happy'}));
      });
    } else {res.writeHead(200,{'content-type':'text/html'});res.end('<!doctype html><title>Local article</title><h1>Local fixture headline</h1><p>Test page</p><div style="height:3000px"></div>');}
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const base=`http://127.0.0.1:${server.address().port}`;
  const output=process.env.MIZUKI_TEST_OUTPUT || '/tmp/mizuki-repair-evidence';fs.mkdirSync(output,{recursive:true});
  const profile=fs.mkdtempSync('/tmp/mizuki-extension-test-');
  const browser=await chromium.launchPersistentContext(profile,{executablePath:'/usr/bin/chromium',headless:true,
    args:[`--disable-extensions-except=${root}`,`--load-extension=${root}`,'--no-sandbox'],viewport:{width:1100,height:800}});
  const errors=[];browser.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));
  try {
    const worker=browser.serviceWorkers()[0] || await browser.waitForEvent('serviceworker');
    const id=worker.url().split('/')[2];
    const page=await browser.newPage();await page.goto(base);
    await page.waitForTimeout(300);
    assert.equal(requests.length,0,'default install must not send browsing data');
    const newPage=browser.waitForEvent('page',{timeout:4000});
    // The real sprite click must open an extension-owned chat surface.
    await page.locator('#mizuki-sprite').click();
    const chat=await newPage;await chat.waitForLoadState();
    assert.equal(chat.url(),`chrome-extension://${id}/chat.html`);
    assert.equal(await page.locator('input,textarea').count(),0,'no chat input in host DOM');
    console.log('PASS default privacy and isolated chat entry');
    await worker.evaluate(base=>chrome.storage.local.set({apiBase:base,consentBase:base}),base);
    await chat.locator('#message').fill('My name is Example');
    await chat.locator('#send').click();
    await chat.locator('#status').filter({hasText:'Reply received'}).waitFor();
    assert.equal(await chat.locator('#message').inputValue(),'');
    await chat.reload();
    assert.match(await chat.locator('#transcript').innerText(),/My name is Example/);
    await chat.locator('#message').fill('Remember me?');await chat.locator('#send').click();
    await chat.locator('#status').filter({hasText:'Reply received'}).waitFor();
    assert.deepEqual(requests[1].history,['User: My name is Example','Mizuki: Local fixture response']);
    console.log('PASS persistent role-tagged chat');
    replyMode='error';await chat.locator('#message').fill('Keep this on error');await chat.locator('#send').click();
    await chat.locator('#status').filter({hasText:'HTTP 503'}).waitFor();
    assert.equal(await chat.locator('#message').inputValue(),'Keep this on error');
    await chat.reload();assert.equal(await chat.locator('#message').inputValue(),'Keep this on error');
    replyMode='hang';await chat.locator('#send').click();await chat.locator('#status').filter({hasText:'Thinking'}).waitFor();
    assert.equal(await chat.locator('#send').isDisabled(),true);
    assert.equal(await chat.locator('#message').inputValue(),'Keep this on error');
    await chat.locator('#clear').click();
    await chat.locator('#status').filter({hasText:'cleared'}).waitFor();
    assert.equal(await chat.locator('#message').inputValue(),'');
    console.log('PASS error recovery, durable draft, busy state and clear');
    await chat.screenshot({path:path.join(output,'chat.png'),fullPage:true});
    const popup=await browser.newPage();await popup.goto(`chrome-extension://${id}/popup.html`);
    await popup.locator('#mode').selectOption('occasional');
    await popup.locator('#sharePageContext').check();
    await popup.screenshot({path:path.join(output,'settings.png'),fullPage:true});
    await page.bringToFront();
    await worker.evaluate(()=>chrome.storage.local.set({enabled:false}));
    await page.waitForFunction(()=>document.querySelector('#mizuki-root').style.display==='none');
    await worker.evaluate(()=>chrome.storage.local.set({enabled:true,pos:{x:9000,y:9000},scale:4}));
    await page.setViewportSize({width:360,height:480});
    await page.waitForTimeout(200);
    let rect=await page.locator('#mizuki-sprite').boundingBox();
    assert.ok(rect.x>=0&&rect.y>=0&&rect.x+rect.width<=361&&rect.y+rect.height<=481,JSON.stringify(rect));
    await page.emulateMedia({reducedMotion:'reduce'});
    assert.equal(await page.locator('#mizuki-sprite').evaluate(el=>getComputedStyle(el).animationName),'none');
    await page.locator('#mizuki-launch').focus();assert.equal(await page.locator('#mizuki-launch').evaluate(el=>el===el.getRootNode().activeElement),true);
    await page.screenshot({path:path.join(output,'small-viewport.png')});
    await worker.evaluate(()=>chrome.storage.local.set({excludedSites:['127.0.0.1']}));
    await page.waitForFunction(()=>document.querySelector('#mizuki-root').style.display==='none');
    console.log('PASS live settings, site exclusions, viewport bounds, keyboard focus and reduced motion');
    // Deterministic scheduler checks in a real DOM with only extension APIs doubled.
    const harness=await browser.newPage();await harness.goto('about:blank');
    await harness.clock.install({time:new Date('2026-01-01T12:00:00Z')});
    await harness.evaluate(()=>{
      window.sent=[];window.listeners=[];
      window.chrome={runtime:{getURL:()=>'',sendMessage:async msg=>{sent.push(msg);return {ok:true,data:{line:'Scheduler fixture',mood:'flustered'}};}},
        storage:{local:{get:async d=>({...d,enabled:false,apiBase:'https://example.test',consentBase:'https://example.test',sharePageContext:true,mode:'occasional'}),set:async()=>{}},onChanged:{addListener:f=>listeners.push(f)}}};
      window.change=values=>listeners.forEach(f=>f(Object.fromEntries(Object.entries(values).map(([k,v])=>[k,{newValue:v}])),'local'));
    });
    await harness.addScriptTag({path:path.join(root,'common.js')});await harness.addScriptTag({path:path.join(root,'content.js')});
    await harness.clock.runFor(105000);assert.equal(await harness.evaluate(()=>sent.length),0);
    await harness.evaluate(()=>change({enabled:true}));
    await harness.clock.runFor(105000);assert.equal(await harness.evaluate(()=>sent.length),1);
    // CSS animations use the compositor clock, not Playwright's JS clock.
    await harness.waitForFunction(()=>!document.querySelector('#mizuki-root').shadowRoot.querySelector('#mizuki-sprite').classList.contains('shake'));
    assert.equal(await harness.locator('#mizuki-sprite').evaluate(el=>el.classList.contains('shake')),false);
    await harness.locator('#dismiss').click();await harness.evaluate(()=>change({mode:'manual'}));
    await harness.clock.runFor(200000);assert.equal(await harness.evaluate(()=>sent.length),1);
    await harness.evaluate(()=>change({mode:'occasional'}));
    for(let i=0;i<4;i++){await harness.clock.runFor(60000);await harness.evaluate(()=>window.dispatchEvent(new Event('scroll')));}
    assert.equal(await harness.evaluate(()=>sent.length),1,'scrolling must count as activity');
    await harness.clock.runFor(105000);assert.equal(await harness.evaluate(()=>sent.length),2);
    await harness.clock.runFor(16000);assert.equal(await harness.locator('#bubble').isVisible(),true,'reply stays until dismissed');
    console.log('PASS enable-after-disable, live scheduler mode, scroll activity, animation cleanup and persistent bubble');
    assert.deepEqual(errors,[]);console.log('PASS no page JavaScript errors');
  } finally {
    await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
