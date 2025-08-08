(function () {
  // Инициализация VK Bridge (вне ВК не упадёт)
  if (window.vkBridge) {
    vkBridge.send('VKWebAppInit').catch(() => {});
  }

  // Проверки
  if (!window.Phaser) {
    console.error('Phaser не найден. Проверь <script> с CDN в index.html');
    return;
  }
  if (!window.GameScene) {
    console.error('GameScene не найдена. Проверь подключение ./scenes/GameScene.js ДО main.js');
    return;
  }

  // Конфиг с адаптивным масштабом
  const config = {
    type: Phaser.AUTO,
    parent: 'game-container',
    backgroundColor: '#1d2330',
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: window.innerWidth,
      height: window.innerHeight
    },
    scene: [window.GameScene]
  };

  const game = new Phaser.Game(config);

  // Ресайз
  window.addEventListener('resize', () => {
    game.scale.resize(window.innerWidth, window.innerHeight);
  });
})();
