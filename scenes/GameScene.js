// GameScene.js

// --- Карточные ключи под твои ассеты (assets/cards/<key>.png) ---
const ALL_CARD_KEYS = [
  'qd','qh','qs','qc',
  'kd','kh','ks','kc',
  'ad','ah','as','ac',
  'jd','jh','js','jc',
  '10h','10c'
];

// --- 11 уровней как просили ---
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

window.GameScene = class GameScene extends Phaser.Scene {
  constructor(){ super('GameScene'); }

  preload(){
    this.cameras.main.setBackgroundColor('#0f0f12');
    // Рубашка (assets/back_card02.png)
    this.load.image('back', 'assets/back_card02.png');
    // Лицевые карты
    ALL_CARD_KEYS.forEach(k => this.load.image(k, `assets/cards/${k}.png`));
  }

  create(){
    // Состояния
    this.levelButtons  = [];
    this.cards         = [];
    this.opened        = [];
    this.canClick      = false;
    this.currentLevel  = null;

    this.hud = null;
    this.mistakeCount  = 0;
    this.mistakeText   = null;
    this.exitBtn       = null;

    this.levelPage     = 0;     // страница меню (для пагинации)
    this._wheelHandler = null;  // ссылка на обработчик колесика для корректного off()

    // Если какие-то текстуры не загрузились — сделаем плейсхолдеры
    this.makePlaceholdersIfNeeded();

    // Показать меню уровней
    this.showLevelSelect();

    // На ресайз: перерисовать меню или перезапустить текущий уровень (для корректной раскладки)
    this.scale.on('resize', () => {
      if (!this.currentLevel) this.showLevelSelect(this.levelPage);
      else this.startGame(this.currentLevel);
    }, this);
  }

  // ---------- ВСПОМОГАТЕЛЬНОЕ ----------

  getSceneWH(){
    const s = this.scale;
    const cam = this.cameras?.main;
    const W = (s && (s.width ?? s.gameSize?.width))  || cam?.width  || this.sys.game.config.width  || 800;
    const H = (s && (s.height ?? s.gameSize?.height)) || cam?.height || this.sys.game.config.height || 600;
    return { W: Math.floor(W), H: Math.floor(H) };
  }

  makePlaceholdersIfNeeded(){
    // Рубашка
    if (!this.textures.exists('back')){
      const g = this.add.graphics();
      g.fillStyle(0x2a2e3f, 1).fillRoundedRect(0,0,220,320,18);
      g.lineStyle(6,0xffffff,1).strokeRoundedRect(0,0,220,320,18);
      g.generateTexture('back', 220, 320);
      g.destroy();
    }
    // Лицевые
    ALL_CARD_KEYS.forEach((k) => {
      if (this.textures.exists(k)) return;
      const g = this.add.graphics();
      g.fillStyle(0x33415c,1).fillRoundedRect(0,0,220,320,18);
      g.lineStyle(6,0x88aaff,1).strokeRoundedRect(0,0,220,320,18);
      const t = this.add.text(110,160,k.toUpperCase(),{ fontFamily:'Arial', fontSize:'48px', color:'#fff' }).setOrigin(0.5);
      g.generateTexture(k,220,320);
      t.destroy(); g.destroy();
    });
  }

  // ---------- МЕНЮ УРОВНЕЙ (3×3, PAGINATION) ----------

  showLevelSelect(page = 0){
    this.clearLevelButtons();

    const { W, H } = this.getSceneWH();

    this.levelPage = page;
    const COLS = 3, ROWS = 3, PER_PAGE = COLS*ROWS;
    const PAGES = Math.max(1, Math.ceil(LEVELS.length / PER_PAGE));

    const title = this.add.text(W/2, H*0.16, 'ПараВоз', {
      fontFamily: 'Arial',
      fontSize: Math.round(H*0.06)+'px',
      color: '#ffffff'
    }).setOrigin(0.5);
    this.levelButtons.push(title);

    // Область сетки под кнопки
    const topY = H*0.28;
    const bottomY = H*0.80;

    const areaH = bottomY - topY;
    const areaW = Math.min(W*0.9, 1000);
    const cellH = areaH / ROWS;
    const cellW = areaW / COLS;

    const padX = Math.min(16, Math.round(cellW * 0.06));
    const padY = Math.min(12, Math.round(cellH * 0.08));
    const btnFont = Math.max(18, Math.round(Math.min(cellH, cellW) * 0.28));

    const gridLeft = (W - areaW) / 2;
    const gridTop  = topY;

    const startIdx = this.levelPage * PER_PAGE;
    const endIdx   = Math.min(startIdx + PER_PAGE, LEVELS.length);
    const pageLevels = LEVELS.slice(startIdx, endIdx);

    pageLevels.forEach((lvl, i) => {
      const r = (i / COLS) | 0;
      const c = i % COLS;
      const x = gridLeft + c * cellW + cellW/2;
      const y = gridTop  + r * cellH + cellH/2;

      const btn = this.add.text(x, y, lvl.label, {
        fontFamily: 'Arial',
        fontSize: btnFont+'px',
        color: '#ffffff',
        backgroundColor: '#333',
        padding: { left: padX, right: padX, top: padY, bottom: padY }
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });

      btn.on('pointerover', () => btn.setStyle({ backgroundColor: '#555' }));
      btn.on('pointerout',  () => btn.setStyle({ backgroundColor: '#333' }));
      btn.on('pointerdown', () => {
        this.clearLevelButtons();
        this.startGame(lvl);
      });

      this.levelButtons.push(btn);
    });

    // Пагинация
    const pagFont = Math.max(18, Math.round(H * 0.04));
    const yNav = H * 0.88;

    const prevActive = this.levelPage > 0;
    const nextActive = this.levelPage < PAGES - 1;

    const prev = this.add.text(W*0.25, yNav, '← Пред.', {
      fontFamily: 'Arial',
      fontSize: pagFont+'px',
      color: (prevActive ? '#fff' : '#777'),
      backgroundColor: (prevActive ? '#333' : '#222'),
      padding: { left: 12, right: 12, top: 8, bottom: 8 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: prevActive });
    if (prevActive){
      prev.on('pointerover', () => prev.setStyle({ backgroundColor: '#555' }));
      prev.on('pointerout',  () => prev.setStyle({ backgroundColor: '#333' }));
      prev.on('pointerdown', () => this.showLevelSelect(this.levelPage - 1));
    }
    this.levelButtons.push(prev);

    const indicator = this.add.text(W*0.5, yNav, `${this.levelPage+1} / ${PAGES}`, {
      fontFamily: 'Arial',
      fontSize: pagFont+'px',
      color: '#aaa'
    }).setOrigin(0.5);
    this.levelButtons.push(indicator);

    const next = this.add.text(W*0.75, yNav, 'След. →', {
      fontFamily: 'Arial',
      fontSize: pagFont+'px',
      color: (nextActive ? '#fff' : '#777'),
      backgroundColor: (nextActive ? '#333' : '#222'),
      padding: { left: 12, right: 12, top: 8, bottom: 8 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: nextActive });
    if (nextActive){
      next.on('pointerover', () => next.setStyle({ backgroundColor: '#555' }));
      next.on('pointerout',  () => next.setStyle({ backgroundColor: '#333' }));
      next.on('pointerdown', () => this.showLevelSelect(this.levelPage + 1));
    }
    this.levelButtons.push(next);

    // Колёсико — одна подписка
    if (this._wheelHandler) {
      this.input.off('wheel', this._wheelHandler);
    }
    this._wheelHandler = (_p, _objs, _dx, dy) => {
      if (dy > 0 && this.levelPage < PAGES - 1) this.showLevelSelect(this.levelPage + 1);
      else if (dy < 0 && this.levelPage > 0)    this.showLevelSelect(this.levelPage - 1);
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

  // ---------- ИГРА ----------

  drawHUD(){
    this.clearHUD();
    const { W, H } = this.getSceneWH();
    const hudH = Math.min(90, Math.round(H*0.1));

    this.hud = this.add.graphics().setDepth(5);
    this.hud.fillStyle(0x222333,1).fillRect(0,0,W,hudH);

    this.mistakeText = this.add.text(20, Math.round(hudH/2), 'Ошибок: 0', {
      fontFamily:'Arial', fontSize: Math.round(hudH*0.5)+'px', color:'#fff'
    }).setOrigin(0,0.5).setDepth(6);

    this.exitBtn = this.add.text(W-20, Math.round(hudH/2), 'В меню', {
      fontFamily:'Arial', fontSize: Math.round(hudH*0.45)+'px', color:'#fff',
      backgroundColor:'#333', padding:{left:10,right:10,top:6,bottom:6}
    }).setOrigin(1,0.5).setInteractive({useHandCursor:true}).setDepth(6);

    this.exitBtn.on('pointerover',()=>this.exitBtn.setStyle({backgroundColor:'#555'}));
    this.exitBtn.on('pointerout', ()=>this.exitBtn.setStyle({backgroundColor:'#333'}));
    this.exitBtn.on('pointerdown',()=>{
      this.children.removeAll();
      this.cards=[]; this.opened=[]; this.canClick=false; this.currentLevel=null;
      this.showLevelSelect(this.levelPage);
    });
  }

  clearHUD(){
    if (this.hud) this.hud.destroy();
    if (this.mistakeText) this.mistakeText.destroy();
    if (this.exitBtn) this.exitBtn.destroy();
    this.hud = this.mistakeText = this.exitBtn = null;
  }

  startGame(level){
    this.currentLevel = level;
    this.mistakeCount = 0;

    this.children.removeAll(); // очистим сцену
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

    // Размеры эталонной карты — из текстуры "back"
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
    // поле фиксированно ниже HUD на outerPad
    const startY = hudH + outerPad + cardH / 2;

    // Создадим карты (сначала лицом)
    let i = 0;
    for (let r=0; r<level.rows; r++){
      for (let c=0; c<level.cols; c++){
        const key = deck[i++];
        const x = startX + c*(cardW + gap);
        const y = startY + r*(cardH + gap);

        const card = this.add.image(x,y,key).setInteractive({useHandCursor:true});
        card.setScale(cardScale).setDepth(20);
        card.setData({ key, opened:false, matched:false });

        card.on('pointerdown', () => this.onCardClick(card));
        this.cards.push(card);
      }
    }

    // Показать 5 сек и перевернуть на «рубашку»
    this.canClick = false;
    this.time.delayedCall(5000, () => {
      this.cards.forEach(card => card.setTexture('back'));
      this.canClick = true;
    });
  }

  onCardClick(card){
    if (!this.canClick) return;
    if (card.getData('opened') || card.getData('matched')) return; // уже открыта/сопоставлена — игнор

    card.setTexture(card.getData('key'));
    card.setData('opened', true);
    this.opened.push(card);

    if (this.opened.length === 2){
      this.canClick = false;
      this.time.delayedCall(500, () => {
        const [a,b] = this.opened;
        if (a.getData('key') === b.getData('key')){
          // Совпали: помечаем и БЛОКИРУЕМ дальнейшие клики
          a.setData('matched', true).setAlpha(0.35).disableInteractive(); // [NEW]
          b.setData('matched', true).setAlpha(0.35).disableInteractive(); // [NEW]
          // дополнительно на всякий случай снимаем "opened"
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
    // Блокируем любые дальнейшие клики по картам после победы
    this.canClick = false;                                     // [NEW]
    this.cards.forEach(c => c.disableInteractive());           // [NEW]

    this.clearHUD();
    const { W, H } = this.getSceneWH();

    this.add.text(W/2, H*0.20, 'Победа!', {
      fontFamily:'Arial', fontSize: Math.round(H*0.08)+'px', color:'#fff'
    }).setOrigin(0.5);

    // Итоговое число ошибок
    this.add.text(W/2, H*0.30, `Ошибок за игру: ${this.mistakeCount}`, { // [NEW]
      fontFamily:'Arial', fontSize: Math.round(H*0.045)+'px', color:'#ddd'
    }).setOrigin(0.5);

    const btn = this.add.text(W/2, H*0.40, 'Сыграть ещё', {
      fontFamily:'Arial', fontSize: Math.round(H*0.05)+'px',
      color:'#fff', backgroundColor:'#333',
      padding:{left:14,right:14,top:10,bottom:10}
    }).setOrigin(0.5).setInteractive({useHandCursor:true});

    btn.on('pointerover',()=>btn.setStyle({backgroundColor:'#555'}));
    btn.on('pointerout', ()=>btn.setStyle({backgroundColor:'#333'}));
    btn.on('pointerdown',()=>{
      this.children.removeAll();
      this.cards = []; this.opened = []; this.canClick = false; this.currentLevel = null;
      this.showLevelSelect(this.levelPage);
    });
  }

  redrawHUD(){
    if (this.currentLevel) this.drawHUD();
  }
};
