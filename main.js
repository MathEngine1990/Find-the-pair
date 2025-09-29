// ====================================================================
// MAIN.JS - ИГРА MEMORY/FIND-THE-PAIR
// С ИНТЕГРАЦИЕЙ VK MINI APPS
// ====================================================================

// Обнаружение платформы
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
const isAndroid = /Android/i.test(navigator.userAgent);

// Флаги окружения
window.VK_DEBUG = new URLSearchParams(window.location.search).has('debug');
let isVKEnvironment = false;

// ====================================================================
// DEBUG УТИЛИТЫ
// ====================================================================

function debugLog(message, data) {
  if (window.VK_DEBUG) {
    console.log(`🔍 [DEBUG] ${message}`, data || '');
  }
}

// ====================================================================
// VK BRIDGE SAFE WRAPPER
// ====================================================================

window.VKSafe = {
  init: async function() {
    try {
      if (typeof vkBridge !== 'undefined') {
        await vkBridge.send('VKWebAppInit');
        isVKEnvironment = true;
        console.log('✅ VK Bridge initialized');
        return true;
      }
    } catch (error) {
      console.warn('⚠️ VK Bridge init failed:', error);
    }
    return false;
  },

  send: async function(method, params = {}) {
    if (typeof vkBridge !== 'undefined' && isVKEnvironment) {
      try {
        const result = await vkBridge.send(method, params);
        debugLog(`VK Bridge call: ${method}`, result);
        return result;
      } catch (error) {
        console.warn(`VK Bridge error (${method}):`, error);
        return null;
      }
    }
    return null;
  },

  subscribe: function(callback) {
    if (typeof vkBridge !== 'undefined') {
      vkBridge.subscribe(callback);
    }
  },

  storageGet: async function(keys) {
    keys = Array.isArray(keys) ? keys : [keys];
    const result = await this.send('VKWebAppStorageGet', { keys });
    return result ? result.keys : [];
  },

  storageSet: async function(key, value) {
    return await this.send('VKWebAppStorageSet', { key, value });
  },

  isSupported: function(method) {
    return typeof vkBridge !== 'undefined' && vkBridge.supports(method);
  },

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

// ====================================================================
// ЭКРАН ОШИБКИ
// ====================================================================

function showErrorScreen(message) {
  document.body.innerHTML = `
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

// ====================================================================
// МОБИЛЬНО-ОПТИМИЗИРОВАННАЯ ИНИЦИАЛИЗАЦИЯ ИГРЫ
// ====================================================================

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
    
  } catch (error) {
    console.error('❌ Failed to create game:', error);
    showErrorScreen(`Ошибка создания игры: ${error.message}`);
  }
}

// ====================================================================
// УЛУЧШЕННАЯ ФУНКЦИЯ MAIN С МОБИЛЬНЫМИ ОПТИМИЗАЦИЯМИ
// ====================================================================

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

  // Ждем полной готовности DOM с учетом мобильных особенностей
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

  // Дополнительная проверка: убеждаемся что body существует
  if (!document.body) {
    console.log('Waiting for document.body...');
    await new Promise(resolve => {
      const checkBody = () => {
        if (document.body) {
          resolve();
        } else {
          setTimeout(checkBody, isMobile ? 100 : 50);
        }
      };
      checkBody();
    });
  }

  // Инициализация VK Bridge (опционально)
  const vkInitialized = await window.VKSafe.init();
  if (vkInitialized) {
    debugLog('VK Bridge initialized', { isVK: true });
    
    // Подписываемся на события VK
    window.VKSafe.subscribe((e) => {
      debugLog('VK Bridge event:', e);
      
      if (e.detail.type === 'VKWebAppUpdateConfig') {
        const scheme = e.detail.data.scheme || 'client_light';
        document.body.setAttribute('scheme', scheme);
        debugLog('Theme changed to:', scheme);
      }
    });
  }

  // Небольшая задержка для стабильности на мобильных
  if (isMobile) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // Запускаем игру
  initGame();
}

// ====================================================================
// ПАТЧ 5: ГЛОБАЛЬНАЯ ИНИЦИАЛИЗАЦИЯ PROGRESSSYNCMANAGER
// ====================================================================

// Глобальная инициализация ProgressSyncManager
window.initGlobalSyncManager = async function() {
  try {
    if (!window.progressSyncManager) {
      // Проверяем наличие класса ProgressSyncManager
      if (typeof ProgressSyncManager === 'undefined') {
        console.warn('⚠️ ProgressSyncManager not loaded, skipping initialization');
        return;
      }

      window.progressSyncManager = new ProgressSyncManager();
      
      // Настраиваем глобальные обработчики
      window.progressSyncManager.onSyncError = (error) => {
        console.error('🔄 Global sync error:', error);
        
        // Можно показать toast уведомление пользователю
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

// Инициализируем после загрузки VK Bridge
if (isVKEnvironment) {
  window.initGlobalSyncManager();
} else {
  // Ждем готовности VK Bridge (если будет загружен позже)
  window.addEventListener('vk-bridge-ready', () => {
    window.initGlobalSyncManager();
  });
}

// ====================================================================
// ПАТЧ 6: TOAST УВЕДОМЛЕНИЯ
// ====================================================================

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

// ====================================================================
// ТОЧКА ВХОДА
// ====================================================================

// Запускаем приложение
main().catch(error => {
  console.error('❌ Fatal error:', error);
  showErrorScreen(`Критическая ошибка: ${error.message}`);
});
