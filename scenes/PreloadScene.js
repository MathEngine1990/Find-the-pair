// scenes/PreloadScene.js
window.PreloadScene = class PreloadScene extends Phaser.Scene {
  constructor(){ super('PreloadScene'); }
  preload(){
    this.load.image('back', 'assets/back_card02.png');
    ALL_CARD_KEYS.forEach(k => this.load.image(k, `assets/cards/${k}.png`));
    this.load.image('button01', 'assets/button01.png');

    // НОВОЕ: фоны
    this.load.image('bg_menu', 'assets/bg_menu.png');
    this.load.image('bg_game', 'assets/bg_game.png');
  }
  create(){
    this.scene.start('MenuScene', { page: 0 });
  }
};
