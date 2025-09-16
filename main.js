//---main.js - ИСПРАВЛЕНИЕ НОВЫХ ОШИБОК

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
      <div>Game: ${info.gameCreated ? 'Created' : 'Not created'}</div>
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

  // ИСПРАВЛЕНИЕ: Безопасная обертка для VK Bridge с новыми методами
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
    
    // ИСПРАВЛЕНИЕ: Используем новый метод supportsAsync с fallback
    async supports(method) {
      if (!window.vkBridge) return false;
      
      // Пробуем новый метод
      if (window.vkBridge.supportsAsync) {
        try {
          return await window.vkBridge.supportsAsync(method);
        } catch (error) {
          debugLog(`supportsAsync error for ${method}:`, error);
          return false;
        }
      }
      
      // Fallback на старый метод с подавлением warning
      if (window.vkBridge.supports) {
        try {
          return window.vkBridge.supports(method);
        } catch (error) {
          return false;
        }
      }
      
      return false;
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
      // ИСПРАВЛЕНИЕ: Проверяем доступность методов через новый API
      const supportsInit = await window.VKSafe.supports('VKWebAppInit');
      if (!supportsInit) {
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

  // ИСПРАВЛЕНИЕ: Настройка интерфейса VK с обработкой ошибок
  async function setupVKInterface() {
    const operations = [];
    
    // Настройка статус-бара и навигации
    if (await window.VKSafe.supports('VKWebAppSetViewSettings')) {
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
    if (await window.VKSafe.supports('VKWebAppDisableSwipeBack')) {
      operations.push({
        name: 'DisableSwipeBack',
        call: () => window.VKSafe.send('VKWebAppDisableSwipeBack')
      });
    }
    
    // ИСПРАВЛЕНИЕ: Разрешение уведомлений с обработкой ошибок
    if (await window.VKSafe.supports('VKWebAppAllowNotifications')) {
      operations.push({
        name: 'AllowNotifications',
        call: async () => {
          try {
            return await window.VKSafe.send('VKWebAppAllowNotifications');
          } catch (error) {
            // Обрабатываем специфичные ошибки уведомлений
            if (error.error_data?.error_code === 15) {
              debugLog('Notifications: App needs moderation approval');
            } else if (error.error_data?.error_code === 4) {
              debugLog('Notifications: User denied permission');
            } else {
              debugLog('Notifications: Other error', error);
            }
            throw error;
          }
        }
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
    const supportsUserInfo = await window.VKSafe.supports('VKWebAppGetUserInfo');
    if (!supportsUserInfo) {
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

  // ИСПРАВЛЕНИЕ: Безопасные обработчики событий приложения
  function handleAppHide() {
    debugLog('App hidden - pausing game');
    
    if (window.game && window.game.scene && typeof window.game.scene.getActiveScene === 'function') {
      try {
        const activeScene = window.game.scene.getActiveScene();
        if (activeScene && activeScene.scene && activeScene.scene.key === 'GameScene') {
          activeScene.canClick = false;
          
          // Сохраняем состояние игры
          if (activeScene.gameMetrics && activeScene.gameMetrics.startTime) {
            activeScene.pausedAt = Date.now();
            debugLog('Game paused and saved');
          }
        }
      } catch (error) {
        debugLog('Error in handleAppHide:', error);
      }
    } else {
      debugLog('Game not ready for app hide handling');
    }
  }

  function handleAppRestore() {
    debugLog('App restored - resuming game');
    
    if (window.game && window.game.scene && typeof window.game.scene.getActiveScene === 'function') {
      try {
        const activeScene = window.game.scene.getActiveScene();
        if (activeScene && activeScene.scene && activeScene.scene.key === 'GameScene') {
          
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
      } catch (error) {
        debugLog('Error in handleAppRestore:', error);
      }
    } else {
      debugLog('Game not ready for app restore handling');
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

  // КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Функция показа ошибки с возможностью перезапуска
  function showErrorFallback(message, details = '') {
    const gameContainer = document.getElementById('game');
    if (!gameContainer) return;
    
    gameContainer.innerHTML = `
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
        <h2 style="color: #ff6b6b;">😔 ${message}</h2>
        ${details ? `<p style="color: #ccc; font-size: 14px; margin: 10px 0;">${details}</p>` : ''}
        <p style="color: #ccc;">Проверьте подключение к интернету и попробуйте снова</p>
        <button onclick="location.reload()" style="
          padding: 12px 24px; 
          font-size: 16px; 
          background: #3498db; 
          color: white; 
          border: none; 
          border-radius: 8px; 
          cursor: pointer;
          margin-top: 20px;
          font-weight: bold;
        ">🔄 Перезагрузить</button>
        
        ${window.VK_DEBUG ? `
          <details style="margin-top: 20px; color: #888; font-size: 12px;">
            <summary>Техническая информация</summary>
            <pre style="text-align: left; margin-top: 10px;">
  DOM Ready: ${document.readyState}
  Phaser: ${!!window.Phaser}
  Game Data: ${!!(window.ALL_CARD_KEYS && window.LEVELS)}
  Scenes: ${!!(window.PreloadScene && window.MenuScene && window.GameScene)}
  VK Environment: ${!!isVKEnvironment}
            </pre>
          </details>
        ` : ''}
      </div>
    `;
  }

  // КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Инициализация игры с усиленными DOM проверками
  function initGame() {
    // ИСПРАВЛЕНИЕ 1: Проверяем готовность DOM
    if (document.readyState === 'loading') {
      console.log('DOM not ready, waiting...');
      document.addEventListener('DOMContentLoaded', initGame);
      return;
    }

    // ИСПРАВЛЕНИЕ 2: Дополнительная проверка что документ полностью готов
    if (!document.body) {
      console.log('Document body not ready, retrying...');
      setTimeout(initGame, 50);
      return;
    }

    debugLog('Initializing game...', {
      readyState: document.readyState,
      hasBody: !!document.body,
      hasPhaserLib: !!window.Phaser,
      hasGameData: !!(window.ALL_CARD_KEYS && window.LEVELS),
      hasScenes: !!(window.PreloadScene && window.MenuScene && window.GameScene)
    });

    // ИСПРАВЛЕНИЕ 3: Усиленная валидация parent элемента
    let gameContainer = document.getElementById('game');
    
    // Если контейнер не найден, создаем его немедленно
    if (!gameContainer) {
      console.warn('Game container not found! Creating immediately...');
      
      gameContainer = document.createElement('div');
      gameContainer.id = 'game';
      gameContainer.style.cssText = `
        width: 100vw; 
        height: 100vh; 
        position: fixed; 
        top: 0; 
        left: 0; 
        background: #1d2330;
        z-index: 1000;
      `;
      
      // Убеждаемся что body существует перед appendChild
      if (document.body) {
        document.body.appendChild(gameContainer);
      } else {
        console.error('Document body still not available!');
        setTimeout(initGame, 100);
        return;
      }
      
      // Проверяем что элемент действительно добавился
      const verification = document.getElementById('game');
      if (!verification) {
        console.error('Failed to create game container, retrying...');
        setTimeout(initGame, 100);
        return;
      }
      
      console.log('Game container created successfully');
    }

    // ИСПРАВЛЕНИЕ 4: Финальная проверка что контейнер доступен
    if (!gameContainer || !gameContainer.parentNode) {
      console.error('Game container validation failed, retrying...');
      setTimeout(initGame, 100);
      return;
    }

    // Проверяем наличие зависимостей
    if (!window.Phaser) {
      console.error('Phaser library not loaded');
      showErrorFallback('Ошибка загрузки библиотеки игры');
      return;
    }

    if (!window.ALL_CARD_KEYS || !window.LEVELS) {
      console.error('Game data not loaded');
      showErrorFallback('Ошибка загрузки данных игры');
      return;
    }

    if (!window.PreloadScene || !window.MenuScene || !window.GameScene) {
      console.error('Game scenes not loaded');
      showErrorFallback('Ошибка загрузки сцен игры');
      return;
    }

    // Определяем размеры для разных устройств
    const isMobile = window.innerWidth < window.innerHeight;
    const gameWidth = 1080;
    const gameHeight = 720;
    
    const DPR = Math.min(2, window.devicePixelRatio || 1);
    
    const gameConfig = {
      type: Phaser.AUTO,
      parent: gameContainer, // ИСПРАВЛЕНО: Передаем элемент напрямую
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
          
          console.log('🎮 Game postBoot called');
          console.log('🎭 Available scenes:', game.scene.scenes.map(s => s.scene.key));
          console.log('🎬 Scene manager status:', game.scene);
          
          // ИСПРАВЛЕНИЕ: Скрываем прелоадер при успешной инициализации
          const preloader = document.getElementById('preloader');
          if (preloader) {
            preloader.style.display = 'none';
            document.body.classList.add('game-loaded');
            console.log('✅ Preloader hidden, game ready');
          }
          
          // Передаем VK данные в игру
          game.registry.set('vkUserData', window.VK_USER_DATA);
          game.registry.set('vkLaunchParams', window.VK_LAUNCH_PARAMS);
          game.registry.set('isVKEnvironment', isVKEnvironment);
          game.registry.set('vkBridgeAvailable', window.VKSafe?.isAvailable() || false);
          
          // Глобальные обработчики ошибок
          game.events.on('error', (error) => {
            console.error('Game error:', error);
            debugLog('Game error details', error);
          });
          
          // КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Принудительно запускаем PreloadScene
          console.log('🚀 Starting PreloadScene manually...');
          try {
            game.scene.start('PreloadScene');
            console.log('✅ PreloadScene start command sent');
          } catch (error) {
            console.error('❌ Failed to start PreloadScene:', error);
          }
          
          // Проверяем статус через короткий интервал
          let checkCount = 0;
          const sceneCheck = setInterval(() => {
            checkCount++;
            const activeScenes = game.scene.scenes.filter(s => s.scene.settings.active);
            console.log(`🔍 Check ${checkCount}: Active scenes:`, activeScenes.map(s => s.scene.key));
            
            if (activeScenes.length > 0) {
              console.log('✅ Scene is active:', activeScenes[0].scene.key);
              clearInterval(sceneCheck);
            } else if (checkCount > 10) {
              console.error('❌ No scenes became active after 10 checks. Force starting MenuScene...');
              try {
                game.scene.start('MenuScene', { page: 0 });
              } catch (error) {
                console.error('Failed to force start MenuScene:', error);
              }
              clearInterval(sceneCheck);
            }
          }, 500);
        }
      }
    };

    // ИСПРАВЛЕНИЕ: Создаем игру с обработкой ошибок
    try {
      console.log('Creating Phaser game...');
      window.game = new Phaser.Game(gameConfig);
      
      // Дополнительная проверка успешного создания
      if (!window.game) {
        throw new Error('Game creation failed');
      }
      
      console.log('✅ Game created successfully');
      debugLog('Game created successfully');
      
      // Показываем отладочную информацию
      if (window.VK_DEBUG) {
        setTimeout(() => {
          showDebugInfo({
            isVK: isVKEnvironment,
            userId: window.VK_LAUNCH_PARAMS?.user_id,
            platform: window.VK_LAUNCH_PARAMS?.platform,
            bridgeAvailable: window.VKSafe?.isAvailable() || false,
            userDataLoaded: !!window.VK_USER_DATA,
            gameCreated: !!window.game
          });
        }, 1000);
      }
      
    } catch (error) {
      console.error('Failed to create Phaser game:', error);
      showErrorFallback('Не удалось создать игру', error.message);
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

  // ИСПРАВЛЕНИЕ: Улучшенная функция main с усиленными DOM проверками
  async function main() {
    debugLog('Starting application', { 
      isVK: isVKEnvironment,
      debug: window.VK_DEBUG,
      userAgent: navigator.userAgent,
      readyState: document.readyState
    });

    // КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Ждем полной готовности DOM
    if (document.readyState === 'loading') {
      console.log('Waiting for DOM to be ready...');
      await new Promise(resolve => {
        const handler = () => {
          document.removeEventListener('DOMContentLoaded', handler);
          resolve();
        };
        document.addEventListener('DOMContentLoaded', handler);
      });
    }

    // ДОПОЛНИТЕЛЬНАЯ ПРОВЕРКА: Убеждаемся что body существует
    if (!document.body) {
      console.log('Waiting for document.body...');
      await new Promise(resolve => {
        const checkBody = () => {
          if (document.body) {
            resolve();
          } else {
            setTimeout(checkBody, 10);
          }
        };
        checkBody();
      });
    }

    console.log('DOM fully ready, proceeding with initialization...');

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

    // ИСПРАВЛЕНИЕ: Небольшая задержка для стабилизации
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Запускаем игру
    initGame();
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

  // ИСПРАВЛЕНИЕ: Обработка потери фокуса страницы с проверками
  document.addEventListener('visibilitychange', () => {
    // Безопасная проверка существования объектов игры
    if (window.game && window.game.scene && typeof window.game.scene.getActiveScene === 'function') {
      if (document.hidden) {
        debugLog('Page hidden, pausing game...');
        
        try {
          // Пауза активной сцены
          const activeScene = window.game.scene.getActiveScene();
          if (activeScene && activeScene.scene && activeScene.scene.key === 'GameScene') {
            activeScene.canClick = false;
            debugLog('Game input disabled due to page visibility change');
          }
        } catch (error) {
          debugLog('Error pausing game:', error);
        }
      } else {
        debugLog('Page visible, resuming game...');
        
        try {
          const activeScene = window.game.scene.getActiveScene();
          if (activeScene && activeScene.scene && activeScene.scene.key === 'GameScene') {
            // Небольшая задержка перед возобновлением
            setTimeout(() => {
              if (activeScene.gameMetrics && activeScene.gameMetrics.startTime) {
                activeScene.canClick = true;
                debugLog('Game input re-enabled');
              }
            }, 500);
          }
        } catch (error) {
          debugLog('Error resuming game:', error);
        }
      }
    } else {
      debugLog('Game or scene manager not ready for visibility handling');
    }
  });

  // ИСПРАВЛЕНИЕ: Запуск с обработкой ошибок
  main().catch(error => {
    console.error('Application startup failed:', error);
    showErrorFallback('Ошибка запуска приложения', error.message);
  });

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

    console.log('🛠️ VK Debug utilities loaded:');
    console.log('📞 VKUtils.testVKMethod(method, params) - test VK methods');
    console.log('👤 VKUtils.getUserInfo() - get user data');
    console.log('💾 VKUtils.testStorage() - test storage');
    console.log('📊 VKUtils.showVKData() - show VK data');
  }

})();
