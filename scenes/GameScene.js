//---scenes/GameScene.js - ИСПРАВЛЕННАЯ версия

window.GameScene = class GameScene extends Phaser.Scene {
  constructor(){ super('GameScene'); }

  init(data){
    this.currentLevel = data?.level || null;
    this.levelPage    = data?.page  || 0;
  }

  _pxClamp(px, minPx, maxPx){ return Math.round(Phaser.Math.Clamp(px, minPx, maxPx)); }
  _pxByH(fraction, minPx, maxPx){ const { H } = this.getSceneWH(); return this._pxClamp(H * fraction, minPx, maxPx); }
  getDPR(){ return Math.min(2.0, Math.max(1, (window.devicePixelRatio || 1))); }

  _createHiDPICanvasTexture(key, w, h, drawFn){
    const DPR = this.getDPR();
    const tex = this.textures.createCanvas(key, Math.max(2, Math.round(w*DPR)), Math.max(2, Math.round(h*DPR)));
    const ctx = tex.getContext();
    ctx.save(); ctx.scale(DPR, DPR); drawFn(ctx, w, h); ctx.restore();
    tex.refresh();
    return tex;
  }

  preload(){}

  create(){
    if (this.scale && this.scale.updateBounds) this.scale.updateBounds();
    this.scale.on('resize', () => { if (this.scale && this.scale.updateBounds) this.scale.updateBounds(); });

    this.levelButtons  = [];
    this.cards         = [];
    this.opened        = [];
    this.canClick      = false;

    this.hud = null;
    this.mistakeCount  = 0;
    this.mistakeText   = null;

    this._wheelHandler = null;
    this.bgImage       = null;
    this._texId        = 0;

    this.makePlaceholdersIfNeeded();
    this.ensureGradientBackground();

    if (!this.currentLevel){
      this.scene.start('MenuScene', { page: this.levelPage });
      return;
    }

    this.startGame(this.currentLevel);

    this.scale.on('resize', () => {
      this.ensureGradientBackground();
      if (this.currentLevel) this.startGame(this.currentLevel);
      else this.scene.start('MenuScene', { page: this.levelPage });
    });
  }

  getSceneWH(){
    const s = this.scale, cam = this.cameras?.main;
    const W = (s && (s.width ?? s.gameSize?.width))  || cam?.width  || this.sys.game.config.width  || 800;
    const H = (s && (s.height ?? s.gameSize?.height)) || cam?.height || this.sys.game.config.height || 600;
    return { W: Math.floor(W), H: Math.floor(H) };
  }

  ensureGradientBackground(){
    const { W, H } = this.getSceneWH();

    if (this.textures.exists('bg_game')) {
      this.bgImage && this.bgImage.destroy();
      const img = this.add.image(W/2, H/2, 'bg_game').setOrigin(0.5).setDepth(-1000);
      const src = this.textures.get('bg_game').getSourceImage();
      const scale = Math.max(W / src.width, H / src.height);
      img.setDisplaySize(src.width * scale, src.height * scale);
      this.bgImage = img;

      this._bgOverlay && this._bgOverlay.destroy();
      this._bgOverlay = this.add.graphics().setDepth(-999).fillStyle(0x000000, 0.18).fillRect(0,0,W,H);
      return;
    }

    const key = 'bg-grad';
    const DPR = this.getDPR();

    if (this.textures.exists(key)) {
      const src = this.textures.get(key).getSourceImage();
      if (src.width !== Math.round(W*DPR) || src.height !== Math.round(H*DPR)) this.textures.remove(key);
    }
    if (!this.textures.exists(key)) {
      this._createHiDPICanvasTexture(key, W, H, (ctx, w, h) => {
        const g = ctx.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0.00, THEME.bgTop);
        g.addColorStop(0.60, THEME.bgMid);
        g.addColorStop(1.00, THEME.bgBottom);
        ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);

        const v = ctx.createRadialGradient(w/2, h*0.6, Math.min(w,h)*0.15, w/2, h*0.6, Math.max(w,h));
        v.addColorStop(0, 'rgba(255,255,255,0.0)');
        v.addColorStop(1, 'rgba(0,0,0,0.22)');
        ctx.fillStyle = v; ctx.fillRect(0,0,w,h);
      });
    }
    this.bgImage && this.bgImage.destroy();
    this.bgImage = this.add.image(0, 0, key).setOrigin(0, 0).setDepth(-1000).setDisplaySize(W, H);

    this._bgOverlay && this._bgOverlay.destroy();
    this._bgOverlay = this.add.graphics().setDepth(-999).fillStyle(0x000000, 0.18).fillRect(0,0,W,H);
  }

  _roundRect(ctx, x, y, w, h, r){
    const rr = Math.max(0, Math.min(r, Math.min(w,h)/2));
    ctx.beginPath();
    ctx.moveTo(x+rr, y);
    ctx.arcTo(x+w, y,   x+w, y+h, rr);
    ctx.arcTo(x+w, y+h, x,   y+h, rr);
    ctx.arcTo(x,   y+h, x,   y,   rr);
    ctx.arcTo(x,   y,   x+w, y,   rr);
    ctx.closePath();
  }

  makePlaceholdersIfNeeded(){
    if (!this.textures.exists('back')){
      const key = 'back', W = 220, H = 320;
      this._createHiDPICanvasTexture(key, W, H, (ctx, w, h) => {
        ctx.fillStyle = '#173528'; this._roundRect(ctx, 0, 0, w, h, 18); ctx.fill();
        ctx.lineWidth = 8; ctx.strokeStyle = '#B88A2E'; this._roundRect(ctx, 0, 0, w, h, 18); ctx.stroke();
        ctx.save(); ctx.globalAlpha = 0.18; ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 1;
        for (let y=20; y<h-20; y+=16){ ctx.beginPath(); ctx.moveTo(16, y); ctx.lineTo(w-16, y); ctx.stroke(); }
        ctx.restore();
      });
    }
    ALL_CARD_KEYS.forEach((k) => {
      if (this.textures.exists(k)) return;
      const W = 220, H = 320;
      this._createHiDPICanvasTexture(k, W, H, (ctx, w, h) => {
        ctx.fillStyle = '#204338'; this._roundRect(ctx, 0, 0, w, h, 18); ctx.fill();
        ctx.lineWidth = 8; ctx.strokeStyle = '#C87420'; this._roundRect(ctx, 0, 0, w, h, 18); ctx.stroke();
        ctx.fillStyle = '#E8E1C9'; ctx.font = '800 48px ' + THEME.font; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(k.toUpperCase(), w/2, h/2);
      });
    });
  }

  drawHUD(){
    this.clearHUD();
    const { W, H } = this.getSceneWH();
    const hudH = Math.min(86, Math.round(H*0.10));

    this.hud = this.add.graphics().setDepth(5);
    this.hud.fillStyle(THEME.hudFill, 0.95).fillRect(0,0,W,hudH);

    this.mistakeText = this.add.text(24, Math.round(hudH/2), 'Ошибок: 0', {
      fontFamily: THEME.font, fontSize: this._pxClamp(hudH*0.32, 14, 22) + 'px', color: THEME.hudText, fontStyle:'600'
    }).setOrigin(0,0.5).setDepth(6);

    const size = Math.round(hudH*0.76);
    const homeBtn = window.makeIconButton(
      this, W - (size/2 + 14), Math.round(hudH/2), size,
      '⌂',
      () => { this.scene.start('MenuScene', { page: this.levelPage }); }
    );
    homeBtn.setDepth(7);
    this.exitBtn = homeBtn;
  }

  clearHUD(){
    if (this.hud) this.hud.destroy();
    if (this.mistakeText) this.mistakeText.destroy();
    if (this.exitBtn) this.exitBtn.destroy();
    this.hud = this.mistakeText = this.exitBtn = null;
  }

  startGame(level){
    console.log('Starting game with level:', level); // DEBUG
    
    // ИСПРАВЛЕНО: Проверка корректности level
    if (!level || !level.cols || !level.rows) {
      console.error('Invalid level data:', level);
      this.scene.start('MenuScene', { page: this.levelPage });
      return;
    }
       
    this.currentLevel = level;
    this.mistakeCount = 0;

    // ИСПРАВЛЕНО: Безопасная инициализация метрик
    const total = level.cols * level.rows;
    if (total % 2 !== 0) {
      console.error('Нечётное число ячеек в сетке', level);
      this.scene.start('MenuScene', { page: this.levelPage });
      return;
    }

    this.gameMetrics = {
      startTime: Date.now(),
      attempts: 0,
      errors: 0,
      pairs: Math.floor(total / 2) // ИСПРАВЛЕНО: Целое число пар
    };  

    this.children.removeAll();
    this.ensureGradientBackground();
    this.cards = []; this.opened = []; this.canClick = false;

    this.drawHUD();

    const pairs = Math.floor(total / 2);

    const shuffled = Phaser.Utils.Array.Shuffle(ALL_CARD_KEYS.slice());
    const base = Array.from({length:pairs}, (_,i)=> shuffled[i % shuffled.length]);
    const deck = Phaser.Utils.Array.Shuffle(base.concat(base));

    const { W, H } = this.getSceneWH();
    const hudH = Math.min(86, Math.round(H*0.10));

    const backTex = this.textures.get('back');
    const backImg = backTex?.getSourceImage?.();
    const cardOrigW = backImg?.width  || 220;
    const cardOrigH = backImg?.height || 320;

    const outerPad = Math.max(10, Math.round(Math.min(W,H)*0.018));
    const gap      = Math.max(6, Math.round(Math.min(W,H)*0.010));

    const availW = W - outerPad*2 - gap*(level.cols-1);
    const availH = (H - hudH) - outerPad*2 - gap*(level.rows-1);

    const scaleX = availW / (cardOrigW * level.cols);
    const scaleY = availH / (cardOrigH * level.rows);
    const cardScale = Math.min(scaleX, scaleY, 1);

    const cardW = cardOrigW * cardScale;
    const cardH = cardOrigH * cardScale;

    const boardW = cardW*level.cols + gap*(level.cols-1);
    const boardH = cardH*level.rows + gap*(level.rows-1);

    const startX = (W - boardW)/2 + cardW/2;
    const startY = hudH + outerPad + cardH/2;

    let i = 0;
    for (let r=0; r<level.rows; r++){
      for (let c=0; c<level.cols; c++){
        const key = deck[i++], x = startX + c*(cardW + gap), y = startY + r*(cardH + gap);
        const card = this.add.image(x,y,key).setInteractive({useHandCursor:true});
        card.setScale(cardScale).setDepth(20);
        card.setData({ key, opened:false, matched:false });

        card.on('pointerover', () => this.tweens.add({ targets: card, scale: cardScale*1.02, duration: 100 }));
        card.on('pointerout',  () => this.tweens.add({ targets: card, scale: cardScale*1.00, duration: 100 }));

        card.on('pointerdown', () => this.onCardClick(card));
        this.cards.push(card);
      }
    }

    // ИСПРАВЛЕНО: 5 секунд показа лицом
    this.canClick = false;
    console.log('Showing cards for 5 seconds...'); // DEBUG
    this.time.delayedCall(5000, () => {
      console.log('Hiding cards, game starts!'); // DEBUG
      this.cards.forEach(card => card.setTexture('back'));
      this.canClick = true;
    });
  }

  onCardClick(card){
    if (!this.canClick) return;
    if (card.getData('opened') || card.getData('matched')) return;

    // ИСПРАВЛЕНО: Увеличиваем попытки только один раз
    this.gameMetrics.attempts++;

    card.setTexture(card.getData('key'));
    card.setData('opened', true);
    this.opened.push(card);

    if (this.opened.length === 2){
      this.canClick = false;
      this.time.delayedCall(450, () => {
        const [a,b] = this.opened;
        if (a.getData('key') === b.getData('key')){
          a.setData('matched', true).setAlpha(THEME.cardDimAlpha).disableInteractive();
          b.setData('matched', true).setAlpha(THEME.cardDimAlpha).disableInteractive();
          a.setData('opened', false); b.setData('opened', false);
        } else {
          this.mistakeCount++;
          this.gameMetrics.errors++; // ДОБАВЛЕНО: Трекинг ошибок в метриках
          if (this.mistakeText) this.mistakeText.setText('Ошибок: ' + this.mistakeCount);
          a.setTexture('back').setData('opened', false);
          b.setTexture('back').setData('opened', false);
        }
        this.opened = [];
        this.canClick = true;

        if (this.cards.every(c => c.getData('matched'))) this.showWin();
      });
    }
  }

  showWin(){
    this.canClick = false;
    this.cards.forEach(c => c.disableInteractive());

    // ДОБАВЛЕНО: Подсчет финального времени
    const gameTime = Math.round((Date.now() - this.gameMetrics.startTime) / 1000);
    console.log('Game finished:', {
      time: gameTime,
      attempts: this.gameMetrics.attempts,
      errors: this.gameMetrics.errors,
      accuracy: Math.round((1 - this.gameMetrics.errors / this.gameMetrics.attempts) * 100)
    });

    const { W, H } = this.getSceneWH();

    this.add.text(W/2, H*0.22, 'Победа!', {
      fontFamily: THEME.font, fontSize: this._pxByH(0.088, 22, 48) + 'px', color:'#FFFFFF', fontStyle:'800'
    }).setOrigin(0.5);

    // УЛУЧШЕНО: Показываем детальную статистику
    this.add.text(W/2, H*0.32, `Время: ${gameTime}с | Попыток: ${this.gameMetrics.attempts} | Ошибок: ${this.mistakeCount}`, {
      fontFamily: THEME.font, fontSize: this._pxByH(0.044, 14, 24) + 'px', color:'#E8E1C9', fontStyle:'600'
    }).setOrigin(0.5);

    const btn = window.makeImageButton(
      this, W/2, H*0.44, Math.min(380, W*0.6), Math.min(80, H*0.12),
      '🔄  Сыграть ещё',
      () => this.scene.start('MenuScene', { page: this.levelPage })
    );
    btn.setDepth(10);
  }
};
