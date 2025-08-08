import vkBridge from '@vkontakte/vk-bridge';
import Phaser from 'phaser';
import GameScene from './scenes/GameScene.js'; // Импорт вашей сцены

vkBridge.send('VKWebAppInit')
  .then(() => {
    console.log('VKBridge initialized');

    const config = {
      type: Phaser.AUTO,
      parent: 'game-container',
      width: 900,
      height: 900,
      backgroundColor: '#1d2330',
      scene: [GameScene]
    };

    new Phaser.Game(config);
  })
  .catch((error) => {
    console.error('VKBridge init error:', error);
  });