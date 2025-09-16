//---main.js - ИСПРАВЛЕНИЕ ДЛЯ МОБИЛЬНЫХ УСТРОЙСТВ

(function() {
  'use strict';
  
  // Глобальные переменные для VK
  window.VK_USER_DATA = null;
  window.VK_LAUNCH_PARAMS = null;
  window.VK_BRIDGE_READY = false;
  window.VK_DEBUG = window.location.search.includes('debug=1') || 
                   window.location.hostname === 'localhost';
  
  // ИСПРАВЛЕНИЕ 1: Добавляем детекцию мобильных устройств
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isAndroid = /Android/.test(navigator.userAgent);
  
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
      <div>Device: ${info.isMobile ? 'Mobile' : 'Desktop'}</div>
      <div>Platform: ${info.platform || 'N/A'}</div>
      <div>User Agent: ${navigator.userAgent.substring(0, 30)}...</div>
      <div>Screen: ${screen.width}x${screen.height}</div>
      <div>Viewport: ${window.innerWidth}x${window.innerHeight}</div>
      <div>DPR: ${window.devicePixelRatio || 1}</div>
      <div>Touch: ${info.touchSupport ? 'Yes' : 'No'}</div>
      <div>Bridge: ${info.bridgeAvailable ? 'Available' : 'Not available'}</div>
      <div>UserData: ${info.userDataLoaded ? 'Loaded' : 'Not loaded'}</div>
      <div>Game: ${info.gameCreated ? 'Created' : 'Not created'}</div>
      <div style="margin-top: 5px; font-size: 10px; opacity: 0.7;">
        Auto-close in 15s
      </div>
    `;
    
    // Удаляем старую панель если есть
    const existing = document.getElementById('vk-debug-panel');
    if (existing) existing.remove();
    
    document.body.appendChild(debugPanel);
    
    // Убираем через 15 секунд на мобильных (больше времени для чтения)
    setTimeout(() => {
      if (debugPanel.parentNode) {
        debugPanel.remove();
      }
    }, 15000);
  }

  // Определяем VK окружение
  const urlParams = new URLSearchParams(window.location.search);
  const isVKEnvironment = /vk_(app_id|user_id|platform)/i.test(window.location.search) || 
                         window.location.hostname.includes('vk-apps.com') ||
                         window.location.hostname.includes('vk.com') ||
                         window.parent !== window;
  
  debugLog('Environment detection', { 
    isVK: isVKEnvironment,
    isMobile: isMobile,
    isIOS: isIOS,
    isAndroid: isAndroid,
    search: window.location.search,
    hostname: window.location.hostname,
    inIframe: window.parent !== window,
    userAgent: navigator.userAgent
  });

  // ИСПРАВЛЕНИЕ 2: Мобильно-оптимизированная обертка для VK Bridge
  window.VKSafe = {
    async send(method, params = {}) {
      if (!window.vkBridge) {
        throw new Error('VK Bridge not available');
      }
      
      debugLog(`VK Bridge call: ${method}`, params);
      
      try {
        // ИСПРАВЛЕНИЕ: Увеличенный таймаут для мобильных устройств
        const timeout = isMobile ? 10000 : 5000;
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error(`${method} timeout`)), timeout)
        );
        
        const resultPromise = window.vkBridge.send(method, params);
        const result = await Promise.race([resultPromise, timeoutPromise]);
        
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
    
    // ИСПРАВЛЕНИЕ: Мобильно-оптимизированная проверка поддержки
    async supports(method) {
      if (!window.vkBridge) return false;
      
      try {
        // На мобильных устройствах используем более простую проверку
        if (isMobile && window.vkBridge.supports) {
          return window.vkBridge.supports(method);
        }
        
        // Пробуем новый метод для десктопа
        if (window.vkBridge.supportsAsync) {
          try {
            return await window.vkBridge.supportsAsync(method);
          } catch (error) {
            debugLog(`supportsAsync error for ${method}:`, error);
            // Fallback на старый метод
            return window.vkBridge.supports ? window.vkBridge.supports(method) : false;
          }
        }
        
        // Fallback на старый метод
        if (window.vkBridge.supports) {
          return window.vkBridge.supports(method);
        }
        
        return false;
      } catch (error) {
        debugLog(`supports check error for ${method}:`, error);
        return false;
      }
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

  // ИСПРАВЛЕНИЕ 3: Мобильно-оптимизированная инициализация VK Bridge
  async function initVKBridge() {
    debugLog('Initializing VK Bridge...', {
      isMobile: isMobile,
      platform: isIOS ? 'iOS' : isAndroid ? 'Android' : 'Desktop'
    });
    
    try {
      // ИСПРАВЛЕНИЕ: На мобильных устройствах даем больше времени на инициализацию
      const initTimeout = isMobile ? 15000 : 10000;
      
      const supportsInit = await window.VKSafe.supports('VKWebAppInit');
      if (!supportsInit) {
        throw new Error('VKWebAppInit not supported');
      }
      
      // Инициализация Bridge с таймаутом
      const initPromise = window.VKSafe.send('VKWebAppInit');
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('VK init timeout')), initTimeout)
      );
      
      await Promise.race([initPromise, timeoutPromise]);
      
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
        platform: vkParams.vk_platform || (isMobile ? (isIOS ? 'mobile_iphone' : 'mobile_android') : 'web'),
        is_app_user: vkParams.vk_is_app_user === '1',
        language: vkParams.vk_language || 'ru',
        are_notifications_enabled: vkParams.vk_are_notifications_enabled === '1',
        group_id: vkParams.vk_group_id,
        ref: vkParams.vk_ref,
        sign: vkParams.sign,
        ts: vkParams.vk_ts
      };
      
      debugLog('VK Launch params parsed', window.VK_LAUNCH_PARAMS);
      
      // Настройка интерфейса с задержкой для мобильных
      if (isMobile) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
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

  // ИСПРАВЛЕНИЕ 4: Мобильно-оптимизированная настройка интерфейса VK
  async function setupVKInterface() {
    const operations = [];
    
    // Настройка статус-бара и навигации (особенно важно для мобильных)
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
    
    // Отключение свайпа назад (критично для мобильных)
    if (await window.VKSafe.supports('VKWebAppDisableSwipeBack')) {
      operations.push({
        name: 'DisableSwipeBack',
        call: () => window.VKSafe.send('VKWebAppDisableSwipeBack')
      });
    }
    
    // ИСПРАВЛЕНИЕ: Мобильно-оптимизированные уведомления
    if (await window.VKSafe.supports('VKWebAppAllowNotifications')) {
      operations.push({
        name: 'AllowNotifications',
        call: async () => {
          try {
            // На мобильных даем больше времени на обработку уведомлений
            if (isMobile) {
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
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
    
    // Выполняем все операции с увеличенным таймаутом для мобильных
    const operationTimeout = isMobile ? 8000 : 5000;
    const results = await Promise.allSettled(
      operations.map(op => 
        Promise.race([
          op.call(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error(`${op.name} timeout`)), operationTimeout)
          )
        ]).catch(error => {
          debugLog(`${op.name} failed`, error.message);
          return { error: error.message };
        })
      )
    );
    
    debugLog('VK Interface setup results', results);
  }

  // ИСПРАВЛЕНИЕ 5: Мобильно-оптимизированная загрузка данных пользователя
  async function loadUserData() {
    const supportsUserInfo = await window.VKSafe.supports('VKWebAppGetUserInfo');
    if (!supportsUserInfo) {
      debugLog('VKWebAppGetUserInfo not supported');
      return null;
    }
    
    try {
      // Увеличенный таймаут для мобильных устройств
      const userDataTimeout = isMobile ? 10000 : 5000;
      
      const userDataPromise = window.VKSafe.send('VKWebAppGetUserInfo');
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('User data request timeout')), userDataTimeout)
      );
      
      const userData = await Promise.race([userDataPromise, timeoutPromise]);
      window.VK_USER_DATA = userData;
      debugLog('User data loaded', userData);
      
      // Кешируем данные пользователя
      try {
        localStorage.setItem('vk_user_cache', JSON.stringify({
          ...userData,
          cached_at: Date.now(),
          mobile_device: isMobile
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
          
          // Восстанавливаем состояние игры с задержкой (больше для мобильных)
          const resumeDelay = isMobile ? 500 : 300;
          setTimeout(() => {
            if (activeScene.pausedAt && activeScene.gameMetrics) {
              // Корректируем время игры, исключая время паузы
              const pauseDuration = Date.now() - activeScene.pausedAt;
              activeScene.gameMetrics.startTime += pauseDuration;
              activeScene.pausedAt = null;
            }
            
            activeScene.canClick = true;
            debugLog('Game resumed');
          }, resumeDelay);
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

  // ИСПРАВЛЕНИЕ 6: Мобильно-оптимизированная загрузка VK Bridge
  function loadVKBridge(retries = 3) {
    return new Promise((resolve, reject) => {
      if (window.vkBridge) {
        debugLog('VK Bridge already loaded');
        resolve();
        return;
      }
      
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/@vkontakte/vk-bridge/dist/browser.min.js';
      
      // Увеличенный таймаут для мобильных устройств
      const loadTimeout = isMobile ? 15000 : 10000;
      
      const timeout = setTimeout(() => {
        script.remove();
        if (retries > 0) {
          debugLog(`VK Bridge load timeout, retrying... (${retries} attempts left)`);
          loadVKBridge(retries - 1).then(resolve).catch(reject);
        } else {
          reject(new Error('VK Bridge load timeout'));
        }
      }, loadTimeout);
      
      script.onload = () => {
        clearTimeout(timeout);
        debugLog('VK Bridge script loaded');
        
        // Ждем пока vkBridge станет доступен (больше попыток для мобильных)
        const maxAttempts = isMobile ? 100 : 50;
        const checkBridge = (attempts = maxAttempts) => {
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
          }, 2000); // Увеличенная задержка между попытками для мобильных
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
        box-sizing: border-box;
      ">
        <h2 style="color: #ff6b6b; font-size: ${isMobile ? '18px' : '24px'}; margin-bottom: 15px;">😔 ${message}</h2>
        ${details ? `<p style="color: #ccc; font-size: ${isMobile ? '12px' : '14px'}; margin: 10px 0; max-width: 90%;">${details}</p>` : ''}
        <p style="color: #ccc; font-size: ${isMobile ? '12px' : '14px'}; margin-bottom: 20px;">Проверьте подключение к интернету и попробуйте снова</p>
        <button onclick="location.reload()" style="
          padding: ${isMobile ? '15px 25px' : '12px 24px'}; 
          font-size: ${isMobile ? '18px' : '16px'}; 
          background: #3498db; 
          color: white; 
          border: none; 
          border-radius: 8px; 
          cursor: pointer;
          margin-top: 20px;
          font-weight: bold;
          min-width: ${isMobile ? '200px' : '160px'};
        ">🔄 Перезагрузить</button>
        
        ${window.VK_DEBUG ? `
          <details style="margin-top: 20px; color: #888; font-size: ${isMobile ? '10px' : '12px'}; max-width: 90%;">
            <summary>Техническая информация</summary>
            <pre style="text-align: left; margin-top: 10px; font-size: ${isMobile ? '8px' : '10px'}; overflow-x: auto;">
  DOM Ready: ${document.readyState}
  Mobile Device: ${isMobile}
  iOS: ${isIOS}
  Android: ${isAndroid}
  Touch Support: ${'ontouchstart' in window}
  Screen: ${screen.width}x${screen.height}
  Viewport: ${window.innerWidth}x${window.innerHeight}
  DPR: ${window.devicePixelRatio || 1}
  Phaser: ${!!window.Phaser}
  Game Data: ${!!(window.ALL_CARD_KEYS && window.LEVELS)}
  Scenes: ${!!(window.PreloadScene && window.MenuScene && window.GameScene)}
  VK Environment: ${!!isVKEnvironment}
  User Agent: ${navigator.userAgent}
            </pre>
          </details>
        ` : ''}
      </div>
    `;
  }

  // КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ 7: Мобильно-оптимизированная инициализация игры
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
      setTimeout(initGame, isMobile ? 100 : 50);
      return;
    }

    debugLog('Initializing game...', {
      readyState: document.readyState,
      hasBody: !!document.body,
      isMobile: isMobile,
      isIOS: isIOS,
      isAndroid: isAndroid,
      touchSupport: 'ontouchstart' in window,
      hasPhaserLib: !!window.Phaser,
      hasGameData: !!(window.ALL_CARD_KEYS && window.LEVELS),
      hasScenes: !!(window.PreloadScene && window.MenuScene && window.GameScene),
      screen: `${screen.width}x${screen.height}`,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      dpr: window.devicePixelRatio || 1
    });

    // ИСПРАВЛЕНИЕ 3: Усиленная валидация parent элемента для мобильных
    let gameContainer = document.getElementById('game');
    
    // Если контейнер не найден, создаем его немедленно
    if (!gameContainer) {
      console.warn('Game container not found! Creating immediately...');
      
      gameContainer = document.createElement('div');
      gameContainer.id = 'game';
      
      // ИСПРАВЛЕНИЕ: Мобильно-оптимизированные стили контейнера
      gameContainer.style.cssText = `
        width: 100vw; 
        height: 100vh; 
        position: fixed; 
        top: 0; 
        left: 0; 
        background: #1d2330;
        z-index: 1000;
        ${isMobile ? `
          touch-action: none;
          -webkit-touch-callout: none;
          -webkit-user-select: none;
          -webkit-tap-highlight-color: transparent;
          overflow: hidden;
        ` : ''}
      `;
      
      // Убеждаемся что body существует перед appendChild
      if (document.body) {
        document.body.appendChild(gameContainer);
        
        // ИСПРАВЛЕНИЕ: Мобильные стили для body
        if (isMobile) {
          document.body.style.cssText += `
            touch-action: none;
            overflow: hidden;
            position: fixed;
            width: 100%;
            height: 100%;
          `;
          
          // Предотвращаем скролл на iOS
          if (isIOS) {
            document.addEventListener('touchmove', (e) => {
              e.preventDefault();
            }, { passive: false });
          }
        }
      } else {
        console.error('Document body still not available!');
        setTimeout(initGame, isMobile ? 200 : 100);
        return;
      }
      
      // Проверяем что элемент действительно добавился
      const verification = document.getElementById('game');
      if (!verification) {
        console.error('Failed to create game container, retrying...');
        setTimeout(initGame, isMobile ? 200 : 100);
        return;
      }
      
      console.log('Game container created successfully');
    }

    // ИСПРАВЛЕНИЕ 4: Финальная проверка что контейнер доступен
    if (!gameContainer || !gameContainer.parentNode) {
      console.error('Game container validation failed, retrying...');
      setTimeout(initGame, isMobile ? 200 : 100);
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

    // ИСПРАВЛЕНИЕ 8: Мобильно-адаптивные размеры игры
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    const isPortrait = screenHeight > screenWidth;
    
    // Определяем размеры для разных устройств
    let gameWidth, gameHeight;
    
    if (isMobile) {
      if (isPortrait) {
        // Портретная ориентация на мобильных
        gameWidth = 720;
        gameHeight = 1280;
      } else {
        // Ландшафтная ориентация на мобильных
        gameWidth = 1280;
        gameHeight = 720;
      }
    } else {
      // Десктоп
      gameWidth = 1080;
      gameHeight = 720;
    }
    
    // ИСПРАВЛЕНИЕ: Оптимизированный DPR для мобильных устройств
    const DPR = isMobile ? Math.min(2, window.devicePixelRatio || 1) : Math.min(2, window.devicePixelRatio || 1);
    
    debugLog('Game configuration', {
      screenWidth: screenWidth,
      screenHeight: screenHeight,
      isPortrait: isPortrait,
      gameWidth: gameWidth,
      gameHeight: gameHeight,
      DPR: DPR,
      isMobile: isMobile
    });
    
    const gameConfig = {
      type: Phaser.AUTO,
      parent: gameContainer, // ИСПРАВЛЕНО: Передаем элемент напрямую
      backgroundColor: '#1d2330',
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: gameWidth,
        height: gameHeight,
        // ИСПРАВЛЕНИЕ: Мобильные настройки масштабирования
        min: {
          width: isMobile ? (isPortrait ? 360 : 640) : 800,
          height: isMobile ? (isPortrait ? 640 : 360) : 600
        },
        max: {
          width: isMobile ? (isPortrait ? 768 : 1366) : 1920,
          height: isMobile ? (isPortrait ? 1366 : 768) : 1080
        }
      },
      resolution: DPR,
      render: { 
        antialias: !isMobile, // Отключаем антиалиасинг на мобильных для производительности
        pixelArt: false,
        powerPreference: isMobile ? 'default' : 'high-performance', // Энергосбережение на мобильных
        // ИСПРАВЛЕНИЕ: Мобильные настройки рендеринга
        batchSize: isMobile ? 1000 : 2000,
        maxTextures: isMobile ? 8 : 16
      },
      // ИСПРАВЛЕНИЕ: Мобильная поддержка ввода
      input: {
        mouse: !isMobile,
        touch: isMobile,
        keyboard: !isMobile, // Отключаем клавиатуру на мобильных
        gamepad: false
      },
      scene: [
        window.PreloadScene,
        window.MenuScene,
        window.GameScene
      ],
      fps: {
        target: isMobile ? 30 : 60, // Ограничиваем FPS на мобильных для экономии батареи
        forceSetTimeOut: true,
        deltaHistory: isMobile ? 5 : 10 // Меньше истории на мобильных
      },
      // ИСПРАВЛЕНИЕ: Мобильная производительность
      physics: {
        default: 'arcade',
        arcade: {
          fps: isMobile ? 30 : 60,
          fixedStep: true
        }
      },
      callbacks: {
        preBoot: function(game) {
          debugLog('Game pre-boot started');
          
          // ИСПРАВЛЕНИЕ: Мобильная оптимизация перед загрузкой
          if (isMobile) {
            // Отключаем контекстное меню на мобильных
            game.canvas.addEventListener('contextmenu', (e) => {
              e.preventDefault();
              return false;
            });
            
            // Предотвращаем зум на мобильных
            game.canvas.addEventListener('touchstart', (e) => {
              if (e.touches.length > 1) {
                e.preventDefault();
              }
            }, { passive: false });
            
            game.canvas.addEventListener('gesturestart', (e) => {
              e.preventDefault();
            });
          }
        },
        
        postBoot: function(game) {
          debugLog('Game booted', {
            renderer: game.renderer.type === 0 ? 'Canvas' : 'WebGL',
            resolution: DPR,
            size: `${game.scale.width}x${game.scale.height}`,
            deviceRatio: window.devicePixelRatio,
            isMobile: isMobile,
            platform: isIOS ? 'iOS' : isAndroid ? 'Android' : 'Desktop'
          });
          
          console.log('🎮 Game postBoot called');
          console.log('📱 Mobile device:', isMobile);
          console.log('🔧 Device info:', {
            iOS: isIOS,
            Android: isAndroid,
            portrait: isPortrait,
            screen: `${screenWidth}x${screenHeight}`,
            game: `${gameWidth}x${gameHeight}`
          });
          console.log('🎭 Available scenes:', game.scene.scenes.map(s => s.scene.key));
          console.log('🎬 Scene manager status:', game.scene);
          
          // ИСПРАВЛЕНИЕ: Скрываем прелоадер при успешной инициализации
          const preloader = document.getElementById('preloader');
          if (preloader) {
            // ИСПРАВЛЕНИЕ: Плавное скрытие прелоадера на мобильных
            if (isMobile) {
              preloader.style.transition = 'opacity 0.5s ease-out';
              preloader.style.opacity = '0';
              setTimeout(() => {
                preloader.style.display = 'none';
                document.body.classList.add('game-loaded');
                console.log('✅ Preloader hidden (mobile), game ready');
              }, 500);
            } else {
              preloader.style.display = 'none';
              document.body.classList.add('game-loaded');
              console.log('✅ Preloader hidden (desktop), game ready');
            }
          }
          
          // Передаем VK данные в игру
          game.registry.set('vkUserData', window.VK_USER_DATA);
          game.registry.set('vkLaunchParams', window.VK_LAUNCH_PARAMS);
          game.registry.set('isVKEnvironment', isVKEnvironment);
          game.registry.set('vkBridgeAvailable', window.VKSafe?.isAvailable() || false);
          game.registry.set('isMobile', isMobile);
          game.registry.set('isIOS', isIOS);
          game.registry.set('isAndroid', isAndroid);
          
          // Глобальные обработчики ошибок
          game.events.on('error', (error) => {
            console.error('Game error:', error);
            debugLog('Game error details', error);
          });
          
          // КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Принудительно запускаем PreloadScene с задержкой для мобильных
          const startDelay = isMobile ? 500 : 100;
          console.log(`🚀 Starting PreloadScene manually in ${startDelay}ms...`);
          
          setTimeout(() => {
            try {
              game.scene.start('PreloadScene');
              console.log('✅ PreloadScene start command sent');
            } catch (error) {
              console.error('❌ Failed to start PreloadScene:', error);
              // Пробуем запустить MenuScene напрямую
              try {
                console.log('🔄 Trying to start MenuScene directly...');
                game.scene.start('MenuScene', { page: 0 });
              } catch (menuError) {
                console.error('❌ Failed to start MenuScene:', menuError);
                showErrorFallback('Ошибка запуска игры', 'Не удалось загрузить игровые сцены');
              }
            }
          }, startDelay);
          
          // ИСПРАВЛЕНИЕ: Проверяем статус через увеличенные интервалы для мобильных
          let checkCount = 0;
          const checkInterval = isMobile ? 1000 : 500;
          const maxChecks = isMobile ? 15 : 10;
          
          const sceneCheck = setInterval(() => {
            checkCount++;
            const activeScenes = game.scene.scenes.filter(s => s.scene.settings.active);
            console.log(`🔍 Check ${checkCount}: Active scenes:`, activeScenes.map(s => s.scene.key));
            
            if (activeScenes.length > 0) {
              console.log('✅ Scene is active:', activeScenes[0].scene.key);
              clearInterval(sceneCheck);
            } else if (checkCount > maxChecks) {
              console.error(`❌ No scenes became active after ${maxChecks} checks. Force starting MenuScene...`);
              try {
                game.scene.start('MenuScene', { page: 0 });
                console.log('🔄 Forced MenuScene start');
              } catch (error) {
                console.error('Failed to force start MenuScene:', error);
                showErrorFallback('Ошибка запуска сцены', 'Игровые сцены не отвечают');
              }
              clearInterval(sceneCheck);
            }
          }, checkInterval);
          
          // ИСПРАВЛЕНИЕ: Дополнительная диагностика для мобильных устройств
          if (isMobile && window.VK_DEBUG) {
            setTimeout(() => {
              console.group('🔍 Mobile Diagnostics');
              console.log('Canvas size:', game.canvas.width, 'x', game.canvas.height);
              console.log('Canvas style:', game.canvas.style.width, 'x', game.canvas.style.height);
              console.log('Game size:', game.scale.width, 'x', game.scale.height);
              console.log('Display size:', game.scale.displaySize.width, 'x', game.scale.displaySize.height);
              console.log('Touch enabled:', game.input.touch.enabled);
              console.log('Mouse enabled:', game.input.mouse.enabled);
              console.log('Active pointers:', game.input.activePointer);
              console.groupEnd();
            }, 2000);
          }
        }
      }
    };

    // ИСПРАВЛЕНИЕ: Создаем игру с обработкой ошибок и мобильными оптимизациями
    try {
      console.log('Creating Phaser game...');
      console.log('Game config:', {
        type: 'AUTO',
        parent: 'game container element',
        mobile: isMobile,
        gameSize: `${gameWidth}x${gameHeight}`,
        DPR: DPR
      });
      
      window.game = new Phaser.Game(gameConfig);
      
      // Дополнительная проверка успешного создания
      if (!window.game) {
        throw new Error('Game creation failed');
      }
      
      console.log('✅ Game created successfully');
      debugLog('Game created successfully');
      
      // ИСПРАВЛЕНИЕ: Мобильные обработчики событий
      if (isMobile) {
        // Обработка изменения ориентации
        window.addEventListener('orientationchange', () => {
          setTimeout(() => {
            if (window.game && window.game.scale) {
              window.game.scale.refresh();
              console.log('📱 Orientation changed, scale refreshed');
            }
          }, 500);
        });
        
        // Обработка фокуса/потери фокуса на мобильных
        window.addEventListener('blur', () => {
          if (window.game && window.game.loop) {
            window.game.loop.sleep();
            console.log('📱 App lost focus, game loop paused');
          }
        });
        
        window.addEventListener('focus', () => {
          if (window.game && window.game.loop) {
            window.game.loop.wake();
            console.log('📱 App gained focus, game loop resumed');
          }
        });
        
        // Обработка события паузы (специфично для мобильных браузеров)
        document.addEventListener('visibilitychange', () => {
          if (window.game) {
            if (document.hidden) {
              window.game.events.emit('pause');
              console.log('📱 Page hidden, game paused');
            } else {
              window.game.events.emit('resume');
              console.log('📱 Page visible, game resumed');
            }
          }
        });
      }
      
      // Показываем отладочную информацию с дополнительными мобильными данными
      if (window.VK_DEBUG) {
        setTimeout(() => {
          showDebugInfo({
            isVK: isVKEnvironment,
            isMobile: isMobile,
            userId: window.VK_LAUNCH_PARAMS?.user_id,
            platform: window.VK_LAUNCH_PARAMS?.platform,
            bridgeAvailable: window.VKSafe?.isAvailable() || false,
            userDataLoaded: !!window.VK_USER_DATA,
            gameCreated: !!window.game,
            touchSupport: 'ontouchstart' in window
          });
        }, 1500);
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
    },

    // ИСПРАВЛЕНИЕ: Дополнительные мобильные утилиты
    isMobileDevice: function() {
      return isMobile;
    },

    getDeviceInfo: function() {
      return {
        isMobile: isMobile,
        isIOS: isIOS,
        isAndroid: isAndroid,
        isPortrait: window.innerHeight > window.innerWidth,
        touchSupport: 'ontouchstart' in window,
        screen: `${screen.width}x${screen.height}`,
        viewport: `${window.innerWidth}x${window.innerHeight}`,
        dpr: window.devicePixelRatio || 1
      };
    }
  };

  // ИСПРАВЛЕНИЕ: Улучшенная функция main с мобильными оптимизациями
  async function main() {
    debugLog('Starting application', { 
      isVK: isVKEnvironment,
      isMobile: isMobile,
      isIOS: isIOS,
      isAndroid: isAndroid,
      debug: window.VK_DEBUG,
      userAgent: navigator.userAgent,
      readyState: document.readyState,
      touchSupport: 'ontouchstart' in window
    });

    // КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Ждем полной готовности DOM с учетом мобильных особенностей
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

    // ДОПОЛНИТЕЛЬНАЯ ПРОВЕРКА: Убеждаемся что body существует (критично для мобильных)
    if (!document.body) {
      console.log('Waiting for document.body...');
      await new Promise(resolve => {
        const checkBody = () => {
          if (document.body) {
            resolve();
          } else {
            setTimeout(checkBody, isMobile ? 20 : 10);
          }
        };
        checkBody();
      });
    }

    console.log('DOM fully ready, proceeding with initialization...');
    console.log('📱 Device detection:', {
      isMobile: isMobile,
      isIOS: isIOS,
      isAndroid: isAndroid,
      touchSupport: 'ontouchstart' in window
    });

    if (isVKEnvironment) {
      try {
        // Загружаем VK Bridge с учетом мобильных особенностей
        await loadVKBridge();
        debugLog('VK Bridge loaded successfully');
        
        // Инициализируем VK с увеличенным таймаутом для мобильных
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

    // ИСПРАВЛЕНИЕ: Увеличенная задержка для стабилизации на мобильных
    const stabilizationDelay = isMobile ? 300 : 100;
    await new Promise(resolve => setTimeout(resolve, stabilizationDelay));
    
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

  // ИСПРАВЛЕНИЕ: Мобильно-оптимизированная обработка потери фокуса страницы
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
          
          // ИСПРАВЛЕНИЕ: Дополнительная пауза для мобильных устройств
          if (isMobile && window.game.loop) {
            window.game.loop.sleep();
            debugLog('Mobile: Game loop paused');
          }
        } catch (error) {
          debugLog('Error pausing game:', error);
        }
      } else {
        debugLog('Page visible, resuming game...');
        
        try {
          const activeScene = window.game.scene.getActiveScene();
          if (activeScene && activeScene.scene && activeScene.scene.key === 'GameScene') {
            // Увеличенная задержка перед возобновлением на мобильных
            const resumeDelay = isMobile ? 1000 : 500;
            setTimeout(() => {
              if (activeScene.gameMetrics && activeScene.gameMetrics.startTime) {
                activeScene.canClick = true;
                debugLog('Game input re-enabled');
              }
            }, resumeDelay);
          }
          
          // ИСПРАВЛЕНИЕ: Возобновление игрового цикла на мобильных
          if (isMobile && window.game.loop) {
            window.game.loop.wake();
            debugLog('Mobile: Game loop resumed');
          }
        } catch (error) {
          debugLog('Error resuming game:', error);
        }
      }
    } else {
      debugLog('Game or scene manager not ready for visibility handling');
    }
  });

  // ИСПРАВЛЕНИЕ: Запуск с обработкой ошибок и мобильной диагностикой
  main().catch(error => {
    console.error('Application startup failed:', error);
    console.error('Mobile context:', {
      isMobile: isMobile,
      isIOS: isIOS,
      isAndroid: isAndroid,
      userAgent: navigator.userAgent,
      screen: `${screen.width}x${screen.height}`,
      viewport: `${window.innerWidth}x${window.innerHeight}`
    });
    showErrorFallback('Ошибка запуска приложения', error.message);
  });

  // ИСПРАВЛЕНИЕ: Расширенные отладочные утилиты с мобильной диагностикой
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
          random: Math.random(),
          mobile: isMobile,
          device: isIOS ? 'iOS' : isAndroid ? 'Android' : 'Desktop'
        };
        
        console.log('Testing VK Storage...');
        
        const saveResult = await this.testVKMethod('VKWebAppStorageSet', {
          key: 'test_key_mobile',
          value: JSON.stringify(testData)
        });
        
        if (!saveResult) return;
        
        const loadResult = await this.testVKMethod('VKWebAppStorageGet', {
          keys: ['test_key_mobile']
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
      },

      // ИСПРАВЛЕНИЕ: Мобильная диагностика
      showMobileInfo() {
        console.group('📱 Mobile Diagnostics');
        console.log('Is Mobile:', isMobile);
        console.log('Is iOS:', isIOS);
        console.log('Is Android:', isAndroid);
        console.log('Touch Support:', 'ontouchstart' in window);
        console.log('User Agent:', navigator.userAgent);
        console.log('Screen Size:', `${screen.width}x${screen.height}`);
        console.log('Viewport Size:', `${window.innerWidth}x${window.innerHeight}`);
        console.log('Device Pixel Ratio:', window.devicePixelRatio || 1);
        console.log('Orientation:', window.innerHeight > window.innerWidth ? 'Portrait' : 'Landscape');
        
        if (window.game) {
          console.log('Game Canvas:', `${window.game.canvas.width}x${window.game.canvas.height}`);
          console.log('Game Scale:', `${window.game.scale.width}x${window.game.scale.height}`);
          console.log('Touch Enabled:', window.game.input.touch?.enabled);
          console.log('Mouse Enabled:', window.game.input.mouse?.enabled);
        }
        console.groupEnd();
      },

      // Тест производительности на мобильных
      async performanceTest() {
        if (!isMobile) {
          console.log('Performance test is designed for mobile devices');
          return;
        }

        console.group('📊 Mobile Performance Test');
        
        const start = performance.now();
        
        // Тест создания и уничтожения объектов
        const objects = [];
        for (let i = 0; i < 1000; i++) {
          objects.push({ id: i, data: Math.random() });
        }
        
        const createTime = performance.now() - start;
        console.log('Object Creation Time:', `${createTime.toFixed(2)}ms`);
        
        // Тест обработки массивов
        const arrayStart = performance.now();
        objects.sort((a, b) => a.data - b.data);
        const sortTime = performance.now() - arrayStart;
        console.log('Array Sort Time:', `${sortTime.toFixed(2)}ms`);
        
        // Тест памяти (приблизительный)
        if (performance.memory) {
          console.log('Memory Usage:', {
            used: `${(performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(2)}MB`,
            total: `${(performance.memory.totalJSHeapSize / 1024 / 1024).toFixed(2)}MB`,
            limit: `${(performance.memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2)}MB`
          });
        }
        
        console.groupEnd();
      }
    };

    console.log('🛠️ VK Debug utilities loaded:');
    console.log('📞 VKUtils.testVKMethod(method, params) - test VK methods');
    console.log('👤 VKUtils.getUserInfo() - get user data');
    console.log('💾 VKUtils.testStorage() - test storage');
    console.log('📊 VKUtils.showVKData() - show VK data');
    console.log('📱 VKUtils.showMobileInfo() - show mobile diagnostics');
    console.log('⚡ VKUtils.performanceTest() - test mobile performance');
  }

})();
