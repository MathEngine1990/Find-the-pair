(function () {
  // 1) Инициализация VK Bridge (без падений вне ВК)
  if (window.vkBridge) {
    vkBridge.send('VKWebAppInit').catch(() => {});
  }

  // 2) Проверка, что Phaser и сцена доступны
  if (!window.Phaser) {
    console.error('Phaser не найден. Проверь <script> с CDN в index.html');
    return;
  }
  if (!window.GameScene) {
    console.error('GameScene не найдена. Проверь подключение ./scenes/GameScene.js ДО main.js');
    return;
  }

  // 3) Конфиг с RESIZE, чтобы в webview всё влезало
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

  // 4) Старт
  const game = new Phaser.Game(config);

  // 5) Ресайз окна/вьюпорта
  window.addEventListener('resize', () => {
    game.scale.resize(window.innerWidth, window.innerHeight);
  });
})();
