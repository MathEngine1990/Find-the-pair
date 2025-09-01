//---scenes/PreloadScene.js - путь отдельного файла

window.PreloadScene = class PreloadScene extends Phaser.Scene {
  constructor(){ super('PreloadScene'); }

  preload(){
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
