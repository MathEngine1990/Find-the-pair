/**
 * main.js - Глобальный файл инициализации игры Memory/Find-the-Pair
 * С интеграцией ProgressSyncManager из patch_for_integration.txt
 */

(function() {
  'use strict';

  // ========================================
  // ДЕТЕКЦИЯ ПЛАТФОРМЫ И УСТРОЙСТВА
  // ========================================
  
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  const isAndroid = /Android/i.test(navigator.userAgent);
  const isLowEnd = isMobile && (navigator.hardwareConcurrency <= 2 || navigator.deviceMemory <= 2);
  
  const isVKEnvironment = (
    window.location.href.includes('vk.com') || 
    window.location.search.includes('vk_app_id') ||
    document.referrer.includes('vk.com')
  );

  window.VK_DEBUG = window.location.search.includes('debug=1') || !isVKEnvironment;

  console.log('🎮 Game Initialization:', {
    isMobile,
    isIOS,
    isAndroid,
    isLowEnd,
    isVKEnvironment,
    debug: window.VK_DEBUG
  });

  // ========================================
  // ОТЛАДОЧНЫЕ УТИЛИТЫ
  // ========================================
  
  function debugLog(...args) {
    if (window.VK_DEBUG) {
      console.log('[Game]', ...args);
    }
  }

  // ========================================
  // ПОКАЗ ОШИБКИ ПОЛЬЗОВАТЕЛЮ
  // ========================================
  
  function showErrorFallback(title, message) {
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
          padding: ${isMobile ? '15px' : '20px'};
        ">
          <h2 style="font-size: ${isMobile ? '20px' : '24px'}; margin-bottom: 10px;">😔 ${title}</h2>
          <p style="font-size: ${isMobile ? '14px' : '16px'}; margin-bottom: 20px; max-width: 400px;">${message}</p>
          <button onclick="location.reload()" style="
            padding: ${isMobile ? '10px 20px' : '12px 24px'}; 
            font-size: ${isMobile ? '14px' : '16px'}; 
            background: #3498db; 
            color: white; 
            border: none; 
            border-radius: 8px; 
            cursor: pointer;
            font-weight: bold;
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
  }

  // ========================================
  // VK BRIDGE ИНТЕГРАЦИЯ
  // ========================================
  
  async function loadVKBridge() {
    return new Promise((resolve, reject) => {
      if (window.vkBridge) {
        resolve(window.vkBridge);
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://unpkg.com/@vkontakte/vk-bridge/dist/browser.min.js';
      script.onload = () => {
        if (window.vkBridge) {
          resolve(window.vkBridge);
        } else {
          reject(new Error('VK Bridge loaded but not available'));
        }
      };
      script.onerror = () => reject(new Error('Failed to load VK Bridge'));
      document.head.appendChild(script);
    });
  }

  async function initVKBridge() {
    try {
      if (!window.vkBridge) {
        console.warn('VK Bridge not loaded');
        return false;
      }

      debugLog('Initializing VK Bridge...');
      window.vkBridge.send('VKWebAppInit');

      const userInfo = await window.vkBridge.send('VKWebAppGetUserInfo');
      debugLog('VK User Info:', userInfo);
      window.VK_USER_DATA = userInfo;

      const launchParams = await window.vkBridge.send('VKWebAppGetLaunchParams');
      debugLog('VK Launch Params:', launchParams);
      window.VK_LAUNCH_PARAMS = launchParams;

      window.dispatchEvent(new CustomEvent('vk-bridge-ready'));
      return true;
    } catch (error) {
      console.error('VK Bridge initialization failed:', error);
      return false;
    }
  }

  window.VKSafe = {
    isAvailable: function() {
      return !!window.vkBridge;
    },

    send: async function(method, params = {}) {
      if (!this.isAvailable()) {
        throw new Error('VK Bridge not available');
      }
      return await window.vkBridge.send(method, params);
    },

    subscribe: function(callback) {
      if (this.isAvailable()) {
        window.vkBridge.subscribe(callback);
      }
    },

    storageGet: async function(keys) {
      if (!this.isAvailable()) return null;
      try {
        const result = await window.vkBridge.send('VKWebAppStorageGet', { keys });
        return result;
      } catch (error) {
        console.error('VK Storage Get failed:', error);
        return null;
      }
    },

    storageSet: async function(key, value) {
      if (!this.isAvailable()) return false;
      try {
        await window.vkBridge.send('VKWebAppStorageSet', { key, value });
        return true;
      } catch (error) {
        console.error('VK Storage Set failed:', error);
        return false;
      }
    },

    storageGetKeys: async function(keys) {
      if (!this.isAvailable()) return {};
      try {
        const result = await this.storageGet(keys);
        const data = {};
        result.keys.forEach(item => {
          data[item.key] = item.value;
        });
        return data;
      } catch (error) {
        console.error('VK Storage Get Keys failed:', error);
        return {};
      }
    },

    isSupported: function(method) {
      return window.VKSafe.supports(method);
    }
  };

  // ========================================
  // ГЛАВНАЯ ФУНКЦИЯ ЗАПУСКА
  // ========================================
  
  async function main() {
    debugLog('Starting application', { 
      isVK: isVKEnvironment,
      debug: window.VK_DEBUG,
      userAgent: navigator.userAgent
    });

    if (isVKEnvironment) {
      try {
        await loadVKBridge();
        debugLog('VK Bridge loaded successfully');
        
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

    const stabilizationDelay = isMobile ? 300 : 100;
    await new Promise(resolve => setTimeout(resolve, stabilizationDelay));
    
    initGame();
  }

  // ========================================
  // ГЛОБАЛЬНЫЕ ОБРАБОТЧИКИ
  // ========================================
  
  window.addEventListener('beforeunload', () => {
    debugLog('Page unloading, cleaning up game...');
    
    if (window.game) {
      window.game.scene.scenes.forEach(scene => {
        if (scene.events) {
          scene.events.emit('shutdown');
        }
      });
      
      window.game.destroy(true);
      window.game = null;
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (window.game && window.game.scene && typeof window.game.scene.getActiveScene === 'function') {
      if (document.hidden) {
        debugLog('Page hidden, pausing game...');
        
        try {
          const activeScene = window.game.scene.getActiveScene();
          if (activeScene && activeScene.scene && activeScene.scene.key === 'GameScene') {
            activeScene.canClick = false;
            debugLog('Game input disabled due to page visibility change');
          }
          
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
            const resumeDelay = isMobile ? 1000 : 500;
            setTimeout(() => {
              if (activeScene.gameMetrics && activeScene.gameMetrics.startTime) {
                activeScene.canClick = true;
                debugLog('Game input re-enabled');
              }
            }, resumeDelay);
          }
          
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

  // ========================================
  // ИНИЦИАЛИЗАЦИЯ ИГРЫ
  // ========================================
  
  function initGame() {
    if (document.readyState === 'loading' || !document.body) {
      console.log('DOM not ready, waiting...');
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initGame);
      } else {
        setTimeout(initGame, 100);
      }
      return;
    }

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

    let gameContainer = document.getElementById('game');
    
    if (!gameContainer) {
      console.warn('Game container not found! Creating one...');
      gameContainer = document.createElement('div');
      gameContainer.id = 'game';
      gameContainer.style.cssText = 'width: 100vw; height: 100vh; margin: 0; padding: 0; overflow: hidden;';
      document.body.appendChild(gameContainer);
    }

    if (!window.Phaser) {
      showErrorFallback('Ошибка загрузки', 'Не удалось загрузить библиотеку Phaser');
      return;
    }

    if (!window.ALL_CARD_KEYS || !window.LEVELS) {
      showErrorFallback('Ошибка данных', 'Не загружены данные игры (карты/уровни)');
      return;
    }

    if (!window.PreloadScene || !window.MenuScene || !window.GameScene) {
      showErrorFallback('Ошибка сцен', 'Не загружены сцены игры');
      return;
    }

    const DPR = Math.min(window.devicePixelRatio || 1, isMobile ? 2 : 3);
    const gameWidth = Math.min(window.innerWidth, 800);
    const gameHeight = Math.min(window.innerHeight, 600);

    const gameConfig = {
      type: Phaser.AUTO,
      parent: 'game',
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
        pixelArt: false,
        antialias: !isMobile,
        antialiasGL: !isMobile,
        mipmapFilter: isMobile ? 'LINEAR' : 'LINEAR_MIPMAP_LINEAR',
        roundPixels: isMobile,
        powerPreference: isMobile ? 'low-power' : 'high-performance',
        failIfMajorPerformanceCaveat: false,
        desynchronized: isMobile,
        batchSize: isMobile ? 1024 : 2048,
        maxTextures: isMobile ? 8 : 16
      },
      scene: [window.PreloadScene, window.MenuScene, window.GameScene],
      dom: {
        createContainer: false
      },
      input: {
        activePointers: 1,
        touch: {
          capture: true
        }
      }
    };

    try {
      console.log('Creating Phaser game...');
      console.log('Game config:', {
        type: 'AUTO',
        parent: 'game container element',
        mobile: isMobile,
        gameSize: `${gameWidth}x${gameHeight}`
      });
      
      window.game = new Phaser.Game(gameConfig);
      
      console.log('✅ Phaser game created:', {
        renderer: window.game.renderer.type === 0 ? 'Canvas' : 'WebGL',
        resolution: DPR,
        size: `${window.game.scale.width}x${window.game.scale.height}`,
        deviceRatio: window.devicePixelRatio,
        mobile: isMobile,
        lowEnd: isLowEnd
      });
      
      window.game.registry.set('isMobile', isMobile);
      window.game.registry.set('isLowEnd', isLowEnd);
      
      if (window.VK_USER_DATA) {
        window.game.registry.set('vkUserData', window.VK_USER_DATA);
      }
      if (window.VK_LAUNCH_PARAMS) {
        window.game.registry.set('vkLaunchParams', window.VK_LAUNCH_PARAMS);
      }
      
      window.game.events.on('pause', () => console.log('⏸️ Game paused'));
      window.game.events.on('resume', () => console.log('▶️ Game resumed'));
      
      if (window.location.search.includes('debug=1')) {
        console.log('🔧 Debug mode enabled');
        window.debugGameConfig = {
          config: window.game.config,
          renderer: window.game.renderer,
          textures: window.game.textures,
          scale: window.game.scale
        };
      }
      
    } catch (error) {
      console.error('Failed to create Phaser game:', error);
      showErrorFallback('Ошибка инициализации', error.message || 'Не удалось создать игру');
    }
  }

  // ========================================
  // ПАТЧ: ГЛОБАЛЬНАЯ ИНИЦИАЛИЗАЦИЯ SYNC MANAGER
  // ========================================
  
  window.initGlobalSyncManager = async function() {
    try {
      if (!window.progressSyncManager) {
        window.progressSyncManager = new ProgressSyncManager();
        
        window.progressSyncManager.onSyncError = (error) => {
          console.error('🔄 Global sync error:', error);
          
          if (window.showToast) {
            window.showToast('Проблема с синхронизацией данных', 'warning');
          }
        };
        
        window.progressSyncManager.onSyncComplete = (data) => {
          console.log('🔄 Global sync completed');
          
          if (window.game && window.game.scene) {
            const activeScene = window.game.scene.getScenes(true)[0];
            if (activeScene && activeScene.onProgressSynced) {
              activeScene.onProgressSynced(data);
            }
          }
        };
        
        console.log('🔄 Global ProgressSyncManager initialized');
      }
      
    } catch (error) {
      console.error('❌ Failed to initialize global sync manager:', error);
    }
  };

  if (window.VK_BRIDGE_READY) {
    window.initGlobalSyncManager();
  } else {
    window.addEventListener('vk-bridge-ready', () => {
      window.initGlobalSyncManager();
    });
  }

  // ========================================
  // ПАТЧ: TOAST УВЕДОМЛЕНИЯ
  // ========================================
  
  window.showToast = function(message, type = 'info', duration = 3000) {
    const toastContainer = document.getElementById('toast-container') || createToastContainer();
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <div class="toast-content">
        <span class="toast-icon">${getToastIcon(type)}</span>
        <span class="toast-message">${message}</span>
      </div>
    `;
    
    toastContainer.appendChild(toast);
    
    setTimeout(() => toast.classList.add('toast-show'), 100);
    
    setTimeout(() => {
      toast.classList.remove('toast-show');
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }, duration);
  };

  function createToastContainer() {
    const container = document.createElement('div');
    container.id = 'toast-container';
    container.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 10000;
      pointer-events: none;
    `;
    document.body.appendChild(container);
    return container;
  }

  function getToastIcon(type) {
    const icons = {
      info: 'ℹ️',
      success: '✅',
      warning: '⚠️',
      error: '❌'
    };
    return icons[type] || icons.info;
  }

  const toastStyles = document.createElement('style');
  toastStyles.textContent = `
    .toast {
      background: rgba(45, 62, 80, 0.95);
      color: white;
      padding: 12px 16px;
      border-radius: 8px;
      margin-bottom: 10px;
      transform: translateX(100%);
      transition: transform 0.3s ease;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      border-left: 4px solid #3498db;
      pointer-events: auto;
      max-width: 300px;
    }
    
    .toast-show {
      transform: translateX(0);
    }
    
    .toast-success {
      border-left-color: #27ae60;
    }
    
    .toast-warning {
      border-left-color: #f39c12;
    }
    
    .toast-error {
      border-left-color: #e74c3c;
    }
    
    .toast-content {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .toast-icon {
      font-size: 16px;
      flex-shrink: 0;
    }
    
    .toast-message {
      font-size: 14px;
      line-height: 1.4;
    }
  `;
  document.head.appendChild(toastStyles);

  // ========================================
  // ГЛОБАЛЬНАЯ ОБРАБОТКА ОШИБОК
  // ========================================
  
  window.addEventListener('error', (event) => {
    console.error('🚨 JavaScript Error:', {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      error: event.error
    });
    
    if (event.message.includes('Phaser') || 
        event.message.includes('WebGL') ||
        event.message.includes('dependencies')) {
      
      const gameDiv = document.getElementById('game');
      if (gameDiv && !window.game) {
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
            <h2>😔 Ошибка загрузки игры</h2>
            <p>Проверьте подключение к интернету и обновите страницу</p>
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
            ">🔄 Обновить страницу</button>
            <div style="
              margin-top: 20px; 
              font-size: 12px; 
              opacity: 0.7;
              max-width: 400px;
            ">
              Если проблема повторяется, попробуйте открыть игру в другом браузере
            </div>
          </div>
        `;
      }
    }
  });

  if (isMobile) {
    document.addEventListener('touchstart', function(e) {
      if (e.touches.length > 1) {
        e.preventDefault();
      }
    }, { passive: false });
  }

  // ========================================
  // ЗАПУСК ПРИЛОЖЕНИЯ
  // ========================================
  
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

  // ========================================
  // ОТЛАДОЧНЫЕ УТИЛИТЫ
  // ========================================
  
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
        
        await window.VKSafe.storageSet('test_data', JSON.stringify(testData));
        const retrieved = await window.VKSafe.storageGetKeys(['test_data']);
        console.log('Storage test:', { saved: testData, retrieved });
        return retrieved;
      },

      async clearStorage() {
        const keys = ['progress', 'achievements', 'test_data'];
        for (const key of keys) {
          await window.VKSafe.storageSet(key, '');
        }
        console.log('Storage cleared for keys:', keys);
      }
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main);
  } else {
    main();
  }

})();
