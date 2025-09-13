//---main.js - ОБНОВЛЕННАЯ версия для VK Mini Apps

(function () {
  // Определяем запуск во ВК
  const isVK = /(^|[?&])vk_(app_id|user_id|ts|aref|ref|platform)=/i.test(location.search);
  
  // Глобальные переменные для VK данных
  window.VK_USER_DATA = null;
  window.VK_LAUNCH_PARAMS = null;

  if (isVK) {
    const s = document.createElement('script');
    s.src = 'https://unpkg.com/@vkontakte/vk-bridge/dist/browser.min.js';
    s.onload = () => {
      try {
        if (window.vkBridge?.supports?.('VKWebAppInit')) {
          // Инициализация VK Bridge
          vkBridge.send('VKWebAppInit');
          
          // Парсинг launch параметров
          const params = new URLSearchParams(location.search);
          window.VK_LAUNCH_PARAMS = {
            user_id: params.get('vk_user_id'),
            app_id: params.get('vk_app_id'),
            platform: params.get('vk_platform') || 'web',
            is_app_user: params.get('vk_is_app_user') === '1',
            language: params.get('vk_language') || 'ru'
          };
          
          console.log('VK Launch params:', window.VK_LAUNCH_PARAMS);
          
          // Подписка на события VK Bridge
          vkBridge.subscribe((e) => {
            console.log('VK Bridge event:', e);
            
            switch (e.detail?.type) {
              case 'VKWebAppInitResult':
                console.log('VK Bridge initialized successfully');
                initGame();
                break;
                
              case 'VKWebAppGetUserInfoResult':
                window.VK_USER_DATA = e.detail.data;
                console.log('User data received:', window.VK_USER_DATA);
                break;
                
              case 'VKWebAppGetUserInfoFailed':
                console.warn('Failed to get user info:', e.detail.data);
                initGame(); // Запускаем игру без данных пользователя
                break;
                
              case 'VKWebAppViewHide':
                // Пауза игры при сворачивании
                if (window.game && window.game.scene) {
                  window.game.scene.pause();
                }
                break;
                
              case 'VKWebAppViewRestore':
                // Восстановление игры
                if (window.game && window.game.scene) {
                  window.game.scene.resume();
                }
                break;
            }
          });
          
          // Настройка внешнего вида
          vkBridge.send('VKWebAppSetViewSettings', { 
            status_bar_style: 'light', 
            action_bar_color: '#1d2330',
            navigation_bar_color: '#1d2330'
          }).catch(() => {});
          
          // Отключение свайпа назад
          vkBridge.send('VKWebAppDisableSwipeBack').catch(() => {});
          
          // Получение данных пользователя
          vkBridge.send('VKWebAppGetUserInfo').catch(() => {
            console.warn('Cannot get user info, starting without it');
            initGame();
          });
          
        } else {
          console.warn('VK Bridge not supported');
          initGame();
        }
      } catch(e) {
        console.error('VK Bridge init failed:', e);
        initGame();
      }
    };
    s.onerror = () => {
      console.error('Failed to load VK Bridge');
      initGame();
    };
    document.head.appendChild(s);
  } else {
    // Не ВК - запускаем сразу
    console.log('Not VK environment, starting game directly');
    initGame();
  }

  function initGame() {
    if (!window.Phaser) {
      console.error('Phaser не найден. Проверь /lib/phaser.min.js');
      return;
    }

    const DPR = Math.min(2, window.devicePixelRatio || 1);

    const config = {
      type: Phaser.AUTO,
      parent: 'game',
      backgroundColor: '#000000',
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: 720,
        height: 1080
      },
      resolution: DPR,
      render: { antialias: true, pixelArt: false },
      scene: [ window.PreloadScene, window.MenuScene, window.GameScene ]
    };

    // Ожидание загрузки шрифтов
    const start = () => {
      window.game = new Phaser.Game(config);
      console.log('Game started successfully');
    };
    
    if (document.fonts && document.fonts.ready) {
      Promise.race([
        document.fonts.ready, 
        new Promise(r => setTimeout(r, 1000))
      ]).finally(start);
    } else {
      start();
    }
  }
})();
