const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function setup() {
  const events = [];
  const window = { adsManager: { beforeResults: async () => { events.push('ad'); } } };
  const document = { hidden: false };
  vm.runInNewContext(fs.readFileSync('scenes/GameScene.js', 'utf8'), {
    window, document, Phaser: { Scene: class {} }, console
  });
  const scene = Object.create(window.GameScene.prototype);
  const status = { scene: true, setOrigin(){return this;}, setDepth(){return this;}, destroy(){this.scene=null;} };
  Object.assign(scene, {
    _resultRun: {}, starState: {}, starRules: {pairs:3,timeLimitSec:60,maxErrors:1},
    gameMetrics: {attempts:3,errors:0}, currentTimeSeconds:10, currentLevelIndex:0,
    gameState: {}, cards: [], syncManager: {}, input: {enabled:true}, sound: {mute:false},
    game: {registry:{get:()=>false}}, scene: {isActive:()=>true},
    updateStarsHUD(){}, clearVictoryScreen(){}, stopGameTimer(){events.push('stop');},
    saveProgressViaSyncManager: async()=>{events.push('save');return {};},
    checkAndUnlockAchievements: async()=>{events.push('achievements');return [{}];},
    getSceneWH:()=>({W:500,H:700}), textManager:{updateDimensions(){}},
    add:{text:()=>status}, showAchievementsScreen(){events.push('results');}
  });
  return {scene,window,document,events,status};
}

test('victory saves once before advertising, then displays results', async()=>{
  const {scene,events}=setup();
  await scene.showWin(); await scene.showWin();
  assert.deepEqual(events,['stop','save','achievements','ad','results']);
  assert.equal(scene.input.enabled,true);
});
test('results wait for ad completion; sound and controls recover', async()=>{
  const {scene,window,events}=setup(); let release, entered;
  const ready=new Promise(r=>entered=r);
  window.adsManager.beforeResults=async hooks=>{
    hooks.onShow(); entered();
    await new Promise(r=>release=r); hooks.onFinish();
  };
  const completion=scene.showWin(); await ready;
  assert.equal(scene.input.enabled,false); assert.equal(scene.sound.mute,true);
  assert.equal(events.includes('results'),false);
  release(); await completion;
  assert.equal(scene.input.enabled,true); assert.equal(scene.sound.mute,false);
  assert.equal(events.at(-1),'results');
});
test('muted player stays muted after advertising', async()=>{
  const {scene,window}=setup(); scene.sound.mute=true;
  window.adsManager.beforeResults=async hooks=>{hooks.onShow();hooks.onFinish();};
  await scene.showWin(); assert.equal(scene.sound.mute,true);
});
test('late reply cannot draw previous round results in a new scene', async()=>{
  const {scene,window,events,status}=setup();
  window.adsManager.beforeResults=async()=>{scene._resultRun={};};
  await scene.showWin(); assert.equal(events.includes('results'),false); assert.equal(status.scene,null);
});
test('unexpected manager failure does not block results or controls', async()=>{
  const {scene,window,events}=setup();
  window.adsManager.beforeResults=async()=>{throw Error('test failure');};
  await scene.showWin(); assert.equal(scene.input.enabled,true); assert.equal(events.at(-1),'results');
});
