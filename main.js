//---main.js - ПОЛНАЯ VK ИНТЕГРАЦИЯ С ОТЛАДКОЙ И ИСПРАВЛЕНИЯМИ

(function() {
  'use strict';
  
  // Глобальные переменные для VK
  window.VK_USER_DATA = null;
  window.VK_LAUNCH_PARAMS = null;
  window.VK_PERMISSIONS = null;
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
      <div style="font-weight: bold; margin-bottom: 5px;">🔍 VK Debug Info:</div>
      <div>Environment: ${info.isVK ? 'VK Mini App' : 'Standalone'}</div>
      <div>User ID: ${info.userId || 'N/A'}</div>
      <div>Platform: ${info.platform || 'N/A'}</div>
      <div>Bridge: ${info.bridgeAvailable ? '✅' : '❌'}</div>
      <div>UserData: ${info.userDataLoaded ? '✅' : '❌'}</div>
      <div>Notifications: ${info.notificationsSupported ? '✅' : '❌'}</div>
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

  // Определяем VK окружение (улучшенное детектирование)
  const urlParams = new URLSearchParams(window.location.search);
  const isVKEnvironment = /vk_(app_id|user_id|platform)/i.test(window.location.search) || 
                         window.location.hostname.includes('vk-apps.com') ||
                         window.location.hostname.includes('vk.com') ||
                         window.parent !== window; // Проверка на iframe
  
  debugLog('Environment detection', { 
    isVK: isVKEnvironment,
    search: window.location.search,
    hostname: window.location.hostname,
    inIframe: window.parent !== window
  });

  // Безопасная обертка для VK Bridge (ИСПРАВЛЕННАЯ)
  window.VKSafe = {
    async send(method, params = {}) {
      if (!window.vkBridge) {
        throw new Error('VK Bridge not available');
      }
      
      // ПРОВЕРКА ПОДДЕРЖКИ МЕТОДА ПЕРЕД ВЫЗОВОМ
      if (!this.supports(method)) {
        console.warn(`⚠️ Method ${method} not supported on this platform`);
        throw new Error(`Method ${method} not supported`);
      }
      
      debugLog(`VK Bridge call: ${method}`, params);
      
      try {
        const result = await window.vkBridge.send(method, params);
        debugLog(`VK Bridge response: ${method}`, result);
        return result;
      } catch (error) {
        this.handleVKError(method, error);
        throw error;
      }
    },
    
    // ДЕТАЛЬНАЯ ОБРАБОТКА ОШИБОК
    handleVKError(method, error) {
      const { error_type, error_data } = error;
      
      switch (method) {
        case 'VKWebAppAllowNotifications':
          if (error_data?.error_code === 15) {
            console.warn('🔔 Notifications not available: app needs moderation approval');
          } else if (error_data?.error_code === 4) {
            console.warn('🔔 User denied notifications permission');
          }
          break;
          
        case 'VKWebAppGetUserInfo':
          if (error_data?.error_code === 15) {
            console.warn('👤 User info access denied');
          }
          break;
          
        default:
          console.warn(`VK Bridge error for ${method}:`, error);
      }
    },
    
    isAvailable() {
      return !!(window.vkBridge && window.vkBridge.send);
    },
    
    supports(method) {
      return window.vkBridge && window.vkBridge.supports && window.vkBridge.supports(method);
    },
    
    // ПРОВЕРКА РАЗРЕШЕНИЙ ПЕРЕД ЗАПРОСОМ
    async checkPermissions() {
      const permissions = {
        notifications: false,
        userInfo: false,
        storage: false,
        share: false,
        haptic: false
      };
      
      if (this.isAvailable()) {
        permissions.notifications = this.supports('VKWebAppAllowNotifications');
        permissions.userInfo = this.supports('VKWebAppGetUserInfo');
        permissions.storage = this.supports('VKWebAppStorageSet');
        permissions.share = this.supports('VKWebAppShare');
        permissions.haptic = this.supports('VKWebAppTapticNotificationOccurred');
      }
      
      debugLog('VK Permissions check', permissions);
      return permissions;
    },
    
    // БЕЗОПАСНЫЙ ЗАПРОС УВЕДОМЛЕНИЙ
    async requestNotifications() {
      if (!this.supports('VKWebAppAllowNotifications')) {
        console.warn('🔔 Notifications not supported on this platform');
        return { success: false, reason: 'not_supported' };
      }
      
      try {
        await this.send('VKWebAppAllowNotifications');
        console.log('✅ Notifications permission granted');
        return { success: true };
      } catch (error) {
        const reason = error.error_data?.error_code === 15 ? 'app_not_approved' : 
                      error.error_data?.error_code === 4 ? 'user_denied' : 'unknown';
        console.warn(`🔔 Notifications denied: ${reason}`);
        return { success: false, reason, error };
      }
    }
  };

  // Парсинг VK параметров с валидацией
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

  // Инициализация VK Bridge (ИСПРАВЛЕННАЯ)
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
      
      // ПРОВЕРКА ДОСТУПНЫХ РАЗРЕШЕНИЙ
      window.VK_PERMISSIONS = await window.VKSafe.checkPermissions();
      debugLog('Available permissions', window.VK_PERMISSIONS);
      
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

  // Настройка интерфейса VK (ИСПРАВЛЕННАЯ)
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
    
    // РАЗРЕШЕНИЕ УВЕДОМЛЕНИЙ - ТОЛЬКО ЕСЛИ ПОДДЕРЖИВАЕТСЯ
    if (window.VK_PERMISSIONS?.notifications) {
      operations.push({
        name: 'AllowNotifications',
        call: async () => {
          const result = await window.VKSafe.requestNotifications();
          if (!result.success) {
            debugLog('Notifications setup failed', result.reason);
          }
          return result;
        }
      });
    } else {
      debugLog('Notifications not supported, skipping');
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

  // Загрузка данных пользователя с таймаутом (ИСПРАВЛЕННАЯ)
  async function loadUserData() {
    if (!window.VK_PERMISSIONS?.userInfo) {
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
      return userData;
    } catch (error) {
      console.warn('Failed to load user data:', error);
      return null;
    }
  }

  // Подписка на события VK с улучшенной обработкой (ИСПРАВЛЕННАЯ)
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

  // Обработчики событий приложения (улучшенные)
  function handleAppHide() {
    debugLog('App hidden - pausing game');
    
    if (window.game?.scene?.isActive('GameScene')) {
      const gameScene = window.game.scene.getScene('GameScene');
      if (gameScene) {
        // Пауза таймеров и анимаций
        gameScene.scene.pause();
        
        // Сохраняем состояние игры
        if (gameScene.gameState?.gameStarted && !gameScene.gameState?.gameCompleted) {
          debugLog('Saving game state on pause');
          // Здесь можно добавить сохранение прогресса
        }
      }
    }
  }

  function handleAppRestore() {
    debugLog('App restored - resuming game');
    
    if (window.game?.scene?.isPaused('GameScene')) {
      const gameScene = window.game.scene.getScene('GameScene');
      if (gameScene) {
        gameScene.scene.resume();
        debugLog('Game resumed successfully');
      }
    }
  }

  // ИСПРАВЛЕННАЯ ОБРАБОТКА КОНФИГА
  function handleConfigUpdate(config) {
    debugLog('VK Config updated', config);
    
    const scheme = config?.scheme || 'bright';
    const accentColor = config?.accent_color || '#5A9EF4';
    
    // Обновляем CSS переменные
    document.documentElement.setAttribute('data-scheme', scheme);
    document.documentElement.style.setProperty('--vk-accent', accentColor);
    
    // Обновляем игровую тему
    if (window.game?.scene?.getScene('GameScene')) {
      window.game.scene.getScene('GameScene').events.emit('theme-changed', {
        scheme,
        accentColor
      });
    }
    
    // Обновление темы игры на основе VK темы
    updateGameTheme(scheme);
    
    // Обновление языка если изменился
    if (config?.lang && window.VK_LAUNCH_PARAMS) {
      window.VK_LAUNCH_PARAMS.language = config.lang;
      debugLog('Language updated', config.lang);
    }
  }

  function updateGameTheme(scheme) {
    debugLog('Updating game theme', scheme);
    
    // Передаем информацию о теме в игру
    if (window.game?.registry) {
      window.game.registry.set('vkTheme', {
        scheme: scheme,
        isDark: !['bright_light', 'client_light'].includes(scheme),
        timestamp: Date.now()
      });
      
      // Уведомляем активную сцену об изменении темы
      const activeScene = window.game.scene.getScenes(true)[0];
      if (activeScene && activeScene.events) {
        activeScene.events.emit('themeChanged', scheme);
      }
    }
  }

  // Инициализация игры (исправлена конфигурация)
  function initGame() {
    debugLog('Initializing game...');
    
    if (!window.Phaser) {
      console.error('❌ Phaser не найден. Проверьте подключение библиотеки.');
      return;
    }

    // Определяем размеры для разных устройств
    const isMobile = window.innerWidth < window.innerHeight;
    const gameWidth = isMobile ? 720 : 1080;  // Исправлено: поменяли местами
    const gameHeight = isMobile ? 1080 : 720; // для правильной ориентации
    
    // Конфигурация игры
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
        powerPreference: 'high-performance' // Для лучшей производительности
      },
      physics: {
        default: 'arcade', // Добавляем физику если нужна
        arcade: {
          debug: window.VK_DEBUG
        }
      },
      scene: [
        window.PreloadScene,
        window.MenuScene,
        window.GameScene
      ],
      // VK специфичные настройки
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
          game.registry.set('vkPermissions', window.VK_PERMISSIONS);
          game.registry.set('isVKEnvironment', isVKEnvironment);
          game.registry.set('vkBridgeAvailable', window.VKSafe.isAvailable());
          
          // Добавляем глобальные обработчики ошибок для игры
          game.events.on('error', (error) => {
            console.error('🎮 Game error:', error);
            debugLog('Game error details', error);
          });
          
          // Обработка изменения размера окна
          game.scale.on('resize', (gameSize) => {
            debugLog('Game resized', gameSize);
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
            userDataLoaded: !!window.VK_USER_DATA,
            notificationsSupported: window.VK_PERMISSIONS?.notifications
          });
        }, 1000); // Показываем после инициализации
      }
      
      debugLog('Game created successfully');
      
    } catch (error) {
      console.error('❌ Ошибка создания игры:', error);
      
      // Попытка fallback без некоторых функций
      if (error.message.includes('WebGL')) {
        console.warn('⚠️ WebGL error, trying Canvas fallback');
        gameConfig.type = Phaser.CANVAS;
        try {
          window.game = new Phaser.Game(gameConfig);
          debugLog('Game created with Canvas fallback');
        } catch (fallbackError) {
          console.error('❌ Canvas fallback failed:', fallbackError);
        }
      }
    }
  }

  // Загрузка VK Bridge с таймаутом и повторными попытками
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
          console.warn('⚠️ VK initialization failed, starting in standalone mode');
        }
        
      } catch (error) {
        console.error('❌ VK setup failed:', error);
        debugLog('VK setup failed, falling back to standalone');
      }
    } else {
      debugLog('Not VK environment, starting directly');
    }

    // Запускаем игру после небольшой задержки для стабилизации
    setTimeout(() => {
      initGame();
    }, 100);
  }

  // Запуск после загрузки DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main);
  } else {
    main();
  }

  // Глобальные утилиты для VK (ОБНОВЛЕННЫЕ)
  if (window.VK_DEBUG) {
    window.VKUtils = {
      // Тестирование VK методов (БЕЗОПАСНОЕ)
      async testVKMethod(method, params = {}) {
        if (!window.VKSafe.isAvailable()) {
          console.error('❌ VK Bridge not available');
          return null;
        }
        
        if (!window.VKSafe.supports(method)) {
          console.error(`❌ Method ${method} not supported`);
          return null;
        }
        
        try {
          const result = await window.VKSafe.send(method, params);
          console.log(`✅ ${method} success:`, result);
          return result;
        } catch (error) {
          console.error(`❌ ${method} failed:`, error);
          return null;
        }
      },

      // Получение информации о пользователе (БЕЗОПАСНОЕ)
      async getUserInfo() {
        if (!window.VK_PERMISSIONS?.userInfo) {
          console.warn('⚠️ User info not supported');
          return null;
        }
        return await this.testVKMethod('VKWebAppGetUserInfo');
      },

      // Тестирование уведомлений (БЕЗОПАСНОЕ)
      async testNotifications() {
        if (!window.VK_PERMISSIONS?.notifications) {
          console.warn('⚠️ Notifications not supported on this platform');
          return null;
        }
        
        const result = await window.VKSafe.requestNotifications();
        console.log('🔔 Notifications test result:', result);
        return result;
      },

      // Тестирование хранилища (БЕЗОПАСНОЕ)
      async testStorage() {
        if (!window.VK_PERMISSIONS?.storage) {
          console.warn('⚠️ Storage not supported');
          return null;
        }
        
        const testData = { 
          test: 'value', 
          timestamp: Date.now(),
          random: Math.random()
        };
        
        console.log('📦 Testing VK Storage...');
        
        // Сохранение
        const saveResult = await this.testVKMethod('VKWebAppStorageSet', {
          key: 'test_key',
          value: JSON.stringify(testData)
        });
        
        if (!saveResult) return;
        
        // Загрузка
        const loadResult = await this.testVKMethod('VKWebAppStorageGet', {
          keys: ['test_key']
        });
        
        if (loadResult && loadResult.keys && loadResult.keys[0]) {
          const loaded = JSON.parse(loadResult.keys[0].value);
          console.log('✅ Storage test successful:', loaded);
          return loaded;
        }
        
        console.error('❌ Storage test failed');
        return null;
      },

      // Показ уведомления (БЕЗОПАСНОЕ)
      async showNotification(type = 'success') {
        if (!window.VK_PERMISSIONS?.haptic) {
          console.warn('⚠️ Haptic feedback not supported');
          return null;
        }
        return await this.testVKMethod('VKWebAppTapticNotificationOccurred', {
          type: type
        });
      },

      // Тест поделиться (БЕЗОПАСНОЕ)
      async testShare() {
        if (!window.VK_PERMISSIONS?.share) {
          console.warn('⚠️ Share not supported');
          return null;
        }
        return await this.testVKMethod('VKWebAppShare', {
          link: window.location.href
        });
      },

      // Показать все VK данные
      showVKData() {
        console.group('🎮 VK Data');
        console.log('Launch Params:', window.VK_LAUNCH_PARAMS);
        console.log('User Data:', window.VK_USER_DATA);
        console.log('Permissions:', window.VK_PERMISSIONS);
        console.log('Bridge Available:', window.VKSafe.isAvailable());
        console.log('Environment:', isVKEnvironment);
        console.log('Debug Mode:', window.VK_DEBUG);
        console.log('URL Params:', Object.fromEntries(new URLSearchParams(window.location.search)));
        console.groupEnd();
      },

      // Симулировать события VK
      simulateVKEvents() {
        console.log('🎭 Simulating VK events...');
        
        setTimeout(() => {
          console.log('Simulating VKWebAppViewHide...');
          handleAppHide();
        }, 1000);
        
        setTimeout(() => {
          console.log('Simulating VKWebAppViewRestore...');
          handleAppRestore();
        }, 3000);
        
        setTimeout(() => {
          console.log('Simulating VKWebAppUpdateConfig...');
          handleConfigUpdate({ scheme: 'bright_light', accent_color: '#5A9EF4' });
        }, 5000);
      }
    };

    console.log('🔍 VK Debug utilities loaded:');
    console.log('VKUtils.testVKMethod(method, params) - тест VK методов');
    console.log('VKUtils.getUserInfo() - данные пользователя');
    console.log('VKUtils.testNotifications() - тест уведомлений');
    console.log('VKUtils.testStorage() - тест хранилища');
    console.log('VKUtils.testShare() - тест поделиться');
    console.log('VKUtils.showNotification(type) - хаптик уведомление');
    console.log('VKUtils.showVKData() - показать VK данные');
    console.log('VKUtils.simulateVKEvents() - симулировать события');
    console.log('Add ?debug=1 to URL for detailed logging');
  }

})();
