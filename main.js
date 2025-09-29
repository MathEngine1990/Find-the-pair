// ==========================================
// MAIN.JS - ПОЛНАЯ VK BRIDGE ИНТЕГРАЦИЯ
// ==========================================

// ==========================================
// ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ И КОНФИГУРАЦИЯ
// ==========================================

// Флаги окружения и дебаг-режима
window.isVKEnvironment = false;
window.VK_DEBUG = new URLSearchParams(window.location.search).has('debug');
window.VK_BRIDGE_READY = false;

// Обнаружение платформы
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
const isAndroid = /Android/i.test(navigator.userAgent);

// ==========================================
// УТИЛИТЫ ДЕБАГА
// ==========================================

function debugLog(message, data) {
  if (window.VK_DEBUG) {
    console.log(`🔍 [DEBUG] ${message}`, data || '');
  }
}

// ==========================================
// PROGRESS SYNC MANAGER (из патча)
// ==========================================

class ProgressSyncManager {
  constructor() {
    this.isVKEnvironment = window.isVKEnvironment;
    this.vkBridge = window.vkBridge;
    this.syncInProgress = false;
    this.lastSyncTime = 0;
    this.syncCooldown = 2000; // 2 секунды между синхронизациями
    
    // Колбэки для внешних обработчиков
    this.onSyncError = null;
    this.onSyncComplete = null;
    this.onProgressUpdate = null;
    
    console.log('🔄 ProgressSyncManager initialized', {
      isVK: this.isVKEnvironment,
      hasBridge: !!this.vkBridge
    });
  }

  async loadProgress() {
    try {
      let vkData = null;
      let localData = null;

      // Загрузка из VK Storage
      if (this.isVKEnvironment && this.vkBridge) {
        try {
          const keys = ['progress', 'achievements', 'settings'];
          const result = await this.vkBridge.send('VKWebAppStorageGet', { keys });
          
          vkData = {
            progress: result.keys.find(k => k.key === 'progress')?.value,
            achievements: result.keys.find(k => k.key === 'achievements')?.value,
            settings: result.keys.find(k => k.key === 'settings')?.value
          };
          
          // Парсим JSON
          if (vkData.progress) vkData.progress = JSON.parse(vkData.progress);
          if (vkData.achievements) vkData.achievements = JSON.parse(vkData.achievements);
          if (vkData.settings) vkData.settings = JSON.parse(vkData.settings);
          
          console.log('✅ VK Storage loaded:', vkData);
        } catch (error) {
          console.warn('⚠️ VK Storage load failed:', error);
        }
      }

      // Загрузка из localStorage
      try {
        localData = {
          progress: JSON.parse(localStorage.getItem('findpair_progress') || 'null'),
          achievements: JSON.parse(localStorage.getItem('findpair_achievements') || 'null'),
          settings: JSON.parse(localStorage.getItem('findpair_settings') || 'null')
        };
        console.log('📦 LocalStorage loaded:', localData);
      } catch (error) {
        console.warn('⚠️ LocalStorage load failed:', error);
      }

      // Мерж данных (приоритет VK Storage)
      const mergedProgress = this.mergeProgress(vkData, localData);
      
      // Обновляем lastSyncTime
      if (mergedProgress) {
        mergedProgress.lastSync = Date.now();
      }
      
      return mergedProgress;
      
    } catch (error) {
      console.error('❌ loadProgress failed:', error);
      if (this.onSyncError) this.onSyncError(error);
      return null;
    }
  }

  mergeProgress(vkData, localData) {
    // Если нет никаких данных - возвращаем дефолтные
    if (!vkData && !localData) {
      return this.getDefaultProgress();
    }

    // Простая стратегия: VK данные приоритетнее
    if (vkData && vkData.progress) {
      return {
        progress: vkData.progress,
        achievements: vkData.achievements || {},
        settings: vkData.settings || {}
      };
    }

    // Fallback на локальные данные
    if (localData && localData.progress) {
      return {
        progress: localData.progress,
        achievements: localData.achievements || {},
        settings: localData.settings || {}
      };
    }

    return this.getDefaultProgress();
  }

  getDefaultProgress() {
    return {
      progress: {
        1: { stars: 0, best: null, unlocked: true },
        2: { stars: 0, best: null, unlocked: false },
        3: { stars: 0, best: null, unlocked: false },
        4: { stars: 0, best: null, unlocked: false },
        5: { stars: 0, best: null, unlocked: false }
      },
      achievements: {},
      settings: {
        soundEnabled: true,
        musicEnabled: true
      },
      lastSync: Date.now()
    };
  }

  async saveProgress(progressData, force = false) {
    // Проверка cooldown (если не force)
    if (!force) {
      const timeSinceLastSync = Date.now() - this.lastSyncTime;
      if (timeSinceLastSync < this.syncCooldown) {
        console.log('⏳ Sync cooldown active, skipping...');
        return;
      }
    }

    // Защита от одновременных сохранений
    if (this.syncInProgress) {
      console.log('⏳ Sync already in progress, skipping...');
      return;
    }

    this.syncInProgress = true;
    this.lastSyncTime = Date.now();

    try {
      // Сохранение в localStorage
      localStorage.setItem('findpair_progress', JSON.stringify(progressData.progress || {}));
      localStorage.setItem('findpair_achievements', JSON.stringify(progressData.achievements || {}));
      localStorage.setItem('findpair_settings', JSON.stringify(progressData.settings || {}));
      console.log('✅ LocalStorage saved');

      // Сохранение в VK Storage
      if (this.isVKEnvironment && this.vkBridge) {
        await Promise.all([
          this.vkBridge.send('VKWebAppStorageSet', {
            key: 'progress',
            value: JSON.stringify(progressData.progress || {})
          }),
          this.vkBridge.send('VKWebAppStorageSet', {
            key: 'achievements',
            value: JSON.stringify(progressData.achievements || {})
          }),
          this.vkBridge.send('VKWebAppStorageSet', {
            key: 'settings',
            value: JSON.stringify(progressData.settings || {})
          })
        ]);
        console.log('✅ VK Storage saved');
      }

      // Колбэк успешной синхронизации
      if (this.onSyncComplete) {
        this.onSyncComplete(progressData);
      }

      // Уведомляем подписчиков об обновлении
      if (this.onProgressUpdate) {
        this.onProgressUpdate(progressData);
      }

    } catch (error) {
      console.error('❌ saveProgress failed:', error);
      if (this.onSyncError) {
        this.onSyncError(error);
      }
      throw error;
    } finally {
      this.syncInProgress = false;
    }
  }

  // Периодическая автосинхронизация (можно вызывать из сцен)
  startAutoSync(intervalMs = 30000) {
    if (this.autoSyncInterval) {
      clearInterval(this.autoSyncInterval);
    }

    this.autoSyncInterval = setInterval(async () => {
      try {
        const currentProgress = await this.loadProgress();
        if (currentProgress) {
          await this.saveProgress(currentProgress, true);
          console.log('🔄 Auto-sync completed');
        }
      } catch (error) {
        console.error('❌ Auto-sync failed:', error);
      }
    }, intervalMs);
  }

  stopAutoSync() {
    if (this.autoSyncInterval) {
      clearInterval(this.autoSyncInterval);
      this.autoSyncInterval = null;
    }
  }
}

// ==========================================
// VK BRIDGE ИНИЦИАЛИЗАЦИЯ
// ==========================================

async function initVKBridge() {
  debugLog('Starting VK Bridge initialization...');
  
  try {
    // Проверяем наличие VK Bridge скрипта
    if (typeof vkBridge === 'undefined') {
      console.log('📦 VK Bridge not loaded, loading dynamically...');
      
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/@vkontakte/vk-bridge/dist/browser.min.js';
        script.onload = resolve;
        script.onerror = () => reject(new Error('Failed to load VK Bridge'));
        document.head.appendChild(script);
      });
      
      console.log('✅ VK Bridge script loaded');
    }

    // Инициализируем Bridge
    window.vkBridge = vkBridge;
    await vkBridge.send('VKWebAppInit');
    
    window.isVKEnvironment = true;
    window.VK_BRIDGE_READY = true;
    
    debugLog('VK Bridge initialized successfully');

    // Получаем данные пользователя
    try {
      const userInfo = await vkBridge.send('VKWebAppGetUserInfo');
      window.VK_USER_INFO = userInfo;
      debugLog('User info received:', userInfo);
    } catch (error) {
      console.warn('⚠️ Could not get user info:', error);
    }

    // Получаем launch params
    try {
      const launchParams = await vkBridge.send('VKWebAppGetLaunchParams');
      window.VK_LAUNCH_PARAMS = launchParams;
      debugLog('Launch params:', launchParams);
    } catch (error) {
      console.warn('⚠️ Could not get launch params:', error);
    }

    // Подписываемся на события VK
    vkBridge.subscribe((e) => {
      debugLog('VK Bridge event:', e);
      
      if (e.detail.type === 'VKWebAppUpdateConfig') {
        const scheme = e.detail.data.scheme || 'client_light';
        document.body.setAttribute('scheme', scheme);
        debugLog('Theme changed to:', scheme);
      }
    });

    // Диспатчим событие готовности
    window.dispatchEvent(new Event('vk-bridge-ready'));
    
    return true;
    
  } catch (error) {
    console.warn('⚠️ VK Bridge initialization failed:', error);
    window.isVKEnvironment = false;
    return false;
  }
}

// ==========================================
// TOAST УВЕДОМЛЕНИЯ (из патча)
// ==========================================

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

// ==========================================
// ЭКРАН ОШИБКИ
// ==========================================

function showErrorScreen(message) {
  const errorHTML = `
    <div style="
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100vh;
      background: linear-gradient(135deg, #1d2330 0%, #2c3e50 100%);
      color: white;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      padding: 20px;
      box-sizing: border-box;
      text-align: center;
    ">
      <div style="font-size: ${isMobile ? '48px' : '64px'}; margin-bottom: 20px;">⚠️</div>
      <h2 style="margin: 10px 0; font-size: ${isMobile ? '20px' : '24px'};">Не удалось загрузить игру</h2>
      <p style="margin: 10px 0; color: #aaa; font-size: ${isMobile ? '14px' : '16px'}; max-width: 400px;">
        ${message}
      </p>
      <button onclick="location.reload()" style="
        margin-top: 20px;
        padding: 12px 24px;
        background: #3498db;
        color: white;
        border: none;
        border-radius: 8px;
        font-size: ${isMobile ? '16px' : '18px'};
        font-weight: bold;
        cursor: pointer;
        transition: background 0.3s;
        min-width: ${isMobile ? '200px' : '160px'};
      ">🔄 Перезагрузить</button>
      
      ${window.VK_DEBUG ? `
        <details style="margin-top: 20px; color: #888; font-size: ${isMobile ? '10px' : '12px'}; max-width: 90%;">
          <summary>Техническая информация</summary>
          <pre style="text-align: left; margin-top: 10px; font-size: ${isMobile ? '8px' : '10px'}; overflow-x: auto;">
DOM Ready: ${document.readyState}
Mobile: ${isMobile}
iOS: ${isIOS}
Android: ${isAndroid}
Touch: ${'ontouchstart' in window}
Screen: ${screen.width}x${screen.height}
Viewport: ${window.innerWidth}x${window.innerHeight}
DPR: ${window.devicePixelRatio || 1}
Phaser: ${!!window.Phaser}
Game Data: ${!!(window.ALL_CARD_KEYS && window.LEVELS)}
Scenes: ${!!(window.PreloadScene && window.MenuScene && window.GameScene)}
VK Env: ${!!window.isVKEnvironment}
User Agent: ${navigator.userAgent}
          </pre>
        </details>
      ` : ''}
    </div>
  `;
  
  document.body.innerHTML = errorHTML;
}

// ==========================================
// МОБИЛЬНО-ОПТИМИЗИРОВАННАЯ ИНИЦИАЛИЗАЦИЯ ИГРЫ
// ==========================================

function initGame() {
  // Проверка готовности DOM
  if (document.readyState === 'loading' || !document.body) {
    debugLog('DOM not ready, waiting...');
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initGame);
    } else {
      setTimeout(initGame, 100);
    }
    return;
  }

  // Дополнительная проверка body
  if (!document.body) {
    debugLog('Document body not ready, retrying...');
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

  // Усиленная валидация parent элемента
  let gameContainer = document.getElementById('game');
  
  if (!gameContainer) {
    console.warn('Game container not found! Creating fallback...');
    gameContainer = document.createElement('div');
    gameContainer.id = 'game';
    gameContainer.style.cssText = `
      width: 100%;
      height: 100%;
      position: fixed;
      top: 0;
      left: 0;
      overflow: hidden;
    `;
    document.body.appendChild(gameContainer);
  }

  // Валидация зависимостей
  if (!window.Phaser) {
    showErrorScreen('Не загружена библиотека Phaser. Проверьте подключение к интернету.');
    return;
  }

  if (!window.ALL_CARD_KEYS || !window.LEVELS) {
    showErrorScreen('Не загружены данные игры (game/Data.js).');
    return;
  }

  if (!window.PreloadScene || !window.MenuScene || !window.GameScene) {
    showErrorScreen('Не загружены сцены игры.');
    return;
  }

  // Расчет размеров с учетом safe area
  const safeWidth = window.innerWidth;
  const safeHeight = window.innerHeight;
  
  debugLog('Creating Phaser game config...', {
    width: safeWidth,
    height: safeHeight,
    container: gameContainer.id
  });

  // Конфигурация Phaser с улучшениями для мобильных
  const config = {
    type: Phaser.AUTO,
    width: safeWidth,
    height: safeHeight,
    parent: 'game',
    backgroundColor: '#1d2330',
    
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: safeWidth,
      height: safeHeight
    },
    
    scene: [
      window.PreloadScene,
      window.MenuScene,
      window.GameScene
    ],
    
    // Оптимизации для мобильных
    render: {
      antialias: !isMobile,
      pixelArt: false,
      roundPixels: true,
      transparent: false,
      clearBeforeRender: true,
      premultipliedAlpha: true,
      preserveDrawingBuffer: false,
      failIfMajorPerformanceCaveat: false,
      powerPreference: isMobile ? 'low-power' : 'high-performance',
      batchSize: isMobile ? 2048 : 4096,
      maxTextures: isMobile ? 8 : 16
    },
    
    physics: {
      default: 'arcade',
      arcade: {
        debug: window.VK_DEBUG
      }
    },
    
    // Аудио с отложенной загрузкой
    audio: {
      disableWebAudio: false,
      noAudio: false
    },
    
    // Мобильные специфичные настройки
    input: {
      activePointers: isMobile ? 1 : 3,
      touch: isMobile,
      mouse: !isMobile,
      smoothFactor: isMobile ? 0.2 : 0
    },
    
    fps: {
      target: isMobile ? 30 : 60,
      forceSetTimeOut: isMobile,
      min: 15,
      smoothStep: true
    },
    
    banner: window.VK_DEBUG
  };

  try {
    debugLog('Creating Phaser.Game instance...');
    window.game = new Phaser.Game(config);
    
    // Обработка ошибок создания игры
    window.game.events.once('ready', () => {
      debugLog('✅ Game created successfully!');
      console.log('🎮 Game initialized successfully');
    });

    // Обработка ресайза окна с debounce
    let resizeTimeout;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        if (window.game && window.game.scale) {
          window.game.scale.resize(window.innerWidth, window.innerHeight);
          debugLog('Game resized:', {
            width: window.innerWidth,
            height: window.innerHeight
          });
        }
      }, isMobile ? 300 : 100);
    });

    // Предотвращение bounce эффекта на iOS
    if (isIOS) {
      document.body.addEventListener('touchmove', (e) => {
        if (e.target === document.body) {
          e.preventDefault();
        }
      }, { passive: false });
    }

    // Инициализация глобального sync manager
    window.initGlobalSyncManager();
    
  } catch (error) {
    console.error('❌ Failed to create game:', error);
    showErrorScreen(`Ошибка создания игры: ${error.message}`);
  }
}

// ==========================================
// ГЛОБАЛЬНАЯ ИНИЦИАЛИЗАЦИЯ SYNC MANAGER
// ==========================================

window.initGlobalSyncManager = async function() {
  try {
    if (!window.progressSyncManager) {
      window.progressSyncManager = new ProgressSyncManager();
      
      // Настраиваем глобальные обработчики
      window.progressSyncManager.onSyncError = (error) => {
        console.error('🔄 Global sync error:', error);
        
        if (window.showToast) {
          window.showToast('Проблема с синхронизацией данных', 'warning');
        }
      };
      
      window.progressSyncManager.onSyncComplete = (data) => {
        console.log('🔄 Global sync completed');
        
        // Уведомляем активные сцены об обновлении данных
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

// ==========================================
// ТОЧКА ВХОДА
// ==========================================

(async function bootstrap() {
  console.log('🚀 Application starting...');
  
  try {
    // 1. Инициализация VK Bridge (если доступен)
    await initVKBridge();
    
    // 2. Небольшая задержка для стабильности на мобильных
    if (isMobile) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // 3. Запуск игры
    initGame();
    
  } catch (error) {
    console.error('❌ Bootstrap failed:', error);
    showErrorScreen(`Ошибка запуска: ${error.message}`);
  }
})();

// ==========================================
// ЭКСПОРТ ДЛЯ ВНЕШНЕГО ИСПОЛЬЗОВАНИЯ
// ==========================================

window.ProgressSyncManager = ProgressSyncManager;
