const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
function setup(search = '?vk_client=ok&vk_app_id=12&vk_user_id=34') {
  let now = 1000;
  const events = {};
  const document = {hidden:false,addEventListener:(name, fn)=>events[name]=fn};
  const window = {location:{search},addEventListener:(name, fn)=>events[name]=fn};
  const context = {window,document,URL,URLSearchParams,Date:{now:()=>now},setTimeout,clearTimeout,console:{warn(){}}};
  vm.runInNewContext(fs.readFileSync('utils/PlatformContext.js','utf8'),context);
  vm.runInNewContext(fs.readFileSync('utils/AdsManager.js','utf8'),context);
  const calls=[];
  const bridge={supportsAsync:async()=>true,send:async method=>{calls.push(method);return {result:true};}};
  const ads=new window.AdsManager({isVK:()=>true,storage:null,getBridge:()=>bridge,getConfig:()=>({enabled:true})});
  return {window,document,events,ads,bridge,calls,advance:ms=>now+=ms,p:window.GamePlatform};
}
test('OK user/app namespace is separate, VK keys remain compatible',()=>{
  const ok=setup(), vk=setup('?vk_app_id=12&vk_user_id=34');
  assert.equal(ok.p.storageIdentity,'ok_12_34');
  assert.equal(ok.p.localKey('acceptedAgreement'),'acceptedAgreement_ok_12_34');
  assert.equal(vk.p.localKey('acceptedAgreement'),'acceptedAgreement');
  assert.notEqual(ok.ads.storageKey,vk.ads.storageKey);
  assert.notEqual(ok.p.storageIdentity,setup('?vk_client=ok&vk_app_id=13&vk_user_id=34').p.storageIdentity);
});
test('OK ads cannot start during first 30 seconds even with unrestricted frequency',async()=>{
  const s=setup();
  assert.equal((await s.ads.beforeResults()).reason,'platform_limit');
  s.advance(29999);assert.equal((await s.ads.beforeResults()).reason,'platform_limit');
  assert.equal(s.calls.length,0);
  s.advance(1);assert.equal((await s.ads.beforeResults()).reason,'shown');
});
test('background and Bridge hidden state each prevent advertisements',async()=>{
  const s=setup();s.advance(30000);
  s.document.hidden=true;assert.equal((await s.ads.beforeResults()).reason,'platform_limit');
  s.document.hidden=false;s.p.onBridgeEvent({detail:{type:'VKWebAppViewHide'}});
  s.events.visibilitychange();assert.equal(s.p.isActive,false);
  s.p.onBridgeEvent({detail:{type:'VKWebAppViewRestore'}});assert.equal(s.p.isActive,true);
  s.events.pagehide();assert.equal(s.p.isActive,false);
  s.events.pageshow();assert.equal(s.p.isActive,true);
});
test('app hidden while availability is pending never starts a late ad',async()=>{
  const s=setup();s.advance(30000);
  s.bridge.send=async method=>{s.calls.push(method);s.document.hidden=true;return {result:true};};
  assert.equal((await s.ads.beforeResults()).reason,'platform_limit');
  assert.deepEqual(s.calls,['VKWebAppCheckNativeAds']);
});
test('share URL never includes launch credentials or an unconfigured OK destination',()=>{
  const s=setup();assert.equal(s.p.publicURL(),null);
  s.window.OK_RELEASE_CONFIG={publicGameURL:'https://ok.ru/game/example'};
  assert.equal(s.p.publicURL(),'https://ok.ru/game/example');
  s.window.OK_RELEASE_CONFIG.publicGameURL+='?vk_user_id=34&sign=secret';assert.equal(s.p.publicURL(),null);
  assert.equal(setup('?vk_app_id=12&sign=secret').p.publicURL(),'https://vk.com/app12');
});
test('progress manager never migrates legacy VK progress into OK',()=>{
  const s=setup();
  const data=new Map([['findpair_progress','legacy'],['findpair_progress_34','vk']]);
  const localStorage={getItem:key=>data.get(key)||null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)};
  const source=fs.readFileSync('sync/ProgressSyncManager.js','utf8');
  vm.runInNewContext(source.slice(0,source.indexOf('window.ProgressSyncManager ='))+'window.TestManager=ProgressSyncManager;',
    {window:s.window,localStorage,URLSearchParams,console:{log(){},warn(){},error(){}}});
  const manager=new s.window.TestManager();
  manager.getDefaultProgressData=()=>({fresh:true});
  assert.equal(manager.getUserStorageKey(),'findpair_progress_ok_12_34');
  assert.equal(manager.getAchievementsKey(),'findpair_achievements_ok_12_34');
  assert.equal(manager.loadFromLocal().fresh,true);
  assert.equal(data.get('findpair_progress'),'legacy');
  assert.equal(data.has('findpair_progress_ok_12_34'),false);
});
