//============================================================================
// main.js - VK Mini Apps Memory Game Bootstrap
// Версия: 2.0.0 | Дата: 2025-09-29
// Поддержка: VK Bridge, ProgressSync, Mobile-first
//============================================================================

(function() {
  'use strict';
  
  //==========================================================================
  // 1. FEATURE FLAGS & DEVICE DETECTION
  //==========================================================================
  
  // Детекция устройства (выполняется первой)
  const Device = Object.freeze({
    isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),
    isIOS: /iPad|iPhone|iPod/.test(navigator.userAgent),
    isAndroid: /Android/.test(navigator.userAgent),
    hasTouch: 'ontouchstart' in window,
    dpr: window.devicePixelRatio || 1,
    
    get isPortrait() {
      return window.innerHeight > window.innerWidth;
    },
    
    get viewport() {
      return {
        width: window.innerWidth,
        height: window.innerHeight,
        screen: `${screen.width}x${screen.height}`
      };
    }
  });
  
  // Feature flags
  const FEATURES = Object.freeze({
    PROGRESS_SYNC: typeof ProgressSyncManager !== 'undefined',
    VK_BRIDGE: true,
    DEBUG_MODE: window.location.search.includes('debug=1') || 
                window.location.hostname === 'localhost'
  });
  
  //==========================================================================
  // 2. GLOBAL STATE
  //==========================================================================
  
  // VK данные
  window.VK_USER_DATA = null;
  window.VK_LAUNCH_PARAMS = null;
  window.VK_BRIDGE_READY = false;
  window.VK_DEBUG = FEATURES.DEBUG_MODE;
  
  // Sync состояние
  window.progressSyncManager = null;
  window.SYNC_STATUS = {
    initialized: false,
    lastSyncTime: 0,
    syncInProgress: false,
    lastError: null,
    available: FEATURES.PROGRESS_SYNC
  };
  
  // VK окружение
  const isVKEnvironment = (
    /vk_(app_id|user_id|platform)/i.test(window.location.search) || 
    window.location.hostname.includes('vk-apps.com') ||
    window.location.hostname.includes('vk.com') ||
    window.parent !== window
  );
  
  //==========================================================================
  // 3. DEBUG & LOGGING
  //==========================================================================
  
  function debugLog(message, data = null) {
    if (!FEATURES.DEBUG_MODE) return;
    
    const timestamp = new Date().toISOString().substr(11, 12);
    console.log(`[${timestamp}] ${message}`, data || '');
  }
  
  function showDebugPanel(info) {
    if (!FEATURES.DEBUG_MODE) return;
    
    const existing = document.getElementById('vk-debug-panel');
    if (existing) existing.remove();
    
    const panel = document.createElement('div');
    panel.id = 'vk-debug-panel';
    panel.style.cssText = `
      position: fixed; top: 10px; right: 10px; 
      background: rgba(0,0,0,0.9); color: #0f0; 
      padding: 12px; border-radius: 6px; 
      font-family: 'Courier New', monospace; 
      font-size: 11px; max-width: 320px; 
      z-index: 99999; border: 1px solid #0f0;
      box-shadow: 0 0 20px rgba(0,255,0,0.3);
    `;
    
    panel.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 8px; color: #fff;">
        🔍 VK Mini Apps Diagnostics
      </div>
      <div>Environment: ${info.isVK ? 'VK' : 'Standalone'}</div>
      <div>Device: ${info.device}</div>
      <div>Platform: ${info.platform || 'N/A'}</div>
      <div>Screen: ${info.screen}</div>
      <div>Touch: ${info.hasTouch ? 'Yes' : 'No'}</div>
      <div>Bridge: ${info.bridgeReady ? '✓' : '✗'}</div>
      <div>User: ${info.hasUser ? '✓' : '✗'}</div>
      <div>Game: ${info.gameCreated ? '✓' : '✗'}</div>
      <div>Sync: ${info.syncReady ? '✓' : '✗'}</div>
      <div style="margin-top: 8px; font-size: 9px; opacity: 0.6;">
        Auto-hide in 15s
      </div>
    `;
    
    document.body.appendChild(panel);
    setTimeout(() => panel.remove(), 15000);
  }
  
  //==========================================================================
  // 4. ERROR HANDLING
  //==========================================================================
  
  function showErrorFallback(message, details = '') {
    let container = document.getElementById('game');
    
    if (!container) {
      container = document.createElement('div');
      container.id = 'game';
      container.style.cssText = `
        position: fixed; top: 0; left: 0; 
        width: 100vw; height: 100vh; 
        background: #1d2330; z-index: 9999;
      `;
      document.body?.appendChild(container);
    }
    
    const fontSize = Device.isMobile ? '16px' : '20px';
    const buttonSize = Device.isMobile ? '16px' : '14px';
    const buttonPadding = Device.isMobile ? '16px 28px' : '12px 24px';
    
    container.innerHTML = `
      <div style="
        display: flex; 
        flex-direction: column; 
        justify-content: center; 
        align-items: center; 
        height: 100%; 
        color: #fff; 
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
        text-align: center;
        padding: 20px;
        box-sizing: border-box;
      ">
        <div style="font-size: 48px; margin-bottom: 20px;">😔</div>
        <h2 style="
          color: #ff6b6b; 
          font-size: ${fontSize}; 
          margin: 0 0 16px 0;
          font-weight: 600;
        ">${message}</h2>
        
        ${details ? `
          <p style="
            color: #aaa; 
            font-size: 14px; 
            margin: 12px 0;
            max-width: 400px;
            line-height: 1.5;
          ">${details}</p>
        ` : ''}
        
        <p style="
          color: #999; 
          font-size: 13px; 
          margin: 16px 0 24px 0;
        ">Проверьте подключение к интернету</p>
        
        <button onclick="location.reload()" style="
          padding: ${buttonPadding}; 
          font-size: ${buttonSize}; 
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
          color: white; 
          border: none; 
          border-radius: 12px; 
          cursor: pointer;
          font-weight: 600;
          box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
          transition: transform 0.2s;
          min-width: ${Device.isMobile ? '200px' : '160px'};
        " onmouseover="this.style.transform='scale(1.05)'" 
           onmouseout="this.style.transform='scale(1)'">
          🔄 Перезагрузить
        </button>
        
        ${FEATURES.DEBUG_MODE ? `
          <details style="
            margin-top: 32px; 
            color: #666; 
            font-size: 10px; 
            max-width: 90%;
            text-align: left;
          ">
            <summary style="cursor: pointer; color: #888; margin-bottom: 8px;">
              Техническая информация
            </summary>
            <pre style="
              font-family: 'Courier New', monospace; 
              font-size: 9px; 
              overflow-x: auto;
              background: rgba(0,0,0,0.3);
              padding: 12px;
              border-radius: 6px;
              margin-top: 8px;
            ">
DOM: ${document.readyState}
Device: ${Device.isMobile ? 'Mobile' : 'Desktop'} ${Device.isIOS ? '(iOS)' : Device.isAndroid ? '(Android)' : ''}
Touch: ${Device.hasTouch}
Screen: ${Device.viewport.screen}
Viewport: ${Device.viewport.width}x${Device.viewport.height}
DPR: ${Device.dpr}
Phaser: ${!!window.Phaser}
GameData: ${!!(window.ALL_CARD_KEYS && window.LEVELS)}
Scenes: ${!!(window.PreloadScene && window.MenuScene && window.GameScene)}
VK Env: ${isVKEnvironment}
VK Bridge: ${!!window.vkBridge}
Sync: ${FEATURES.PROGRESS_SYNC}
User-Agent: ${navigator.userAgent}
            </pre>
          </details>
        ` : ''}
      </div>
    `;
  }
  
  //==========================================================================
  // 5. VK BRIDGE WRAPPER
  //==========================================================================
  
  window.VKSafe = {
    async send(method, params = {}) {
      if (!window.vkBridge) {
        throw new Error('VK Bridge not available');
      }
      
      debugLog(`VK → ${method}`, params);
      
      const timeout = Device.isMobile ? 10000 : 5000;
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error(`${method} timeout`)), timeout)
      );
      
      try {
        const result = await Promise.race([
          window.vkBridge.send(method, params),
          timeoutPromise
        ]);
        
        debugLog(`VK ← ${method}`, result);
        return result;
      } catch (error) {
        console.warn(`VK Bridge error (${method}):`, error.message);
        throw error;
      }
    },
    
    isAvailable() {
      return !!(window.vkBridge && typeof window.vkBridge.send === 'function');
    },
    
    async supports(method) {
      if (!window.vkBridge) return false;
      
      try {
        // Используем синхронный метод если доступен
        if (typeof window.vkBridge.supports === 'function') {
          return window.vkBridge.supports(method);
        }
        
        // Fallback для старых версий
        return true; // Оптимистичный подход
      } catch (error) {
        debugLog(`supports(${method}) failed:`, error);
        return false;
      }
    }
  };
  
  //==========================================================================
  // 6. VK BRIDGE INITIALIZATION
  //==========================================================================
  
  function parseVKParams() {
    const params = {};
    const vkKeys = [
      'vk_user_id', 'vk_app_id', 'vk_is_app_user', 
      'vk_are_notifications_enabled', 'vk_language', 
      'vk_platform', 'vk_ref', 'vk_group_id', 'vk_ts', 'sign'
    ];
    
    const urlParams = new URLSearchParams(window.location.search);
    
    vkKeys.forEach(key => {
      const value = urlParams.get(key);
      if (value !== null) {
        // Валидация числовых ID
        if ((key === 'vk_user_id' || key === 'vk_app_id') && !/^\d+$/.test(value)) {
          console.warn(`Invalid ${key}: ${value}`);
          return;
        }
        params[key] = value;
      }
    });
    
    return params;
  }
  
  async function loadVKBridge(retries = 3) {
    if (window.vkBridge) {
      debugLog('VK Bridge already loaded');
      return;
    }
    
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/@vkontakte/vk-bridge/dist/browser.min.js';
      
      const timeout = setTimeout(() => {
        script.remove();
        if (retries > 0) {
          debugLog(`Bridge load timeout, retrying (${retries} left)`);
          loadVKBridge(retries - 1).then(resolve).catch(reject);
        } else {
          reject(new Error('VK Bridge load timeout'));
        }
      }, Device.isMobile ? 15000 : 10000);
      
      script.onload = () => {
        clearTimeout(timeout);
        
        // Ждём доступности vkBridge
        const checkBridge = (attempts = 50) => {
          if (window.vkBridge) {
            debugLog('VK Bridge ready');
            resolve();
          } else if (attempts > 0) {
            setTimeout(() => checkBridge(attempts - 1), 100);
          } else {
            reject(new Error('VK Bridge not available'));
          }
        };
        
        checkBridge();
      };
      
      script.onerror = () => {
        clearTimeout(timeout);
        script.remove();
        
        if (retries > 0) {
          setTimeout(() => {
            loadVKBridge(retries - 1).then(resolve).catch(reject);
          }, 2000);
        } else {
          reject(new Error('Failed to load VK Bridge'));
        }
      };
      
      document.head.appendChild(script);
    });
  }
  
  async function initVKBridge() {
    try {
      const supportsInit = await window.VKSafe.supports('VKWebAppInit');
      if (!supportsInit) {
        throw new Error('VKWebAppInit not supported');
      }
      
      await window.VKSafe.send('VKWebAppInit');
      window.VK_BRIDGE_READY = true;
      
      // Парсим параметры запуска
      const vkParams = parseVKParams();
      window.VK_LAUNCH_PARAMS = {
        user_id: vkParams.vk_user_id,
        app_id: vkParams.vk_app_id,
        platform: vkParams.vk_platform || (Device.isMobile ? 
          (Device.isIOS ? 'mobile_iphone' : 'mobile_android') : 'web'),
        is_app_user: vkParams.vk_is_app_user === '1',
        language: vkParams.vk_language || 'ru',
        are_notifications_enabled: vkParams.vk_are_notifications_enabled === '1',
        group_id: vkParams.vk_group_id,
        ref: vkParams.vk_ref,
        sign: vkParams.sign,
        ts: vkParams.vk_ts
      };
      
      // Настройка UI
      await setupVKInterface();
      
      // Загрузка данных пользователя
      await loadUserData();
      
      // Подписка на события
      subscribeToVKEvents();
      
      debugLog('VK Bridge initialized', window.VK_LAUNCH_PARAMS);
      return true;
      
    } catch (error) {
      console.error('VK Bridge init failed:', error);
      return false;
    }
  }
  
  async function setupVKInterface() {
    const operations = [];
    
    // Настройка UI
    if (await window.VKSafe.supports('VKWebAppSetViewSettings')) {
      operations.push(
        window.VKSafe.send('VKWebAppSetViewSettings', {
          status_bar_style: 'light',
          action_bar_color: '#1d2330',
          navigation_bar_color: '#1d2330'
        }).catch(e => debugLog('SetViewSettings failed:', e))
      );
    }
    
    // Отключение свайпа (критично для мобильных)
    if (Device.isMobile && await window.VKSafe.supports('VKWebAppDisableSwipeBack')) {
      operations.push(
        window.VKSafe.send('VKWebAppDisableSwipeBack')
          .catch(e => debugLog('DisableSwipeBack failed:', e))
      );
    }
    
    // Уведомления (опционально)
    if (await window.VKSafe.supports('VKWebAppAllowNotifications')) {
      operations.push(
        window.VKSafe.send('VKWebAppAllowNotifications')
          .catch(e => {
            if (e.error_data?.error_code === 4) {
              debugLog('Notifications denied by user');
            } else {
              debugLog('Notifications error:', e);
            }
          })
      );
    }
    
    await Promise.allSettled(operations);
  }
  
  async function loadUserData() {
    if (!await window.VKSafe.supports('VKWebAppGetUserInfo')) {
      return null;
    }
    
    try {
      const userData = await window.VKSafe.send('VKWebAppGetUserInfo');
      window.VK_USER_DATA = userData;
      
      // Кеш на 24 часа
      try {
        localStorage.setItem('vk_user_cache', JSON.stringify({
          ...userData,
          cached_at: Date.now()
        }));
      } catch (e) {
        debugLog('Cache write failed:', e);
      }
      
      return userData;
    } catch (error) {
      console.warn('Failed to load user data:', error);
      
      // Пытаемся загрузить из кеша
      try {
        const cached = localStorage.getItem('vk_user_cache');
        if (cached) {
          const data = JSON.parse(cached);
          if (Date.now() - data.cached_at < 86400000) {
            window.VK_USER_DATA = data;
            debugLog('Using cached user data');
            return data;
          }
        }
      } catch (e) {
        // Игнорируем ошибки кеша
      }
      
      return null;
    }
  }
  
  function subscribeToVKEvents() {
    if (!window.vkBridge?.subscribe) return;
    
    window.vkBridge.subscribe((e) => {
      const { type, data } = e.detail || {};
      debugLog(`VK Event: ${type}`, data);
      
      switch (type) {
        case 'VKWebAppViewHide':
          handleAppHide();
          break;
        case 'VKWebAppViewRestore':
          handleAppRestore();
          break;
        case 'VKWebAppUpdateConfig':
          if (data?.scheme) {
            document.body.setAttribute('data-vk-scheme', data.scheme);
          }
          break;
        case 'VKWebAppGetUserInfoResult':
          if (data && !data.error) {
            window.VK_USER_DATA = data;
          }
          break;
        case 'VKWebAppStorageSetResult':
        case 'VKWebAppStorageGetResult':
          window.SYNC_STATUS.lastSyncTime = Date.now();
          break;
      }
    });
  }
  
  function handleAppHide() {
    debugLog('App hidden');
    
    // Синхронизация при сворачивании
    if (window.progressSyncManager?.forceSync) {
      window.progressSyncManager.forceSync().catch(e => 
        debugLog('Background sync failed:', e)
      );
    }
    
    // Пауза игры
    if (window.game?.scene) {
      const scene = window.game.scene.getScene('GameScene');
      if (scene?.canClick !== undefined) {
        scene.canClick = false;
        scene.pausedAt = Date.now();
      }
    }
  }
  
  function handleAppRestore() {
    debugLog('App restored');
    
    // Синхронизация при возврате
    if (window.progressSyncManager?.forceSync) {
      setTimeout(() => {
        window.progressSyncManager.forceSync().catch(e => 
          debugLog('Restore sync failed:', e)
        );
      }, 1000);
    }
    
    // Возобновление игры
    if (window.game?.scene) {
      const scene = window.game.scene.getScene('GameScene');
      if (scene?.pausedAt) {
        setTimeout(() => {
          if (scene.gameMetrics?.startTime) {
            scene.gameMetrics.startTime += (Date.now() - scene.pausedAt);
          }
          scene.canClick = true;
          scene.pausedAt = null;
        }, Device.isMobile ? 500 : 300);
      }
    }
  }
  
  //==========================================================================
  // 7. PROGRESS SYNC MANAGER
  //==========================================================================
  
  async function initProgressSync() {
    if (!FEATURES.PROGRESS_SYNC) {
      debugLog('ProgressSync feature disabled');
      return false;
    }
    
    try {
      window.progressSyncManager = new ProgressSyncManager();
      
      // Обработчики событий
      window.progressSyncManager.onSyncStart = () => {
        window.SYNC_STATUS.syncInProgress = true;
        debugLog('Sync started');
      };
      
      window.progressSyncManager.onSyncComplete = (data) => {
        window.SYNC_STATUS.syncInProgress = false;
        window.SYNC_STATUS.lastSyncTime = Date.now();
        window.SYNC_STATUS.lastError = null;
        debugLog('Sync completed', data);
        
        window.dispatchEvent(new CustomEvent('progressSynced', { detail: data }));
      };
      
      window.progressSyncManager.onSyncError = (error) => {
        window.SYNC_STATUS.syncInProgress = false;
        window.SYNC_STATUS.lastError = error;
        debugLog('Sync error:', error);
        
        window.dispatchEvent(new CustomEvent('syncError', { detail: error }));
      };
      
      // Тестовая загрузка
      await window.progressSyncManager.loadProgress();
      
      window.SYNC_STATUS.initialized = true;
      debugLog('ProgressSync initialized');
      return true;
      
    } catch (error) {
      console.error('ProgressSync init failed:', error);
      window.SYNC_STATUS.lastError = error;
      
      // Заглушка для совместимости
      window.progressSyncManager = {
        loadProgress: () => Promise.resolve({}),
        saveProgress: () => Promise.resolve(),
        forceSync: () => Promise.resolve(),
        getSyncStatus: () => ({ available: false, error: error.message })
      };
      
      return false;
    }
  }
  
  //==========================================================================
  // 8. PHASER GAME INITIALIZATION
  //==========================================================================
  
  function initGame() {
    // Проверка готовности DOM
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        setTimeout(initGame, Device.isMobile ? 150 : 100);
      });
      return;
    }
    
    if (!document.body) {
      setTimeout(initGame, Device.isMobile ? 100 : 50);
      return;
    }
    
    debugLog('Initializing game', {
      readyState: document.readyState,
      device: Device.isMobile ? 'Mobile' : 'Desktop',
      phaser: !!window.Phaser,
      data: !!(window.ALL_CARD_KEYS && window.LEVELS),
      scenes: !!(window.PreloadScene && window.MenuScene && window.GameScene),
      sync: window.SYNC_STATUS.initialized
    });
    
    // Валидация зависимостей
    if (!window.Phaser) {
      showErrorFallback('Phaser не загружен', 'Библиотека игры недоступна');
      return;
    }
    
    if (!window.ALL_CARD_KEYS || !window.LEVELS) {
      showErrorFallback('Данные игры не загружены', 'gamedata.js недоступен');
      return;
    }
    
    if (!window.PreloadScene || !window.MenuScene || !window.GameScene) {
      showErrorFallback('Сцены игры не загружены', 'scenes/*.js недоступны');
      return;
    }
    
    // Контейнер игры
    let container = document.getElementById('game');
    if (!container) {
      container = document.createElement('div');
      container.id = 'game';
      container.style.cssText = `
        width: 100vw; height: 100vh; 
        position: fixed; top: 0; left: 0; 
        background: #1d2330; z-index: 1000;
        ${Device.isMobile ? `
          touch-action: none;
          -webkit-touch-callout: none;
          -webkit-user-select: none;
          -webkit-tap-highlight-color: transparent;
          overflow: hidden;
        ` : ''}
      `;
      
      document.body.appendChild(container);
      
      // Мобильные стили body
      if (Device.isMobile) {
        document.body.style.cssText += `
          touch-action: none;
          overflow: hidden;
          position: fixed;
          width: 100%; height: 100%;
        `;
        
        // Предотвращение скролла на iOS
        if (Device.isIOS) {
          document.addEventListener('touchmove', e => {
            if (e.target === document.body) {
              e.preventDefault();
            }
          }, { passive: false });
        }
      }
    }
    
    // Размеры игры
    let gameWidth, gameHeight;
    
    if (Device.isMobile) {
      if (Device.isPortrait) {
        gameWidth = 720;
        gameHeight = 1280;
      } else {
        gameWidth = 1280;
        gameHeight = 720;
      }
    } else {
      gameWidth = 1080;
      gameHeight = 720;
    }
    
    // Конфигурация Phaser
    const config = {
      type: Phaser.AUTO,
      parent: container,
      width: gameWidth,
      height: gameHeight,
      backgroundColor: '#1d2330',
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: gameWidth,
        height: gameHeight
      },
      render: {
        antialias: !Device.isMobile,
        pixelArt: false
      },
      scene: [
        window.PreloadScene,
        window.MenuScene,
        window.GameScene
      ]
    };
    
    // Создание игры
    try {
      window.game = new Phaser.Game(config);
      
      if (!window.game) {
        throw new Error('Game creation failed');
      }
      
      debugLog('Game created');
      
      // Ожидание готовности
      window.game.events.once('ready', () => {
        debugLog('Game ready');
        
        // Скрытие прелоадера
        const preloader = document.getElementById('preloader');
        if (preloader) {
          preloader.style.transition = 'opacity 0.5s';
          preloader.style.opacity = '0';
          setTimeout(() => {
            preloader.style.display = 'none';
            document.body.classList.add('game-loaded');
          }, 500);
        }
        
        // Передача данных в игру
        window.game.registry.set('vkUserData', window.VK_USER_DATA);
        window.game.registry.set('vkLaunchParams', window.VK_LAUNCH_PARAMS);
        window.game.registry.set('isVKEnvironment', isVKEnvironment);
        window.game.registry.set('vkBridgeAvailable', window.VKSafe.isAvailable());
        window.game.registry.set('isMobile', Device.isMobile);
        window.game.registry.set('isIOS', Device.isIOS);
        window.game.registry.set('isAndroid', Device.isAndroid);
        window.game.registry.set('progressSyncManager', window.progressSyncManager);
        window.game.registry.set('syncStatus', window.SYNC_STATUS);
        
        // Запуск первой сцены
        setTimeout(() => {
          try {
            window.game.scene.start('PreloadScene');
          } catch (error) {
            console.error('Failed to start PreloadScene:', error);
            // Fallback
            try {
              window.game.scene.start('MenuScene', { page: 0 });
            } catch (menuError) {
              showErrorFallback('Ошибка запуска', 'Не удалось загрузить сцены');
            }
          }
        }, 200);
      });
      
      // Мобильные обработчики
      if (Device.isMobile) {
        // Обработка ориентации
        window.addEventListener('orientationchange', () => {
          setTimeout(() => {
            window.game?.scale?.refresh();
          }, 500);
        });
        
        // Touch handlers (добавляются после создания canvas)
        setTimeout(() => {
          if (window.game?.canvas) {
            window.game.canvas.addEventListener('contextmenu', e => {
              e.preventDefault();
              return false;
            });
            
            window.game.canvas.addEventListener('touchstart', e => {
              if (e.touches.length > 1) {
                e.preventDefault();
              }
            }, { passive: false });
            
            window.game.canvas.addEventListener('gesturestart', e => {
              e.preventDefault();
            });
          }
        }, 1000);
      }
      
      // Debug панель
      if (FEATURES.DEBUG_MODE) {
        setTimeout(() => {
          showDebugPanel({
            isVK: isVKEnvironment,
            device: Device.isMobile ? 
              (Device.isIOS ? 'iOS' : Device.isAndroid ? 'Android' : 'Mobile') : 
              'Desktop
              ',
            platform: window.VK_LAUNCH_PARAMS?.platform || 'N/A',
            screen: Device.viewport.screen,
            hasTouch: Device.hasTouch,
            bridgeReady: window.VK_BRIDGE_READY,
            hasUser: !!window.VK_USER_DATA,
            gameCreated: !!window.game,
            syncReady: window.SYNC_STATUS.initialized
          });
        }, 1500);
      }
      
    } catch (error) {
      console.error('Game creation failed:', error);
      showErrorFallback('Не удалось создать игру', error.message);
    }
  }
  
  //==========================================================================
  // 9. VK HELPERS (Public API)
  //==========================================================================
  
  window.VKHelpers = {
    // Поделиться результатом
    async shareResult(score, level) {
      if (!window.VK_BRIDGE_READY) {
        throw new Error('VK Bridge not ready');
      }
      
      return window.VKSafe.send('VKWebAppShare', {
        link: `${window.location.href}?score=${score}&level=${level}`
      });
    },
    
    // Показать рекламу
    async showAd() {
      if (!window.VK_BRIDGE_READY) {
        throw new Error('VK Bridge not ready');
      }
      
      return window.VKSafe.send('VKWebAppShowNativeAds', {
        ad_format: 'interstitial'
      });
    },
    
    // Сохранить в облако VK
    async setStorageData(key, value) {
      if (!window.VK_BRIDGE_READY) {
        throw new Error('VK Bridge not ready');
      }
      
      return window.VKSafe.send('VKWebAppStorageSet', {
        key: key,
        value: JSON.stringify(value)
      });
    },
    
    // Получить из облака VK
    async getStorageData(keys) {
      if (!window.VK_BRIDGE_READY) {
        throw new Error('VK Bridge not ready');
      }
      
      return window.VKSafe.send('VKWebAppStorageGet', {
        keys: Array.isArray(keys) ? keys : [keys]
      });
    },
    
    // Проверка поддержки
    isSupported(method) {
      return window.VKSafe.supports(method);
    },
    
    // Информация об устройстве
    getDeviceInfo() {
      return {
        isMobile: Device.isMobile,
        isIOS: Device.isIOS,
        isAndroid: Device.isAndroid,
        isPortrait: Device.isPortrait,
        hasTouch: Device.hasTouch,
        viewport: Device.viewport,
        dpr: Device.dpr
      };
    },
    
    // Статус синхронизации
    getSyncStatus() {
      return {
        ...window.SYNC_STATUS,
        managerAvailable: !!window.progressSyncManager
      };
    },
    
    // Принудительная синхронизация
    async forceSyncNow() {
      if (!window.progressSyncManager?.forceSync) {
        throw new Error('Sync manager not available');
      }
      return window.progressSyncManager.forceSync();
    }
  };
  
  //==========================================================================
  // 10. TOAST NOTIFICATIONS
  //==========================================================================
  
  window.showToast = function(message, type = 'info', duration = 3000) {
    let container = document.getElementById('toast-container');
    
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.style.cssText = `
        position: fixed;
        top: ${Device.isMobile ? '60px' : '20px'};
        right: 20px;
        z-index: 100000;
        pointer-events: none;
      `;
      document.body.appendChild(container);
    }
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.style.cssText = `
      background: rgba(30, 39, 51, 0.95);
      color: white;
      padding: 14px 18px;
      border-radius: 8px;
      margin-bottom: 10px;
      transform: translateX(400px);
      transition: transform 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      border-left: 4px solid ${getToastColor(type)};
      pointer-events: auto;
      max-width: 300px;
      font-size: 14px;
      display: flex;
      align-items: center;
      gap: 10px;
    `;
    
    const icon = document.createElement('span');
    icon.textContent = getToastIcon(type);
    icon.style.fontSize = '18px';
    
    const text = document.createElement('span');
    text.textContent = message;
    text.style.flex = '1';
    
    toast.appendChild(icon);
    toast.appendChild(text);
    container.appendChild(toast);
    
    // Анимация появления
    requestAnimationFrame(() => {
      toast.style.transform = 'translateX(0)';
    });
    
    // Автоудаление
    setTimeout(() => {
      toast.style.transform = 'translateX(400px)';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  };
  
  function getToastIcon(type) {
    const icons = {
      info: 'ℹ️',
      success: '✅',
      warning: '⚠️',
      error: '❌'
    };
    return icons[type] || icons.info;
  }
  
  function getToastColor(type) {
    const colors = {
      info: '#3498db',
      success: '#27ae60',
      warning: '#f39c12',
      error: '#e74c3c'
    };
    return colors[type] || colors.info;
  }
  
  //==========================================================================
  // 11. MAIN ENTRY POINT
  //==========================================================================
  
  async function main() {
    debugLog('Application starting', {
      isVK: isVKEnvironment,
      device: Device.isMobile ? 'Mobile' : 'Desktop',
      features: FEATURES,
      readyState: document.readyState
    });
    
    // Ожидание готовности DOM
    if (document.readyState === 'loading') {
      await new Promise(resolve => {
        document.addEventListener('DOMContentLoaded', resolve, { once: true });
      });
      
      // Дополнительная стабилизация для мобильных
      await new Promise(r => setTimeout(r, Device.isMobile ? 200 : 100));
    }
    
    // Ожидание body
    if (!document.body) {
      await new Promise(resolve => {
        const check = () => {
          if (document.body) {
            resolve();
          } else {
            setTimeout(check, 20);
          }
        };
        check();
      });
    }
    
    debugLog('DOM ready');
    
    // Инициализация ProgressSync (если доступен)
    if (FEATURES.PROGRESS_SYNC) {
      await initProgressSync();
    }
    
    // Инициализация VK (если в VK окружении)
    if (isVKEnvironment) {
      try {
        await loadVKBridge();
        const vkReady = await initVKBridge();
        
        if (!vkReady) {
          console.warn('VK init failed, continuing in standalone mode');
        }
        
        // Повторная попытка инициализации Sync после VK
        if (FEATURES.PROGRESS_SYNC && !window.SYNC_STATUS.initialized && window.VK_BRIDGE_READY) {
          await initProgressSync();
        }
      } catch (error) {
        console.error('VK setup failed:', error);
      }
    }
    
    // Стабилизация перед запуском игры
    await new Promise(r => setTimeout(r, Device.isMobile ? 300 : 100));
    
    // Запуск игры
    initGame();
  }
  
  //==========================================================================
  // 12. LIFECYCLE HANDLERS
  //==========================================================================
  
  // Обработка закрытия страницы
  window.addEventListener('beforeunload', () => {
    debugLog('Page unloading');
    
    // Принудительная синхронизация
    if (window.progressSyncManager?.forceSync) {
      try {
        window.progressSyncManager.forceSync();
      } catch (e) {
        debugLog('Unload sync failed:', e);
      }
    }
    
    // Очистка игры
    if (window.game) {
      window.game.scene.scenes.forEach(scene => {
        scene.events?.emit('shutdown');
      });
      window.game.destroy(true);
      window.game = null;
    }
  });
  
  // Обработка видимости страницы
  document.addEventListener('visibilitychange', () => {
    if (!window.game?.scene) return;
    
    if (document.hidden) {
      debugLog('Page hidden');
      
      const scene = window.game.scene.getScene('GameScene');
      if (scene) {
        scene.canClick = false;
        
        if (Device.isMobile && window.game.loop) {
          window.game.loop.sleep();
        }
      }
    } else {
      debugLog('Page visible');
      
      const scene = window.game.scene.getScene('GameScene');
      if (scene) {
        setTimeout(() => {
          scene.canClick = true;
          
          if (Device.isMobile && window.game.loop) {
            window.game.loop.wake();
          }
        }, Device.isMobile ? 1000 : 500);
      }
    }
  });
  
  //==========================================================================
  // 13. DEBUG UTILITIES (Development only)
  //==========================================================================
  
  if (FEATURES.DEBUG_MODE) {
    window.DebugAgreement = {
      reset() {
        ['acceptedAgreement', 'agreementVersion', 'agreementAcceptedAt', 
         'vk_agreement_shown', 'firstLaunchShown'].forEach(key => {
          localStorage.removeItem(key);
        });
        console.log('✅ Agreement data cleared. Reload: location.reload()');
      },
      
      status() {
        const status = {
          accepted: localStorage.getItem('acceptedAgreement'),
          version: localStorage.getItem('agreementVersion'),
          acceptedAt: localStorage.getItem('agreementAcceptedAt'),
          vkShown: localStorage.getItem('vk_agreement_shown'),
          firstLaunch: localStorage.getItem('firstLaunchShown')
        };
        console.table(status);
        return status;
      },
      
      show() {
        const menuScene = window.game?.scene?.getScene('MenuScene');
        if (menuScene?.showUserAgreement) {
          menuScene.showUserAgreement();
        } else {
          console.error('MenuScene not ready');
        }
      },
      
      accept() {
        localStorage.setItem('acceptedAgreement', 'true');
        localStorage.setItem('agreementVersion', '2025-09-29');
        localStorage.setItem('agreementAcceptedAt', new Date().toISOString());
        console.log('✅ Agreement accepted');
      }
    };
    
    if (FEATURES.PROGRESS_SYNC) {
      window.DebugSync = {
        status() {
          console.table(window.SYNC_STATUS);
          if (window.progressSyncManager) {
            console.log('Manager:', window.progressSyncManager.getSyncStatus());
          }
          return window.SYNC_STATUS;
        },
        
        async forceSync() {
          if (!window.progressSyncManager) {
            throw new Error('Sync manager not available');
          }
          console.log('🔄 Forcing sync...');
          const result = await window.progressSyncManager.forceSync();
          console.log('✅ Sync completed:', result);
          return result;
        },
        
        async loadData() {
          if (!window.progressSyncManager) {
            throw new Error('Sync manager not available');
          }
          const data = await window.progressSyncManager.loadProgress();
          console.log('📊 Loaded:', data);
          return data;
        },
        
        async saveTestData() {
          if (!window.progressSyncManager) {
            throw new Error('Sync manager not available');
          }
          
          const testData = {
            levels: {
              0: { stars: 3, bestTime: 45, errors: 0, timestamp: Date.now() },
              1: { stars: 2, bestTime: 67, errors: 1, timestamp: Date.now() }
            },
            stats: {
              gamesPlayed: 2,
              totalTime: 112,
              totalErrors: 1,
              bestTime: 45,
              lastPlayed: Date.now()
            },
            achievements: { first_win: true, perfect_game: true },
            version: '1.0',
            timestamp: Date.now()
          };
          
          await window.progressSyncManager.saveProgress(testData, true);
          console.log('✅ Test data saved');
          return testData;
        },
        
        async clearData() {
          if (!window.progressSyncManager) {
            throw new Error('Sync manager not available');
          }
          await window.progressSyncManager.clearAllData();
          console.log('✅ Data cleared');
        }
      };
    }
    
    window.VKUtils = {
      async testMethod(method, params = {}) {
        if (!window.VKSafe.isAvailable()) {
          console.error('VK Bridge not available');
          return null;
        }
        try {
          const result = await window.VKSafe.send(method, params);
          console.log(`${method} ✅`, result);
          return result;
        } catch (error) {
          console.error(`${method} ❌`, error);
          return null;
        }
      },
      
      async getUserInfo() {
        return this.testMethod('VKWebAppGetUserInfo');
      },
      
      showVKData() {
        console.group('VK Data');
        console.log('Launch Params:', window.VK_LAUNCH_PARAMS);
        console.log('User Data:', window.VK_USER_DATA);
        console.log('Bridge Ready:', window.VK_BRIDGE_READY);
        console.log('Environment:', isVKEnvironment);
        console.groupEnd();
      },
      
      showDeviceInfo() {
        console.group('Device Info');
        console.log('Mobile:', Device.isMobile);
        console.log('iOS:', Device.isIOS);
        console.log('Android:', Device.isAndroid);
        console.log('Touch:', Device.hasTouch);
        console.log('Portrait:', Device.isPortrait);
        console.log('Viewport:', Device.viewport);
        console.log('DPR:', Device.dpr);
        console.groupEnd();
      }
    };
    
    console.log(`
%c🎮 VK Mini Apps - Debug Mode
%cCommands:
  DebugAgreement.reset()      - сброс соглашения
  DebugAgreement.status()     - статус соглашения
  ${FEATURES.PROGRESS_SYNC ? `DebugSync.forceSync()      - синхронизация
  DebugSync.status()          - статус синхронизации` : ''}
  VKUtils.showVKData()        - данные VK
  VKUtils.showDeviceInfo()    - информация об устройстве
`, 
      'color: #667eea; font-size: 16px; font-weight: bold;',
      'color: #aaa; font-size: 12px;'
    );
  }
  
  //==========================================================================
  // 14. START APPLICATION
  //==========================================================================
  
  main().catch(error => {
    console.error('Application startup failed:', error);
    showErrorFallback('Ошибка запуска', error.message);
  });
  
})();
