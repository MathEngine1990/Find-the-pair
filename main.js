import BootScene from './scenes/BootScene.js';
import IntroScene from './scenes/IntroScene.js';
import MainMenuScene from './scenes/MainMenuScene.js';
import GameScene from './scenes/GameScene.js';

import vkBridge from '@vkontakte/vk-bridge';

const config = {
    type: Phaser.AUTO,
    parent: 'game-container',
    width: 900,
    height: 900,
    backgroundColor: '#1d2330',
    scene: [BootScene, IntroScene, MainMenuScene, GameScene]
};

// Запрос инициализации VK Mini App
vkBridge.send('VKWebAppInit')
  .then(() => {
    console.log('VK Bridge инициализирован');
    // можно запускать Phaser
    new Phaser.Game(config);
  })
  .catch((e) => {
    console.error('Ошибка VKBridge:', e);
  });
