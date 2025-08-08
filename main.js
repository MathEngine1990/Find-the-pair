(function () {
  // Определяем, что запущены во ВК (в query есть параметры vk_*)
  const isVK = /(^|[?&])vk_(app_id|user_id|ts|aref|ref|platform)=/i.test(location.search);

  if (isVK) {
    // Динамически грузим vk-bridge ТОЛЬКО во ВК
    const s = document.createElement('script');
    s.src = 'https://unpkg.com/@vkontakte/vk-bridge/dist/browser.min.js';
    s.onload = () => {
      if (window.vkBridge?.supports?.('VKWebAppInit')) {
        vkBridge.send('VKWebAppInit').catch(()=>{});
      }
      // Опционально: красиво оформить системные элементы
      vkBridge.send('VKWebAppSetViewSettings', {
        status_bar_style: 'light',
        action_bar_color: '#1d2330'
      }).catch(()=>{});
      // Опционально: отключить свайп-назад, если мешает
      vkBridge.send('VKWebAppDisableSwipeBack').catch(()=>{});
    };
    document.head.appendChild(s);

    // (опц.) своя обработка кнопки "назад"
    window.addEventListener('popstate', (e) => {
      if (window.handleBackFromVK) {
        e.preventDefault();
        window.handleBackFromVK();
        history.pushState({}, '');
      }
    });
    history.pushState({}, '');
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

  // Конфиг Phaser с адаптивным масштабом
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

  // Ресайз канваса
  window.addEventListener('resize', () => {
    game.scale.resize(window.innerWidth, window.innerHeight);
  });

  // (опц.) Автопауза при сворачивании
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) game.loop.sleep();
    else game.loop.wake();
  });

  // (опц.) обработчик "назад" от ВК
  window.handleBackFromVK = function () {
    // Здесь можно открыть своё меню/паузу (по желанию)
  };
})();
