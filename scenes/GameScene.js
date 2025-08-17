// GameScene.js
//
// Стиль: изумруд + латунь/медь, скругления, объёмные кнопки, современный шрифт.
// Без доп. ассетов для UI — всё рисуется кодом через Canvas-текстуры.
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

// --- Тема ---
const THEME = {
  font: 'Jura, Russo One, sans-serif',

  // Фон: глубокий изумруд → тёмный хвойный → мшисто-оливковый
  bgTop:    '#07130E',
  bgMid:    '#203B30',
  bgBottom: '#5C7865',

  // Тёплая «дымка»
  fogPink:  'rgba(196,154,58,0.16)',

  // Кнопки/градиенты
  gradPinkA:  '#C49A3A',
  gradPinkB:  '#3B5A48',
  gradGreenA: '#4D6D5B',
  gradGreenB: '#D07F2E',

  // Обводки/тени
  strokeLight: 'rgba(239,226,192,0.38)',
  strokeDark:  'rgba(0,0,0,0.30)',

  // HUD
  hudFill:  0x0b1611,
  hudText:  '#EDE2C6',

  // Карты
  cardDimAlpha: 0.40
};

window.GameScene = class GameScene extends Phaser.Scene {
  constructor(){ super('GameScene'); }

  // ------- HELPERS: клампы для шрифта -------
  _pxClamp(px, minPx, maxPx){ // число → округлённый кламп
    return Math.round(Phaser.Math.Clamp(px, minPx, maxPx));
  }
  _pxByH(fraction, minPx, maxPx){ // доля от высоты сцены → кламп
    const { H } = this.getSceneWH();
    return this._pxClamp(H * fraction, minPx, maxPx);
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
      if (src.width !== W || src.height !== H) this.textures.remove(key);
    }
    if (!this.textures.exists(key)) {
      const tex = this.textures.createCanvas(key, W, H);
      const ctx = tex.getContext();

      // Вертикальный градиент
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0.00, THEME.bgTop);
      g.addColorStop(0.55, THEME.bgMid);
      g.addColorStop(1.00, THEME.bgBottom);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);

      // Тёплая дымка
      const fog = ctx.createRadialGradient(W*0.7, H*0.1, 10, W*0.7, H*0.1, Math.max(W,H)*0.8);
      fog.addColorStop(0, THEME.fogPink);
      fog.addColorStop(1, 'rgba(255,77,157,0.0)');
      ctx.fillStyle = fog;
      ctx.fillRect(0, 0, W, H);

      // Виньетка
      const v = ctx.createRadialGradient(W/2, H*0.6, Math.min(W,H)*0.1, W/2, H*0.6, Math.max(W,H));
      v.addColorStop(0, 'rgba(255,255,255,0)');
      v.addColorStop(1, 'rgba(0,0,0,0.26)');
      ctx.fillStyle = v;
      ctx.fillRect(0,0,W,H);

      tex.refresh();
    }
    if (this.bgImage) this.bgImage.destroy();
    this.bgImage = this.add.image(0, 0, key).setOrigin(0, 0).setDepth(-1000);
    this.bgImage.setDisplaySize(W, H);
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

  // Создать объёмную закруглённую кнопку (текстура)
  makeButtonTexture(w, h, radius, colTop, colBot, withGloss=true){
    const key = this._uid('btn');
    const tex = this.textures.createCanvas(key, w, h);
    const ctx = tex.getContext();

    // Тень
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = Math.max(8, Math.round(Math.min(w,h)*0.1));
    ctx.shadowOffsetY = Math.round(h*0.08);

    // Градиент кнопки
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, colTop);
    g.addColorStop(1, colBot);
    ctx.fillStyle = g;

    this._roundRect(ctx, 8, 8, w-16, h-16, radius);
    ctx.fill();
    ctx.restore();

    // Внутренняя обводка
    ctx.lineWidth = 2;
    ctx.strokeStyle = THEME.strokeLight;
    this._roundRect(ctx, 8, 8, w-16, h-16, radius);
    ctx.stroke();

    // Блик
    if (withGloss){
      const gh = Math.max(10, Math.round(h*0.42));
      const gloss = ctx.createLinearGradient(0, 10, 0, gh);
      gloss.addColorStop(0, 'rgba(255,255,255,0.45)');
      gloss.addColorStop(1, 'rgba(255,255,255,0.0)');
      ctx.fillStyle = gloss;
      this._roundRect(ctx, 12, 12, w-24, gh-6, radius*0.7);
      ctx.fill();
    }

    tex.refresh();
    return key;
  }

  // Создать круглую иконку-кнопку
  makeCircleIconTexture(size, colTop, colBot){
    const key = this._uid('icn');
    const tex = this.textures.createCanvas(key, size, size);
    const ctx = tex.getContext();

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = Math.round(size*0.12);
    ctx.shadowOffsetY = Math.round(size*0.08);

    const g = ctx.createLinearGradient(0, 0, 0, size);
    g.addColorStop(0, colTop);
    g.addColorStop(1, colBot);
    ctx.fillStyle = g;

    ctx.beginPath();
    ctx.arc(size/2, size/2, size/2 - 6, 0, Math.PI*2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.lineWidth = 2;
    ctx.strokeStyle = THEME.strokeLight;
    ctx.beginPath();
    ctx.arc(size/2, size/2, size/2 - 6, 0, Math.PI*2);
    ctx.stroke();

    tex.refresh();
    return key;
  }

  // Контейнер-кнопка (текст поверх текстуры)
  // Интерактив вешаем на IMG (масштабируется с контейнером)
  makeTextButton(x, y, w, h, label, colTop, colBot, onClick){
    const key = this.makeButtonTexture(w, h, Math.min(20, h/2), colTop, colBot, true);
    const img = this.add.image(0, 0, key).setOrigin(0.5);
    const txt = this.add.text(0, 0, label, {
      fontFamily: THEME.font,
      fontSize: this._pxClamp(h*0.42, 14, 28) + 'px', // кламп текста кнопки
      color:'#0F1A14',
      fontStyle:'600'
    }).setOrigin(0.5);

    const cont = this.add.container(x, y, [img, txt]);
    cont.setSize(w, h);

    img.setInteractive({ useHandCursor: true })
      .on('pointerdown', () => onClick && onClick())
      .on('pointerover', () => this.tweens.add({ targets: cont, scale: 1.04, duration: 120 }))
      .on('pointerout',  () => this.tweens.add({ targets: cont, scale: 1.00, duration: 120 }));

    return cont;
  }

  makeIconButton(x, y, size, iconText, colTop, colBot, onClick){
    const key = this.makeCircleIconTexture(size, colTop, colBot);
    const img = this.add.image(0,0,key).setOrigin(0.5);
    const txt = this.add.text(0,0,iconText,{
      fontFamily: THEME.font,
      fontSize: this._pxClamp(size*0.5, 16, 32) + 'px', // кламп иконки
      color:'#0F1A14',
      fontStyle:'800'
    }).setOrigin(0.5);

    const cont = this.add.container(x,y,[img,txt]);
    cont.setSize(size,size);

    img.setInteractive({ useHandCursor: true })
      .on('pointerdown', () => onClick && onClick())
      .on('pointerover', () => this.tweens.add({ targets: cont, scale: 1.06, duration: 120 }))
      .on('pointerout',  () => this.tweens.add({ targets: cont, scale: 1.00, duration: 120 }));

    return cont;
  }

  // ---------- PLACEHOLDERS FOR CARDS ----------
  makePlaceholdersIfNeeded(){
    // Рубашка (если нет)
    if (!this.textures.exists('back')){
      const g = this.add.graphics();
      g.fillStyle(0x143225, 1)
       .fillRoundedRect(0,0,220,320,20);
      g.lineStyle(8, 0xC49A3A, 0.9)
       .strokeRoundedRect(0,0,220,320,20);
      g.generateTexture('back', 220, 320);
      g.destroy();
    }

    // Лица (если нет ассетов)
    ALL_CARD_KEYS.forEach((k) => {
      if (this.textures.exists(k)) return;
      const g = this.add.graphics();
      g.fillStyle(0x23483B, 1)
       .fillRoundedRect(0,0,220,320,20);
      g.lineStyle(8, 0xD07F2E, 0.95)
       .strokeRoundedRect(0,0,220,320,20);

      const t = this.add.text(110,160,k.toUpperCase(),{
        fontFamily: THEME.font,
        fontSize: this._pxClamp(48, 18, 48) + 'px', // безопасный диапазон
        color: '#EDE2C6',
        fontStyle: '800'
      }).setOrigin(0.5);

      g.generateTexture(k,220,320);
      t.destroy();
      g.destroy();
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
    const title = this.add.text(W/2, H*0.14, 'Память: Найди пару', {
      fontFamily: THEME.font,
      fontSize: this._pxByH(0.075, 18, 40) + 'px', // кламп заголовка
      color: '#EDE2C6',
      fontStyle:'800'
    }).setOrigin(0.5);
    this.levelButtons.push(title);

    // Сетка кнопок уровней
    const topY = H*0.24, bottomY = H*0.78;
    const areaH = bottomY - topY;
    const areaW = Math.min(W*0.92, 1080);
    const cellH = areaH / ROWS;
    const cellW = areaW / COLS;
    const gridLeft = (W - areaW) / 2;
    const gridTop  = topY;

    const startIdx = this.levelPage * PER_PAGE;
    let endIdx   = Math.min(startIdx + PER_PAGE, LEVELS.length);
    const pageLevels = LEVELS.slice(startIdx, endIdx);

    pageLevels.forEach((lvl, i) => {
      const r = (i / COLS) | 0, c = i % COLS;
      const x = gridLeft + c * cellW + cellW/2;
      const y = gridTop  + r * cellH + cellH/2;
      const w = Math.min(320, cellW*0.9);
      const h = Math.min(90,  cellH*0.6);

      const btn = this.makeTextButton(
        x, y, w, h, lvl.label,
        THEME.gradPinkA, THEME.gradGreenA,
        () => { this.clearLevelButtons(); this.startGame(lvl); }
      );
      this.levelButtons.push(btn);
    });

    // Навигация страниц
    const yNav = H*0.86;
    const size = Math.max(54, Math.round(H*0.065));

    const prevActive = this.levelPage > 0;
    const nextActive = this.levelPage < PAGES - 1;

    const prevBtn = this.makeIconButton(
      W*0.30, yNav, size,
      '‹', THEME.gradPinkB, THEME.gradPinkA,
      () => { if (prevActive) this.showLevelSelect(this.levelPage - 1); }
    );
    prevBtn.setAlpha(prevActive?1:0.45);
    this.levelButtons.push(prevBtn);

    const pageTxt = this.add.text(W*0.5, yNav, `${this.levelPage+1} / ${PAGES}`, {
      fontFamily: THEME.font,
      fontSize: this._pxClamp(size*0.48, 14, 24) + 'px', // кламп счётчика страниц
      color:'#e9fffb',
      fontStyle:'600'
    }).setOrigin(0.5);
    this.levelButtons.push(pageTxt);

    const nextBtn = this.makeIconButton(
      W*0.70, yNav, size,
      '›', THEME.gradGreenB, THEME.gradGreenA,
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
    const hudH = Math.min(90, Math.round(H*0.1));

    // Фон HUD
    this.hud = this.add.graphics().setDepth(5);
    this.hud.fillStyle(THEME.hudFill, 0.9).fillRect(0,0,W,hudH);

    // «Ошибок»
    this.mistakeText = this.add.text(24, Math.round(hudH/2), 'Ошибок: 0', {
      fontFamily: THEME.font,
      fontSize: this._pxClamp(hudH*0.48, 14, 22) + 'px', // кламп HUD-текста
      color: THEME.hudText,
      fontStyle:'600'
    }).setOrigin(0,0.5).setDepth(6);

    // Домой (иконка)
    const size = Math.round(hudH*0.78);
    const homeBtn = this.makeIconButton(
      W - (size/2 + 14), Math.round(hudH/2), size,
      '⌂', THEME.gradPinkA, THEME.gradGreenA,
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
    const hudH = Math.min(90, Math.round(H*0.1));

    // Размер карты
    const backTex = this.textures.get('back');
    const backImg = backTex?.getSourceImage?.();
    const cardOrigW = backImg?.width  || 220;
    const cardOrigH = backImg?.height || 320;

    // Паддинги и зазоры
    const outerPad = Math.max(8, Math.round(Math.min(W,H)*0.02));
    const gap      = Math.max(6, Math.round(Math.min(W,H)*0.012));

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

        // Ховер-эффект
        card.on('pointerover', () => this.tweens.add({ targets: card, scale: cardScale*1.03, duration: 120 }));
        card.on('pointerout',  () => this.tweens.add({ targets: card, scale: cardScale*1.00, duration: 120 }));

        card.on('pointerdown', () => this.onCardClick(card));
        this.cards.push(card);
      }
    }

    // Запоминание: 5 секунд лицом, затем переворот
    this.canClick = false;
    this.time.delayedCall(5000, () => {
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
      this.time.delayedCall(500, () => {
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
      fontSize: this._pxByH(0.09, 22, 48) + 'px', // кламп заголовка победы
      color:'#ffffff',
      fontStyle:'800'
    }).setOrigin(0.5);

    // Итоги
    this.add.text(W/2, H*0.32, `Ошибок за игру: ${this.mistakeCount}`, {
      fontFamily: THEME.font,
      fontSize: this._pxByH(0.045, 14, 24) + 'px', // кламп текста итогов
      color:'#eafff7',
      fontStyle:'600'
    }).setOrigin(0.5);

    // Кнопка «сыграть ещё»
    const btn = this.makeTextButton(
      W/2, H*0.44,
      Math.min(380, W*0.6), Math.min(80, H*0.12),
      '🔄  Сыграть ещё',
      THEME.gradGreenB, THEME.gradPinkB,
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
