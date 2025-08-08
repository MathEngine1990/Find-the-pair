(function () {
  // 1) VK Bridge — безопасно (вне VK просто ничего не делает)
  if (window.vkBridge) {
    vkBridge.send('VKWebAppInit').catch(() => {});
  }

  // 2) Проверки
  if (!window.Phaser) {
    console.error('Phaser не найден. Проверь <script> с CDN в index.html');
    return;
  }
  if (!window.GameScene) {
    console.error('GameScene не найдена. Проверь подключение ./scenes/GameScene.js ДО main.js');
    return;
  }

  // 3) Конфиг с адаптивным масштабом
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

  // 4) Ресайз
  window.addEventListener('resize', () => {
    game.scale.resize(window.innerWidth, window.innerHeight);
  });
})();
