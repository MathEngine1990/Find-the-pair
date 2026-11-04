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
  return { manager, config, bridge, calls, advance: ms => { now += ms; } };
}

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
