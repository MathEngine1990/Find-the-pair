//---main.js - ИСПРАВЛЕННАЯ ВЕРСИЯ с единым API синхронизации

(function() {
  'use strict';
  
  // Глобальные переменные для VK
  window.VK_USER_DATA = null;
  window.VK_LAUNCH_PARAMS = null;
  window.VK_BRIDGE_READY = false;
  window.VK_DEBUG = window.location.search.includes('debug=1') || 
                   window.location.hostname === 'localhost';
  
  // ИСПРАВЛЕНИЕ: Унифицированные ключи хранения
  window.STORAGE_KEYS = {
    PROGRESS: 'findpair_progress_v2',
    ACHIEVEMENTS: 'findpair_achievements_v2', 
    SETTINGS: 'findpair_settings_v2',
    STATS: 'findpair_stats_v2'
  };
  
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
      <div>Sync Status: ${info.syncStatus}</div>
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

  // КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Единый VK API с retry логикой
  window.VKUnified = {
    _retryCount: 0,
    _maxRetries: 3,
    
    async _retryOperation(operation, operationName) {
      for (let attempt = 1; attempt <= this._maxRetries; attempt++) {
        try {
          return await operation();
        } catch (error) {
          debugLog(`${operationName} attempt ${attempt} failed:`, error);
          
          if (attempt === this._maxRetries) {
            throw new Error(`${operationName} failed after ${this._maxRetries} attempts: ${error.message}`);
          }
          
          // Exponential backoff
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    },

    async getStorage(keys) {
      if (!this.isReady()) {
        throw new Error('VK Bridge not ready');
      }
      
      return await this._retryOperation(async () => {
        const result = await window.VKManager.send('VKWebAppStorageGet', {
          keys: Array.isArray(keys) ? keys : [keys]
        });
        return result;
      }, 'getStorage');
    },

    async setStorage(key, value) {
      if (!this.isReady()) {
        throw new Error('VK Bridge not ready');
      }
      
      const data = typeof value === 'string' ? value : JSON.stringify(value);
      
      return await this._retryOperation(async () => {
        return await window.VKManager.send('VKWebAppStorageSet', { 
          key, 
          value: data 
        });
      }, 'setStorage');
    },

    isReady() {
      return window.VKManager?.isAvailable() && window.VK_BRIDGE_READY;
    },

    async sync() {
      if (!this.isReady()) {
        debugLog('VK not ready, skipping sync');
        return false;
      }

      try {
        return await window.ProgressSyncManager.syncWithVK();
      } catch (error) {
        console.warn('VK sync failed:', error);
        return false;
      }
    }
  };

  // ИСПРАВЛЕНИЕ: Создаем единую обертку используя VKUnified
  window.VKSafe = {
    async send(method, params = {}) {
      if (method === 'VKWebAppStorageGet') {
        return await window.VKUnified.getStorage(params.keys);
      } else if (method === 'VKWebAppStorageSet') {
        return await window.VKUnified.setStorage(params.key, params.value);
      } else if (!window.VKManager?.isAvailable()) {
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

  // НОВОЕ: Менеджер синхронизации прогресса
  window.ProgressSyncManager = {
    _isOnline: navigator.onLine,
    _syncQueue: [],
    _lastSyncTime: 0,
    _syncCooldown: 5000, // 5 секунд между синхронизациями

    init() {
      // Слушаем события сети
      window.addEventListener('online', () => {
        this._isOnline = true;
        debugLog('Network online, processing sync queue');
        this._processSyncQueue();
      });

      window.addEventListener('offline', () => {
        this._isOnline = false;
        debugLog('Network offline, queuing operations');
      });

      // Миграция старых ключей
      this._migrateOldStorage();
    },

    _migrateOldStorage() {
      const migrations = [
        { old: 'findpair_progress', new: window.STORAGE_KEYS.PROGRESS },
        { old: 'findpair_achievements', new: window.STORAGE_KEYS.ACHIEVEMENTS }
      ];
      
      migrations.forEach(({ old, new: newKey }) => {
        try {
          const oldData = localStorage.getItem(old);
          if (oldData && !localStorage.getItem(newKey)) {
            localStorage.setItem(newKey, oldData);
            localStorage.removeItem(old);
            debugLog(`Migrated ${old} → ${newKey}`);
          }
        } catch (error) {
          debugLog('Migration error:', error);
        }
      });
    },

    async syncWithVK() {
      const now = Date.now();
      if (now - this._lastSyncTime < this._syncCooldown) {
        debugLog('Sync cooldown active, skipping');
        return false;
      }

      if (!window.VKUnified.isReady()) {
        debugLog('VK not ready for sync');
        return false;
      }

      try {
        this._lastSyncTime = now;
        
        // Синхронизируем прогресс
        const progressSynced = await this._syncProgress();
        
        // Синхронизируем достижения
        const achievementsSynced = await this._syncAchievements();
        
        debugLog('Sync completed', { 
          progress: progressSynced, 
          achievements: achievementsSynced 
        });
        
        return progressSynced || achievementsSynced;
        
      } catch (error) {
        console.warn('Sync failed:', error);
        this._queueSync(); // Добавляем в очередь для повторного выполнения
        return false;
      }
    },

    async _syncProgress() {
      try {
        // Загружаем из VK
        const vkResult = await window.VKUnified.getStorage([window.STORAGE_KEYS.PROGRESS]);
        const vkData = vkResult.keys?.[0]?.value ? 
          JSON.parse(vkResult.keys[0].value) : {};
        
        // Загружаем локальные данные
        const localData = this._getLocalProgress();
        
        // Мержим с conflict resolution
        const merged = this._mergeProgress(localData, vkData);
        
        // Проверяем, есть ли изменения
        const hasChanges = JSON.stringify(merged) !== JSON.stringify(vkData);
        
        if (hasChanges) {
          // Сохраняем везде
          await Promise.all([
            this._saveLocalProgress(merged),
            window.VKUnified.setStorage(window.STORAGE_KEYS.PROGRESS, merged)
          ]);
          
          debugLog('Progress synced and merged');
          return true;
        } else {
          debugLog('Progress already in sync');
          return false;
        }
        
      } catch (error) {
        debugLog('Progress sync error:', error);
        throw error;
      }
    },

    async _syncAchievements() {
      try {
        // Аналогично для достижений
        const vkResult = await window.VKUnified.getStorage([window.STORAGE_KEYS.ACHIEVEMENTS]);
        const vkData = vkResult.keys?.[0]?.value ? 
          JSON.parse(vkResult.keys[0].value) : {};
        
        const localData = this._getLocalAchievements();
        const merged = this._mergeAchievements(localData, vkData);
        
        const hasChanges = JSON.stringify(merged) !== JSON.stringify(vkData);
        
        if (hasChanges) {
          await Promise.all([
            this._saveLocalAchievements(merged),
            window.VKUnified.setStorage(window.STORAGE_KEYS.ACHIEVEMENTS, merged)
          ]);
          
          debugLog('Achievements synced and merged');
          return true;
        }
        
        return false;
        
      } catch (error) {
        debugLog('Achievements sync error:', error);
        throw error;
      }
    },

    _mergeProgress(local, remote) {
      const merged = { ...remote };
      
      Object.keys(local).forEach(levelKey => {
        const localLevel = local[levelKey];
        const remoteLevel = remote[levelKey];
        
        if (!remoteLevel || 
            localLevel.stars > remoteLevel.stars ||
            (localLevel.stars === remoteLevel.stars && localLevel.bestTime < remoteLevel.bestTime) ||
            (localLevel.lastModified && remoteLevel.lastModified && 
             localLevel.lastModified > remoteLevel.lastModified)) {
          
          merged[levelKey] = { 
            ...localLevel, 
            lastModified: Date.now(),
            syncedAt: Date.now()
          };
        }
      });
      
      return merged;
    },

    _mergeAchievements(local, remote) {
      const merged = { ...remote };
      
      Object.keys(local).forEach(achievementKey => {
        const localValue = local[achievementKey];
        const remoteValue = remote[achievementKey];
        
        // Достижения только добавляются, не удаляются
        if (localValue && !remoteValue) {
          merged[achievementKey] = {
            unlocked: true,
            unlockedAt: local[achievementKey].unlockedAt || Date.now(),
            syncedAt: Date.now()
          };
        }
      });
      
      return merged;
    },

    _getLocalProgress() {
      try {
        const saved = localStorage.getItem(window.STORAGE_KEYS.PROGRESS);
        return saved ? JSON.parse(saved) : {};
      } catch (error) {
        debugLog('Error loading local progress:', error);
        return {};
      }
    },

    _getLocalAchievements() {
      try {
        const saved = localStorage.getItem(window.STORAGE_KEYS.ACHIEVEMENTS);
        return saved ? JSON.parse(saved) : {};
      } catch (error) {
        debugLog('Error loading local achievements:', error);
        return {};
      }
    },

    _saveLocalProgress(data) {
      try {
        localStorage.setItem(window.STORAGE_KEYS.PROGRESS, JSON.stringify(data));
        return true;
      } catch (error) {
        debugLog('Error saving local progress:', error);
        return false;
      }
    },

    _saveLocalAchievements(data) {
      try {
        localStorage.setItem(window.STORAGE_KEYS.ACHIEVEMENTS, JSON.stringify(data));
        return true;
      } catch (error) {
        debugLog('Error saving local achievements:', error);
        return false;
      }
    },

    _queueSync() {
      if (!this._isOnline) {
        this._syncQueue.push(() => this.syncWithVK());
        debugLog('Sync queued for when online');
      }
    },

    async _processSyncQueue() {
      if (!this._isOnline || this._syncQueue.length === 0) return;
      
      const operations = [...this._syncQueue];
      this._syncQueue = [];
      
      for (const operation of operations) {
        try {
          await operation();
        } catch (error) {
          debugLog('Queued sync operation failed:', error);
        }
      }
    },

    // Публичные методы для сохранения прогресса
    async saveProgress(levelIndex, data) {
      const progress = this._getLocalProgress();
      progress[levelIndex] = {
        ...data,
        lastModified: Date.now()
      };
      
      this._saveLocalProgress(progress);
      
      // Асинхронная синхронизация с VK
      if (this._isOnline && window.VKUnified.isReady()) {
        setTimeout(() => this.syncWithVK().catch(err => 
          debugLog('Auto-sync failed:', err)
        ), 1000);
      } else {
        this._queueSync();
      }
    },

    async saveAchievement(achievementId, data) {
      const achievements = this._getLocalAchievements();
      achievements[achievementId] = {
        ...data,
        unlockedAt: Date.now()
      };
      
      this._saveLocalAchievements(achievements);
      
      // Асинхронная синхронизация с VK
      if (this._isOnline && window.VKUnified.isReady()) {
        setTimeout(() => this.syncWithVK().catch(err => 
          debugLog('Achievement sync failed:', err)
        ), 1000);
      } else {
        this._queueSync();
      }
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

    debugLog('DOM ready, initializing sync manager...');

    // ШАГ 1.5: Инициализируем синхронизацию ПЕРВОЙ
    try {
      window.ProgressSyncManager.init();
      debugLog('ProgressSyncManager initialized');
    } catch (error) {
      console.error('ProgressSyncManager init failed:', error);
    }

    // ШАГ 2: Инициализируем VKManager (если VK окружение)
    if (isVKEnvironment) {
      try {
        debugLog('Initializing VK Manager...');
        
        if (!window.VKManager) {
          console.error('VKManager not found! Make sure vk-manager.js is loaded');
          throw new Error('VKManager not loaded');
        }
        
        const vkReady = await window.VKManager.init();
        
        if (vkReady) {
          window.VK_USER_DATA = window.VKManager.getUserData();
          window.VK_LAUNCH_PARAMS = window.VKManager.getLaunchParams();
          window.VK_BRIDGE_READY = true;
          
          debugLog('VK Manager initialized successfully', {
            userData: !!window.VK_USER_DATA,
            launchParams: !!window.VK_LAUNCH_PARAMS
          });

          // НОВОЕ: Запускаем первичную синхронизацию
          setTimeout(async () => {
            try {
              const synced = await window.ProgressSyncManager.syncWithVK();
              debugLog('Initial sync completed:', synced);
            } catch (error) {
              debugLog('Initial sync failed:', error);
            }
          }, 2000);
          
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
    
    if (!window.GameProgressManager) {
      console.error('GameProgressManager not found! Make sure game-progress-manager.js is loaded');
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
      
      // ИСПРАВЛЕНИЕ: Подключаем синхронизацию к GameProgressManager
      if (window.GameProgressManager.setProgressSyncManager) {
        window.GameProgressManager.setProgressSyncManager(window.ProgressSyncManager);
      }
      
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

    // Показываем отладочную информацию
    if (window.VK_DEBUG) {
      showDebugInfo({
        isVK: isVKEnvironment,
        isMobile: isMobile,
        vkManagerReady: !!window.VKManager?.isAvailable(),
        progressManagerReady: !!window.GameProgressManager?.isLoaded,
        syncStatus: window.VKUnified.isReady() ? 'Ready' : 'Offline',
        gameCreated: !!window.game
      });
    }
  }

  // Функция создания игры (без изменений)
  async function createGame() {
    debugLog('Creating game with unified managers...');
    
    if (!window.Phaser) {
      throw new Error('Phaser library not loaded');
    }

    if (!window.ALL_CARD_KEYS || !window.LEVELS) {
      throw new Error('Game data not loaded');
    }

    if (!window.PreloadScene || !window.MenuScene || !window.GameScene) {
      throw new Error('Game scenes not loaded');
    }

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
      
      if (isMobile) {
        document.body.style.cssText += `
          touch-action: none;
          overflow: hidden;
          position: fixed;
          width: 100%;
          height: 100%;
        `;
        
        if (isIOS) {
          document.addEventListener('touchmove', (e) => {
            e.preventDefault();
          }, { passive: false });
        }
      }
    }

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
      
      window.game.events.once('ready', function() {
        debugLog('Game ready event triggered');
        
        // Передаем все данные в игру
        window.game.registry.set('vkUserData', window.VK_USER_DATA);
        window.game.registry.set('vkLaunchParams', window.VK_LAUNCH_PARAMS);
        window.game.registry.set('isVKEnvironment', isVKEnvironment);
        window.game.registry.set('vkBridgeAvailable', window.VKManager?.isAvailable() || false);
        window.game.registry.set('isMobile', isMobile);
        window.game.registry.set('isIOS', isIOS);
        window.game.registry.set('isAndroid', isAndroid);
        
        // КЛЮЧЕВОЕ ИСПРАВЛЕНИЕ: Передаем менеджеры синхронизации
        window.game.registry.set('vkManager', window.VKManager);
        window.game.registry.set('progressManager', window.GameProgressManager);
        window.game.registry.set('syncManager', window.ProgressSyncManager);
        window.game.registry.set('vkUnified', window.VKUnified);
        window.game.registry.set('storageKeys', window.STORAGE_KEYS);
        
        const preloader = document.getElementById('preloader');
        if (preloader) {
          preloader.style.opacity = '0';
          setTimeout(() => {
            preloader.style.display = 'none';
            document.body.classList.add('game-loaded');
          }, 500);
        }
        
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
      
      if (isMobile) {
        window.addEventListener('orientationchange', () => {
          setTimeout(() => {
            if (window.game?.scale) {
              window.game.scale.refresh();
              debugLog('Orientation changed, scale refreshed');
            }
          }, 500);
        });
        
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

  // ИСПРАВЛЕННЫЕ публичные методы - теперь используют VKUnified
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

    // КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Используем VKUnified для storage
    setStorageData: function(key, value) {
      if (!window.VKUnified.isReady()) {
        return Promise.reject('VK Unified not ready');
      }

      return window.VKUnified.setStorage(key, value);
    },

    getStorageData: function(keys) {
      if (!window.VKUnified.isReady()) {
        return Promise.reject('VK Unified not ready');
      }

      return window.VKUnified.getStorage(keys);
    },

    // НОВОЕ: Методы синхронизации
    syncProgress: function() {
      return window.ProgressSyncManager.syncWithVK();
    },

    saveProgress: function(levelIndex, data) {
      return window.ProgressSyncManager.saveProgress(levelIndex, data);
    },

    saveAchievement: function(achievementId, data) {
      return window.ProgressSyncManager.saveAchievement(achievementId, data);
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
        dpr: window.devicePixelRatio || 1,
        online: navigator.onLine
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
            
            // ИСПРАВЛЕНИЕ: Сохраняем через ProgressSyncManager
            if (window.ProgressSyncManager) {
              // Сохраняем текущий прогресс при скрытии приложения
              const currentLevel = activeScene.currentLevel;
              if (currentLevel && activeScene.gameMetrics) {
                const levelIndex = window.LEVELS?.findIndex(l => l === currentLevel) || 0;
                const gameData = {
                  inProgress: true,
                  pausedAt: Date.now(),
                  gameTime: Date.now() - activeScene.gameMetrics.startTime,
                  attempts: activeScene.gameMetrics.attempts || 0,
                  errors: activeScene.gameMetrics.errors || 0
                };
                
                window.ProgressSyncManager.saveProgress(`temp_${levelIndex}`, gameData)
                  .catch(err => debugLog('Failed to save game state:', err));
              }
            }
            
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
            
            // НОВОЕ: Попытка синхронизации при возврате в приложение
            if (window.ProgressSyncManager && navigator.onLine) {
              setTimeout(() => {
                window.ProgressSyncManager.syncWithVK()
                  .catch(err => debugLog('Resume sync failed:', err));
              }, 1000);
            }
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
    
    // ИСПРАВЛЕНИЕ: Сохраняем через ProgressSyncManager
    if (window.ProgressSyncManager && window.game?.scene) {
      try {
        const activeScene = window.game.scene.getActiveScene();
        if (activeScene?.scene?.key === 'GameScene' && activeScene.gameMetrics) {
          const currentLevel = activeScene.currentLevel;
          if (currentLevel) {
            const levelIndex = window.LEVELS?.findIndex(l => l === currentLevel) || 0;
            const finalData = {
              completed: false,
              exitedAt: Date.now(),
              gameTime: Date.now() - activeScene.gameMetrics.startTime,
              attempts: activeScene.gameMetrics.attempts || 0,
              errors: activeScene.gameMetrics.errors || 0
            };
            
            // Синхронное сохранение в localStorage
            const progress = window.ProgressSyncManager._getLocalProgress();
            progress[`exit_${levelIndex}`] = finalData;
            window.ProgressSyncManager._saveLocalProgress(progress);
          }
        }
      } catch (error) {
        debugLog('Error saving on unload:', error);
      }
    }
    
    if (window.GameProgressManager?.isLoaded) {
      window.GameProgressManager.save(true);
    }
    
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

  // ИСПРАВЛЕННЫЕ отладочные утилиты - используют единые менеджеры
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
          test: 'unified_storage_test', 
          timestamp: Date.now(),
          device: isMobile ? 'mobile' : 'desktop',
          version: '2.0'
        };
        
        console.log('Testing unified storage system...');
        
        if (!window.VKUnified.isReady()) {
          console.log('VK not available, testing local storage only...');
          
          try {
            localStorage.setItem('test_unified_local', JSON.stringify(testData));
            const loaded = JSON.parse(localStorage.getItem('test_unified_local'));
            localStorage.removeItem('test_unified_local');
            
            console.log('Local storage test successful:', loaded);
            return loaded;
          } catch (error) {
            console.error('Local storage test failed:', error);
            return null;
          }
        }
        
        try {
          // Тестируем VKUnified API
          await window.VKUnified.setStorage('test_unified_vk', testData);
          const result = await window.VKUnified.getStorage(['test_unified_vk']);
          
          if (result.keys?.[0]) {
            const loaded = JSON.parse(result.keys[0].value);
            console.log('VK Unified storage test successful:', loaded);
            
            // Очищаем тестовые данные
            try {
              await window.VKUnified.setStorage('test_unified_vk', null);
            } catch (cleanupError) {
              console.warn('Cleanup failed:', cleanupError);
            }
            
            return loaded;
          }
          
        } catch (error) {
          console.error('VK Unified storage test failed:', error);
        }
        
        return null;
      },

      async testSync() {
        console.log('Testing sync system...');
        
        if (!window.ProgressSyncManager) {
          console.error('ProgressSyncManager not available');
          return false;
        }
        
        try {
          // Добавляем тестовые данные локально
          const testProgress = {
            test_level: {
              stars: 3,
              bestTime: 45,
              bestAccuracy: 100,
              attempts: 8,
              errors: 0,
              completedAt: Date.now(),
              lastModified: Date.now()
            }
          };
          
          window.ProgressSyncManager._saveLocalProgress(testProgress);
          console.log('Test progress saved locally');
          
          // Пытаемся синхронизировать
          const synced = await window.ProgressSyncManager.syncWithVK();
          console.log('Sync test result:', synced);
          
          // Проверяем что данные сохранились
          const savedProgress = window.ProgressSyncManager._getLocalProgress();
          console.log('Final progress state:', savedProgress);
          
          return synced;
          
        } catch (error) {
          console.error('Sync test failed:', error);
          return false;
        }
      },

      showVKData() {
        console.group('VK Data & Sync Status');
        console.log('VK Manager Available:', window.VKManager?.isAvailable());
        console.log('VK Unified Ready:', window.VKUnified.isReady());
        console.log('Progress Sync Manager:', !!window.ProgressSyncManager);
        console.log('Game Progress Manager:', window.GameProgressManager?.isLoaded);
        console.log('User Data:', window.VK_USER_DATA);
        console.log('Launch Params:', window.VK_LAUNCH_PARAMS);
        console.log('Environment:', isVKEnvironment);
        console.log('Online Status:', navigator.onLine);
        console.log('Storage Keys:', window.STORAGE_KEYS);
        console.groupEnd();
      },

      showProgress() {
        console.group('Game Progress & Sync');
        
        if (window.ProgressSyncManager) {
          const localProgress = window.ProgressSyncManager._getLocalProgress();
          const localAchievements = window.ProgressSyncManager._getLocalAchievements();
          
          console.log('Local Progress:', localProgress);
          console.log('Local Achievements:', localAchievements);
          console.log('Last Sync Time:', new Date(window.ProgressSyncManager._lastSyncTime));
          console.log('Sync Queue Length:', window.ProgressSyncManager._syncQueue.length);
          console.log('Online Status:', window.ProgressSyncManager._isOnline);
        }
        
        if (window.GameProgressManager?.isLoaded) {
          console.log('Game Manager Stats:', window.GameProgressManager.getStats());
          
          if (window.GameProgressManager.getTotalStars) {
            console.log('Total Stars:', window.GameProgressManager.getTotalStars());
          }
          if (window.GameProgressManager.getCompletionPercentage) {
            console.log('Completion:', window.GameProgressManager.getCompletionPercentage() + '%');
          }
        }
        
        console.groupEnd();
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
        console.log('Connection:', navigator.connection?.effectiveType || 'unknown');
        
        if (window.game) {
          console.log('Game Canvas:', `${window.game.canvas.width}x${window.game.canvas.height}`);
          console.log('Game Scale:', `${window.game.scale.width}x${window.game.scale.height}`);
        }
        console.groupEnd();
      },

      async forceSync() {
        console.log('Forcing manual sync...');
        
        if (!window.ProgressSyncManager) {
          console.error('ProgressSyncManager not available');
          return false;
        }
        
        try {
          // Сбрасываем cooldown для принудительной синхронизации
          window.ProgressSyncManager._lastSyncTime = 0;
          
          const result = await window.ProgressSyncManager.syncWithVK();
          console.log('Force sync result:', result);
          return result;
        } catch (error) {
          console.error('Force sync failed:', error);
          return false;
        }
      }
    };

    console.log('Debug utilities loaded (v2.0):');
    console.log('VKUtils.testVKMethod(method, params) - test VK methods');
    console.log('VKUtils.getUserInfo() - get user data');
    console.log('VKUtils.testStorage() - test unified storage');
    console.log('VKUtils.testSync() - test sync system');
    console.log('VKUtils.showVKData() - show VK & sync data');
    console.log('VKUtils.showProgress() - show game progress');
    console.log('VKUtils.showMobileInfo() - show mobile info');
    console.log('VKUtils.forceSync() - force manual sync');
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

// НОВОЕ: Debug commands для тестирования синхронизации
window.DebugSync = {
  clearAll: function() {
    if (window.STORAGE_KEYS) {
      Object.values(window.STORAGE_KEYS).forEach(key => {
        localStorage.removeItem(key);
      });
    }
    
    // Старые ключи тоже чистим
    ['findpair_progress', 'findpair_achievements', 'findpair_settings'].forEach(key => {
      localStorage.removeItem(key);
    });
    
    console.log('All sync data cleared');
  },

  addTestData: function() {
    if (!window.ProgressSyncManager) {
      console.error('ProgressSyncManager not available');
      return;
    }
    
    const testProgress = {
      '0': { stars: 3, bestTime: 30, bestAccuracy: 100, attempts: 5, errors: 0, lastModified: Date.now() },
      '1': { stars: 2, bestTime: 60, bestAccuracy: 85, attempts: 10, errors: 2, lastModified: Date.now() },
      '2': { stars: 1, bestTime: 120, bestAccuracy: 70, attempts: 15, errors: 5, lastModified: Date.now() }
    };
    
    const testAchievements = {
      first_win: { unlocked: true, unlockedAt: Date.now() },
      perfect_game: { unlocked: true, unlockedAt: Date.now() }
    };
    
    window.ProgressSyncManager._saveLocalProgress(testProgress);
    window.ProgressSyncManager._saveLocalAchievements(testAchievements);
    
    console.log('Test data added');
  },

  status: function() {
    if (!window.ProgressSyncManager) {
      console.error('ProgressSyncManager not available');
      return;
    }
    
    console.group('Sync Status');
    console.log('VK Ready:', window.VKUnified?.isReady());
    console.log('Online:', navigator.onLine);
    console.log('Last Sync:', new Date(window.ProgressSyncManager._lastSyncTime));
    console.log('Queue Length:', window.ProgressSyncManager._syncQueue.length);
    console.log('Local Progress:', window.ProgressSyncManager._getLocalProgress());
    console.log('Local Achievements:', window.ProgressSyncManager._getLocalAchievements());
    console.groupEnd();
  }
};

// Показываем доступные команды
console.log(`
DEBUG COMMANDS (Enhanced):

DebugAgreement.reset()  - сбросить соглашение
DebugAgreement.status() - проверить статус  
DebugAgreement.show()   - показать соглашение
DebugAgreement.accept() - принять соглашение

DebugSync.clearAll()    - очистить все данные синхронизации
DebugSync.addTestData() - добавить тестовые данные
DebugSync.status()      - показать статус синхронизации

VKUtils.testSync()      - тестировать систему синхронизации
VKUtils.forceSync()     - принудительная синхронизация

Пример: DebugSync.clearAll(); DebugSync.addTestData(); VKUtils.forceSync();
`);
