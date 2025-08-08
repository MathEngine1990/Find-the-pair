// Ключи карт (как в твоих ассетах)
const ALL_CARD_KEYS = [
  'qd','qh','qs','qc',
  'kd','kh','ks','kc',
  'ad','ah','as','ac',
  'jd','jh','js','jc',
  '10h','10c'
];

const LEVELS = [
  { label: '3x4 (6 пар)', cols: 4, rows: 3 },
  { label: '4x4 (8 пар)', cols: 4, rows: 4 },
  { label: '6x6 (18 пар)', cols: 6, rows: 6 }
];

window.GameScene = class GameScene extends Phaser.Scene {
  constructor() { super('GameScene'); }

  preload() {
    // рубашка
    this.load.image('back', 'assets/back_card02.png');
    // все карты
    ALL_CARD_KEYS.forEach(key => {
      this.load.image(key, `assets/cards/${key}.png`);
    });
  }

  create() {
    this.levelButtons = [];
    this.cards = [];
    this.opened = [];
    this.canClick = false;
    this.currentLevel = null;

    this.hud = null;
    this.mistakeCount = 0;
    this.mistakeText = null;
    this.exitBtn = null;

    this.showLevelSelect();
    this.scale.on('resize', () => this.redrawHUD(), this);
  }

  // --- Меню уровней ---
  showLevelSelect() {
    this.clearLevelButtons();

    const { width: W, height: H } = this.scale.gameSize;

    const title = this.add.text(W/2, H*0.2, 'Игра на память', {
      fontFamily: 'Arial',
      fontSize: Math.round(H*0.06) + 'px',
      color: '#ffffff'
    }).setOrigin(0.5);
    this.levelButtons.push(title);

    const startY = H*0.35;
    const gapY   = Math.max(54, H*0.08);

    LEVELS.forEach((lvl, i) => {
      const btn = this.add.text(W/2, startY + i*gapY, lvl.label, {
        fontFamily: 'Arial',
        fontSize: Math.round(H*0.045) + 'px',
        color: '#ffffff',
        backgroundColor: '#333',
        padding: { left: 14, right: 14, top: 10, bottom: 10 }
      }).setOrigin(0.5).setInteractive();

      btn.on('pointerover', () => btn.setStyle({ backgroundColor: '#555' }));
      btn.on('pointerout',  () => btn.setStyle({ backgroundColor: '#333' }));
      btn.on('pointerdown', () => {
        this.clearLevelButtons();
        this.startGame(lvl);
      });

      this.levelButtons.push(btn);
    });
  }

  clearLevelButtons() {
    if (!this.levelButtons) return;
    this.levelButtons.forEach(b => b && b.destroy());
    this.levelButtons = [];
  }

  // --- Запуск уровня ---
  startGame(level) {
    this.currentLevel = level;
    this.mistakeCount = 0;

    this.children.removeAll();
    this.cards = [];
    this.opened = [];
    this.canClick = false;

    this.drawHUD();

    const total = level.cols * level.rows;
    const pairs = total / 2;

    let chosen = Phaser.Utils.Array.Shuffle(ALL_CARD_KEYS.slice()).slice(0, pairs);
    let deck = Phaser.Utils.Array.Shuffle(chosen.concat(chosen));

    const { width: W, height: H } = this.scale.gameSize;
    const hudH = Math.min(90, Math.round(H*0.1));

    // реальные размеры исходной карты (подгони под свои ассеты при нужде)
    const cardOrigW = 500;
    const cardOrigH = 1300;

    const padding = Math.max(8, Math.round(Math.min(W, H) * 0.01));
    const availW = W - padding * (level.cols + 1);
    const availH = (H - hudH) - padding * (level.rows + 1);

    const scaleX = availW / (cardOrigW * level.cols);
    const scaleY = availH / (cardOrigH * level.rows);
    const cardScale = Math.min(scaleX, scaleY, 1);

    const cardW = cardOrigW * cardScale;
    const cardH = cardOrigH * cardScale;

    const spacingX = (W - (cardW * level.cols)) / (level.cols + 1);
    const spacingY = ((H - hudH) - (cardH * level.rows)) / (level.rows + 1);

    const startX = spacingX + cardW / 2;
    const startY = hudH + spacingY + cardH / 2;

    let i = 0;
    for (let r = 0; r < level.rows; r++) {
      for (let c = 0; c < level.cols; c++) {
        const key = deck[i++];
        const x = startX + c * (cardW + spacingX);
        const y = startY + r * (cardH + spacingY);

        const card = this.add.image(x, y, key).setInteractive();
        card.setScale(cardScale);
        card.setDepth(10);
        card.setData('key', key);
        card.setData('opened', false);
        card.setData('matched', false);

        card.on('pointerdown', () => this.onCardClick(card));
        this.cards.push(card);
      }
    }

    // показать все 2 сек, затем перевернуть
    this.canClick = false;
    this.time.delayedCall(2000, () => {
      this.cards.forEach(card => card.setTexture('back'));
      this.canClick = true;
    });
  }

  onCardClick(card) {
    if (!this.canClick) return;
    if (card.getData('opened') || card.getData('matched')) return;

    card.setTexture(card.getData('key'));
    card.setData('opened', true);
    this.opened.push(card);

    if (this.opened.length === 2) {
      this.canClick = false;
      this.time.delayedCall(600, () => {
        const [a, b] = this.opened;
        if (a.getData('key') === b.getData('key')) {
          a.setData('matched', true);
          b.setData('matched', true);
        } else {
          this.mistakeCount++;
          if (this.mistakeText) this.mistakeText.setText('Ошибок: ' + this.mistakeCount);
          a.setTexture('back').setData('opened', false);
          b.setTexture('back').setData('opened', false);
        }
        this.opened = [];
        this.canClick = true;

        if (this.cards.every(c => c.getData('matched'))) {
          this.showWin();
        }
      });
    }
  }

  showWin() {
    this.clearHUD();

    const { width: W } = this.scale.gameSize;
    this.add.text(W/2, 80, 'Победа!', {
      fontFamily: 'Arial',
      fontSize: '56px',
      color: '#fff'
    }).setOrigin(0.5);

    const btn = this.add.text(W/2, 170, 'Сыграть ещё', {
      fontFamily: 'Arial',
      fontSize: '40px',
      color: '#fff',
      backgroundColor: '#333',
      padding: { left: 14, right: 14, top: 10, bottom: 10 }
    }).setOrigin(0.5).setInteractive();

    btn.on('pointerover', () => btn.setStyle({ backgroundColor: '#555' }));
    btn.on('pointerout',  () => btn.setStyle({ backgroundColor: '#333' }));
    btn.on('pointerdown', () => {
      this.children.removeAll();
      this.cards = [];
      this.opened = [];
      this.canClick = false;
      this.currentLevel = null;
      this.showLevelSelect();
    });
  }

  // --- HUD ---
  drawHUD() {
    this.clearHUD();

    const { width: W, height: H } = this.scale.gameSize;
    const hudH = Math.min(90, Math.round(H*0.1));

    this.hud = this.add.graphics();
    this.hud.fillStyle(0x222333, 1);
    this.hud.fillRect(0, 0, W, hudH);
    this.hud.setDepth(50);

    this.mistakeText = this.add.text(20, Math.round(hudH/2), 'Ошибок: 0', {
      fontFamily: 'Arial',
      fontSize: Math.round(hudH * 0.5) + 'px',
      color: '#fff'
    }).setOrigin(0, 0.5).setDepth(100);

    this.exitBtn = this.add.text(W - 20, Math.round(hudH/2), 'В меню', {
      fontFamily: 'Arial',
      fontSize: Math.round(hudH * 0.45) + 'px',
      color: '#fff',
      backgroundColor: '#333',
      padding: { left: 10, right: 10, top: 6, bottom: 6 }
    }).setOrigin(1, 0.5).setInteractive().setDepth(100);

    this.exitBtn.on('pointerover', () => this.exitBtn.setStyle({ backgroundColor: '#555' }));
    this.exitBtn.on('pointerout',  () => this.exitBtn.setStyle({ backgroundColor: '#333' }));
    this.exitBtn.on('pointerdown', () => {
      this.children.removeAll();
      this.cards = [];
      this.opened = [];
      this.canClick = false;
      this.currentLevel = null;
      this.showLevelSelect();
    });
  }

  clearHUD() {
    if (this.hud) this.hud.destroy();
    if (this.mistakeText) this.mistakeText.destroy();
    if (this.exitBtn) this.exitBtn.destroy();
    this.hud = null;
    this.mistakeText = null;
    this.exitBtn = null;
  }

  redrawHUD() {
    if (this.currentLevel) this.drawHUD();
  }
};
