const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const context = { window: {}, Phaser: { Scene: class {} }, console, Date };
vm.runInNewContext(fs.readFileSync('scenes/GameScene.js', 'utf8'), context);
function setup(keys = ['a', 'b']) {
  const scene = Object.create(context.window.GameScene.prototype);
  const queue = [], timers = [];
  scene.tweens = { add: config => queue.push(config) };
  scene.time = { delayedCall: (delay, callback) => timers.push(callback) };
  scene.textures = { exists: () => true };
  scene.gameState = {};
  scene.gameMetrics = { attempts: 0, errors: 0, startTime: Date.now(), matchTimes: [] };
  scene.mistakeCount = 0; scene.opened = []; scene.canClick = true;
  scene.startGameTimer = () => { scene.timerStarted = true; };
  scene.showWin = () => { scene.won = true; };
  function card(key) {
    const data = new Map([['key', key]]);
    const c = { scene, active: true, scaleX: 1, scaleY: 1, alpha: 1,
      texture: { source: [{width: 100, height: 150}] },
      getData: key => data.get(key),
      setData(key, value) { data.set(key, value); return this; },
      setScale(x,y) { this.scaleX=x; this.scaleY=y; return this; },
      setTexture(key) { this.texture = { source: [{width: key === 'back' ? 200 : 100, height: key === 'back' ? 300 : 150}] }; this.textureKey = key; return this; },
      setInteractive() { this.interactive=true; return this; },
      disableInteractive() { this.interactive=false; return this; }
    };
    Object.defineProperties(c, {
      displayWidth: { get() { return this.scaleX*this.texture.source[0].width; }, set(v) { this.scaleX=v/this.texture.source[0].width; } },
      displayHeight: { get() { return this.scaleY*this.texture.source[0].height; }, set(v) { this.scaleY=v/this.texture.source[0].height; } }
    });
    scene.setCardSize(c, 80, 120);
    return c;
  }
  scene.cards = keys.map(card);
  function step() {
    const tween = queue.shift(); assert.ok(tween);
    for (const target of [].concat(tween.targets)) {
      for (const key of ['scaleX', 'scaleY', 'alpha']) if (key in tween) target[key] = tween[key];
    }
    tween.onComplete?.();
  }
  const drain = () => { while(queue.length) step(); };
  return { scene, step, drain, timers, queue };
}
test('flip preserves layout size across differently sized face/back textures', () => {
  const {scene, step, drain} = setup(); const c=scene.cards[0];
  scene.flipCard(c, 'back'); step();
  assert.equal(c.scaleX, 0); assert.equal(c.getData('targetWidth'), 80);
  drain(); assert.equal(c.displayWidth, 80); assert.equal(c.displayHeight, 120);
  scene.flipCard(c, 'a'); drain(); assert.equal(c.displayWidth, 80);
});
test('memorization enables input and timer only after every flip finishes', () => {
  const {scene, step, drain}=setup(); scene.flipAllCardsAndStartGame();
  assert.equal(scene.canClick,false); step(); step(); step();
  assert.equal(scene.canClick,false); assert.equal(scene.timerStarted,undefined);
  drain(); assert.equal(scene.canClick,true); assert.equal(scene.timerStarted,true);
});
test('mismatch stays locked until both closing animations finish', () => {
  const {scene, timers, step, drain}=setup(); scene.opened=[...scene.cards];
  scene.cards.forEach(c=>c.setData('opened',true)); scene.checkPair();
  assert.equal(scene.gameMetrics.errors,1); assert.equal(scene.canClick,false);
  timers.shift()(); step(); step(); step(); assert.equal(scene.canClick,false);
  drain(); assert.equal(scene.canClick,true); assert.equal(scene.opened.length,0);
  assert.ok(scene.cards.every(c=>!c.getData('opened') && c.displayWidth===80));
});
test('rapid repeated clicks cannot open the same card twice', () => {
  const {scene, drain}=setup(); scene.onCardClick(scene.cards[0]); scene.onCardClick(scene.cards[0]);
  drain(); assert.equal(scene.opened.length,1); assert.equal(scene._processingCards,false);
});
test('matched pair still completes the level', () => {
  const {scene, drain}=setup(['a','a']); scene.opened=[...scene.cards]; scene.checkPair();
  drain(); assert.equal(scene.won,true); assert.equal(scene.gameMetrics.errors,0);
  assert.ok(scene.cards.every(c=>c.getData('matched') && !c.interactive));
});
test('destroyed card cannot trigger flip completion', () => {
  const {scene, drain}=setup(); let completed=false;
  scene.flipCard(scene.cards[0], 'back', ()=>completed=true);
  scene.cards[0].active=false; drain(); assert.equal(completed,false);
});

vm.runInNewContext(fs.readFileSync('ui/Button.js', 'utf8'), context);
test('button motion interrupts old tween and preserves custom base scale', () => {
  const { EventEmitter } = require('node:events');
  const zone=new EventEmitter(), cont=new EventEmitter();
  Object.assign(cont,{scene:{},active:true,scaleX:2,scaleY:3});
  let stopped=0; const tweens=[];
  const scene={tweens:{add(config){tweens.push(config);return {stop(){stopped++;}};}}};
  context.window.attachButtonMotion(scene,cont,zone,{setColor(){}},'#fff','#ffe');
  zone.emit('pointerover'); zone.emit('pointerdown'); zone.emit('pointerout');
  assert.equal(stopped,2);
  assert.equal(tweens.at(-1).scaleX,2); assert.equal(tweens.at(-1).scaleY,3);
  cont.emit('destroy'); assert.equal(stopped,3);
});
