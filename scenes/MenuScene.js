// scenes/MenuScene.js
window.MenuScene = class MenuScene extends Phaser.Scene {
  constructor(){ super('MenuScene'); }

  init(data){ this.levelPage = data?.page || 0; }

  create(){
    this.levelButtons = [];
    this._wheelHandler = null;

    this.ensureGradientBackground();
    this.drawMenu(this.levelPage);

    this.scale.on('resize', () => {
      this.ensureGradientBackground();
      this.drawMenu(this.levelPage);
    });
  }

  getSceneWH(){
    const s = this.scale, cam = this.cameras?.main;
    const W = (s && (s.width ?? s.gameSize?.width))  || cam?.width  || this.sys.game.config.width  || 800;
    const H = (s && (s.height ?? s.gameSize?.height)) || cam?.height || this.sys.game.config.height || 600;
    return { W: Math.floor(W), H: Math.floor(H) };
  }

  getDPR(){ return Math.min(2.0, Math.max(1, (window.devicePixelRatio || 1))); }

// scenes/MenuScene.js (замени весь метод ensureGradientBackground на этот)
ensureGradientBackground(){
  const { W, H } = this.getSceneWH();

  // если есть фоновая картинка — используем её
  if (this.textures.exists('bg_menu')) {
    if (this.bgImage) this.bgImage.destroy();

    const img = this.add.image(W/2, H/2, 'bg_menu')
      .setOrigin(0.5)
      .setDepth(-1000);

    // cover: заполняем всю сцену без искажений
    const src = this.textures.get('bg_menu').getSourceImage();
    const iw = src.width, ih = src.height;
    const scale = Math.max(W / iw, H / ih);
    img.setDisplaySize(iw * scale, ih * scale);

    this.bgImage = img;

    // лёгкая виньетка поверх (по желанию, как в твоей теме)
    const vignette = this.add.graphics().setDepth(-999);
    vignette.fillStyle(0x000000, 0.20);
    vignette.fillRect(0,0,W,H);
    this.vignette && this.vignette.destroy();
    this.vignette = vignette;

    return;
  }

  // --- ФОЛЛБЭК: твой прежний градиент ---
  const key = 'bg-grad-menu';
  const DPR = Math.min(2.0, Math.max(1, (window.devicePixelRatio || 1)));
  if (this.textures.exists(key)) {
    const src = this.textures.get(key).getSourceImage();
    if (src.width !== Math.round(W*DPR) || src.height !== Math.round(H*DPR)) {
      this.textures.remove(key);
    }
  }
  if (!this.textures.exists(key)){
    const tex = this.textures.createCanvas(key, Math.max(2, Math.round(W*DPR)), Math.max(2, Math.round(H*DPR)));
    const ctx = tex.getContext();
    ctx.save(); ctx.scale(DPR, DPR);
    const g = ctx.createLinearGradient(0,0,0,H);
    g.addColorStop(0, THEME.bgTop); g.addColorStop(0.6, THEME.bgMid); g.addColorStop(1, THEME.bgBottom);
    ctx.fillStyle = g; ctx.fillRect(0,0,W,H);
    ctx.restore(); tex.refresh();
  }
  if (this.bgImage) this.bgImage.destroy();
  this.bgImage = this.add.image(0,0,key).setOrigin(0,0).setDepth(-1000).setDisplaySize(W,H);

  // (опц.) лёгкая виньетка
  this.vignette && this.vignette.destroy();
  this.vignette = this.add.graphics().setDepth(-999);
  this.vignette.fillStyle(0x000000, 0.20);
  this.vignette.fillRect(0,0,W,H);
}


  clearMenu(){
    if (this._wheelHandler){ this.input.off('wheel', this._wheelHandler); this._wheelHandler = null; }
    this.levelButtons.forEach(b=>b && b.destroy());
    this.levelButtons = [];
  }

  drawMenu(page){
    this.clearMenu();
    const { W, H } = this.getSceneWH();
    this.levelPage = page;

    const COLS=3, ROWS=3, PER_PAGE=COLS*ROWS;
    const PAGES = Math.max(1, Math.ceil(LEVELS.length / PER_PAGE));
    const title = this.add.text(W/2, H*0.13, 'Память: Найди пару', {
      fontFamily: THEME.font, fontSize: Math.round(Math.min(Math.max(H*0.072,20),40)) + 'px',
      color:'#E8E1C9', fontStyle:'800', align:'center'
    }).setOrigin(0.5);
    this.levelButtons.push(title);

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
      const h = Math.min(200,  cellH*0.86);

      const btn = window.makeImageButton(this, x, y, w, h, lvl.label, () => {
        this.scene.start('GameScene', { level: lvl, page: this.levelPage });
      });
      this.levelButtons.push(btn);
    });

    const yNav = H*0.86;
    const size = Math.max(52, Math.round(H*0.06));
    const prevActive = this.levelPage > 0;
    const nextActive = this.levelPage < PAGES - 1;

    const prevBtn = window.makeIconButton(this, W*0.30, yNav, size, '‹', () => {
      if (prevActive) this.drawMenu(this.levelPage - 1);
    });
    prevBtn.setAlpha(prevActive?1:0.45); this.levelButtons.push(prevBtn);

    const pageTxt = this.add.text(W*0.5, yNav, `${this.levelPage+1} / ${PAGES}`, {
      fontFamily: THEME.font, fontSize: Math.round(Math.min(Math.max(size*0.30,14),22)) + 'px',
      color:'#E8E1C9', fontStyle:'600'
    }).setOrigin(0.5);
    this.levelButtons.push(pageTxt);

    const nextBtn = window.makeIconButton(this, W*0.70, yNav, size, '›', () => {
      if (nextActive) this.drawMenu(this.levelPage + 1);
    });
    nextBtn.setAlpha(nextActive?1:0.45); this.levelButtons.push(nextBtn);

    this._wheelHandler = (_p, _objs, _dx, dy) => {
      if (dy > 0 && nextActive) this.drawMenu(this.levelPage + 1);
      else if (dy < 0 && prevActive) this.drawMenu(this.levelPage - 1);
    };
    this.input.on('wheel', this._wheelHandler);
  }
};
