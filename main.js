//---main.js - ФИНАЛЬНАЯ ВЕРСИЯ С ПОЛНОЙ VK ИНТЕГРАЦИЕЙ

(function() {
  'use strict';
  
  // Глобальные переменные для VK
  window.VK_USER_DATA = null;
  window.VK_LAUNCH_PARAMS = null;
  window.VK_BRIDGE_READY = false;
  window.VK_DEBUG = window.location.search.includes('debug=1') || 
                   window.location.hostname === 'localhost';
  
  // Отладочные функции
  function debugLog(message, data = null) {
    if (window.VK_DEBUG) {
      console.log(`[VK Debug] ${message}`, data || '');
    }
  }
  
  function showDebugInfo(info) {
    if (!window.VK_DEBUG) return;
    
    const debugPanel = document.createElement('div');
    debugPanel.id = 'vk-debug-panel';
    debugPanel.style.cssText = `
      position: fixed; top: 10px; right: 10px; 
      background: rgba(0,0,0,0.8); color: white; 
      padding: 10px; border-radius: 5px; 
      font-family: monospace; font-size: 12px;
      max-width: 300px; z-index: 10000;
      border: 1px solid #333;
    `;
    debugPanel.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 5px;">VK Debug Info:</div>
      <div>Environment: ${info.isVK ? 'VK Mini App' : 'Standalone'}</div>
      <div>User ID: ${info.userId || 'N/A'}</div>
      <div>Platform: ${info.platform || 'N/A'}</div>
      <div>Bridge: ${info.bridgeAvailable ? 'Available' : 'Not available'}</div>
      <div>UserData: ${info.userDataLoaded ? 'Loaded' : 'Not loaded'}</div>
      <div style="margin-top: 5px; font-size: 10px; opacity: 0.7;">
        Auto-close in 10s
      </div>
    `;
    
    // Удаляем старую панель если есть
    const existing = document.getElementById('vk-debug-panel');
    if (existing) existing.remove();
    
    document.body.appendChild(debugPanel);
    
    // Убираем через 10 секунд
    setTimeout(() => {
      if (debugPanel.parentNode) {
        debugPanel.remove();
      }
    }, 10000);
  }

  // Определяем VK окружение
  const urlParams = new URLSearchParams(window.location.search);
  const isVKEnvironment = /vk_(app_id|user_id|platform)/i.test(window.location.search) || 
                         window.location.hostname.includes('vk-apps.com') ||
                         window.location.hostname.includes('vk.com') ||
                         window.parent !== window;
  
  debugLog('Environment detection', { 
    isVK: isVKEnvironment,
    search: window.location.search,
    hostname: window.location.hostname,
    inIframe: window.parent !== window
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

  // Парсинг VK параметров с валидацией
  function parseVKParams() {
    const params = {};
    const search = window.location.search;
    
    const vkParams = [
      'vk_user_id', 'vk_app_id', 'vk_is_app_user', 'vk_are_notifications_enabled',
      'vk_language', 'vk_ref', 'vk_access_token_settings', 'vk_group_id',
      'vk_platform', 'vk_ts', 'sign'
    ];
    
    const urlParams = new URLSearchParams(search);
    vkParams.forEach(param => {
      const value = urlParams.get(param);
      if (value !== null) {
        // Валидация значений
        if (param === 'vk_user_id' || param === 'vk_app_id') {
          if (!/^\d+$/.test(value)) {
            console.warn(`Invalid ${param}: ${value}`);
            return;
          }
        }
        params[param] = value;
      }
    });
    
    debugLog('Parsed VK params', params);
    return params;
  }

  // Инициализация VK Bridge
  async function initVKBridge() {
    debugLog('Initializing VK Bridge...');
    
    try {
      // Проверяем доступность методов
      if (!window.VKSafe.supports('VKWebAppInit')) {
        throw new Error('VKWebAppInit not supported');
      }
      
      // Инициализация Bridge
      await window.VKSafe.send('VKWebAppInit');
      debugLog('VK Bridge initialized successfully');
      window.VK_BRIDGE_READY = true;
      
      // Парсим launch параметры с валидацией
      const vkParams = parseVKParams();
      
      // Проверяем обязательные параметры
      if (!vkParams.vk_user_id || !vkParams.vk_app_id) {
        console.warn('Missing required VK parameters');
      }
      
      window.VK_LAUNCH_PARAMS = {
        user_id: vkParams.vk_user_id,
        app_id: vkParams.vk_app_id,
        platform: vkParams.vk_platform || 'web',
        is_app_user: vkParams.vk_is_app_user === '1',
        language: vkParams.vk_language || 'ru',
        are_notifications_enabled: vkParams.vk_are_notifications_enabled === '1',
        group_id: vkParams.vk_group_id,
        ref: vkParams.vk_ref,
        sign: vkParams.sign,
        ts: vkParams.vk_ts
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
    const operations = [];
    
    // Настройка статус-бара и навигации
    if (window.VKSafe.supports('VKWebAppSetViewSettings')) {
      operations.push({
        name: 'SetViewSettings',
        call: () => window.VKSafe.send('VKWebAppSetViewSettings', {
          status_bar_style: 'light',
          action_bar_color: '#1d2330',
          navigation_bar_color: '#1d2330'
        })
      });
    }
    
    // Отключение свайпа назад
    if (window.VKSafe.supports('VKWebAppDisableSwipeBack')) {
      operations.push({
        name: 'DisableSwipeBack',
        call: () => window.VKSafe.send('VKWebAppDisableSwipeBack')
      });
    }
    
    // Разрешение уведомлений (опционально)
    if (window.VKSafe.supports('VKWebAppAllowNotifications')) {
      operations.push({
        name: 'AllowNotifications',
        call: () => window.VKSafe.send('VKWebAppAllowNotifications')
      });
    }
    
    // Выполняем все операции
    const results = await Promise.allSettled(
      operations.map(op => op.call().catch(error => {
        debugLog(`${op.name} failed`, error.message);
        return { error: error.message };
      }))
    );
    
    debugLog('VK Interface setup results', results);
  }

  // Загрузка данных пользователя
  async function loadUserData() {
    if (!window.VKSafe.supports('VKWebAppGetUserInfo')) {
      debugLog('VKWebAppGetUserInfo not supported');
      return null;
    }
    
    try {
      // Таймаут для запроса пользователя
      const userDataPromise = window.VKSafe.send('VKWebAppGetUserInfo');
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('User data request timeout')), 5000)
      );
      
      const userData = await Promise.race([userDataPromise, timeoutPromise]);
      window.VK_USER_DATA = userData;
      debugLog('User data loaded', userData);
      
      // Кешируем данные пользователя
      try {
        localStorage.setItem('vk_user_cache', JSON.stringify({
          ...userData,
          cached_at: Date.now()
        }));
      } catch (e) {
        console.warn('Failed to cache user data:', e);
      }
      
      return userData;
    } catch (error) {
      console.warn('Failed to load user data:', error);
      
      // Пытаемся загрузить из кеша
      try {
        const cached = localStorage.getItem('vk_user_cache');
        if (cached) {
          const data = JSON.parse(cached);
          // Используем кеш только если он не старше 24 часов
          if (Date.now() - data.cached_at < 24 * 60 * 60 * 1000) {
            window.VK_USER_DATA = data;
            debugLog('Using cached user data');
            return data;
          }
        }
      } catch (e) {
        console.warn('Failed to load cached user data:', e);
      }
      
      return null;
    }
  }

  // Подписка на события VK
  function subscribeToVKEvents() {
    if (!window.vkBridge || !window.vkBridge.subscribe) {
      debugLog('VK Bridge subscribe not available');
      return;
    }
    
    window.vkBridge.subscribe((e) => {
      const eventType = e.detail?.type;
      const eventData = e.detail?.data;
      
      debugLog(`VK Event: ${eventType}`, eventData);
      
      switch (eventType) {
        case 'VKWebAppViewHide':
          handleAppHide();
          break;
          
        case 'VKWebAppViewRestore':
          handleAppRestore();
          break;
          
        case 'VKWebAppUpdateConfig':
          handleConfigUpdate(eventData);
          break;
          
        case 'VKWebAppGetUserInfoResult':
          if (eventData && !eventData.error) {
            window.VK_USER_DATA = eventData;
            debugLog('User data updated from event', eventData);
          }
          break;
          
        case 'VKWebAppStorageGetResult':
        case 'VKWebAppStorageSetResult':
          debugLog('Storage operation completed', eventData);
          break;
          
        case 'VKWebAppShareResult':
          debugLog('Share completed', eventData);
          break;
          
        default:
          debugLog(`Unhandled VK event: ${eventType}`, eventData);
      }
    });
    
    debugLog('VK Events subscription initialized');
  }

  // Обработчики событий приложения
  function handleAppHide() {
    debugLog('App hidden - pausing game');
    
    if (window.game?.scene) {
      const activeScene = window.game.scene.getActiveScene();
      if (activeScene && activeScene.scene.key === 'GameScene') {
        activeScene.canClick = false;
        
        // Сохраняем состояние игры
        if (activeScene.gameMetrics && activeScene.gameMetrics.startTime) {
          activeScene.pausedAt = Date.now();
          debugLog('Game paused and saved');
        }
      }
    }
  }

  function handleAppRestore() {
    debugLog('App restored - resuming game');
    
    if (window.game?.scene) {
      const activeScene = window.game.scene.getActiveScene();
      if (activeScene && activeScene.scene.key === 'GameScene') {
        
        // Восстанавливаем состояние игры с задержкой
        setTimeout(() => {
          if (activeScene.pausedAt && activeScene.gameMetrics) {
            // Корректируем время игры, исключая время паузы
            const pauseDuration = Date.now() - activeScene.pausedAt;
            activeScene.gameMetrics.startTime += pauseDuration;
            activeScene.pausedAt = null;
          }
          
          activeScene.canClick = true;
          debugLog('Game resumed');
        }, 300);
      }
    }
  }

  function handleConfigUpdate(config) {
    debugLog('VK Config updated', config);
    
    // Можно адаптировать тему игры под схему VK
    if (config && config.scheme) {
      document.body.setAttribute('data-vk-scheme', config.scheme);
    }
  }

  // Загрузка VK Bridge с повторными попытками
  function loadVKBridge(retries = 3) {
    return new Promise((resolve, reject) => {
      if (window.vkBridge) {
        debugLog('VK Bridge already loaded');
        resolve();
        return;
      }
      
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/@vkontakte/vk-bridge/dist/browser.min.js';
      
      const timeout = setTimeout(() => {
        script.remove();
        if (retries > 0) {
          debugLog(`VK Bridge load timeout, retrying... (${retries} attempts left)`);
          loadVKBridge(retries - 1).then(resolve).catch(reject);
        } else {
          reject(new Error('VK Bridge load timeout'));
        }
      }, 10000);
      
      script.onload = () => {
        clearTimeout(timeout);
        debugLog('VK Bridge script loaded');
        
        // Ждем пока vkBridge станет доступен
        const checkBridge = (attempts = 50) => {
          if (window.vkBridge) {
            debugLog('VK Bridge available');
            resolve();
          } else if (attempts > 0) {
            setTimeout(() => checkBridge(attempts - 1), 100);
          } else {
            reject(new Error('VK Bridge not available after loading'));
          }
        };
        
        checkBridge();
      };
      
      script.onerror = () => {
        clearTimeout(timeout);
        script.remove();
        if (retries > 0) {
          debugLog(`VK Bridge load error, retrying... (${retries} attempts left)`);
          setTimeout(() => {
            loadVKBridge(retries - 1).then(resolve).catch(reject);
          }, 1000);
        } else {
          reject(new Error('Failed to load VK Bridge script'));
        }
      };
      
      document.head.appendChild(script);
    });
  }

  // Инициализация игры
  function initGame() {
    debugLog('Initializing game...');
    
    if (!window.Phaser) {
      console.error('Phaser not found. Check library connection.');
      return;
    }

    if (!window.ALL_CARD_KEYS || !window.LEVELS) {
      console.error('Game data not loaded');
      return;
    }

    if (!window.PreloadScene || !window.MenuScene || !window.GameScene) {
      console.error('Game scenes not loaded');
      return;
    }

    // Определяем размеры для разных устройств
    const isMobile = window.innerWidth < window.innerHeight;
    const gameWidth = 1080;
    const gameHeight = 720;
    
    const DPR = Math.min(2, window.devicePixelRatio || 1);
    const gameConfig = {
      type: Phaser.AUTO,
      parent: 'game',
      backgroundColor: '#1d2330',
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: gameWidth,
        height: gameHeight
      },
      resolution: DPR,
      render: { 
        antialias: true, 
        pixelArt: false,
        powerPreference: 'high-performance'
      },
      scene: [
        window.PreloadScene,
        window.MenuScene,
        window.GameScene
      ],
      fps: {
        target: 60,
        forceSetTimeOut: true
      },
      callbacks: {
        preBoot: function(game) {
          debugLog('Game pre-boot started');
        },
        
        postBoot: function(game) {
          debugLog('Game booted', {
            renderer: game.renderer.type === 0 ? 'Canvas' : 'WebGL',
            resolution: DPR,
            size: `${game.scale.width}x${game.scale.height}`,
            deviceRatio: window.devicePixelRatio
          });
          
          // Передаем VK данные в игру
          game.registry.set('vkUserData', window.VK_USER_DATA);
          game.registry.set('vkLaunchParams', window.VK_LAUNCH_PARAMS);
          game.registry.set('isVKEnvironment', isVKEnvironment);
          game.registry.set('vkBridgeAvailable', window.VKSafe.isAvailable());
          
          // Глобальные обработчики ошибок
          game.events.on('error', (error) => {
            console.error('Game error:', error);
            debugLog('Game error details', error);
          });
        }
      }
    };

    // Создаем игру с обработкой ошибок
    try {
      window.game = new Phaser.Game(gameConfig);
      
      // Показываем отладочную информацию
      if (window.VK_DEBUG) {
        setTimeout(() => {
          showDebugInfo({
            isVK: isVKEnvironment,
            userId: window.VK_LAUNCH_PARAMS?.user_id,
            platform: window.VK_LAUNCH_PARAMS?.platform,
            bridgeAvailable: window.VKSafe.isAvailable(),
            userDataLoaded: !!window.VK_USER_DATA
          });
        }, 1000);
      }
      
      debugLog('Game created successfully');
      
    } catch (error) {
      console.error('Error creating game:', error);
      
      // Показываем пользователю ошибку
      const gameDiv = document.getElementById('game');
      if (gameDiv) {
        gameDiv.innerHTML = `
          <div style="
            display: flex; 
            flex-direction: column; 
            justify-content: center; 
            align-items: center; 
            height: 100vh; 
            background: #1d2330; 
            color: #fff; 
            font-family: Arial, sans-serif;
            text-align: center;
            padding: 20px;
          ">
            <h2>Error loading game</h2>
            <p>Try refreshing the page</p>
            <button onclick="location.reload()" style="
              padding: 12px 24px; 
              font-size: 16px; 
              background: #3498db; 
              color: white; 
              border: none; 
              border-radius: 8px; 
              cursor: pointer;
              margin-top: 20px;
            ">Refresh</button>
          </div>
        `;
      }
    }
  }

  // Публичные методы для использования в игре
  window.VKHelpers = {
    // Поделиться результатом
    shareResult: function(score, level) {
      if (!window.VK_BRIDGE_READY) return Promise.reject('VK Bridge not ready');

      return window.VKSafe.send('VKWebAppShare', {
        link: window.location.href + `?shared_score=${score}&level=${level}`
      });
    },

    // Показать рекламу
    showAd: function() {
      if (!window.VK_BRIDGE_READY) return Promise.reject('VK Bridge not ready');

      return window.VKSafe.send('VKWebAppShowNativeAds', {
        ad_format: 'interstitial'
      });
    },

    // Сохранить данные в облако VK
    setStorageData: function(key, value) {
      if (!window.VK_BRIDGE_READY) return Promise.reject('VK Bridge not ready');

      return window.VKSafe.send('VKWebAppStorageSet', {
        key: key,
        value: JSON.stringify(value)
      });
    },

    // Получить данные из облака VK
    getStorageData: function(keys) {
      if (!window.VK_BRIDGE_READY) return Promise.reject('VK Bridge not ready');

      return window.VKSafe.send('VKWebAppStorageGet', {
        keys: Array.isArray(keys) ? keys : [keys]
      });
    },

    // Проверка доступности функций
    isSupported: function(method) {
      return window.VKSafe.supports(method);
    }
  };

  // Главная функция запуска
  async function main() {
    debugLog('Starting application', { 
      isVK: isVKEnvironment,
      debug: window.VK_DEBUG,
      userAgent: navigator.userAgent
    });

    if (isVKEnvironment) {
      try {
        // Загружаем VK Bridge
        await loadVKBridge();
        debugLog('VK Bridge loaded successfully');
        
        // Инициализируем VK
        const vkInitialized = await initVKBridge();
        
        if (!vkInitialized) {
          console.warn('VK initialization failed, starting in standalone mode');
        }
        
      } catch (error) {
        console.error('VK setup failed:', error);
        debugLog('VK setup failed, falling back to standalone');
      }
    } else {
      debugLog('Not VK environment, starting directly');
    }

    // Запускаем игру после небольшой задержки
    setTimeout(() => {
      initGame();
    }, 100);
  }

  // Глобальные обработчики
  window.addEventListener('beforeunload', () => {
    debugLog('Page unloading, cleaning up game...');
    
    if (window.game) {
      // Останавливаем все сцены
      window.game.scene.scenes.forEach(scene => {
        if (scene.events) {
          scene.events.emit('shutdown');
        }
      });
      
      // Уничтожаем игру
      window.game.destroy(true);
      window.game = null;
    }
  });

  // Обработка потери фокуса страницы
  document.addEventListener('visibilitychange', () => {
    if (window.game && document.hidden) {
      debugLog('Page hidden, pausing game...');
      
      // Пауза активной сцены
      const activeScene = window.game.scene.getActiveScene();
      if (activeScene && activeScene.scene.key === 'GameScene') {
        activeScene.canClick = false;
        debugLog('Game input disabled due to page visibility change');
      }
    } else if (window.game && !document.hidden) {
      debugLog('Page visible, resuming game...');
      
      const activeScene = window.game.scene.getActiveScene();
      if (activeScene && activeScene.scene.key === 'GameScene') {
        // Небольшая задержка перед возобновлением
        setTimeout(() => {
          if (activeScene.gameMetrics && activeScene.gameMetrics.startTime) {
            activeScene.canClick = true;
            debugLog('Game input re-enabled');
          }
        }, 500);
      }
    }
  });

  // Запуск после загрузки DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main);
  } else {
    main();
  }

  // Отладочные утилиты (только в dev режиме)
  if (window.VK_DEBUG) {
    window.VKUtils = {
      async testVKMethod(method, params = {}) {
        if (!window.VKSafe.isAvailable()) {
          console.error('VK Bridge not available');
          return null;
        }
        
        try {
          const result = await window.VKSafe.send(method, params);
          console.log(`${method} success:`, result);
          return result;
        } catch (error) {
          console.error(`${method} failed:`, error);
          return null;
        }
      },

      async getUserInfo() {
        return await this.testVKMethod('VKWebAppGetUserInfo');
      },

      async testStorage() {
        const testData = { 
          test: 'value', 
          timestamp: Date.now(),
          random: Math.random()
        };
        
        console.log('Testing VK Storage...');
        
        const saveResult = await this.testVKMethod('VKWebAppStorageSet', {
          key: 'test_key',
          value: JSON.stringify(testData)
        });
        
        if (!saveResult) return;
        
        const loadResult = await this.testVKMethod('VKWebAppStorageGet', {
          keys: ['test_key']
        });
        
        if (loadResult && loadResult.keys && loadResult.keys[0]) {
          const loaded = JSON.parse(loadResult.keys[0].value);
          console.log('Storage test successful:', loaded);
          return loaded;
        }
        
        console.error('Storage test failed');
        return null;
      },

      showVKData() {
        console.group('VK Data');
        console.log('Launch Params:', window.VK_LAUNCH_PARAMS);
        console.log('User Data:', window.VK_USER_DATA);
        console.log('Bridge Available:', window.VKSafe.isAvailable());
        console.log('Environment:', isVKEnvironment);
        console.log('Debug Mode:', window.VK_DEBUG);
        console.groupEnd();
      }
    };

    console.log('VK Debug utilities loaded:');
    console.log('VKUtils.testVKMethod(method, params) - test VK methods');
    console.log('VKUtils.getUserInfo() - get user data');
    console.log('VKUtils.testStorage() - test storage');
    console.log('VKUtils.showVKData() - show VK data');
  }

})();
