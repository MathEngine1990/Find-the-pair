//---main.js - ПОЛНАЯ VK ИНТЕГРАЦИЯ С ОТЛАДКОЙ

(function() {
  'use strict';
  
  // Глобальные переменные для VK
  window.VK_USER_DATA = null;
  window.VK_LAUNCH_PARAMS = null;
  window.VK_DEBUG = window.location.search.includes('debug=1');
  
  // Отладочные функции
  function debugLog(message, data = null) {
    if (window.VK_DEBUG) {
      console.log(`🔍 [VK Debug] ${message}`, data || '');
    }
  }
  
  function showDebugInfo(info) {
    if (!window.VK_DEBUG) return;
    
    const debugPanel = document.createElement('div');
    debugPanel.style.cssText = `
      position: fixed; top: 10px; right: 10px; 
      background: rgba(0,0,0,0.8); color: white; 
      padding: 10px; border-radius: 5px; 
      font-family: monospace; font-size: 12px;
      max-width: 300px; z-index: 10000;
    `;
    debugPanel.innerHTML = `
      <div><strong>VK Debug Info:</strong></div>
      <div>Environment: ${info.isVK ? 'VK Mini App' : 'Standalone'}</div>
      <div>User ID: ${info.userId || 'N/A'}</div>
      <div>Platform: ${info.platform || 'N/A'}</div>
      <div>Bridge: ${info.bridgeAvailable ? '✅' : '❌'}</div>
      <div>UserData: ${info.userDataLoaded ? '✅' : '❌'}</div>
    `;
    document.body.appendChild(debugPanel);
    
    // Убираем через 10 секунд
    setTimeout(() => debugPanel.remove(), 10000);
  }

  // Определяем VK окружение
  const urlParams = new URLSearchParams(window.location.search);
  const isVKEnvironment = /vk_(app_id|user_id|platform)/i.test(window.location.search) || 
                         window.location.hostname.includes('vk.com');
  
  debugLog('Environment detection', { 
    isVK: isVKEnvironment,
    search: window.location.search,
    hostname: window.location.hostname
  });

  // Безопасная обертка для VK Bridge
  window.VKSafe = {
    async send(method, params = {}) {
      if (!window.vkBridge) {
        throw new Error('VK Bridge not available');
      }
      
      debugLog(`VK Bridge call: ${method}`, params);
      
      try {
        const result = await window.vkBridge.send(method, params);
        debugLog(`VK Bridge response: ${method}`, result);
        return result;
      } catch (error) {
        console.warn(`VK Bridge error for ${method}:`, error);
        throw error;
      }
    },
    
    isAvailable() {
      return !!(window.vkBridge && window.vkBridge.send);
    },
    
    supports(method) {
      return window.vkBridge && window.vkBridge.supports && window.vkBridge.supports(method);
    }
  };

  // Парсинг VK параметров
  function parseVKParams() {
    const params = {};
    const search = window.location.search;
    
    // Основные VK параметры
    const vkParams = [
      'vk_user_id', 'vk_app_id', 'vk_is_app_user', 'vk_are_notifications_enabled',
      'vk_language', 'vk_ref', 'vk_access_token_settings', 'vk_group_id',
      'vk_platform', 'vk_ts', 'sign'
    ];
    
    const urlParams = new URLSearchParams(search);
    vkParams.forEach(param => {
      const value = urlParams.get(param);
      if (value !== null) {
        params[param] = value;
      }
    });
    
    return params;
  }

  // Инициализация VK Bridge
  async function initVKBridge() {
    debugLog('Initializing VK Bridge...');
    
    try {
      // Инициализация Bridge
      if (window.VKSafe.supports('VKWebAppInit')) {
        await window.VKSafe.send('VKWebAppInit');
        debugLog('VK Bridge initialized successfully');
      } else {
        throw new Error('VKWebAppInit not supported');
      }
      
      // Парсим launch параметры
      const vkParams = parseVKParams();
      window.VK_LAUNCH_PARAMS = {
        user_id: vkParams.vk_user_id,
        app_id: vkParams.vk_app_id,
        platform: vkParams.vk_platform || 'web',
        is_app_user: vkParams.vk_is_app_user === '1',
        language: vkParams.vk_language || 'ru',
        are_notifications_enabled: vkParams.vk_are_notifications_enabled === '1',
        group_id: vkParams.vk_group_id,
        sign: vkParams.sign
      };
      
      debugLog('VK Launch params parsed', window.VK_LAUNCH_PARAMS);
      
      // Настройка интерфейса
      await setupVKInterface();
      
      // Получение данных пользователя
      await loadUserData();
      
      // Подписка на события
      subscribeToVKEvents();
      
      return true;
      
    } catch (error) {
      console.error('VK Bridge initialization failed:', error);
      return false;
    }
  }

  // Настройка интерфейса VK
  async function setupVKInterface() {
    const promises = [];
    
    // Настройка статус-бара и навигации
    if (window.VKSafe.supports('VKWebAppSetViewSettings')) {
      promises.push(
        window.VKSafe.send('VKWebAppSetViewSettings', {
          status_bar_style: 'light',
          action_bar_color: '#1d2330',
          navigation_bar_color: '#1d2330'
        }).catch(e => debugLog('SetViewSettings failed', e))
      );
    }
    
    // Отключение свайпа назад
    if (window.VKSafe.supports('VKWebAppDisableSwipeBack')) {
      promises.push(
        window.VKSafe.send('VKWebAppDisableSwipeBack')
          .catch(e => debugLog('DisableSwipeBack failed', e))
      );
    }
    
    // Разрешение уведомлений (опционально)
    if (window.VKSafe.supports('VKWebAppAllowNotifications')) {
      promises.push(
        window.VKSafe.send('VKWebAppAllowNotifications')
          .catch(e => debugLog('AllowNotifications declined', e))
      );
    }
    
    await Promise.allSettled(promises);
    debugLog('VK Interface setup completed');
  }

  // Загрузка данных пользователя
  async function loadUserData() {
    try {
      if (window.VKSafe.supports('VKWebAppGetUserInfo')) {
        const userData = await window.VKSafe.send('VKWebAppGetUserInfo');
        window.VK_USER_DATA = userData;
        debugLog('User data loaded', userData);
        return userData;
      }
    } catch (error) {
      console.warn('Failed to load user data:', error);
    }
    return null;
  }

  // Подписка на события VK
  function subscribeToVKEvents() {
    if (!window.vkBridge) return;
    
    window.vkBridge.subscribe((e) => {
      const eventType = e.detail?.type;
      debugLog(`VK Event: ${eventType}`, e.detail?.data);
      
      switch (eventType) {
        case 'VKWebAppViewHide':
          handleAppHide();
          break;
          
        case 'VKWebAppViewRestore':
          handleAppRestore();
          break;
          
        case 'VKWebAppUpdateConfig':
          handleConfigUpdate(e.detail.data);
          break;
          
        case 'VKWebAppGetUserInfoResult':
          window.VK_USER_DATA = e.detail.data;
          break;
          
        case 'VKWebAppStorageGetResult':
        case 'VKWebAppStorageSetResult':
          debugLog('Storage operation completed', e.detail.data);
          break;
      }
    });
  }

  // Обработчики событий приложения
  function handleAppHide() {
    debugLog('App hidden - pausing game');
    if (window.game && window.game.scene) {
      const gameScene = window.game.scene.getScene('GameScene');
      if (gameScene && gameScene.gameState && gameScene.gameState.gameStarted) {
        gameScene.time.paused = true;
        debugLog('Game paused');
      }
    }
  }

  function handleAppRestore() {
    debugLog('App restored - resuming game');
    if (window.game && window.game.scene) {
      const gameScene = window.game.scene.getScene('GameScene');
      if (gameScene && gameScene.time) {
        gameScene.time.paused = false;
        debugLog('Game resumed');
      }
    }
  }

  function handleConfigUpdate(config) {
    debugLog('VK Config updated', config);
    
    // Можно обновить тему игры на основе VK темы
    if (config.scheme) {
      updateGameTheme(config.scheme);
    }
  }

  function updateGameTheme(scheme) {
    // Обновление темы игры (light/dark) на основе настроек VK
    debugLog('Updating game theme', scheme);
    
    if (window.THEME) {
      if (scheme === 'bright_light') {
        window.THEME.isDark = false;
        // Обновить цвета для светлой темы
      } else {
        window.THEME.isDark = true;
        // Обновить цвета для темной темы
      }
    }
  }

  // Инициализация игры
  function initGame() {
    debugLog('Initializing game...');
    
    if (!window.Phaser) {
      console.error('❌ Phaser не найден. Проверьте подключение библиотеки.');
      return;
    }

    // Конфигурация игры
    const DPR = Math.min(2, window.devicePixelRatio || 1);
    const gameConfig = {
      type: Phaser.AUTO,
      parent: 'game',
      backgroundColor: '#1d2330',
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: 1080,
        height: 720
      },
      resolution: DPR,
      render: { 
        antialias: true, 
        pixelArt: false 
      },
      scene: [
        window.PreloadScene,
        window.MenuScene,
        window.GameScene
      ],
      // VK специфичные настройки
      callbacks: {
        postBoot: function(game) {
          debugLog('Game booted', {
            renderer: game.renderer.type === 0 ? 'Canvas' : 'WebGL',
            resolution: DPR,
            size: `${game.scale.width}x${game.scale.height}`
          });
          
          // Передаем VK данные в игру
          game.vkUserData = window.VK_USER_DATA;
          game.vkLaunchParams = window.VK_LAUNCH_PARAMS;
          game.isVKEnvironment = isVKEnvironment;
        }
      }
    };

    // Создаем игру
    try {
      window.game = new Phaser.Game(gameConfig);
      
      // Показываем отладочную информацию
      if (window.VK_DEBUG) {
        showDebugInfo({
          isVK: isVKEnvironment,
          userId: window.VK_LAUNCH_PARAMS?.user_id,
          platform: window.VK_LAUNCH_PARAMS?.platform,
          bridgeAvailable: window.VKSafe.isAvailable(),
          userDataLoaded: !!window.VK_USER_DATA
        });
      }
      
      debugLog('Game created successfully');
      
    } catch (error) {
      console.error('❌ Ошибка создания игры:', error);
    }
  }

  // Загрузка VK Bridge
  function loadVKBridge() {
    return new Promise((resolve, reject) => {
      if (window.vkBridge) {
        resolve();
        return;
      }
      
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/@vkontakte/vk-bridge/dist/browser.min.js';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load VK Bridge'));
      document.head.appendChild(script);
    });
  }

  // Главная функция запуска
  async function main() {
    debugLog('Starting application', { 
      isVK: isVKEnvironment,
      debug: window.VK_DEBUG 
    });

    if (isVKEnvironment) {
      try {
        // Загружаем VK Bridge
        await loadVKBridge();
        debugLog('VK Bridge loaded');
        
        // Инициализируем VK
        const vkInitialized = await initVKBridge();
        
        if (!vkInitialized) {
          console.warn('⚠️ VK initialization failed, starting in standalone mode');
        }
        
      } catch (error) {
        console.error('❌ VK setup failed:', error);
        debugLog('VK setup failed, falling back to standalone');
      }
    } else {
      debugLog('Not VK environment, starting directly');
    }

    // Запускаем игру
    initGame();
  }

  // Запуск после загрузки DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main);
  } else {
    main();
  }

  // Глобальные утилиты для VK (доступны в консоли для отладки)
  if (window.VK_DEBUG) {
    window.VKUtils = {
      // Тестирование VK методов
      async testVKMethod(method, params = {}) {
        try {
          const result = await window.VKSafe.send(method, params);
          console.log(`✅ ${method} success:`, result);
          return result;
        } catch (error) {
          console.error(`❌ ${method} failed:`, error);
          return null;
        }
      },

      // Получение информации о пользователе
      async getUserInfo() {
        return await this.testVKMethod('VKWebAppGetUserInfo');
      },

      // Тестирование хранилища
      async testStorage() {
        const testData = { test: 'value', timestamp: Date.now() };
        
        // Сохранение
        await this.testVKMethod('VKWebAppStorageSet', {
          key: 'test_key',
          value: JSON.stringify(testData)
        });
        
        // Загрузка
        const result = await this.testVKMethod('VKWebAppStorageGet', {
          keys: ['test_key']
        });
        
        if (result && result.keys && result.keys[0]) {
          const loaded = JSON.parse(result.keys[0].value);
          console.log('Storage test successful:', loaded);
        }
      },

      // Показ уведомления
      async showNotification(message) {
        return await this.testVKMethod('VKWebAppTapticNotificationOccurred', {
          type: 'success'
        });
      },

      // Принудительная синхронизация достижений
      async syncAchievements() {
        if (window.VKAchievementManager) {
          await window.VKAchievementManager.saveAchievements();
          console.log('✅ Achievements synced');
        }
      },

      // Показать все VK данные
      showVKData() {
        console.group('🎮 VK Data');
        console.log('Launch Params:', window.VK_LAUNCH_PARAMS);
        console.log('User Data:', window.VK_USER_DATA);
        console.log('Bridge Available:', window.VKSafe.isAvailable());
        console.log('Environment:', isVKEnvironment);
        console.groupEnd();
      }
    };

    console.log('🔍 VK Debug utilities available:');
    console.log('VKUtils.testVKMethod(method, params) - тест VK методов');
    console.log('VKUtils.getUserInfo() - данные пользователя');
    console.log('VKUtils.testStorage() - тест хранилища');
    console.log('VKUtils.showVKData() - показать VK данные');
    console.log('VKUtils.syncAchievements() - синхронизировать достижения');
  }

})();  //