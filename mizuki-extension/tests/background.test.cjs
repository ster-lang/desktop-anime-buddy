const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
function setup(initial = {}, fetcher) {
  const stored = structuredClone(initial), listeners = [], changes = [], calls = [], opened = [];
  const api = {
    runtime: {id:'test-extension', getURL:p=>`chrome-extension://test-extension/${p}`, onMessage:{addListener:f=>listeners.push(f)}},
    storage: {local:{get:async defaults=>({...defaults,...structuredClone(stored)}),set:async values=>{
      Object.assign(stored,structuredClone(values));
      changes.forEach(f=>f(Object.fromEntries(Object.entries(values).map(([k,v])=>[k,{newValue:v}])),'local'));
    }},onChanged:{addListener:f=>changes.push(f)}},
    tabs: {create:async options=>{opened.push(options); return {id:1};},get:async id=>({id,active:true,url:'https://example.com/'})}
  };
  const cryptoStub = {randomUUID:()=>String(Math.random()*1e16)+String(Math.random()*1e16)};
  const context=vm.createContext({chrome:api, console, URL, AbortController, Date, crypto:cryptoStub, setTimeout:(f,ms)=>setTimeout(f,ms===30000?30:ms),clearTimeout,
    fetch:async (...args)=>{calls.push(args); return fetcher ? fetcher(...args) : {ok:true,json:async()=>({line:'Fixture reply',mood:'happy'})};}});
  context.importScripts=(...files)=>files.forEach(file=>vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context));
  context.importScripts('background.js');
  async function send(msg,sender={id:'test-extension',url:'chrome-extension://test-extension/chat.html'}) {
    return new Promise((resolve,reject)=>{
      const result=listeners[0](msg,sender,resolve);
      if(result?.then) result.then(resolve,reject);
      else if(result!==true) resolve(result);
    });
  }
  return {send,calls,stored,opened,api};
}
const consent={apiBase:'https://example.test',consentBase:'https://example.test',mode:'occasional',sharePageContext:true};
const tab={id:'test-extension',url:'https://example.com/',tab:{id:2,active:true},frameId:0};
test('no server request before explicit destination consent, including legacy messages',async()=>{
  const h=setup();
  const reply=await h.send({type:'mizuki-speak',apiBase:'https://example.test',payload:{event:'hello'}});
  assert.equal(h.calls.length,0,'must not contact a server before opt-in');
  assert.equal(reply.ok,false);
});
test('private chat stores both roles and sends labeled history across worker restarts',async()=>{
  const h=setup(consent);
  const first=await h.send({type:'mizuki-chat',text:'My name is Example'});
  assert.equal(first.ok,true);
  assert.deepEqual(h.stored.conversation.map(t=>t.role),['user','assistant']);
  const restarted=setup(h.stored);
  assert.equal((await restarted.send({type:'mizuki-chat',text:'What is my name?'})).ok,true);
  const body=JSON.parse(restarted.calls[0][1].body);
  assert.deepEqual(body.history,['User: My name is Example','Mizuki: Fixture reply']);
  assert.equal(restarted.calls[0][0],'https://example.test/api/public/companion');
});
test('pending requests reject a second send without losing the first; stalled fetch times out',async()=>{
  const h=setup(consent,(_url,options)=>new Promise((_resolve,reject)=>options.signal.addEventListener('abort',()=>reject(new Error('aborted')))));
  const first=h.send({type:'mizuki-chat',text:'First'});
  await new Promise(r=>setTimeout(r,5));
  const second=await h.send({type:'mizuki-chat',text:'Second'});
  assert.equal(second.code,'busy');
  assert.match((await first).error,/timed out/i);
  assert.equal(h.calls.length,1);
  assert.equal(h.stored.conversation,undefined);
});
test('automatic reactions require opt-in, active non-excluded sites and one shared cooldown',async()=>{
  const h=setup({...consent,conversation:[{role:'user',content:'private secret'}]});
  assert.equal((await h.send({type:'mizuki-auto',kind:'idle',context:{title:'Article',headline:'Headline'}},tab)).ok,true);
  assert.equal(JSON.parse(h.calls[0][1].body).history.length,0,'private chat must never feed in-page reactions');
  assert.equal((await h.send({type:'mizuki-auto',kind:'idle'},tab)).skipped,true);
  for (const overrides of [{mode:'manual'},{excludedSites:['example.com']},{sharePageContext:false},{enabled:false}]) {
    const blocked=setup({...consent,...overrides});
    await blocked.send({type:'mizuki-auto',kind:'idle'},tab);
    assert.equal(blocked.calls.length,0);
  }
  assert.equal((await h.send({type:'mizuki-chat',text:'not private'},tab)).ok,false);
});
test('malformed replies are rejected; clearing history cancels an in-flight reply',async()=>{
  const bad=setup(consent,async()=>({ok:true,json:async()=>({unexpected:'value'})}));
  assert.equal((await bad.send({type:'mizuki-chat',text:'hello'})).ok,false);
  assert.equal(bad.stored.conversation,undefined);
  let resolve;
  const h=setup({...consent,conversation:[{role:'user',content:'old'}]},()=>new Promise(r=>{resolve=r;}));
  const pending=h.send({type:'mizuki-chat',text:'hello'});
  await new Promise(r=>setTimeout(r,1));
  assert.equal((await h.send({type:'mizuki-clear'})).ok,true);
  resolve({ok:true,json:async()=>({line:'late reply',mood:'idle'})});
  assert.equal((await pending).ok,false);
  assert.deepEqual(h.stored.conversation,[]);
});
test('consent revocation cancels pending work and destinations cannot override settings',async()=>{
  let resolve;
  const h=setup(consent,()=>new Promise(r=>{resolve=r;}));
  const pending=h.send({type:'mizuki-chat',text:'hi',apiBase:'https://evil.test'});
  await new Promise(r=>setTimeout(r,1));
  await h.api.storage.local.set({consentBase:''});
  resolve({ok:true,json:async()=>({line:'late reply',mood:'idle'})});
  assert.equal((await pending).ok,false);
  assert.equal(h.calls[0][0],'https://example.test/api/public/companion');
  assert.equal(h.stored.conversation,undefined);
});
test('privacy controls reject non-private reads and ignore disabled/background pages',async()=>{
  const h=setup(consent);
  assert.equal((await h.send({type:'mizuki-clear'},tab)).ok,false);
  assert.equal((await h.send({type:'mizuki-chat',text:'hello'},{...tab,id:'other-extension'})).ok,false);
  const inactive=setup(consent);inactive.api.tabs.get=async()=>({active:false});
  await inactive.send({type:'mizuki-auto',kind:'page'},tab);assert.equal(inactive.calls.length,0);
  const insecure=setup({...consent,apiBase:'http://example.test',consentBase:'http://example.test'});
  assert.equal((await insecure.send({type:'mizuki-chat',text:'hello'})).ok,false);
  assert.equal(insecure.calls.length,0);
});
module.exports={setup,consent,tab};
