window.GameScene = class GameScene extends Phaser.Scene {
  constructor(){ super('GameScene'); }


  preload() {
    this.load.image('back', 'assets/back_card02.png');
    // и все карты
  }

  create() {
    // Вызовите showLevelSelect и остальную логику, которую вы писали
  }

  update() {}
}
