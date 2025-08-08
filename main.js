import BootScene from './scenes/BootScene.js';
import IntroScene from './scenes/IntroScene.js';
import MainMenuScene from './scenes/MainMenuScene.js';
import GameScene from './scenes/GameScene.js';

const config = {
    type: Phaser.AUTO,
    parent: 'game-container',
    width: 900,
    height: 900,
    backgroundColor: '#1d2330',
    scene: [BootScene, IntroScene, MainMenuScene, GameScene]
};

new Phaser.Game(config);
