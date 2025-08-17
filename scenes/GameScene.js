// GameScene.js
//
// Стиль: строгий изумруд + латунь/медь, умеренные скругления, спокойные градиенты,
// без глянца, современный геометрический шрифт.
// Все UI-элементы рисуются кодом через Canvas-текстуры с HiDPI (ретина) поддержкой.
//
// (Рекомендуется подключить шрифт в index.html)
// <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;800&display=swap" rel="stylesheet">

// --- Карточные ключи под твои ассеты (assets/cards/<key>.png) ---
const ALL_CARD_KEYS = [
  'qd','qh','qs','qc',
  'kd','kh','ks','kc',
  'ad','ah','as','ac',
  'jd','jh','js','jc',
  '10h','10c'
];

// --- 11 уровней ---
const LEVELS = [
  { label: '2×3 (3 пары)',  cols: 3, rows: 2 },
  { label: '2×4 (4 пары)',  cols: 4, rows: 2 },
  { label: '2×5 (5 пар)',   cols: 5, rows: 2 },
  { label: '3×4 (6 пар)',   cols: 4, rows: 3 },
  { label: '4×4 (8 пар)',   cols: 4, rows: 4 },
  { label: '3×6 (9 пар)',   cols: 6, rows: 3 },
  { label: '4×5 (10 пар)',  cols: 5, rows: 4 },
  { label: '4×6 (12 пар)',  cols: 6, rows: 4 },
  { label: '4×7 (14 пар)',  cols: 7, rows: 4 },
  { label: '5×6 (15 пар)',  cols: 6, rows: 5 },
  { label: '6×6 (18 пар)',  cols: 6, rows: 6 }
];

// --- Тема (строже, спокойнее) ---
const THEME = {
  font: 'Poppins, Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif',

  // Фон: глубокий изумруд → еловый → серо-оливковый (без розовой дымки)
  bgTop:    '#06120E',
  bgMid:    '#1C2F27',
  bgBottom: '#495D53',

  // Кнопки/градиенты (строго, без глянца)
  gradA1:   '#B88A2E', // латунь (светлее)
  gradA2:   '#3C4F45', // тёмный зелёный
  gradB1:   '#41584C', // вторичный верх
  gradB2:   '#C87420', // медь (низ)

  // Обводки/тени (уменно)
  strokeLight: 'rgba(230,220,190,0.34)',
  strokeDark:  'rgba(0,0,0,0.28)',

  // HUD
  hudFill:  0x0a1410,
  hudText:  '#E8E1C9',

  // Карты
  cardDimAlpha: 0.40
};

window.GameScene = class GameScene extends Phaser.Scene {
  constructor(){ super('GameScene'); }

  // ------- HELPERS: клампы для шрифта -------
  _pxClamp(px, minPx, maxPx){ return Math.round(Phaser.Math.Clamp(px, minPx, maxPx)); }
  _pxByH(fraction, minPx, maxPx){ const { H } = this.getSceneWH(); return this._pxClamp(H * fraction, minPx, maxPx); }

  // ------- HiDPI helpers -------
  getDPR(){
    // Не слишком агрессивно, чтобы не раздувать память на старых устройствах
    const dpr = Math.min(2.0, Math.max(1, (window.devicePixelRatio || 1)));
    return dpr;
  }

  // Универсальный способ создать CanvasTexture с учётом DPR
  _createHiDPICanvasTexture(key, w, h, drawFn){
    const DPR = this.getDPR();
    const tex = this.textures.createCanvas(key, Math.max(2, Math.round(w*DPR)), Math.max(2, Math.round(h*DPR)));
    const ctx = tex.getContext();
    // Нормируем систему координат к логическим w×h
    ctx.save();
    ctx.scale(DPR, DPR);
    drawFn(ctx, w, h);
    ctx.restore();
    tex.refresh();
    return tex;
  }

  preload(){
    // Карты
    this.load.image('back', 'assets/back_card02.png');
    ALL_CARD_KEYS.forEach(k => this.load.image(k, `assets/cards/${k}.png`));
  }

  create(){
    // Состояние
    this.levelButtons  = [];
    this.cards         = [];
    this.opened        = [];
    this.canClick      = false;
    this.currentLevel  = null;

    this.hud = null;
    this.mistakeCount  = 0;
    this.mistakeText   = null;

    this.levelPage     = 0;
    this._wheelHandler = null;
    this.bgImage       = null;

    // Счётчик для уникальных имён текстур
    this._texId = 0;

    // Плейсхолдеры, фон и меню
    this.makePlaceholdersIfNeeded();
    this.ensureGradientBackground();
    this.showLevelSelect();

    // Ресайз
    this.scale.on('resize', () => {
      this.ensureGradientBackground();
      if (!this.currentLevel) this.showLevelSelect(this.levelPage);
      else this.startGame(this.currentLevel);
    }, this);
  }

  // ---------- SIZE UTILS ----------
  getSceneWH(){
    const s = this.scale;
    const cam = this.cameras?.main;
    const W = (s && (s.width ?? s.gameSize?.width))  || cam?.width  || this.sys.game.config.width  || 800;
    const H = (s && (s.height ?? s.gameSize?.height)) || cam?.height || this.sys.game.config.height || 600;
    return { W: Math.floor(W), H: Math.floor(H) };
  }

  // ---------- BACKGROUND ----------
  ensureGradientBackground(){
    const { W, H } = this.getSceneWH();
    const key = 'bg-grad';
    if (this.textures.exists(key)) {
      const src = this.textures.get(key).getSourceImage();
      if (src.width !== Math.round(W*this.getDPR()) || src.height !== Math.round(H*this.getDPR())) {
        this.textures.remove(key);
      }
    }
    if (!this.textures.exists(key)) {
      this._createHiDPICanvasTexture(key, W, H, (ctx, w, h) => {
        // Вертикальный строгий градиент
        const g = ctx.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0.00, THEME.bgTop);
        g.addColorStop(0.60, THEME.bgMid);
        g.addColorStop(1.00, THEME.bgBottom);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);

        // Лёгкая виньетка по краям (строго, без цветной дымки)
        const v = ctx.createRadialGradient(w/2, h*0.6, Math.min(w,h)*0.15, w/2, h*0.6, Math.max(w,h));
        v.addColorStop(0, 'rgba(255,255,255,0.0)');
        v.addColorStop(1, 'rgba(0,0,0,0.22)');
        ctx.fillStyle = v;
        ctx.fillRect(0,0,w,h);
      });
    }
    if (this.bgImage) this.bgImage.destroy();
    this.bgImage = this.add.image(0, 0, key).setOrigin(0, 0).setDepth(-1000);
    this.bgImage.setDisplaySize(W, H); // логический размер, картинка — HiDPI
  }

  // ---------- CANVAS SHAPES ----------
  _uid(pref){ return `${pref}_${Date.now()}_${this._texId++}`; }

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

  // Строгая кнопка (урезанные скругления, без глянца)
  makeButtonTexture(w, h, radius, colTop, colBot){
    const key = this._uid('btn');

    this._createHiDPICanvasTexture(key, w, h, (ctx, W, H) => {
      // Умеренная тень
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.28)';
      ctx.shadowBlur = Math.max(6, Math.round(Math.min(W,H)*0.10));
      ctx.shadowOffsetY = Math.round(H*0.08);

      // Градиент кнопки (без блика)
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, colTop);
      g.addColorStop(1, colBot);
      ctx.fillStyle = g;

      const pad = 10;
      this._roundRect(ctx, pad, pad, W-pad*2, H-pad*2, Math.min(14, H/3));
      ctx.fill();
      ctx.restore();

      // Внутренняя обводка
      ctx.lineWidth = 2;
      ctx.strokeStyle = THEME.strokeLight;
      this._roundRect(ctx, pad, pad, W-pad*2, H-pad*2, Math.min(14, H/3));
      ctx.stroke();
    });

    return key;
  }

  // Круглая иконка (строже, без блика)
  makeCircleIconTexture(size, colTop, colBot){
    const key = this._uid('icn');

    this._createHiDPICanvasTexture(key, size, size, (ctx, S) => {
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.28)';
      ctx.shadowBlur = Math.round(S*0.12);
      ctx.shadowOffsetY = Math.round(S*0.08);

      const g = ctx.createLinearGradient(0, 0, 0, S);
      g.addColorStop(0, colTop);
      g.addColorStop(1, colBot);
      ctx.fillStyle = g;

      ctx.beginPath();
      ctx.arc(S/2, S/2, S/2 - 6, 0, Math.PI*2);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      ctx.lineWidth = 2;
      ctx.strokeStyle = THEME.strokeLight;
      ctx.beginPath();
      ctx.arc(S/2, S/2, S/2 - 6, 0, Math.PI*2);
      ctx.stroke();
    });

    return key;
  }

  // Контейнер-кнопка (текст поверх текстуры)
  makeTextButton(x, y, w, h, label, colTop, colBot, onClick){
    const key = this.makeButtonTexture(w, h, Math.min(14, h/3), colTop, colBot);
    const img = this.add.image(0, 0, key).setOrigin(0.5);
    img.setDisplaySize(w, h); // важно для HiDPI

    const txt = this.add.text(0, 0, label, {
      fontFamily: THEME.font,
      fontSize: this._pxClamp(h*0.22, 14, 28) + 'px',
      color:'#0E1713',
      fontStyle:'600'
    }).setOrigin(0.5);

    const cont = this.add.container(x, y, [img, txt]);
    cont.setSize(w, h);

    img.setInteractive({ useHandCursor: true })
      .on('pointerdown', () => onClick && onClick())
      .on('pointerover', () => this.tweens.add({ targets: cont, scale: 1.03, duration: 110 }))
      .on('pointerout',  () => this.tweens.add({ targets: cont, scale: 1.00, duration: 110 }));

    return cont;
  }

  makeIconButton(x, y, size, iconText, colTop, colBot, onClick){
    const key = this.makeCircleIconTexture(size, colTop, colBot);
    const img = this.add.image(0,0,key).setOrigin(0.5);
    img.setDisplaySize(size, size); // важно для HiDPI

    const txt = this.add.text(0,0,iconText,{
      fontFamily: THEME.font,
      fontSize: this._pxClamp(size*0.34, 16, 30) + 'px',
      color:'#0E1713',
      fontStyle:'800'
    }).setOrigin(0.5);

    const cont = this.add.container(x,y,[img,txt]);
    cont.setSize(size,size);

    img.setInteractive({ useHandCursor: true })
      .on('pointerdown', () => onClick && onClick())
      .on('pointerover', () => this.tweens.add({ targets: cont, scale: 1.05, duration: 110 }))
      .on('pointerout',  () => this.tweens.add({ targets: cont, scale: 1.00, duration: 110 }));

    return cont;
  }

  // ---------- PLACEHOLDERS FOR CARDS ----------
  makePlaceholdersIfNeeded(){
    // Рубашка (если нет)
    if (!this.textures.exists('back')){
      const key = 'back';
      // генерируем HiDPI рубашку 220×320
      const W = 220, H = 320;
      this._createHiDPICanvasTexture(key, W, H, (ctx, w, h) => {
        // Основа
        ctx.fillStyle = '#173528';
        this._roundRect(ctx, 0, 0, w, h, 18);
        ctx.fill();
        // Обводка
        ctx.lineWidth = 8;
        ctx.strokeStyle = '#B88A2E';
        this._roundRect(ctx, 0, 0, w, h, 18);
        ctx.stroke();

        // Набивка строгим паттерном
        ctx.save();
        ctx.globalAlpha = 0.18;
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1;
        for (let y=20; y<h-20; y+=16){
          ctx.beginPath();
          ctx.moveTo(16, y);
          ctx.lineTo(w-16, y);
          ctx.stroke();
        }
        ctx.restore();
      });
    }

    // Лица (если нет ассетов)
    ALL_CARD_KEYS.forEach((k) => {
      if (this.textures.exists(k)) return;
      const W = 220, H = 320;
      this._createHiDPICanvasTexture(k, W, H, (ctx, w, h) => {
        ctx.fillStyle = '#204338';
        this._roundRect(ctx, 0, 0, w, h, 18);
        ctx.fill();

        ctx.lineWidth = 8;
        ctx.strokeStyle = '#C87420';
        this._roundRect(ctx, 0, 0, w, h, 18);
        ctx.stroke();

        ctx.fillStyle = '#E8E1C9';
        ctx.font = '800 48px ' + THEME.font;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(k.toUpperCase(), w/2, h/2);
      });
    });
  }

  // ---------- LEVEL SELECT (3×3 + пагинация) ----------
  showLevelSelect(page = 0){
    this.clearLevelButtons();
    this.ensureGradientBackground();

    const { W, H } = this.getSceneWH();
    this.levelPage = page;

    const COLS = 3, ROWS = 3, PER_PAGE = COLS*ROWS;
    const PAGES = Math.max(1, Math.ceil(LEVELS.length / PER_PAGE));

    // Заголовок
    const title = this.add.text(W/2, H*0.13, 'Память: Найди пару', {
      fontFamily: THEME.font,
      fontSize: this._pxByH(0.072, 20, 40) + 'px',
      color: '#E8E1C9',
      fontStyle:'800',
      align: 'center'
    }).setOrigin(0.5);
    this.levelButtons.push(title);

    // Сетка кнопок уровней
    const topY = H*0.22, bottomY = H*0.78;
    const areaH = bottomY - topY;
    const areaW = Math.min(W*0.90, 1080);
    const cellH = areaH / ROWS;
    const cellW = areaW / COLS;
    const gridLeft = (W - areaW) / 2;
    const gridTop  = topY;

    const startIdx = this.levelPage * PER_PAGE;
    const endIdx   = Math.min(startIdx + PER_PAGE, LEVELS.length);
    const pageLevels = LEVELS.slice(startIdx, endIdx);

    pageLevels.forEach((lvl, i) => {
      const r = (i / COLS) | 0, c = i % COLS;
      const x = gridLeft + c * cellW + cellW/2;
      const y = gridTop  + r * cellH + cellH/2;
      const w = Math.min(320, cellW*0.9);
      const h = Math.min(86,  cellH*0.56);

      const btn = this.makeTextButton(
        x, y, w, h, lvl.label,
        THEME.gradA1, THEME.gradB1,
        () => { this.clearLevelButtons(); this.startGame(lvl); }
      );
      this.levelButtons.push(btn);
    });

    // Навигация страниц
    const yNav = H*0.86;
    const size = Math.max(52, Math.round(H*0.06));

    const prevActive = this.levelPage > 0;
    const nextActive = this.levelPage < PAGES - 1;

    const prevBtn = this.makeIconButton(
      W*0.30, yNav, size,
      '‹', THEME.gradB1, THEME.gradA1,
      () => { if (prevActive) this.showLevelSelect(this.levelPage - 1); }
    );
    prevBtn.setAlpha(prevActive?1:0.45);
    this.levelButtons.push(prevBtn);

    const pageTxt = this.add.text(W*0.5, yNav, `${this.levelPage+1} / ${PAGES}`, {
      fontFamily: THEME.font,
      fontSize: this._pxClamp(size*0.30, 14, 22) + 'px',
      color:'#E8E1C9',
      fontStyle:'600'
    }).setOrigin(0.5);
    this.levelButtons.push(pageTxt);

    const nextBtn = this.makeIconButton(
      W*0.70, yNav, size,
      '›', THEME.gradA1, THEME.gradB1,
      () => { if (nextActive) this.showLevelSelect(this.levelPage + 1); }
    );
    nextBtn.setAlpha(nextActive?1:0.45);
    this.levelButtons.push(nextBtn);

    // Колёсико
    if (this._wheelHandler) this.input.off('wheel', this._wheelHandler);
    this._wheelHandler = (_p, _objs, _dx, dy) => {
      if (dy > 0 && nextActive) this.showLevelSelect(this.levelPage + 1);
      else if (dy < 0 && prevActive) this.showLevelSelect(this.levelPage - 1);
    };
    this.input.on('wheel', this._wheelHandler);
  }

  clearLevelButtons(){
    if (this._wheelHandler){
      this.input.off('wheel', this._wheelHandler);
      this._wheelHandler = null;
    }
    if (!this.levelButtons) return;
    this.levelButtons.forEach(b => b && b.destroy());
    this.levelButtons = [];
  }

  // ---------- HUD ----------
  drawHUD(){
    this.clearHUD();
    const { W, H } = this.getSceneWH();
    const hudH = Math.min(86, Math.round(H*0.10));

    // Фон HUD
    this.hud = this.add.graphics().setDepth(5);
    this.hud.fillStyle(THEME.hudFill, 0.95).fillRect(0,0,W,hudH);

    // «Ошибок»
    this.mistakeText = this.add.text(24, Math.round(hudH/2), 'Ошибок: 0', {
      fontFamily: THEME.font,
      fontSize: this._pxClamp(hudH*0.32, 14, 22) + 'px',
      color: THEME.hudText,
      fontStyle:'600'
    }).setOrigin(0,0.5).setDepth(6);

    // Домой (иконка)
    const size = Math.round(hudH*0.76);
    const homeBtn = this.makeIconButton(
      W - (size/2 + 14), Math.round(hudH/2), size,
      '⌂', THEME.gradA1, THEME.gradB1,
      () => {
        this.children.removeAll();
        this.ensureGradientBackground();
        this.cards=[]; this.opened=[]; this.canClick=false; this.currentLevel=null;
        this.showLevelSelect(this.levelPage);
      }
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

  // ---------- GAME ----------
  startGame(level){
    this.currentLevel = level;
    this.mistakeCount = 0;

    this.children.removeAll();  // очистим сцену (удалит и фон)
    this.ensureGradientBackground();
    this.cards = [];
    this.opened = [];
    this.canClick = false;

    this.drawHUD();

    const total = level.cols * level.rows;
    if (total % 2 !== 0){
      console.error('Нечётное число ячеек в сетке', level);
      return;
    }
    const pairs = total / 2;

    // Подготовка колоды
    const shuffled = Phaser.Utils.Array.Shuffle(ALL_CARD_KEYS.slice());
    const base = Array.from({length:pairs}, (_,i)=> shuffled[i % shuffled.length]);
    const deck = Phaser.Utils.Array.Shuffle(base.concat(base));

    // Размеры сцены
    const { W, H } = this.getSceneWH();
    const hudH = Math.min(86, Math.round(H*0.10));

    // Размер карты
    const backTex = this.textures.get('back');
    const backImg = backTex?.getSourceImage?.();
    const cardOrigW = backImg?.width  || 220;
    const cardOrigH = backImg?.height || 320;

    // Паддинги и зазоры (чуть плотнее — строгая сетка)
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

    // Создаём карты (сначала лицом)
    let i = 0;
    for (let r=0; r<level.rows; r++){
      for (let c=0; c<level.cols; c++){
        const key = deck[i++];
        const x = startX + c*(cardW + gap);
        const y = startY + r*(cardH + gap);

        const card = this.add.image(x,y,key).setInteractive({useHandCursor:true});
        card.setScale(cardScale).setDepth(20);
        card.setData({ key, opened:false, matched:false });

        // Ховер-эффект (чуть мягче)
        card.on('pointerover', () => this.tweens.add({ targets: card, scale: cardScale*1.02, duration: 100 }));
        card.on('pointerout',  () => this.tweens.add({ targets: card, scale: cardScale*1.00, duration: 100 }));

        card.on('pointerdown', () => this.onCardClick(card));
        this.cards.push(card);
      }
    }

    // Запоминание: 4 секунды лицом, затем переворот (строже/динамичнее)
    this.canClick = false;
    this.time.delayedCall(4000, () => {
      this.cards.forEach(card => card.setTexture('back'));
      this.canClick = true;
    });
  }

  onCardClick(card){
    if (!this.canClick) return;
    if (card.getData('opened') || card.getData('matched')) return;

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
          a.setData('opened', false);
          b.setData('opened', false);
        } else {
          this.mistakeCount++;
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

    const { W, H } = this.getSceneWH();

    // Заголовок
    this.add.text(W/2, H*0.22, 'Победа!', {
      fontFamily: THEME.font,
      fontSize: this._pxByH(0.088, 22, 48) + 'px',
      color:'#FFFFFF',
      fontStyle:'800'
    }).setOrigin(0.5);

    // Итоги
    this.add.text(W/2, H*0.32, `Ошибок за игру: ${this.mistakeCount}`, {
      fontFamily: THEME.font,
      fontSize: this._pxByH(0.044, 14, 24) + 'px',
      color:'#E8E1C9',
      fontStyle:'600'
    }).setOrigin(0.5);

    // Кнопка «сыграть ещё»
    const btn = this.makeTextButton(
      W/2, H*0.44,
      Math.min(380, W*0.6), Math.min(80, H*0.12),
      '🔄  Сыграть ещё',
      THEME.gradB2, THEME.gradB1,
      () => {
        this.children.removeAll();
        this.ensureGradientBackground();
        this.cards = []; this.opened = []; this.canClick = false; this.currentLevel = null;
        this.showLevelSelect(this.levelPage);
      }
    );
    btn.setDepth(10);
  }

  redrawHUD(){
    if (this.currentLevel) this.drawHUD();
  }
};
