//---main.js - ПОЛНОЕ ИСПРАВЛЕНИЕ ДЛЯ МОБИЛЬНЫХ УСТРОЙСТВ

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
      <div style="margin-top: 5px; font-size: 10px; opacity: 0.7;">
        Auto-close in 10s
      </div>
    `;
    
    const existing = document.getElementById('vk-debug-panel');
    if (existing) existing.remove();
    
    document.body.appendChild(debugPanel);
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

  // ИСПРАВЛЕННЫЙ VKSafe с обработкой мобильных ошибок
  window.VKSafe = {
    // Список безопасных ошибок по методам
    SAFE_ERRORS: {
      'VKWebAppAllowNotifications': [15, 4], // Access denied, Not supported
      'VKWebAppSetViewSettings': [4, 15], 
      'VKWebAppDisableSwipeBack': [4], 
      'VKWebAppTapticNotificationOccurred': [4]
    },

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
        // Проверяем безопасные ошибки
        const safeErrorCodes = this.SAFE_ERRORS[method] || [];
        const errorCode = error.error_data?.error_code;
        const isSafeError = safeErrorCodes.includes(errorCode);
        
        if (isSafeError) {
          const platform = window.VK_LAUNCH_PARAMS?.platform || 'unknown';
          console.info(`ℹ️ VK ${method}: Expected platform limitation on ${platform} (code ${errorCode})`);
          debugLog(`Safe error for ${method}`, error);
          return { result: false, safe_error: true, error_code: errorCode };
        } else {
          console.error(`❌ VK Bridge critical error for ${method}:`, error);
          throw error;
        }
      }
    },
    
    isAvailable() {
      return !!(window.vkBridge && window.vkBridge.send);
    },
    
    supports(method) {
      if (!window.vkBridge || !window.vkBridge.supports) return false;
      
      try {
        return window.vkBridge.supports(method);
      } catch (e) {
        debugLog(`Error checking support for ${method}`, e);
        return false;
      }
    },

    // Проверка совместимости с платформой
    isMethodCompatible(method) {
      const platform = window.VK_LAUNCH_PARAMS?.platform || 'web';
      
      const platformLimitations = {
        'VKWebAppAllowNotifications': ['web'], // Только desktop
        'VKWebAppTapticNotificationOccurred': ['mobile_android', 'mobile_iphone'],
        'VKWebAppDisableSwipeBack': ['mobile_android', 'mobile_iphone', 'mobile_web']
      };
      
      const supportedPlatforms = platformLimitations[method];
      if (!supportedPlatforms) return true;
      
      return supportedPlatforms.includes(platform);
    },

    // Безопасный вызов
    async safeSend(method, params = {}) {
      if (!this.supports(method)) {
        debugLog(`Method ${method} not supported`);
        return { result: false, reason: 'not_supported' };
      }
      
      if (!this.isMethodCompatible(method)) {
        debugLog(`Method ${method} not compatible with platform ${window.VK_LAUNCH_PARAMS?.platform}`);
        return { result: false, reason: 'not_compatible' };
      }
      
      try {
        return await this.send(method, params);
      } catch (error) {
        debugLog(`Safe send failed for ${method}`, error);
        return { result: false, reason: 'error', error };
      }
    }
  };

  // Парсинг VK параметров
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
      if (!window.VKSafe.supports('VKWebAppInit')) {
        throw new Error('VKWebAppInit not supported');
      }
      
      await window.VKSafe.send('VKWebAppInit');
      debugLog('VK Bridge initialized successfully');
      
      const vkParams = parseVKParams();
      
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
      
      await setupVKInterface();
      await loadUserData();
      subscribeToVKEvents();
      
      return true;
      
    } catch (error) {
      console.error('VK Bridge initialization failed:', error);
      return false;
    }
  }

  // ИСПРАВЛЕННАЯ настройка интерфейса VK
  async function setupVKInterface() {
    const platform = window.VK_LAUNCH_PARAMS?.platform || 'web';
    const isMobilePlatform = ['mobile_android', 'mobile_iphone', 'mobile_web'].includes(platform);
    
    debugLog('Setting up VK interface', { platform, isMobile: isMobilePlatform });
    
    // Список операций с указанием критичности
    const operations = [
      {
        name: 'SetViewSettings',
        method: 'VKWebAppSetViewSettings',
        params: {
          status_bar_style: 'light',
          action_bar_color: '#1d2330',
          navigation_bar_color: '#1d2330'
        },
        critical: false
      },
      {
        name: 'DisableSwipeBack',
        method: 'VKWebAppDisableSwipeBack',
        params: {},
        critical: false,
        mobileOnly: true
      }
    ];
    
    // Уведомления только для desktop и только если нужны
    if (!isMobilePlatform && 
        window.VK_LAUNCH_PARAMS?.is_app_user && 
        !window.VK_LAUNCH_PARAMS?.are_notifications_enabled) {
      operations.push({
        name: 'AllowNotifications',
        method: 'VKWebAppAllowNotifications',
        params: {},
        critical: false,
        desktopOnly: true
      });
    }
    
    // Выполняем операции
    const results = [];
    for (const op of operations) {
      // Проверяем условия выполнения
      if (op.mobileOnly && !isMobilePlatform) {
        debugLog(`Skipping ${op.name} - not mobile platform`);
        continue;
      }
      if (op.desktopOnly && isMobilePlatform) {
        debugLog(`Skipping ${op.name} - not desktop platform`);
        continue;
      }
      
      if (!window.VKSafe.supports(op.method)) {
        debugLog(`Skipping ${op.name} - not supported`);
        continue;
      }
      
      try {
        const result = await window.VKSafe.send(op.method, op.params);
        debugLog(`${op.name} success`, result);
        results.push({ name: op.name, success: true, result });
      } catch (error) {
        const errorMsg = error.error_data?.error_msg || error.message;
        
        if (op.critical) {
          console.error(`❌ Critical error in ${op.name}: ${errorMsg}`);
          throw error;
        } else {
          console.info(`ℹ️ Non-critical: ${op.name} - ${errorMsg}`);
          debugLog(`${op.name} error details`, error);
          results.push({ name: op.name, success: false, error: errorMsg });
        }
      }
    }
    
    debugLog('VK Interface setup completed', {
      total: operations.length,
      executed: results.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length
    });
    
    return results;
  }

  // Загрузка данных пользователя с таймаутом
  async function loadUserData() {
    if (!window.VKSafe.supports('VKWebAppGetUserInfo')) {
      debugLog('VKWebAppGetUserInfo not supported');
      return null;
    }
    
    try {
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
      }
    });
    
    debugLog('VK Events subscription initialized');
  }

  // Обработчики событий
  function handleAppHide() {
    debugLog('App hidden - pausing game');
    
    if (window.game?.scene?.isActive('GameScene')) {
      const gameScene = window.game.scene.getScene('GameScene');
      if (gameScene) {
        gameScene.scene.pause();
      }
    }
  }

  function handleAppRestore() {
    debugLog('App restored - resuming game');
    
    if (window.game?.scene?.isPaused('GameScene')) {
      const gameScene = window.game.scene.getScene('GameScene');
      if (gameScene) {
        gameScene.scene.resume();
      }
    }
  }

  function handleConfigUpdate(config) {
    debugLog('VK Config updated', config);
    
    if (config?.scheme && window.game?.registry) {
      window.game.registry.set('vkTheme', {
        scheme: config.scheme,
        isDark: !['bright_light', 'client_light'].includes(config.scheme),
        timestamp: Date.now()
      });
      
      const activeScene = window.game.scene.getScenes(true)[0];
      if (activeScene && activeScene.events) {
        activeScene.events.emit('themeChanged', config.scheme);
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

    const isMobile = window.innerWidth < window.innerHeight;
    const gameWidth = isMobile ? 720 : 1080;
    const gameHeight = isMobile ? 1080 : 720;
    
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
      callbacks: {
        postBoot: function(game) {
          debugLog('Game booted', {
            renderer: game.renderer.type === 0 ? 'Canvas' : 'WebGL',
            resolution: DPR,
            size: `${game.scale.width}x${game.scale.height}`,
            deviceRatio: window.devicePixelRatio
          });
          
          game.registry.set('vkUserData', window.VK_USER_DATA);
          game.registry.set('vkLaunchParams', window.VK_LAUNCH_PARAMS);
          game.registry.set('isVKEnvironment', isVKEnvironment);
          game.registry.set('vkBridgeAvailable', window.VKSafe.isAvailable());
          
          game.events.on('error', (error) => {
            console.error('🎮 Game error:', error);
            debugLog('Game error details', error);
          });
        }
      }
    };

    try {
      window.game = new Phaser.Game(gameConfig);
      
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
      console.error('❌ Ошибка создания игры:', error);
      
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

  // Загрузка VK Bridge
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
