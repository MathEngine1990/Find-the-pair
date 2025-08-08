(function () {
  // Определяем, что мы действительно во ВК (в URL есть параметры vk_*)
  const isVK = /(^|[?&])vk_(app_id|user_id|ts|aref|ref|platform)=/i.test(location.search);

  if (isVK) {
    // динамически грузим vk-bridge, чтобы в обычном браузере его не было
    const s = document.createElement('script');
    s.src = 'https://unpkg.com/@vkontakte/vk-bridge/dist/browser.min.js';
    s.onload = () => {
      // Инициализация
      if (window.vkBridge?.supports?.('VKWebAppInit')) {
        vkBridge.send('VKWebAppInit').catch(()=>{});
      }
      // (необязательно, но приятно) оформить статусбар/хедер
      vkBridge.send('VKWebAppSetViewSettings', {
        status_bar_style: 'light',
        action_bar_color: '#1d2330'
      }).catch(()=>{});

      // (опционально) отключить свайп-назад, если он мешает
      vkBridge.send('VKWebAppDisableSwipeBack').catch(()=>{});
    };
    document.head.appendChild(s);

    // (опционально) своя обработка «Назад»
    window.addEventListener('popstate', (e) => {
      if (window.handleBackFromVK) {
        e.preventDefault();
        window.handleBackFromVK(); // реализуй в игре (например: открыть меню/позу)
        history.pushState({}, ''); // остаёмся на странице
      }
    });
    history.pushState({}, ''); // создаём запись истории
  }

  // ...ниже — твой существующий код Phaser (проверки, конфиг, resize и т.д.) ...
  if (!window.Phaser) { console.error('Phaser не найден'); return; }
  if (!window.GameScene) { console.error('GameScene не найдена'); return; }

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game-container',
    backgroundColor: '#1d2330',
    scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.CENTER_BOTH,
      width: window.innerWidth, height: window.innerHeight },
    scene: [window.GameScene]
  });

  window.addEventListener('resize', () => {
    game.scale.resize(window.innerWidth, window.innerHeight);
  });

  // (опционально) сцена/игра на паузу при сворачивании
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { game.loop.sleep(); } else { game.loop.wake(); }
  });
})();


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
