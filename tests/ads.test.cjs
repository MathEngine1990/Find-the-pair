const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function setup(overrides = {}) {
  const window = { location: { search: '' } };
  vm.runInNewContext(fs.readFileSync('utils/AdsManager.js', 'utf8'), {
    window, setTimeout, clearTimeout, console: { warn() {} }
  });
  const calls = [];
  const config = { enabled: true, everyNthRound: 1, skipFirstRounds: 0,
    minIntervalSeconds: 0, maxShowsPerSession: 0, availabilityTimeoutMs: 100, showTimeoutMs: 100 };
  const bridge = {
    supportsAsync: async () => true,
    send: async (method) => { calls.push(method); return { result: true }; }
  };
  let now = 10000;
  const manager = new window.AdsManager({
    getConfig: () => config, getBridge: () => bridge, isVK: () => true,
    now: () => now, storage: null, ...overrides
  });
  return { window, manager, config, bridge, calls, advance: ms => { now += ms; } };
}

test('iPhone and iPad skip ads before any SDK calls, hooks or counters', async () => {
  for (const navigator of [
    {userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)'},
    {userAgent:'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)'},
    {userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X)', platform:'MacIntel',maxTouchPoints:5}
  ]) {
    const s=setup();s.window.navigator=navigator;
    let hooks=0;
    const result=await s.manager.beforeResults({onShow:()=>hooks++,onFinish:()=>hooks++});
    assert.equal(result.reason,'ios_ads_disabled');
    assert.equal(s.calls.length,0);assert.equal(hooks,0);
    assert.equal(s.manager.state.rounds,0);assert.equal(s.manager.busy,false);assert.equal(s.manager.showing,false);
  }
});
test('iOS launch parameters bypass ads even without a recognizable user agent', async () => {
  for (const platform of ['mobile_iphone','mobile_iphone_messenger','mobile_ios','mobile_web_ios']) {
    const s=setup();s.window.location.search=`?vk_app_id=12&vk_platform=${platform}`;
    // mobile_iphone is also handled through the launch parameter check.
    assert.equal((await s.manager.beforeResults()).reason,'ios_ads_disabled');
    assert.equal(s.calls.length,0);
  }
});
test('Android and desktop Mac retain supported advertisements', async () => {
  for (const navigator of [{userAgent:'Mozilla/5.0 (Linux; Android 14)'},
    {userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X)',platform:'MacIntel',maxTouchPoints:0}]) {
    const s=setup();s.window.navigator=navigator;
    assert.equal((await s.manager.beforeResults()).reason,'shown');
  }
});
test('iOS advertising can only be re-enabled with explicit true', async () => {
  const s=setup({requestIOSStart:start=>start()});s.window.navigator={userAgent:'iPhone'};
  s.config.allowIOSAds='true';assert.equal((await s.manager.beforeResults()).reason,'ios_ads_disabled');
  s.config.allowIOSAds=true;assert.equal((await s.manager.beforeResults()).reason,'shown');
});

function attachPromptDOM(s) {
  const mounted=[];
  function element() {
    return { style:{}, children:[], setAttribute(){}, focus(){},
      append(...children){this.children.push(...children);},
      remove(){const i=mounted.indexOf(this);if(i>=0)mounted.splice(i,1);} };
  }
  s.window.document={createElement:element,body:{append:node=>mounted.push(node)}};
  s.window.navigator={userAgent:'iPhone'};
  s.config.allowIOSAds=true;
  return mounted;
}

test('iOS shows only from the click stack after availability; double click cannot duplicate', async () => {
  const s=setup();const mounted=attachPromptDOM(s);let insideClick=false, hooks=0;
  s.bridge.send=method=>{
    if(method==='VKWebAppShowNativeAds') assert.equal(insideClick,true);
    s.calls.push(method);return Promise.resolve({result:true});
  };
  const completion=s.manager.beforeResults({onShow:()=>hooks++});
  await new Promise(r=>setTimeout(r,0));
  assert.deepEqual(s.calls,['VKWebAppCheckNativeAds']);
  assert.equal(hooks,0);assert.equal(s.manager.showing,false);
  assert.equal(mounted.length,1);
  const button=mounted[0].children[2];
  insideClick=true;button.onclick();button.onclick();insideClick=false;
  assert.equal((await completion).reason,'shown');
  assert.equal(mounted.length,0);assert.equal(hooks,1);
  assert.deepEqual(s.calls,['VKWebAppCheckNativeAds','VKWebAppShowNativeAds']);
});
test('iOS prompt cancels after inactivity and never sends a late ad', async () => {
  const s=setup();const mounted=attachPromptDOM(s);
  const completion=s.manager.beforeResults();await new Promise(r=>setTimeout(r,0));
  const oldButton=mounted[0].children[2];
  s.advance(30000);
  assert.equal((await completion).reason,'gesture_cancelled');
  oldButton.onclick();assert.equal(s.calls.length,1);assert.equal(mounted.length,0);
  assert.equal(s.manager.busy,false);assert.equal(s.manager.state.requests,0);
});
test('iOS click rechecks scene and background state', async () => {
  for (const hidden of [false,true]) {
    const s=setup();const mounted=attachPromptDOM(s);let current=true;
    const completion=s.manager.beforeResults({isCurrent:()=>current});
    await new Promise(r=>setTimeout(r,0));
    if(hidden) s.window.GamePlatform={canRequestAd:()=>false}; else current=false;
    mounted[0].children[2].onclick();
    assert.equal((await completion).reason,'gesture_cancelled');
    assert.equal(s.calls.length,1);assert.equal(s.manager.busy,false);
  }
});
test('unsupported iOS never presents a launch prompt', async () => {
  const s=setup();const mounted=attachPromptDOM(s);s.bridge.supportsAsync=async()=>false;
  assert.equal((await s.manager.beforeResults()).reason,'unavailable');assert.equal(mounted.length,0);
});
test('synchronous SDK throw after iOS click restores hooks and lock', async () => {
  const s=setup();const mounted=attachPromptDOM(s);let restored=0;
  s.bridge.send=method=>{if(method==='VKWebAppShowNativeAds')throw Error('SDK failure');return Promise.resolve({result:true});};
  const completion=s.manager.beforeResults({onFinish:()=>restored++});
  await new Promise(r=>setTimeout(r,0));mounted[0].children[2].onclick();
  assert.equal((await completion).reason,'error');assert.equal(restored,1);
  assert.equal(s.manager.busy,false);assert.equal(s.manager.showing,false);
});

test('interstitial check then show, sound hooks balanced', async () => {
  const {manager,calls}=setup(); const hooks=[];
  assert.equal((await manager.beforeResults({onShow:()=>hooks.push('mute'),onFinish:()=>hooks.push('restore')})).reason,'shown');
  assert.deepEqual(calls,['VKWebAppCheckNativeAds','VKWebAppShowNativeAds']);
  assert.deepEqual(hooks,['mute','restore']); assert.equal(manager.busy,false);
});
test('standalone and disabled modes never call the ad network', async () => {
  const a=setup({isVK:()=>false}); await a.manager.beforeResults(); assert.equal(a.calls.length,0);
  const b=setup(); b.config.enabled=false; await b.manager.beforeResults(); assert.equal(b.calls.length,0);
});
test('unsupported and no-fill do not show advertisements', async () => {
  const a=setup(); a.bridge.supportsAsync=async()=>false;
  assert.equal((await a.manager.beforeResults()).reason,'unavailable'); assert.equal(a.calls.length,0);
  const b=setup(); b.bridge.send=async method=>{b.calls.push(method);return {result:false};};
  assert.equal((await b.manager.beforeResults()).reason,'unavailable'); assert.equal(b.calls.length,1);
});
test('skip-first, every-N, cooldown and session cap are configurable', async () => {
  const a=setup(); a.config.skipFirstRounds=1; a.config.everyNthRound=2;
  assert.equal((await a.manager.beforeResults()).reason,'frequency_limit');
  assert.equal((await a.manager.beforeResults()).reason,'frequency_limit');
  assert.equal((await a.manager.beforeResults()).reason,'shown');
  const b=setup(); b.config.minIntervalSeconds=60; b.config.maxShowsPerSession=2;
  await b.manager.beforeResults();
  assert.equal((await b.manager.beforeResults()).reason,'frequency_limit');
  b.advance(60000); assert.equal((await b.manager.beforeResults()).reason,'shown');
  b.advance(60000); assert.equal((await b.manager.beforeResults()).reason,'frequency_limit');
});
test('SDK rejection restores state and allows later requests', async () => {
  const {manager,bridge}=setup(); let restored=0;
  bridge.send=async method=>{if(method==='VKWebAppShowNativeAds')throw Error('closed');return {result:true};};
  assert.equal((await manager.beforeResults({onFinish:()=>restored++})).reason,'error');
  assert.equal(restored,1); assert.equal(manager.busy,false); assert.equal(manager.showing,false);
});
test('scene change during availability check prevents a late advertisement', async () => {
  const {manager,calls}=setup();
  assert.equal((await manager.beforeResults({isCurrent:()=>false})).reason,'scene_changed');
  assert.deepEqual(calls,['VKWebAppCheckNativeAds']);
});
test('check timeout cannot initiate a late show', async () => {
  const {manager,bridge,calls}=setup(); let resolve;
  bridge.send=method=>{calls.push(method);return new Promise(r=>resolve=r);};
  assert.equal((await manager.beforeResults()).reason,'timeout');
  resolve({result:true}); await Promise.resolve();
  assert.equal(calls.length,1); assert.equal(manager.busy,false);
});
test('show timeout releases results but blocks overlapping ads until late reply', async () => {
  const {manager,bridge}=setup(); let resolve, restored=0;
  bridge.send=async method=>method==='VKWebAppCheckNativeAds'?{result:true}:new Promise(r=>resolve=r);
  const first=manager.beforeResults({onFinish:()=>restored++});
  assert.equal((await manager.beforeResults()).reason,'busy');
  assert.equal((await first).reason,'timeout');
  assert.equal(manager.busy,true); assert.equal(manager.showing,true); assert.equal(restored,0);
  resolve({result:true}); await new Promise(r=>setTimeout(r,0));
  assert.equal(manager.busy,false); assert.equal(manager.showing,false); assert.equal(restored,1);
});
test('session counters survive reload, storage failure is harmless', async () => {
  let saved; const storage={getItem:()=>saved,setItem:(_,v)=>saved=v};
  await setup({storage}).manager.beforeResults();
  const b=setup({storage}); b.config.maxShowsPerSession=1;
  assert.equal((await b.manager.beforeResults()).reason,'frequency_limit');
  const c=setup({storage:{getItem(){throw Error();},setItem(){throw Error();}}});
  assert.equal((await c.manager.beforeResults()).reason,'shown');
});
