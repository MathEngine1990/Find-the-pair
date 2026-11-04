//---main.js - ПОЛНАЯ ВЕРСИЯ С ИНТЕГРАЦИЕЙ VK И PROGRESSSYNCMANAGER




// ========================================
// ГЛОБАЛЬНЫЕ КОНСТАНТЫ (ВНЕ IIFE!)
// ========================================

// === main.js:1 - ДОБАВИТЬ В САМОЕ НАЧАЛО ===

// ✅ FIX #7: Кэшируем DPR ПЕРЕД любыми вычислениями
//window._rawDPR = window.devicePixelRatio || 1;

// ✅ ЕДИНСТВЕННЫЙ источник DPR
window._DPR = (() => {
  const raw = window.devicePixelRatio || 1;
  const isLowEnd = (navigator.hardwareConcurrency || 2) <= 2;
  
  if (isLowEnd) return 1.0;
  if (/Mobile/i.test(navigator.userAgent)) return Math.min(1.5, raw);
  return Math.min(2.0, raw);
})();

console.log('🎯 DPR locked:', window._DPR);

const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
const isAndroid = /Android/.test(navigator.userAgent);

const isVKEnvironment = /vk_(app_id|user_id|platform)/i.test(window.location.search) || 
                       window.location.hostname.includes('vk-apps.com') ||
                       window.location.hostname.includes('vk.com') ||
                       window.parent !== window;

(function() {
  'use strict';
  
  // ========================================
  // ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ
  // ========================================
  
  window.VK_USER_DATA = null;
  window.VK_LAUNCH_PARAMS = null;
  window.VK_BRIDGE_READY = false;
  window.VK_DEBUG = window.location.search.includes('debug=1') || 
                   window.location.hostname === 'localhost';
  
  // ========================================
  // ОТЛАДОЧНЫЕ УТИЛИТЫ
  // ========================================
  
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
    
    const existing = document.getElementById('vk-debug-panel');
    if (existing) existing.remove();
    
    document.body.appendChild(debugPanel);
    
    setTimeout(() => {
      if (debugPanel.parentNode) {
        debugPanel.remove();
      }
    }, 15000);
  }

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
  Scenes: ${!!(window.PreloadScene && window.MenuScene && window.GameScene && window.AchievementsScene)}
  VK Environment: ${!!isVKEnvironment}
  User Agent: ${navigator.userAgent}
            </pre>
          </details>
        ` : ''}
      </div>
    `;
  }

  // КРИТИЧНО: Заменяем все window.alert на игровые уведомления
function showGameNotification(message, type = 'info') {
    // Если игра ещё не создана, сохраняем сообщение
    if (!window.game || !window.game.scene) {
       console.warn('⚠️ Game not ready, using native alert:', message);
       // ✅ Используем нативный alert через сохранённую ссылку
       if (window._nativeAlert) {
           window._nativeAlert(message);
       }
       return;
    }
    
    const activeScene = window.game.scene.getScenes(true)[0];
       if (!activeScene || !activeScene.add || !activeScene.tweens) {
       console.warn('⚠️ Scene not ready for notifications');
       if (window._nativeAlert) window._nativeAlert(message);
       return;
   }
    
    const { width, height } = activeScene.scale;
    
    // Создаём уведомление в активной сцене
    const notification = activeScene.add.container(width/2, height*0.85)
        .setDepth(9999);
    
    // Фон уведомления
    const bg = activeScene.add.graphics();
    const bgColor = type === 'error' ? 0xE74C3C : 
                    type === 'success' ? 0x27AE60 : 0x3498DB;
    
    bg.fillStyle(bgColor, 0.95);
    bg.fillRoundedRect(-200, -30, 400, 60, 10);
    
    // Текст уведомления
    const text = activeScene.add.text(0, 0, message, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '16px',
        color: '#FFFFFF',
        wordWrap: { width: 380 },
        align: 'center'
    }).setOrigin(0.5);
    
    notification.add([bg, text]);
    notification.setAlpha(0);
    
    // Анимация появления
    activeScene.tweens.add({
        targets: notification,
        alpha: 1,
        y: height * 0.8,
        duration: 300,
        ease: 'Power2.easeOut',
        onComplete: () => {
            // Автоскрытие через 3 секунды
            activeScene.time.delayedCall(3000, () => {
                activeScene.tweens.add({
                    targets: notification,
                    alpha: 0,
                    y: height * 0.85,
                    duration: 300,
                    ease: 'Power2.easeIn',
                    onComplete: () => notification.destroy()
                });
            });
        }
    });
}

window.forceCloseDueToAgreementDecline = async function () {
  try {
    // 1) фиксируем флаг (и для текущей вкладки, и на будущее)
    window.__AGREEMENT_DECLINED__ = true;
   

    // 2) глушим Phaser audio
    try {
      if (window.game?.sound) {
        window.game.sound.stopAll();
        window.game.sound.mute = true;
      }
    } catch {}

    // 3) стопаем игровой цикл
    try { window.game?.loop?.stop?.(); } catch {}

    // 4) уничтожаем Phaser целиком
    try {
      if (window.game) {
        window.game.destroy(true);
        window.game = null;
      }
    } catch {}

    // 5) best-effort: попросить VK закрыть (может не сработать на desktop_web — это ок)
    try {
      if (window.vkBridge?.supports?.('VKWebAppClose')) {
        await window.vkBridge.send('VKWebAppClose', { status: 'success' });
      } else if (window.VKSafe?.supports) {
        const ok = await window.VKSafe.supports('VKWebAppClose');
        if (ok) await window.VKSafe.send('VKWebAppClose', { status: 'success' });
      }
    } catch {}

    // 6) если VK не закрыл — показываем заглушку и больше ничего не рисуем
    document.body.innerHTML = `
      <div style="
        display:flex;align-items:center;justify-content:center;
        height:100vh;background:#0e1621;color:#fff;
        font-family:Arial;text-align:center;padding:24px;box-sizing:border-box;">
        <div>
          <h2 style="margin:0 0 12px 0;">Приложение закрыто</h2>
          <p style="margin:0;opacity:.85;">Без принятия пользовательского соглашения игра недоступна.</p>
        </div>
      </div>
    `;
  } catch (e) {
    console.warn('forceCloseDueToAgreementDecline error:', e);
  }
};


  window._nativeAlert = window.alert.bind(window);

// Заменяем все вызовы alert
window.alert = showGameNotification;

  // ========================================
  // VK BRIDGE ОБЕРТКА
  // ========================================
  
  window.VKSafe = {
    async send(method, params = {}) {
      if (!window.vkBridge) {
        throw new Error('VK Bridge not available');
      }
      
      debugLog(`VK Bridge call: ${method}`, params);
      
      try {
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
    
    async supports(method) {
      if (!window.vkBridge) return false;
      
      try {
        if (isMobile && window.vkBridge.supports) {
          return window.vkBridge.supports(method);
        }
        
        if (window.vkBridge.supportsAsync) {
          try {
            return await window.vkBridge.supportsAsync(method);
          } catch (error) {
            debugLog(`supportsAsync error for ${method}:`, error);
            return window.vkBridge.supports ? window.vkBridge.supports(method) : false;
          }
        }
        
        if (window.vkBridge.supports) {
          return window.vkBridge.supports(method);
        }
        
        return false;
      } catch (error) {
        debugLog(`supports check error for ${method}:`, error);
        return false;
      }
    },

    async storageGet(keys) {
      if (!this.isAvailable()) return null;
      try {
        const result = await this.send('VKWebAppStorageGet', { keys });
        return result;
      } catch (error) {
        console.error('VK Storage Get failed:', error);
        return null;
      }
    },

    async storageSet(key, value) {
      if (!this.isAvailable()) return false;
      try {
        await this.send('VKWebAppStorageSet', { key, value });
        return true;
      } catch (error) {
        console.error('VK Storage Set failed:', error);
        return false;
      }
    },

    async storageGetKeys(keys) {
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
    }
  };

  // ========================================
  // ПАРСИНГ VK ПАРАМЕТРОВ
  // ========================================
  
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

  // ========================================
  // ИНИЦИАЛИЗАЦИЯ VK BRIDGE
  // ========================================
  
  async function initVKBridge() {
    debugLog('Initializing VK Bridge...', {
      isMobile: isMobile,
      platform: isIOS ? 'iOS' : isAndroid ? 'Android' : 'Desktop'
    });
    
    // ✅ НОВОЕ: Используем VKManager если доступен
    if (window.VKManager) {
      try {
        console.log('🔄 Using VKManager for initialization...');
        const success = await window.VKManager.init();
        
        if (success) {
          window.VK_BRIDGE_READY = true;
          window.VK_USER_DATA = window.VKManager.getUserData();
          window.VK_LAUNCH_PARAMS = window.VKManager.getLaunchParams();
          
          debugLog('VK Manager initialized successfully');
          
          // ✅ Инициализируем ProgressSyncManager ПОСЛЕ VKManager
          await window.initGlobalSyncManager();
          
          return true;
        } else {
          console.warn('VKManager init returned false, falling back to legacy...');
        }
      } catch (error) {
        console.warn('VKManager init failed, falling back to legacy:', error);
      }
    }
    
    // ✅ FALLBACK: Старая логика (оставляем без изменений)
    try {
      const initTimeout = isMobile ? 15000 : 10000;
      
      const supportsInit = await window.VKSafe.supports('VKWebAppInit');
      if (!supportsInit) {
        throw new Error('VKWebAppInit not supported');
      }
      
      const initPromise = window.VKSafe.send('VKWebAppInit');
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('VK init timeout')), initTimeout)
      );
      
      await Promise.race([initPromise, timeoutPromise]);
      
      debugLog('VK Bridge initialized successfully');
      window.VK_BRIDGE_READY = true;
      
      const vkParams = parseVKParams();
      
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
      
      if (isMobile) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      await setupVKInterface();
      await loadUserData();
      subscribeToVKEvents();
      
      return true;
      
    } catch (error) {
      console.error('VK Bridge initialization failed:', error);
      return false;
    }
  }

  async function setupVKInterface() {
    const operations = [];
    
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
    
    if (await window.VKSafe.supports('VKWebAppDisableSwipeBack')) {
      operations.push({
        name: 'DisableSwipeBack',
        call: () => window.VKSafe.send('VKWebAppDisableSwipeBack')
      });
    }
    

    
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

  async function loadUserData() {
    const supportsUserInfo = await window.VKSafe.supports('VKWebAppGetUserInfo');
    if (!supportsUserInfo) {
      debugLog('VKWebAppGetUserInfo not supported');
      return null;
    }
    
    try {
      const userDataTimeout = isMobile ? 10000 : 5000;
      
      const userDataPromise = window.VKSafe.send('VKWebAppGetUserInfo');
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('User data request timeout')), userDataTimeout)
      );
      
      const userData = await Promise.race([userDataPromise, timeoutPromise]);
      window.VK_USER_DATA = userData;
      debugLog('User data loaded', userData);
      
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
      
      try {
        const cached = localStorage.getItem('vk_user_cache');
        if (cached) {
          const data = JSON.parse(cached);
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

  // === main.js:780-810 - ЗАМЕНИТЬ subscribeToVKEvents ===

function subscribeToVKEvents() {
  if (!window.vkBridge?.subscribe) {
    debugLog('VK Bridge subscribe not available');
    return;
  }
  
  // ✅ КРИТИЧНО: Обернуть в try-catch + async handler
  const eventHandler = async (e) => {
    try {
      const eventType = e.detail?.type;
      const eventData = e.detail?.data;
      
      debugLog(`VK Event: ${eventType}`, eventData);
      
      switch (eventType) {
case 'VKWebAppViewHide':
  if (window.__BACK_NAV_IN_PROGRESS__) {
    console.log('⛔ VKWebAppViewHide ignored (BACK navigation)');
    window.__BACK_NAV_IN_PROGRESS__ = false;
    break;
  }
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
    } catch (error) {
      // ✅ НОВОЕ: Глушим ошибки событий
      console.warn('⚠️ VK event handler error:', error.message);
    }
  };
  
  window.vkBridge.subscribe(eventHandler);
  
  // ✅ КРИТИЧНО: Сохранить handler для cleanup
  window._vkEventHandler = eventHandler;
  
  debugLog('VK Events subscription initialized');
}

// ✅ ДОБАВИТЬ: Cleanup при unload
window.addEventListener('beforeunload', () => {
  if (window.vkBridge?.unsubscribe && window._vkEventHandler) {
    window.vkBridge.unsubscribe(window._vkEventHandler);
  }
});

  function handleAppHide() {
    debugLog('App hidden - pausing game');

  // 🔊 Глушим звук и выставляем глобальный mute-флаг
  forceUserMuteOnHide();
    
    if (window.game && window.game.scene && typeof window.game.scene.getActiveScene === 'function') {
      try {
        const activeScene = window.game.scene.getActiveScene();
        if (activeScene && activeScene.scene && activeScene.scene.key === 'GameScene') {
          activeScene.canClick = false;
          
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
          
          const resumeDelay = isMobile ? 500 : 300;
          setTimeout(() => {
            if (activeScene.pausedAt && activeScene.gameMetrics) {
              const pauseDuration = Date.now() - activeScene.pausedAt;
              activeScene.gameMetrics.startTime += pauseDuration;
              activeScene.pausedAt = null;
            }
            
            activeScene.canClick = true;
            debugLog('Game resumed');

            // 🔊 Возобновляем звук (если не в mute)
            resumeGameAudio();
          }, resumeDelay);
        }
      } catch (error) {
        debugLog('Error in handleAppRestore:', error);
      }
    } else {
      debugLog('Game not ready for app restore handling');
    }
  }

function forceUserMuteOnHide() {
  try {
    if (!window.game) return;

    const game = window.game;
    const registry = game.registry;

    // ✅ ВАЖНО: НЕ МЕНЯЕМ пользовательский выбор
    // registry.set('musicMuted', true);          // ❌ убрать
    // localStorage.setItem('findpair_musicMuted','true'); // ❌ убрать

    // ✅ Просто временно глушим весь звук (на время background/hidden)
    if (game.sound) {
      game.sound.mute = true;
    }

    // ✅ Не трогаем кнопку 🔊/🔇 — это состояние пользователя, а не "фон"
    // (иначе будет ощущение, что игра сама выключила звук навсегда)

    console.log('[Audio] forceUserMuteOnHide → sound temporarily muted (user setting preserved).',
      { musicMuted: registry?.get?.('musicMuted') }
    );
  } catch (e) {
    console.warn('[Audio] forceUserMuteOnHide error:', e);
  }
}




function pauseGameAudio() {
  try {
    if (!window.game || !window.game.sound) return;

    const sound = window.game.sound;

    // ✅ Надёжный вариант для мобилок: просто заглушаем
    sound.mute = true;

    console.log('[Audio] Global mute ON (pauseGameAudio)');
  } catch (e) {
    console.warn('[Audio] pauseGameAudio error:', e);
  }
}

function resumeGameAudio() {
  try {
    if (!window.game || !window.game.sound) return;
    if (window.adsManager?.showing) {
      window.game.sound.mute = true;
      return;
    }

    const sound = window.game.sound;
    const registry = window.game.registry;

    // читаем флаг, который ты ставишь в MenuScene.initMusic / toggleMusic
    let musicMuted = false;
    if (registry) {
      const val = registry.get('musicMuted');
      musicMuted = !!val;
    }

    const ctx = sound.context || sound.audioContext || sound.ctx;

    // Пытаемся разбудить WebAudio-контекст
    if (ctx && ctx.state === 'suspended') {
      console.log('[Audio] Context is suspended, trying to resume...');

      ctx.resume().then(() => {
        console.log('[Audio] AudioContext resumed (promise resolved)');

        // 1️⃣ применяем mute после resume
        sound.mute = !!musicMuted || !!window.adsManager?.showing;

        // 2️⃣ если фоновой музыки нет или она не играет — запускаем
        tryResumeBackgroundMusic(sound, registry, musicMuted);

        // ✅ FIX #2: финальная страховка
        sound.mute = !!musicMuted || !!window.adsManager?.showing;
      }).catch((err) => {
        console.warn('[Audio] AudioContext resume failed:', err);

        // даже если не получилось, всё равно выставим mute-флаг
        sound.mute = !!musicMuted || !!window.adsManager?.showing;
      });

      return; // ждём промис
    }

    // Контекст уже running — просто синхронизируем mute и музыку
    sound.mute = !!musicMuted;
    tryResumeBackgroundMusic(sound, registry, musicMuted);

    // ✅ FIX #2: финальная синхронизация (race-case)
    sound.mute = !!musicMuted;

    console.log('[Audio] Global mute restored (resumeGameAudio). musicMuted =', musicMuted);
  } catch (e) {
    console.warn('[Audio] resumeGameAudio error:', e);
  }
}


// вспомогательный хелпер рядом с resumeGameAudio
function tryResumeBackgroundMusic(sound, registry, musicMuted) {
  try {
    if (!registry) return;

    const bgMusic = registry.get('bgMusic');
    if (!bgMusic) return;

    // Если пользователь НЕ включил mute и музыка по каким-то причинам не играет — запустим
    if (!musicMuted && !bgMusic.isPlaying && !bgMusic.isPaused) {
      console.log('[Audio] Restarting bgMusic after resume');
      bgMusic.play({ loop: true });
    }
  } catch (e) {
    console.warn('[Audio] tryResumeBackgroundMusic error:', e);
  }
}




  function handleConfigUpdate(config) {
    debugLog('VK Config updated', config);
    
    if (config && config.scheme) {
      document.body.setAttribute('data-vk-scheme', config.scheme);
    }
  }

  // ========================================
  // ЗАГРУЗКА VK BRIDGE СКРИПТА
  // ========================================
  
  function loadVKBridge(retries = 3) {
    return new Promise((resolve, reject) => {
      if (window.vkBridge) {
        debugLog('VK Bridge already loaded');
        resolve();
        return;
      }
      
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/@vkontakte/vk-bridge/dist/browser.min.js';
      
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
          }, 2000);
        } else {
          reject(new Error('Failed to load VK Bridge script'));
        }
      };
      
      document.head.appendChild(script);
    });
  }

  // ========================================
  // ИНИЦИАЛИЗАЦИЯ ИГРЫ
  // ========================================

  

  
 async function initGame() {

    
    if (document.readyState === 'loading' || !document.body) {
      console.log('DOM not ready, waiting...');
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initGame);
      } else {
        setTimeout(initGame, 100);
      }
      return;
    }

       // ResponsiveManager уже загружен через <script src="utils/ResponsiveManager.js">
   if (!window.ResponsiveManager) {
     console.error('ResponsiveManager not loaded!');
     showErrorFallback('ResponsiveManager отсутствует');
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
      hasScenes: !!(window.PreloadScene && window.MenuScene && window.GameScene && window.AchievementsScene),
      screen: `${screen.width}x${screen.height}`,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      dpr: window.devicePixelRatio || 1
    });

    let gameContainer = document.getElementById('game');
    
    if (!gameContainer) {
      console.warn('Game container not found! Creating immediately...');
      
      gameContainer = document.createElement('div');
      gameContainer.id = 'game';
      
      gameContainer.style.cssText = `
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 0;
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
      
      if (document.body) {
        document.body.appendChild(gameContainer);
        
        if (isMobile) {
          document.body.style.cssText = `
            touch-action: none;
            overflow: hidden;
              margin: 0;
  padding: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  position: fixed;
  top: 0;
  left: 0;
  background: #1d2330;
          `;
          
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
      
      const verification = document.getElementById('game');
      if (!verification) {
        console.error('Failed to create game container, retrying...');
        setTimeout(initGame, isMobile ? 200 : 100);
        return;
      }
      
      console.log('Game container created successfully');
    }

    if (!gameContainer || !gameContainer.parentNode) {
      console.error('Game container validation failed, retrying...');
      setTimeout(initGame, isMobile ? 200 : 100);
      return;
    }

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

    // Определяем ориентацию ПЕРЕД использованием
    const isPortrait = window.innerHeight > window.innerWidth;
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    
    let gameWidth, gameHeight;
    
    if (isMobile) {
      gameWidth = window.innerWidth;
    gameHeight = window.innerHeight;
  } else {
    // Для десктопа можно фиксировать
    gameWidth = 1920;
    gameHeight = 1080;
    }
    
    console.log('📐 Game dimensions calculated:', {
  isMobile: isMobile,
  isPortrait: isPortrait,
  gameSize: `${gameWidth}x${gameHeight}`,
  viewport: `${window.innerWidth}x${window.innerHeight}`,
  screen: `${screen.width}x${screen.height}`
});

   // === main.js:870 - ВСТАВИТЬ ПЕРЕД responsiveManager ===

// ✅ FIX #1: Определяем класс устройства
const getDeviceClass = () => {
  const hardwareConcurrency = navigator.hardwareConcurrency || 2;
  const deviceMemory = navigator.deviceMemory || 2;
  
  const isLowEnd = hardwareConcurrency <= 2 || deviceMemory <= 2;
  
  return {
    isLowEnd: isLowEnd,
    isHighEnd: hardwareConcurrency >= 4 && deviceMemory >= 4
  };
};

const deviceClass = getDeviceClass();

// ✅ FIX #1: Адаптивный DPR (КРИТИЧНО!)
const getOptimalDPR = () => {
  const rawDPR = window.devicePixelRatio || 1;
  
  if (deviceClass.isLowEnd) {
    return Math.min(1.0, rawDPR); // Слабые: 1x максимум
  }
  
  if (isMobile) {
    return Math.min(1.5, rawDPR); // Мобильные: 1.5x максимум
  }
  
  return Math.min(2.0, rawDPR); // Десктоп: 2x максимум
};

window._cachedDPR = getOptimalDPR(); // ✅ Кэшируем
   //game.registry.set('cachedDPR', window._DPR);
//game.registry.set('useHDTextures', window._DPR >= 1.5);

console.log('📱 Device config:', {
  isMobile,
  isLowEnd: deviceClass.isLowEnd,
  rawDPR: window.devicePixelRatio || 1,
  usedDPR: window._cachedDPR
});

// === main.js:885 - ЗАМЕНИТЬ ===

const responsiveManager = new window.ResponsiveManager();

// ✅ Передаём данные в ResponsiveManager
responsiveManager.deviceClass = deviceClass;
responsiveManager.cachedDPR = window._cachedDPR;

const gameConfig = responsiveManager.getOptimalGameConfig();

gameConfig.scene = [
  window.PreloadScene,
  window.MenuScene,
  window.GameScene,
  window.AchievementsScene   // 👈 новая сцена
];


// Добавить callbacks
// === main.js:874-895 - ЗАМЕНИТЬ preBoot ЦЕЛИКОМ ===

gameConfig.callbacks = {
  preBoot: (game) => {
    console.log('🔄 [preBoot] Initializing ProgressSyncManager...');
    
    
  },
  
  postBoot: (game) => {
    // Resize handler (без изменений)
    let resizeTimeout;
    game.scale.on('resize', () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        console.log('🔄 Debounced resize triggered');
        game.events.emit('debounced-resize');
      }, 150);
    });
    
    game.events.on('debounced-resize', () => {
      const activeScene = game.scene.getScenes(true)[0];
      if (activeScene?.handleResize) {
        const gameSize = game.scale.gameSize;
        activeScene.handleResize(gameSize);
      }
    });
    // ✅ ДОБАВИТЬ: Регистрация менеджера ПОСЛЕ его готовности
    if (window.progressSyncManager) {
      game.registry.set('progressSyncManager', window.progressSyncManager);
      console.log('✅ ProgressSyncManager registered in postBoot');
    } else {
      console.warn('⚠️ ProgressSyncManager not ready in postBoot');
    }
  }
};



function startPhaserGame() {
  try {
    console.log('Creating Phaser game...');
    window.game = new Phaser.Game(gameConfig);

    // ✅ Когда Phaser полностью поднялся
    window.game.events.once('ready', function () {
      console.log('🎮 Game ready event triggered');
      console.log('🎭 Available scenes:', window.game.scene.scenes.map(s => s.scene.key));

      // Прячем HTML-прелоадер
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

      // Прокидываем VK/девайс данные в registry
      window.game.registry.set('vkUserData', window.VK_USER_DATA);
      window.game.registry.set('vkLaunchParams', window.VK_LAUNCH_PARAMS);
      window.game.registry.set('isVKEnvironment', isVKEnvironment);
      window.game.registry.set('vkBridgeAvailable', window.VKSafe?.isAvailable() || false);
      window.game.registry.set('isMobile', isMobile);
      window.game.registry.set('isIOS', isIOS);
      window.game.registry.set('isAndroid', isAndroid);
      window.game.registry.set('deviceClass', deviceClass);
      window.game.registry.set('cachedDPR', window._cachedDPR);
      window.game.registry.set('useHDTextures', window._cachedDPR >= 1.5);

      // 🔊 1) WEB/desktop: пробуем сразу включить звук, если нет mute
      if (!isMobile) {
        try {
          console.log('[Audio] Trying auto resume on web/desktop...');
          resumeGameAudio(); // учитывает registry.musicMuted и bgMusic
        } catch (e) {
          console.warn('[Audio] Auto resume failed on web:', e);
        }
      }

      // 🔊 2) Универсальный "будильник" аудио на первый тач по canvas
      try {
        const canvas = window.game.canvas;
        if (canvas && !canvas._audioWakeBound) {
          const wakeAudio = () => {
            try {
              console.log('[Audio] wakeAudio pointerdown → resumeGameAudio()');
              resumeGameAudio();
            } catch (e) {
              console.warn('[Audio] wakeAudio handler error:', e);
            }
          };

          // pointerdown работает и для мыши, и для тача
          canvas.addEventListener('pointerdown', wakeAudio, { passive: true });
          canvas._audioWakeBound = true;

          console.log('[Audio] Global pointerdown wakeAudio listener attached');
        }
      } catch (e) {
        console.warn('[Audio] Failed to attach wakeAudio listener:', e);
      }

      // ❌ НИЧЕГО тут больше не стартуем руками
      // PreloadScene уже работает как первая сцена
    });

  } catch (e) {
    console.error('❌ Failed to create Phaser game:', e);
    showErrorFallback('Не удалось создать игру', e.message);
  }
}





   const MAX_FONT_WAIT = 4000;

startPhaserGame();

    

  }

  // ========================================
  // ПАТЧ: ГЛОБАЛЬНАЯ ИНИЦИАЛИЗАЦИЯ SYNC MANAGER
  // ========================================
  
  window.initGlobalSyncManager = async function() {
    try {
      if (!window.progressSyncManager) {
        console.log('🔄 Creating ProgressSyncManager...');
        
        // ✅ ИСПРАВЛЕНО: Ждём готовности VKManager
        if (window.VKManager && !window.VKManager.isReady) {
          console.log('⏳ Waiting for VKManager...');
          await window.VKManager.init().catch(e => {
            console.warn('VKManager init failed, continuing:', e);
          });
        }
        
        window.progressSyncManager = new ProgressSyncManager();
        
        // ✅ Инициализируем явно
        await window.progressSyncManager.init();
        
        // ✅ Устанавливаем обработчики
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
        
        console.log('✅ Global ProgressSyncManager initialized');
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
  // ПУБЛИЧНЫЕ МЕТОДЫ ДЛЯ ИГРЫ
  // ========================================
  
  window.VKHelpers = {
    shareResult: function(score, level) {
      if (!window.VK_BRIDGE_READY) return Promise.reject('VK Bridge not ready');

      return window.VKSafe.send('VKWebAppShare', {
        link: window.location.href + `?shared_score=${score}&level=${level}`
      });
    },

    showAd: function() {
      if (!window.VK_BRIDGE_READY) return Promise.reject('VK Bridge not ready');

      return window.VKSafe.send('VKWebAppShowNativeAds', {
        ad_format: 'interstitial'
      });
    },

    setStorageData: function(key, value) {
      if (!window.VK_BRIDGE_READY) return Promise.reject('VK Bridge not ready');

      return window.VKSafe.send('VKWebAppStorageSet', {
        key: key,
        value: JSON.stringify(value)
      });
    },

    getStorageData: function(keys) {
      if (!window.VK_BRIDGE_READY) return Promise.reject('VK Bridge not ready');

      return window.VKSafe.send('VKWebAppStorageGet', {
        keys: Array.isArray(keys) ? keys : [keys]
      });
    },

    isSupported: function(method) {
      return window.VKSafe.supports(method);
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

  // ========================================
  // ГЛАВНАЯ ФУНКЦИЯ
  // ========================================
  
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


  // Создаём базовую точку истории, чтобы Android Back не закрывал WebView сразу
if (window.history && history.replaceState) {
  history.replaceState({ scene: 'ROOT' }, '');
}

      // 3️⃣ СРАЗУ СТАРТУЕМ ИГРУ — БЕЗ ОЖИДАНИЯ VK
  initGame();




  // === GLOBAL BACK HANDLER (Android / VK Mini Apps) ===
if (!window.__BACK_HANDLER_BOUND__) {
  window.__BACK_HANDLER_BOUND__ = true;

window.addEventListener('popstate', (e) => {
  console.log('🧭 popstate:', e.state, 'current:', history.state);

  // ✅ КЛЮЧ: не даём WebView "уйти назад" дальше и закрыть мини-апп
  // Подкладываем обратно ROOT-точку истории
  try {
    if (window.history && history.pushState) {
      history.pushState({ scene: 'ROOT' }, '');
    }
  } catch {}

  handleSystemBack('popstate');
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Backspace' || e.key === 'Escape') {
    e.preventDefault();
    handleSystemBack('keydown');
  }
});

document.addEventListener('backbutton', (e) => {
  e.preventDefault();
  handleSystemBack('backbutton');
}, false);


}


function handleSystemBack(source = 'unknown') {

  const game = window.game;
  const sm = game?.scene;
  if (!sm) return;
  
const gameScene = sm.getScene && sm.getScene('GameScene');
const gameActive = !!(gameScene && gameScene.scene && gameScene.scene.isActive());




  // ✅ Анти-двойной вызов (VK Android иногда дёргает back дважды)
  const now = Date.now();
  if (window.__BACK_LOCK_TS__ && (now - window.__BACK_LOCK_TS__ < 400)) {
    console.log('🔙 Back ignored (lock)', source);
    return;
  }
  window.__BACK_LOCK_TS__ = now;

  // 🔑 твой флаг оставляем
  window.__BACK_NAV_IN_PROGRESS__ = true;

  // ✅ Надёжная проверка: не "первая активная", а конкретно сцена достижений
  const achScene = sm.getScene && sm.getScene('AchievementsScene');
  const menuScene = sm.getScene && sm.getScene('MenuScene');

  // 2) Если в игре — отдаём сцене (она покажет confirm)
if (gameActive) {
  try {
    if (typeof gameScene.onSystemBack === 'function') {
      gameScene.onSystemBack();
      return;
    }
  } catch (e) {
    console.warn('GameScene onSystemBack failed', e);
  }

  // жёсткий фоллбек если метода нет
  try { sm.start('MenuScene', { page: 0 }); } catch (e) {}
  try { sm.bringToTop('MenuScene'); } catch (e) {}
  return;
}


  const achActive = !!(achScene && achScene.scene && achScene.scene.isActive());
  const menuActive = !!(menuScene && menuScene.scene && menuScene.scene.isActive());

  console.log('🔙 System BACK', source, 'achActive=', achActive, 'menuActive=', menuActive);

  // 1) Если в достижениях — СТОПАЕМ достижения, ЗАПУСКАЕМ меню и ПОДНИМАЕМ его
  if (achActive) {
    try { sm.stop('AchievementsScene'); } catch (e) { console.warn('stop AchievementsScene failed', e); }

    try { sm.start('MenuScene', { page: 0 }); } catch (e) { console.warn('start MenuScene failed', e); }

    try { sm.bringToTop('MenuScene'); } catch (e) {}
    return;
  }

  // 2) Если в меню — игнор (как ты хотел)
  if (menuActive) {
    console.log('🔙 Back on MenuScene ignored');
    return;
  }

  // 3) Фоллбек: если вообще непонятно где — в меню
  try { sm.start('MenuScene', { page: 0 }); } catch (e) {}
  try { sm.bringToTop('MenuScene'); } catch (e) {}
}




// 4️⃣ А ТЕПЕРЬ — VK / SYNC В ФОНЕ


    if (isVKEnvironment) {

 // Фоновая VK-инициализация, НЕ блокирует игру
    (async () => {

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

        // Fallback: хотя бы локальный ProgressSyncManager
        try {
          await window.initGlobalSyncManager();
        } catch (e) {
          console.warn('ProgressSyncManager init failed in fallback:', e);
        }

      }

      })();

    } else {

    (async () => {
      debugLog('Not VK environment, starting sync manager directly');
      try {
        await window.initGlobalSyncManager();
      } catch (e) {
        console.warn('ProgressSyncManager init failed:', e);
      }
    })();
  }
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

        // 🔊 Глушим все звуки + ставим глобальный mute-флаг и кнопку
        forceUserMuteOnHide();
          
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

        // 🔊 Возобновляем звук
        resumeGameAudio();
          
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
  // ЗАПУСК
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
  // DEBUG УТИЛИТЫ
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

      async performanceTest() {
        if (!isMobile) {
          console.log('Performance test is designed for mobile devices');
          return;
        }

        console.group('📊 Mobile Performance Test');
        
        const start = performance.now();
        
        const objects = [];
        for (let i = 0; i < 1000; i++) {
          objects.push({ id: i, data: Math.random() });
        }
        
        const createTime = performance.now() - start;
        console.log('Object Creation Time:', `${createTime.toFixed(2)}ms`);
        
        const arrayStart = performance.now();
        objects.sort((a, b) => a.data - b.data);
        const sortTime = performance.now() - arrayStart;
        console.log('Array Sort Time:', `${sortTime.toFixed(2)}ms`);
        
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

  // ========================================
  // ВСПОМОГАТЕЛЬНО: Определение ключа прогресса
  // ========================================
  function detectProgressStorageKey() {
    try {
      const userId =
        (window.VK_USER_DATA && window.VK_USER_DATA.id) ||
        (window.VK_LAUNCH_PARAMS && window.VK_LAUNCH_PARAMS.vk_user_id);

      // Кандидаты по умолчанию
      const candidates = [];
      if (userId) {
        candidates.push(`findpair_progress_${userId}`);
      }
      candidates.push('findpair_progress');

      // Пытаемся найти реально существующий ключ в localStorage
      const ls = window.localStorage || null;
      if (ls) {
        const keys = Object.keys(ls);
        const existing = keys.find(k => k.startsWith('findpair_progress'));
        if (existing) {
          return existing;
        }
      }

      // Фоллбек
      return candidates[0];
    } catch (e) {
      console.warn('detectProgressStorageKey error:', e);
      return 'findpair_progress';
    }
  }

  
// ========================================
// DEBUG: Полный жёсткий сброс прогресса и достижений
// ========================================
window.resetAllGameProgress = async function () {
  try {
    console.log('🧹 Starting HARD progress reset (ALL keys).');

    // Убедимся, что sync-менеджер инициализирован (для VKHelpers и т.п.)
    if (!window.progressSyncManager && window.initGlobalSyncManager) {
      console.warn('progressSyncManager not ready, initializing.');
      await window.initGlobalSyncManager();
    }

    const now = Date.now();

    const emptyProgress = {
      // Метаданные времени
      timestamp: now,
      lastModified: now,

      // Фактические данные прогресса (пустые)
      levels: {},
      stats: {
        gamesPlayed: 0,
        totalTime: 0,
        totalErrors: 0,
        bestTime: null,
        lastPlayed: 0,
        perfectGames: 0,
        totalStars: 0
      },
      achievements: {},

      // 👇 Ключевой флаг, который увидит ProgressSyncManager
      isReset: true
    };

    const emptyJson = JSON.stringify(emptyProgress);

    // 1) Собираем ВСЕ ключи прогресса в localStorage
    const lsKeys = [];
    if (window.localStorage) {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('findpair_progress')) {
          lsKeys.push(key);
        }
      }
    }

    console.log('📦 Local progress keys:', lsKeys);

    // 2) Перезаписываем ВСЕ такие ключи в localStorage
    lsKeys.forEach(key => {
      try {
        localStorage.setItem(key, emptyJson);
        console.log('💾 localStorage reset:', key);
      } catch (e) {
        console.warn('localStorage reset error for', key, e);
      }
    });

    // 3) Перезаписываем те же ключи в VK Storage (если есть VKHelpers)
    if (window.VKHelpers && typeof window.VKHelpers.setStorageData === 'function') {
      for (const key of lsKeys) {
        try {
          await window.VKHelpers.setStorageData(key, emptyProgress);
          console.log('☁️ VK Storage reset:', key);
        } catch (e) {
          console.warn('VK Storage reset error for', key, e);
        }
      }

      // На всякий случай — базовый ключ без id и с текущим vk_user_id
      const userId =
        (window.VK_LAUNCH_PARAMS && window.VK_LAUNCH_PARAMS.vk_user_id) ||
        (window.VK_USER_DATA && window.VK_USER_DATA.id);

      const extraKeys = ['findpair_progress'];
      if (userId) extraKeys.push(`findpair_progress_${userId}`);

      for (const key of extraKeys) {
        try {
          await window.VKHelpers.setStorageData(key, emptyProgress);
          console.log('☁️ VK Storage extra reset:', key);
        } catch (e) {
          console.warn('VK Storage extra reset error for', key, e);
        }
      }
    } else {
      console.warn('VKHelpers.setStorageData not available, VK storage not fully reset.');
    }

    // 4) Обновляем кеш менеджера прогресса
    if (window.progressSyncManager) {
      try {
        if ('_lastLocalProgress' in window.progressSyncManager) {
          window.progressSyncManager._lastLocalProgress = emptyProgress;
        }
        if ('_cachedProgress' in window.progressSyncManager) {
          window.progressSyncManager._cachedProgress = emptyProgress;
        }
        console.log('📥 ProgressSyncManager cache updated with empty progress.');
      } catch (e) {
        console.warn('Failed to update ProgressSyncManager cache:', e);
      }
    }

    console.log('✅ HARD reset completed (ALL keys).');

    if (window.showToast) {
      window.showToast('Прогресс и достижения сброшены, перезагрузите страницу.', 'success', 4000);
    }
  } catch (e) {
    console.error('resetAllGameProgress error:', e);
    if (window.showToast) {
      window.showToast('Ошибка сброса прогресса', 'error', 3000);
    }
  }
};



  // ========================================
  // DEBUG AGREEMENT УТИЛИТЫ
  // ========================================
  
window.DebugAgreement = {
  reset: async function() {
    // 1) Локальный сброс
    try {
      localStorage.removeItem('acceptedAgreement');
      localStorage.removeItem('agreementVersion');
      localStorage.removeItem('agreementAcceptedAt');
      localStorage.removeItem('vk_agreement_shown');
      localStorage.removeItem('firstLaunchShown');
      localStorage.removeItem('findpair_agreement_declined');
window.__AGREEMENT_DECLINED__ = false;

      console.log('✅ Agreement data cleared in localStorage');
    } catch (e) {
      console.warn('Local agreement clear error:', e);
    }

    // 2) Сброс в VK Storage
    try {
      if (window.VKHelpers && typeof window.VKHelpers.setStorageData === 'function') {
        await window.VKHelpers.setStorageData('findpair_agreement_v1', {
          accepted: false,
          version: null,
          acceptedAt: null
        });
        console.log('☁️ VK Storage agreement reset (findpair_agreement_v1)');
      } else {
        console.log('VKHelpers.setStorageData not available, VK agreement not cleared from VK Storage');
      }
    } catch (e) {
      console.warn('VK Storage agreement reset error:', e);
    }

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

accept: async function() {
  const acceptedAt = new Date().toISOString();

  // 1) Локально
  try {
    localStorage.setItem('acceptedAgreement', 'true');
    localStorage.setItem('agreementVersion', '2025-09-13');
    localStorage.setItem('agreementAcceptedAt', acceptedAt);
    localStorage.setItem('vk_agreement_shown', '1');
  } catch (e) {
    console.warn('Failed to save agreement to localStorage', e);
  }

  // 2) В VK Storage
  try {
    if (window.VKHelpers && typeof window.VKHelpers.setStorageData === 'function') {
      await window.VKHelpers.setStorageData('findpair_agreement_v1', {
        accepted: true,
        version: '2025-09-13',
        acceptedAt
      });
      console.log('☁️ VK Storage: agreement stored (findpair_agreement_v1)');
    } else {
      console.log('VKHelpers.setStorageData not available, VK agreement stored only locally');
    }
  } catch (e) {
    console.warn('VK Storage agreement save error:', e);
  }

  console.log('✅ Agreement accepted (local + VK Storage)');
}

  };

  console.log(`
🔧 DEBUG COMMANDS доступны:

DebugAgreement.reset()  - сбросить соглашение
DebugAgreement.status() - проверить статус  
DebugAgreement.show()   - показать соглашение
DebugAgreement.accept() - принять соглашение

Пример: DebugAgreement.reset(); location.reload();
`);

})();
