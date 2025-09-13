//---scenes/PreloadScene.js - путь отдельного файла

window.PreloadScene = class PreloadScene extends Phaser.Scene {
  constructor(){ super('PreloadScene'); }

  preload(){
    
    // Прогресс-бар
  const { width, height } = this.scale;
  const progressBar = this.add.graphics();
  const progressBox = this.add.graphics();
  
  progressBox.fillStyle(0x222222);
  progressBox.fillRect(width/2 - 160, height/2 - 25, 320, 50);
  
  this.load.on('progress', (value) => {
    progressBar.clear();
    progressBar.fillStyle(0x00ff00);
    progressBar.fillRect(width/2 - 150, height/2 - 15, 300 * value, 30);
  });
    
    // единый базовый путь для ассетов
    this.load.setPath('assets/');

    this.load.image('back', 'back_card02.png');
    window.ALL_CARD_KEYS.forEach(k => this.load.image(k, `cards/${k}.png`));
    this.load.image('button01', 'button01.png');

    // фоны
    this.load.image('bg_menu', 'bg_menu.png');
    this.load.image('bg_game', 'bg_game.png');
  }

  create(){
    this.scene.start('MenuScene', { page: 0 });
  }
};
