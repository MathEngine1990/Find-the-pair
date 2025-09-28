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
  Sync Manager: ${!!window.ProgressSyncManager}
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
    if (document.readyState === 'loading' || !document.body) {
      console.log('DOM not ready, waiting...');
      if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initGame);
        } else {
        setTimeout(initGame, 100);
    }
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
      hasSyncManager: !!window.ProgressSyncManager,
      syncReady: window.SYNC_STATUS.initialized,
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

    // НОВАЯ ПРОВЕРКА: ProgressSyncManager
    if (!window.ProgressSyncManager) {
      console.warn('ProgressSyncManager not loaded - using fallback mode');
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
    
    debugLog('Game configuration', {
      screenWidth: screenWidth,
      screenHeight: screenHeight,
      isPortrait: isPortrait,
      gameWidth: gameWidth,
      gameHeight: gameHeight,
      isMobile: isMobile
    });
    
    const gameConfig = {
      type: Phaser.AUTO,
      parent: gameContainer, // ИСПРАВЛЕНО: Передаем элемент напрямую
      width: gameWidth,      // ИСПРАВЛЕНИЕ: Упрощаем до базовых параметров
      height: gameHeight,
      backgroundColor: '#1d2330',
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: gameWidth,
        height: gameHeight
      },
      render: { 
        antialias: !isMobile, // Отключаем антиалиасинг на мобильных для производительности
        pixelArt: false
      },
      scene: [
        window.PreloadScene,
        window.MenuScene,
        window.GameScene
      ]
    };

    // ИСПРАВЛЕНИЕ: Создаем игру с упрощенной конфигурацией и добавляем postBoot логику после создания
    try {
      console.log('Creating Phaser game...');
      console.log('Game config:', {
        type: 'AUTO',
        parent: 'game container element',
        mobile: isMobile,
        gameSize: `${gameWidth}x${gameHeight}`
      });
      
      window.game = new Phaser.Game(gameConfig);
      
      // Дополнительная проверка успешного создания
      if (!window.game) {
        throw new Error('Game creation failed');
      }
      
      console.log('✅ Game created successfully');
      debugLog('Game created successfully');
      
      // ИСПРАВЛЕНИЕ: Добавляем postBoot логику через событие после создания игры
      window.game.events.once('ready', function() {
        console.log('🎮 Game ready event triggered');
        console.log('📱 Mobile device:', isMobile);
        console.log('🎭 Available scenes:', window.game.scene.scenes.map(s => s.scene.key));
        
        // Скрываем прелоадер
        const preloader = document.getElementById('preloader');
        if (preloader) {
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
        window.game.registry.set('vkUserData', window.VK_USER_DATA);
        window.game.registry.set('vkLaunchParams', window.VK_LAUNCH_PARAMS);
        window.game.registry.set('isVKEnvironment', isVKEnvironment);
        window.game.registry.set('vkBridgeAvailable', window.VKSafe?.isAvailable() || false);
        window.game.registry.set('isMobile', isMobile);
        window.game.registry.set('isIOS', isIOS);
        window.game.registry.set('isAndroid', isAndroid);
        
        // ДОБАВЛЕНО: Передаем данные синхронизации в игру
        window.game.registry.set('progressSyncManager', window.progressSyncManager);
        window.game.registry.set('syncStatus', window.SYNC_STATUS);
        
        // ИСПРАВЛЕНИЕ: Запускаем сцену с минимальной задержкой
        setTimeout(() => {
          try {
            window.game.scene.start('PreloadScene');
            console.log('✅ PreloadScene start command sent');
          } catch (error) {
            console.error('❌ Failed to start PreloadScene:', error);
            try {
              console.log('🔄 Trying to start MenuScene directly...');
              window.game.scene.start('MenuScene', { page: 0 });
            } catch (menuError) {
              console.error('❌ Failed to start MenuScene:', menuError);
              showErrorFallback('Ошибка запуска игры', 'Не удалось загрузить игровые сцены');
            }
          }
        }, 200);
      });
      
      // ИСПРАВЛЕНИЕ: Упрощенные мобильные обработчики событий
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
        
        // Добавляем обработчики для предотвращения зума и скролла ПОСЛЕ создания canvas
        setTimeout(() => {
          if (window.game && window.game.canvas) {
            window.game.canvas.addEventListener('contextmenu', (e) => {
              e.preventDefault();
              return false;
            });
            
            window.game.canvas.addEventListener('touchstart', (e) => {
              if (e.touches.length > 1) {
                e.preventDefault();
              }
            }, { passive: false });
            
            window.game.canvas.addEventListener('gesturestart', (e) => {
              e.preventDefault();
            });
            
            console.log('📱 Mobile touch handlers added to canvas');
          }
        }, 1000);
      }
      
      // Показываем отладочную информацию
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
            syncInitialized: window.SYNC_STATUS.initialized,
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
    },

    // ДОБАВЛЕНО: Утилиты для синхронизации
    getSyncStatus: function() {
      return {
        ...window.SYNC_STATUS,
        managerAvailable: !!window.progressSyncManager
      };
    },

    forceSyncNow: async function() {
      if (!window.progressSyncManager) {
        throw new Error('Sync manager not available');
      }
      return await window.progressSyncManager.forceSync();
    }
  };

  // НОВАЯ ФУНКЦИЯ: Toast уведомления
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
    
    // Анимация появления
    setTimeout(() => toast.classList.add('toast-show'), 100);
    
    // Автоматическое удаление
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

  // Добавляем стили для toast'ов
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

    // ДОБАВЛЕНО: Инициализация ProgressSyncManager перед VK
    console.log('🔄 Initializing ProgressSyncManager...');
    const syncInitialized = await initGlobalSyncManager();
    if (syncInitialized) {
      console.log('✅ ProgressSyncManager ready');
    } else {
      console.warn('⚠️ ProgressSyncManager failed to initialize');
    }

    if (isVKEnvironment) {
      try {
        // Загружаем VK Bridge с учетом мобильных особенностей
        await loadVKBridge();
        debugLog('VK Bridge loaded successfully');
        
        // Инициализируем VK с увеличенным таймаутом для мобильных
        const vkInitialized = await initVKBridge();
        
        if (!vkInitialized) {
          console.warn('VK initialization failed, starting in standalone mode');
        } else {
          // ДОБАВЛЕНО: Инициализация ProgressSyncManager после готовности VK
          if (!syncInitialized && window.VK_BRIDGE_READY) {
            console.log('🔄 Retrying ProgressSyncManager after VK ready...');
            await initGlobalSyncManager();
          }
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
    
    // ДОБАВЛЕНО: Принудительная синхронизация перед закрытием
    if (window.progressSyncManager && window.SYNC_STATUS.initialized) {
      try {
        // Синхронизируем синхронно (может не успеть, но попытаемся)
        window.progressSyncManager.forceSync();
      } catch (error) {
        debugLog('Error during unload sync:', error);
      }
    }
    
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

      // ДОБАВЛЕНО: Диагностика синхронизации
      showSyncInfo() {
        console.group('🔄 Sync Diagnostics');
        console.log('Sync Manager Available:', !!window.progressSyncManager);
        console.log('Sync Status:', window.SYNC_STATUS);
        
        if (window.progressSyncManager) {
          console.log('Sync Manager Status:', window.progressSyncManager.getSyncStatus());
          console.log('VK Available for Sync:', window.progressSyncManager.isVKAvailable());
        }
        
        // Проверяем локальные данные
        try {
          const localData = localStorage.getItem('findpair_progress');
          console.log('Local Progress Size:', localData ? `${localData.length} chars` : 'None');
          
          if (localData) {
            const parsed = JSON.parse(localData);
            console.log('Local Progress Structure:', {
              hasLevels: !!parsed.levels,
              hasStats: !!parsed.stats,
              hasAchievements: !!parsed.achievements,
              version: parsed.version,
              timestamp: parsed.timestamp ? new Date(parsed.timestamp).toLocaleString() : 'None'
            });
          }
        } catch (error) {
          console.log('Local Data Error:', error.message);
        }
        
        console.groupEnd();
      },

      // Тест синхронизации
      async testSync() {
        if (!window.progressSyncManager) {
          console.error('ProgressSyncManager not available');
          return;
        }

        console.group('🧪 Sync Test');
        
        try {
          // Тест загрузки
          console.log('Testing load...');
          const data = await window.progressSyncManager.loadProgress();
          console.log('Load result:', data);
          
          // Тест сохранения
          console.log('Testing save...');
          const testData = {
            ...data,
            testTimestamp: Date.now(),
            testValue: Math.random()
          };
          
          await window.progressSyncManager.saveProgress(testData, true);
          console.log('Save completed');
          
          // Тест повторной загрузки
          console.log('Testing reload...');
          const reloaded = await window.progressSyncManager.loadProgress();
          console.log('Reload result:', reloaded);
          
          console.log('✅ Sync test completed successfully');
          
        } catch (error) {
          console.error('❌ Sync test failed:', error);
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
        
        // Тест синхронизации (если доступна)
        if (window.progressSyncManager) {
          const syncStart = performance.now();
          try {
            await window.progressSyncManager.forceSync();
            const syncTime = performance.now() - syncStart;
            console.log('Sync Time:', `${syncTime.toFixed(2)}ms`);
          } catch (error) {
            console.log('Sync Test Failed:', error.message);
          }
        }
        
        console.groupEnd();
      },

      // Очистка всех данных для отладки
      clearAllData() {
        console.log('🗑️ Clearing all game data...');
        
        // Очищаем localStorage
        const keysToRemove = [
          'findpair_progress',
          'findpair_achievements', 
          'acceptedAgreement',
          'agreementVersion',
          'agreementAcceptedAt',
          'vk_agreement_shown',
          'vk_user_cache',
          'device_id'
        ];
        
        keysToRemove.forEach(key => {
          localStorage.removeItem(key);
        });
        
        // Очищаем через ProgressSyncManager если доступен
        if (window.progressSyncManager) {
          window.progressSyncManager.clearAllData().then(() => {
            console.log('✅ All data cleared via sync manager');
          }).catch(error => {
            console.error('❌ Failed to clear sync data:', error);
          });
        }
        
        console.log('✅ Local data cleared');
        console.log('🔄 Reload page to see changes: location.reload()');
      }
    };

    console.log('🛠️ VK Debug utilities loaded:');
    console.log('📞 VKUtils.testVKMethod(method, params) - test VK methods');
    console.log('👤 VKUtils.getUserInfo() - get user data');
    console.log('💾 VKUtils.testStorage() - test storage');
    console.log('📊 VKUtils.showVKData() - show VK data');
    console.log('📱 VKUtils.showMobileInfo() - show mobile diagnostics');
    console.log('🔄 VKUtils.showSyncInfo() - show sync diagnostics');
    console.log('🧪 VKUtils.testSync() - test sync functionality');
    console.log('⚡ VKUtils.performanceTest() - test mobile performance');
    console.log('🗑️ VKUtils.clearAllData() - clear all game data');
  }

})();

// ДОБАВЛЕНО: События для синхронизации
window.addEventListener('progressSynced', (event) => {
  console.log('🔄 Progress synced globally:', event.detail);
});

window.addEventListener('progressUpdated', (event) => {
  console.log('📊 Progress updated globally:', event.detail);
});

window.addEventListener('syncError', (event) => {
  console.error('❌ Global sync error:', event.detail);
});

// ДОБАВИТЬ В САМЫЙ КОНЕЦ main.js (после всех функций)

// Debug commands for agreement testing (всегда доступны)
window.DebugAgreement = {
  reset: function() {
    localStorage.removeItem('acceptedAgreement');
    localStorage.removeItem('agreementVersion');
    localStorage.removeItem('agreementAcceptedAt');
    localStorage.removeItem('vk_agreement_shown');
    localStorage.removeItem('firstLaunchShown');
    console.log('✅ Agreement data cleared');
    console.log('📄 Reload page: location.reload()');
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
    if (window.game && window.game.scene) {
      const menuScene = window.game.scene.getScene('MenuScene');
      if (menuScene && menuScene.showUserAgreement) {
        menuScene.showUserAgreement();
      } else if (menuScene && menuScene.showAgeRating) {
        menuScene.showAgeRating();
      } else {
        console.error('MenuScene not ready or methods missing');
      }
    } else {
      console.error('Game not initialized');
    }
  },

  accept: function() {
    localStorage.setItem('acceptedAgreement', 'true');
    localStorage.setItem('agreementVersion', '2025-09-13');
    localStorage.setItem('agreementAcceptedAt', new Date().toISOString());
    console.log('✅ Agreement accepted');
  }
};

// ДОБАВЛЕНО: Debug команды для синхронизации
window.DebugSync = {
  status: function() {
    console.table(window.SYNC_STATUS);
    
    if (window.progressSyncManager) {
      console.log('Manager Status:', window.progressSyncManager.getSyncStatus());
    }
    
    return {
      globalStatus: window.SYNC_STATUS,
      managerStatus: window.progressSyncManager?.getSyncStatus()
    };
  },

  forceSync: async function() {
    if (!window.progressSyncManager) {
      console.error('ProgressSyncManager not available');
      return;
    }
    
    try {
      console.log('🔄 Forcing sync...');
      const result = await window.progressSyncManager.forceSync();
      console.log('✅ Force sync result:', result);
      return result;
    } catch (error) {
      console.error('❌ Force sync failed:', error);
      throw error;
    }
  },

  loadData: async function() {
    if (!window.progressSyncManager) {
      console.error('ProgressSyncManager not available');
      return;
    }
    
    try {
      const data = await window.progressSyncManager.loadProgress();
      console.log('📊 Loaded data:', data);
      return data;
    } catch (error) {
      console.error('❌ Load failed:', error);
      throw error;
    }
  },

  saveTestData: async function() {
    if (!window.progressSyncManager) {
      console.error('ProgressSyncManager not available');
      return;
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
      achievements: {
        first_win: true,
        perfect_game: true
      },
      version: '1.0',
      timestamp: Date.now()
    };
    
    try {
      console.log('💾 Saving test data...');
      await window.progressSyncManager.saveProgress(testData, true);
      console.log('✅ Test data saved');
      return testData;
    } catch (error) {
      console.error('❌ Save failed:', error);
      throw error;
    }
  },

  clearData: async function() {
    if (!window.progressSyncManager) {
      console.error('ProgressSyncManager not available');
      return;
    }
    
    try {
      console.log('🗑️ Clearing sync data...');
      await window.progressSyncManager.clearAllData();
      console.log('✅ Sync data cleared');
    } catch (error) {
      console.error('❌ Clear failed:', error);
      throw error;
    }
  },

  reinit: async function() {
    try {
      console.log('🔄 Reinitializing sync manager...');
      
      // Создаем новый экземпляр
      window.progressSyncManager = new ProgressSyncManager();
      window.SYNC_STATUS.initialized = true;
      
      console.log('✅ Sync manager reinitialized');
      return true;
    } catch (error) {
      console.error('❌ Reinit failed:', error);
      throw error;
    }
  }
};

// Автоматически показываем команды в консоли
console.log(`
🔧 DEBUG COMMANDS доступны:

=== AGREEMENT ===
DebugAgreement.reset()  - сбросить соглашение
DebugAgreement.status() - проверить статус  
DebugAgreement.show()   - показать соглашение
DebugAgreement.accept() - принять соглашение

=== SYNC ===
DebugSync.status()      - статус синхронизации
DebugSync.forceSync()   - принудительная синхронизация
DebugSync.loadData()    - загрузить данные
DebugSync.saveTestData()- сохранить тестовые данные
DebugSync.clearData()   - очистить данные синхронизации
DebugSync.reinit()      - переинициализировать менеджер

Пример: DebugSync.status(); DebugSync.forceSync();
`);//---main.js - ПОЛНАЯ ВЕРСИЯ С ИНТЕГРАЦИЕЙ ProgressSyncManager

(function() {
  'use strict';
  
  // Глобальные переменные для VK
  window.VK_USER_DATA = null;
  window.VK_LAUNCH_PARAMS = null;
  window.VK_BRIDGE_READY = false;
  window.VK_DEBUG = window.location.search.includes('debug=1') || 
                   window.location.hostname === 'localhost';
  
  // ДОБАВЛЕНО: Глобальные переменные для синхронизации
  window.progressSyncManager = null;
  window.SYNC_STATUS = {
    initialized: false,
    lastSyncTime: 0,
    syncInProgress: false,
    lastError: null
  };
  
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
      <div>Sync: ${info.syncInitialized ? 'Ready' : 'Not ready'}</div>
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
          // ДОБАВЛЕНО: Обновляем статус синхронизации
          if (window.progressSyncManager) {
            window.SYNC_STATUS.lastSyncTime = Date.now();
          }
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
    
    // ДОБАВЛЕНО: Принудительная синхронизация при скрытии приложения
    if (window.progressSyncManager && window.SYNC_STATUS.initialized) {
      try {
        window.progressSyncManager.forceSync().catch(error => {
          debugLog('Background sync failed:', error);
        });
      } catch (error) {
        debugLog('Error during background sync:', error);
      }
    }
    
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
    
    // ДОБАВЛЕНО: Синхронизация при возврате в приложение
    if (window.progressSyncManager && window.SYNC_STATUS.initialized) {
      setTimeout(() => {
        try {
          window.progressSyncManager.forceSync().catch(error => {
            debugLog('Restore sync failed:', error);
          });
        } catch (error) {
          debugLog('Error during restore sync:', error);
        }
      }, 1000);
    }
    
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

  // НОВАЯ ФУНКЦИЯ: Инициализация глобального ProgressSyncManager
  async function initGlobalSyncManager() {
    try {
      // Проверяем доступность ProgressSyncManager
      if (!window.ProgressSyncManager) {
        console.warn('ProgressSyncManager class not available');
        return false;
      }
      
      console.log('Initializing global ProgressSyncManager...');
      
      // Создаем глобальный экземпляр
      window.progressSyncManager = new ProgressSyncManager();
      
      // Настраиваем глобальные обработчики событий
      window.progressSyncManager.onSyncStart = () => {
        window.SYNC_STATUS.syncInProgress = true;
        debugLog('Global sync started');
        
        // Показываем уведомление пользователю если нужно
        if (window.showToast) {
          window.showToast('Синхронизация данных...', 'info', 1500);
        }
      };
      
      window.progressSyncManager.onSyncComplete = (data) => {
        window.SYNC_STATUS.syncInProgress = false;
        window.SYNC_STATUS.lastSyncTime = Date.now();
        window.SYNC_STATUS.lastError = null;
        
        console.log('Global sync completed successfully');
        debugLog('Global sync completed', data);
        
        // Уведомляем активные сцены об обновлении данных
        if (window.game && window.game.scene) {
          const activeScene = window.game.scene.getScenes(true)[0];
          if (activeScene && activeScene.onProgressSynced) {
            activeScene.onProgressSynced(data);
          }
        }
        
        // Показываем успешное уведомление
        if (window.showToast) {
          window.showToast('Данные синхронизированы', 'success');
        }
        
        // Запускаем событие для всех слушателей
        window.dispatchEvent(new CustomEvent('progressSynced', { detail: data }));
      };
      
      window.progressSyncManager.onSyncError = (error) => {
        window.SYNC_STATUS.syncInProgress = false;
        window.SYNC_STATUS.lastError = error;
        
        console.error('Global sync error:', error);
        debugLog('Global sync error', error);
        
        // Показываем уведомление об ошибке пользователю
        if (window.showToast) {
          window.showToast('Ошибка синхронизации', 'warning');
        }
        
        // Запускаем событие об ошибке
        window.dispatchEvent(new CustomEvent('syncError', { detail: error }));
      };
      
      window.progressSyncManager.onProgressUpdate = (progressData) => {
        debugLog('Progress updated globally', progressData);
        
        // Уведомляем активные сцены
        if (window.game && window.game.scene) {
          const scenes = window.game.scene.getScenes(true);
          scenes.forEach(scene => {
            if (scene.onProgressUpdate) {
              scene.onProgressUpdate(progressData);
            }
          });
        }
        
        // Запускаем событие для всех слушателей
        window.dispatchEvent(new CustomEvent('progressUpdated', { detail: progressData }));
      };
      
      // Отмечаем что инициализация завершена
      window.SYNC_STATUS.initialized = true;
      
      console.log('Global ProgressSyncManager initialized successfully');
      debugLog('Sync manager ready', window.progressSyncManager.getSyncStatus());
      
      return true;
      
    } catch (error) {
      console.error('Failed to initialize global sync manager:', error);
      window.SYNC_STATUS.lastError = error;
      return false;
    }
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
  DPR
