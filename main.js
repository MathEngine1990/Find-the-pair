//---main.js - ФИНАЛЬНАЯ ВЕРСИЯ с интеграцией единых менеджеров

(function() {
  'use strict';
  
  // Глобальные переменные для VK
  window.VK_USER_DATA = null;
  window.VK_LAUNCH_PARAMS = null;
  window.VK_BRIDGE_READY = false;
  window.VK_DEBUG = window.location.search.includes('debug=1') || 
                   window.location.hostname === 'localhost';
  
  // Детекция мобильных устройств
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isAndroid = /Android/.test(navigator.userAgent);
  
  // Отладочные функции
  function debugLog(message, data = null) {
    if (window.VK_DEBUG) {
      console.log(`[Main] ${message}`, data || '');
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
      <div style="font-weight: bold; margin-bottom: 5px;">Debug Info:</div>
      <div>Environment: ${info.isVK ? 'VK Mini App' : 'Standalone'}</div>
      <div>Device: ${info.isMobile ? 'Mobile' : 'Desktop'}</div>
      <div>VK Manager: ${info.vkManagerReady ? 'Ready' : 'Not ready'}</div>
      <div>Progress Manager: ${info.progressManagerReady ? 'Ready' : 'Not ready'}</div>
      <div>Game: ${info.gameCreated ? 'Created' : 'Not created'}</div>
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
  const isVKEnvironment = /vk_(app_id|user_id|platform)/i.test(window.location.search) || 
                         window.location.hostname.includes('vk-apps.com') ||
                         window.location.hostname.includes('vk.com') ||
                         window.parent !== window;
  
  debugLog('Environment detection', { 
    isVK: isVKEnvironment,
    isMobile: isMobile,
    search: window.location.search,
    hostname: window.location.hostname
  });

  // ИСПРАВЛЕНИЕ: Создаем единую обертку используя VKManager
  window.VKSafe = {
    async send(method, params = {}) {
      if (!window.VKManager?.isAvailable()) {
        throw new Error('VK Manager not available');
      }
      
      return await window.VKManager.send(method, params);
    },
    
    isAvailable() {
      return window.VKManager?.isAvailable() || false;
    },
    
    supports(method) {
      return window.VKManager?.isSupported(method) || false;
    }
  };

  // КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Единая инициализация приложения
  async function initializeApp() {
    debugLog('Starting unified app initialization...');

    // ШАГ 1: Ждем готовности DOM
    if (document.readyState === 'loading' || !document.body) {
      debugLog('Waiting for DOM...');
      await new Promise(resolve => {
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', resolve);
        } else {
          const checkBody = () => {
            if (document.body) {
              resolve();
            } else {
              setTimeout(checkBody, isMobile ? 20 : 10);
            }
          };
          checkBody();
        }
      });
    }

    debugLog('DOM ready, proceeding with managers initialization...');

    // ШАГ 2: Инициализируем VKManager ПЕРВЫМ (если VK окружение)
    if (isVKEnvironment) {
      try {
        debugLog('Initializing VK Manager...');
        
        // Проверяем существование VKManager
        if (!window.VKManager) {
          console.error('VKManager not found! Make sure vk-manager.js is loaded');
          throw new Error('VKManager not loaded');
        }
        
        const vkReady = await window.VKManager.init();
        
        if (vkReady) {
          // Получаем данные из VKManager
          window.VK_USER_DATA = window.VKManager.getUserData();
          window.VK_LAUNCH_PARAMS = window.VKManager.getLaunchParams();
          window.VK_BRIDGE_READY = true;
          
          debugLog('VK Manager initialized successfully', {
            userData: !!window.VK_USER_DATA,
            launchParams: !!window.VK_LAUNCH_PARAMS
          });
        } else {
          debugLog('VK Manager initialization failed, continuing in standalone mode');
        }
        
      } catch (error) {
        console.error('VK Manager initialization error:', error);
        debugLog('VK setup failed, falling back to standalone');
      }
    } else {
      debugLog('Not VK environment, skipping VK Manager');
    }

    // ШАГ 3: Инициализируем GameProgressManager
    debugLog('Initializing GameProgressManager...');
    
    // Проверяем существование GameProgressManager
    if (!window.GameProgressManager) {
      console.error('GameProgressManager not found! Make sure game-progress-manager.js is loaded');
      // Создаем заглушку для совместимости
      window.GameProgressManager = {
        isLoaded: false,
        init: () => Promise.resolve(),
        save: () => Promise.resolve(),
        load: () => Promise.resolve(),
        getAllProgress: () => ({}),
        getStats: () => ({ gamesPlayed: 0, totalTime: 0 })
      };
    }
    
    try {
      await window.GameProgressManager.init();
      debugLog('GameProgressManager ready');
    } catch (error) {
      console.error('GameProgressManager initialization failed:', error);
      debugLog('GameProgressManager failed, using fallback');
    }

    // ШАГ 4: Стабилизационная задержка для мобильных
    if (isMobile) {
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    // ШАГ 5: Создаем игру
    await createGame();
  }

  // ИСПРАВЛЕННАЯ функция создания игры
  async function createGame() {
    debugLog('Creating game with unified managers...');
    
    // Проверяем зависимости
    if (!window.Phaser) {
      throw new Error('Phaser library not loaded');
    }

    if (!window.ALL_CARD_KEYS || !window.LEVELS) {
      throw new Error('Game data not loaded');
    }

    if (!window.PreloadScene || !window.MenuScene || !window.GameScene) {
      throw new Error('Game scenes not loaded');
    }

    // Создаем или находим игровой контейнер
    let gameContainer = document.getElementById('game');
    if (!gameContainer) {
      debugLog('Creating game container...');
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
        ${isMobile ? `
          touch-action: none;
          -webkit-touch-callout: none;
          -webkit-user-select: none;
          -webkit-tap-highlight-color: transparent;
          overflow: hidden;
        ` : ''}
      `;
      
      document.body.appendChild(gameContainer);
      
      // Мобильные стили для body
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
    }

    // Мобильно-адаптивные размеры
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    const isPortrait = screenHeight > screenWidth;
    
    let gameWidth, gameHeight;
    
    if (isMobile) {
      if (isPortrait) {
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

    debugLog('Game configuration', {
      screenSize: `${screenWidth}x${screenHeight}`,
      gameSize: `${gameWidth}x${gameHeight}`,
      isPortrait,
      isMobile
    });
    
    const gameConfig = {
      type: Phaser.AUTO,
      parent: gameContainer,
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
        antialias: !isMobile,
        pixelArt: false
      },
      scene: [
        window.PreloadScene,
        window.MenuScene,
        window.GameScene
      ]
    };

    try {
      debugLog('Creating Phaser game instance...');
      window.game = new Phaser.Game(gameConfig);
      
      if (!window.game) {
        throw new Error('Game creation failed');
      }
      
      debugLog('Game created successfully');
      
      // Обработчик готовности игры
      window.game.events.once('ready', function() {
        debugLog('Game ready event triggered');
        
        // ИСПРАВЛЕНИЕ: Передаем все менеджеры в игру
        window.game.registry.set('vkUserData', window.VK_USER_DATA);
        window.game.registry.set('vkLaunchParams', window.VK_LAUNCH_PARAMS);
        window.game.registry.set('isVKEnvironment', isVKEnvironment);
        window.game.registry.set('vkBridgeAvailable', window.VKManager?.isAvailable() || false);
        window.game.registry.set('isMobile', isMobile);
        window.game.registry.set('isIOS', isIOS);
        window.game.registry.set('isAndroid', isAndroid);
        
        // КЛЮЧЕВОЕ ИСПРАВЛЕНИЕ: Передаем единые менеджеры
        window.game.registry.set('vkManager', window.VKManager);
        window.game.registry.set('progressManager', window.GameProgressManager);
        window.game.registry.set('gameProgressManager', window.GameProgressManager); // Для совместимости
        
        // Скрываем прелоадер
        const preloader = document.getElementById('preloader');
        if (preloader) {
          preloader.style.opacity = '0';
          setTimeout(() => {
            preloader.style.display = 'none';
            document.body.classList.add('game-loaded');
          }, 500);
        }
        
        // Запускаем сцену
        setTimeout(() => {
          try {
            window.game.scene.start('PreloadScene');
            debugLog('PreloadScene started');
          } catch (error) {
            console.error('Failed to start PreloadScene:', error);
            try {
              window.game.scene.start('MenuScene', { page: 0 });
            } catch (menuError) {
              console.error('Failed to start MenuScene:', menuError);
              showErrorFallback('Ошибка запуска игры');
            }
          }
        }, 200);
      });
      
      // Мобильные обработчики событий
      if (isMobile) {
        window.addEventListener('orientationchange', () => {
          setTimeout(() => {
            if (window.game?.scale) {
              window.game.scale.refresh();
              debugLog('Orientation changed, scale refreshed');
            }
          }, 500);
        });
        
        // Обработчики касаний для canvas (после создания)
        setTimeout(() => {
          if (window.game?.canvas) {
            window.game.canvas.addEventListener('contextmenu', (e) => {
              e.preventDefault();
              return false;
            });
            
            window.game.canvas.addEventListener('touchstart', (e) => {
              if (e.touches.length > 1) {
                e.preventDefault();
              }
            }, { passive: false });
            
            debugLog('Mobile touch handlers added');
          }
        }, 1000);
      }
      
    } catch (error) {
      console.error('Failed to create game:', error);
      showErrorFallback('Не удалось создать игру', error.message);
    }
  }

  // ИСПРАВЛЕННЫЕ публичные методы - теперь все идет через VKManager
  window.VKHelpers = {
    shareResult: function(score, level) {
      if (!window.VKManager?.isAvailable()) {
        return Promise.reject('VK Manager not available');
      }

      return window.VKManager.shareResult(score, level);
    },

    showAd: function() {
      if (!window.VKManager?.isAvailable()) {
        return Promise.reject('VK Manager not available');
      }

      return window.VKManager.showAd();
    },

    // ИСПРАВЛЕНИЕ: Используем методы VKManager для storage
    setStorageData: function(key, value) {
      if (!window.VKManager?.isAvailable()) {
        return Promise.reject('VK Manager not available');
      }

      return window.VKManager.setStorageData(key, value);
    },

    getStorageData: function(keys) {
      if (!window.VKManager?.isAvailable()) {
        return Promise.reject('VK Manager not available');
      }

      return window.VKManager.getStorageData(keys);
    },

    isSupported: function(method) {
      return window.VKManager?.isSupported(method) || false;
    },

    isMobileDevice: function() {
      return isMobile;
    },

    getDeviceInfo: function() {
      return {
        isMobile,
        isIOS,
        isAndroid,
        isPortrait: window.innerHeight > window.innerWidth,
        touchSupport: 'ontouchstart' in window,
        screen: `${screen.width}x${screen.height}`,
        viewport: `${window.innerWidth}x${window.innerHeight}`,
        dpr: window.devicePixelRatio || 1
      };
    }
  };

  // Обработчики событий приложения
  function handleAppHide() {
    debugLog('App hidden - pausing and saving');
    
    if (window.game?.scene) {
      try {
        const activeScene = window.game.scene.getActiveScene();
        if (activeScene?.scene?.key === 'GameScene') {
          activeScene.canClick = false;
          
          if (activeScene.gameMetrics?.startTime) {
            activeScene.pausedAt = Date.now();
            
            // ИСПРАВЛЕНИЕ: Сохраняем через GameProgressManager
            if (window.GameProgressManager?.isLoaded) {
              window.GameProgressManager.save(true);
            }
          }
        }
      } catch (error) {
        debugLog('Error in handleAppHide:', error);
      }
    }
  }

  function handleAppRestore() {
    debugLog('App restored - resuming');
    
    if (window.game?.scene) {
      try {
        const activeScene = window.game.scene.getActiveScene();
        if (activeScene?.scene?.key === 'GameScene') {
          
          const resumeDelay = isMobile ? 500 : 300;
          setTimeout(() => {
            if (activeScene.pausedAt && activeScene.gameMetrics) {
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
    }
  }

  // Функция показа ошибки
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
        <h2 style="color: #ff6b6b; margin-bottom: 15px;">${message}</h2>
        ${details ? `<p style="color: #ccc; margin: 10px 0; max-width: 90%;">${details}</p>` : ''}
        <p style="color: #ccc; margin-bottom: 20px;">Проверьте подключение к интернету и попробуйте снова</p>
        <button onclick="location.reload()" style="
          padding: 12px 24px; 
          font-size: 16px; 
          background: #3498db; 
          color: white; 
          border: none; 
          border-radius: 8px; 
          cursor: pointer;
          font-weight: bold;
        ">Перезагрузить</button>
      </div>
    `;
  }

  // Глобальные обработчики
  window.addEventListener('beforeunload', () => {
    debugLog('Page unloading...');
    
    // Сохраняем прогресс через GameProgressManager
    if (window.GameProgressManager?.isLoaded) {
      window.GameProgressManager.save(true);
    }
    
    // Очищаем игру
    if (window.game) {
      try {
        window.game.destroy(true);
      } catch (error) {
        debugLog('Error destroying game:', error);
      }
    }
  });

  // Обработчик видимости
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      handleAppHide();
    } else {
      handleAppRestore();
    }
  });

  // ИСПРАВЛЕНИЕ: Отладочные утилиты используют единые менеджеры
  if (window.VK_DEBUG) {
    window.VKUtils = {
      async testVKMethod(method, params = {}) {
        if (!window.VKManager?.isAvailable()) {
          console.error('VK Manager not available');
          return null;
        }
        
        try {
          const result = await window.VKManager.send(method, params);
          console.log(`${method} success:`, result);
          return result;
        } catch (error) {
          console.error(`${method} failed:`, error);
          return null;
        }
      },

      async getUserInfo() {
        return window.VKManager?.getUserData() || null;
      },

      async testStorage() {
        const testData = { 
          test: 'value', 
          timestamp: Date.now(),
          device: isMobile ? 'mobile' : 'desktop'
        };
        
        console.log('Testing unified storage...');
        
        if (!window.VKManager?.isAvailable()) {
          console.log('VK not available, testing GameProgressManager...');
          
          if (window.GameProgressManager?.isLoaded) {
            window.GameProgressManager.setSetting('test_key', testData);
            const loaded = window.GameProgressManager.getSetting('test_key');
            
            console.log('GameProgressManager test:', loaded);
            return loaded;
          } else {
            console.log('GameProgressManager not ready');
            return null;
          }
        }
        
        try {
          await window.VKManager.setStorageData('test_unified', testData);
          const result = await window.VKManager.getStorageData(['test_unified']);
          
          if (result.keys?.[0]) {
            const loaded = JSON.parse(result.keys[0].value);
            console.log('Unified storage test successful:', loaded);
            return loaded;
          }
          
        } catch (error) {
          console.error('Storage test failed:', error);
        }
        
        return null;
      },

      showVKData() {
        console.group('VK Data');
        console.log('VK Manager Available:', window.VKManager?.isAvailable());
        console.log('Game Progress Manager:', window.GameProgressManager?.isLoaded);
        console.log('User Data:', window.VK_USER_DATA);
        console.log('Launch Params:', window.VK_LAUNCH_PARAMS);
        console.log('Environment:', isVKEnvironment);
        console.groupEnd();
      },

      showProgress() {
        if (window.GameProgressManager?.isLoaded) {
          console.group('Game Progress');
          console.log('Stats:', window.GameProgressManager.getStats());
          console.log('Progress:', window.GameProgressManager.getAllProgress());
          console.log('Achievements:', window.GameProgressManager.getAchievements());
          if (window.GameProgressManager.getTotalStars) {
            console.log('Total Stars:', window.GameProgressManager.getTotalStars());
          }
          if (window.GameProgressManager.getCompletionPercentage) {
            console.log('Completion:', window.GameProgressManager.getCompletionPercentage() + '%');
          }
          console.groupEnd();
        } else {
          console.log('GameProgressManager not loaded');
        }
      },

      showMobileInfo() {
        console.group('Mobile Diagnostics');
        console.log('Is Mobile:', isMobile);
        console.log('Is iOS:', isIOS);
        console.log('Is Android:', isAndroid);
        console.log('Touch Support:', 'ontouchstart' in window);
        console.log('Screen Size:', `${screen.width}x${screen.height}`);
        console.log('Viewport Size:', `${window.innerWidth}x${window.innerHeight}`);
        console.log('Device Pixel Ratio:', window.devicePixelRatio || 1);
        console.log('Orientation:', window.innerHeight > window.innerWidth ? 'Portrait' : 'Landscape');
        
        if (window.game) {
          console.log('Game Canvas:', `${window.game.canvas.width}x${window.game.canvas.height}`);
          console.log('Game Scale:', `${window.game.scale.width}x${window.game.scale.height}`);
        }
        console.groupEnd();
      }
    };

    console.log('Debug utilities loaded:');
    console.log('VKUtils.testVKMethod(method, params) - test VK methods');
    console.log('VKUtils.getUserInfo() - get user data');
    console.log('VKUtils.testStorage() - test unified storage');
    console.log('VKUtils.showVKData() - show VK data');
    console.log('VKUtils.showProgress() - show game progress');
    console.log('VKUtils.showMobileInfo() - show mobile info');
  }

  // ГЛАВНЫЙ ЗАПУСК - теперь все через единые менеджеры
  initializeApp().catch(error => {
    console.error('Application startup failed:', error);
    showErrorFallback('Ошибка запуска приложения', error.message);
  });

})();

// Debug commands для тестирования соглашения (всегда доступны)
window.DebugAgreement = {
  reset: function() {
    localStorage.removeItem('acceptedAgreement');
    localStorage.removeItem('agreementVersion');
    localStorage.removeItem('agreementAcceptedAt');
    localStorage.removeItem('vk_agreement_shown');
    localStorage.removeItem('firstLaunchShown');
    console.log('Agreement data cleared');
    console.log('Reload page: location.reload()');
  },

  status: function() {
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

  show: function() {
    if (window.game?.scene) {
      const menuScene = window.game.scene.getScene('MenuScene');
      if (menuScene && menuScene.showUserAgreement) {
        menuScene.showUserAgreement();
      } else {
        console.error('MenuScene not ready or method missing');
      }
    } else {
      console.error('Game not initialized');
    }
  },

  accept: function() {
    localStorage.setItem('acceptedAgreement', 'true');
    localStorage.setItem('agreementVersion', '2025-09-13');
    localStorage.setItem('agreementAcceptedAt', new Date().toISOString());
    console.log('Agreement accepted');
  }
};

// Показываем доступные команды
console.log(`
DEBUG COMMANDS:

DebugAgreement.reset()  - сбросить соглашение
DebugAgreement.status() - проверить статус  
DebugAgreement.show()   - показать соглашение
DebugAgreement.accept() - принять соглашение

Пример: DebugAgreement.reset(); location.reload();
`);
