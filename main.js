//---main.js - ПОЛНАЯ VK ИНТЕГРАЦИЯ

(function () {
  // Определяем запуск во ВК
  const isVK = /(^|[?&])vk_(app_id|user_id|ts|aref|ref|platform)=/i.test(location.search);
  
  // Глобальные переменные для VK данных
  window.VK_USER_DATA = null;
  window.VK_LAUNCH_PARAMS = null;

  if (isVK) {
    console.log('🎮 VK Mini App detected, initializing VK Bridge...');
    
    const s = document.createElement('script');
    s.src = 'https://unpkg.com/@vkontakte/vk-bridge/dist/browser.min.js';
    s.onload = () => {
      try {
        if (window.vkBridge?.supports?.('VKWebAppInit')) {
          // 1. ИНИЦИАЛИЗАЦИЯ VK BRIDGE
          vkBridge.send('VKWebAppInit').then(() => {
            console.log('✅ VK Bridge initialized successfully');
            
            // 2. ПАРСИНГ LAUNCH ПАРАМЕТРОВ
            const params = new URLSearchParams(location.search);
            window.VK_LAUNCH_PARAMS = {
              user_id: params.get('vk_user_id'),
              app_id: params.get('vk_app_id'),
              platform: params.get('vk_platform') || 'web',
              is_app_user: params.get('vk_is_app_user') === '1',
              language: params.get('vk_language') || 'ru',
              sign: params.get('sign') // для валидации
            };
            
            console.log('📋 VK Launch params:', window.VK_LAUNCH_PARAMS);
            
            // 3. НАСТРОЙКА ВНЕШНЕГО ВИДА
            vkBridge.send('VKWebAppSetViewSettings', { 
              status_bar_style: 'light', 
              action_bar_color: '#1d2330',
              navigation_bar_color: '#1d2330'
            }).catch(() => {});
            
            // 4. ОТКЛЮЧЕНИЕ СВАЙПА НАЗАД
            vkBridge.send('VKWebAppDisableSwipeBack').catch(() => {});
            
            // 5. ПОЛУЧЕНИЕ ДАННЫХ ПОЛЬЗОВАТЕЛЯ
            vkBridge.send('VKWebAppGetUserInfo').then((userData) => {
              window.VK_USER_DATA = userData;
              console.log('👤 User data received:', userData);
              initGame();
            }).catch((error) => {
              console.warn('⚠️ Cannot get user info:', error);
              initGame(); // Запускаем без данных пользователя
            });
            
          }).catch((error) => {
            console.error('❌ VK Bridge init failed:', error);
            initGame();
          });
          
          // 6. ПОДПИСКА НА СОБЫТИЯ VK BRIDGE
          vkBridge.subscribe((e) => {
            console.log('📡 VK Bridge event:', e.detail?.type);
            
            switch (e.detail?.type) {
              case 'VKWebAppViewHide':
                // Пауза игры при сворачивании
                if (window.game?.scene?.isPaused !== undefined) {
                  window.game.scene.pause('GameScene');
                  console.log('⏸️ Game paused (app hidden)');
                }
                break;
                
              case 'VKWebAppViewRestore':
                // Восстановление игры
                if (window.game?.scene?.isPaused !== undefined) {
                  window.game.scene.resume('GameScene');
                  console.log('▶️ Game resumed (app restored)');
                }
                break;
                
              case 'VKWebAppUpdateConfig':
                // Обновление темы приложения
                console.log('🎨 VK theme updated:', e.detail?.data);
                break;
            }
          });
          
        } else {
          console.warn('⚠️ VK Bridge not supported');
          initGame();
        }
      } catch(e) {
        console.error('❌ VK Bridge setup failed:', e);
        initGame();
      }
    };
    
    s.onerror = () => {
  console.warn('⚠️ VK Bridge недоступен, запуск в standalone режиме');
  window.VK_LAUNCH_PARAMS = null;
  initGame();
};
    
    document.head.appendChild(s);
  } else {
    // Не ВК - запускаем сразу
    console.log('🖥️ Not VK environment, starting game directly');
    initGame();
  }

  // ФУНКЦИЯ ИНИЦИАЛИЗАЦИИ ИГРЫ
  function initGame() {
    if (!window.Phaser) {
      console.error('❌ Phaser не найден. Проверьте /lib/phaser.min.js');
      return;
    }

    console.log('🚀 Initializing Phaser game...');

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
    const startPhaser = () => {
      try {
        window.game = new Phaser.Game(config);
        console.log('✅ Phaser game started successfully');
        
        // Добавляем обработчик ошибок для игры
        window.game.events.on('error', (error) => {
          console.error('🎮 Game error:', error);
        });
        
      } catch (error) {
        console.error('❌ Failed to start Phaser game:', error);
      }
    };
    
    if (document.fonts && document.fonts.ready) {
      Promise.race([
        document.fonts.ready, 
        new Promise(resolve => setTimeout(resolve, 1000))
      ]).finally(() => {
        console.log('📝 Fonts loaded, starting game');
        startPhaser();
      });
    } else {
      startPhaser();
    }
  }

  // ФУНКЦИИ ДЛЯ ВЗАИМОДЕЙСТВИЯ С VK
  window.VK_UTILS = {
    // Отправка события достижения
    sendAchievement: function(achievement) {
      if (window.vkBridge && isVK) {
        vkBridge.send('VKWebAppTapticNotificationOccurred', { type: 'success' });
        console.log('🏆 Achievement sent:', achievement);
      }
    },
    
    // Поделиться результатом
    shareResult: function(level, time, errors) {
      if (window.vkBridge && isVK) {
        const message = `Прошел уровень ${level} за ${time}с с ${errors} ошибками в игре "Память: Найди пару"! 🧠🎯`;
        vkBridge.send('VKWebAppShare', { link: location.href });
        console.log('📤 Share result:', message);
      }
    },
    
    // Показать рекламу (для будущей монетизации)
    showAd: function(type = 'interstitial') {
      if (window.vkBridge && isVK) {
        return vkBridge.send('VKWebAppShowNativeAds', { ad_format: type });
      }
      return Promise.reject('No VK Bridge');
    },
    
    // Сохранение в облако VK
    saveToCloud: function(key, data) {
      if (window.vkBridge && isVK) {
        return vkBridge.send('VKWebAppStorageSet', { 
          key: key, 
          value: JSON.stringify(data) 
        });
      }
      // Fallback на localStorage
      localStorage.setItem(key, JSON.stringify(data));
      return Promise.resolve();
    },
    
    // Загрузка из облака VK
    loadFromCloud: function(key) {
      if (window.vkBridge && isVK) {
        return vkBridge.send('VKWebAppStorageGet', { keys: [key] })
          .then(result => {
            const value = result.keys?.[0]?.value;
            return value ? JSON.parse(value) : null;
          });
      }
      // Fallback на localStorage
      const value = localStorage.getItem(key);
      return Promise.resolve(value ? JSON.parse(value) : null);
    }
  };

})();
