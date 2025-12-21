// utils/vk-manager.js - ЕДИНЫЙ МЕНЕДЖЕР VK API
class VKManager {
  constructor() {
    this.bridge = null;
    this.isReady = false;
    this.isInitializing = false;
    this.pendingOperations = [];
    this.userData = null;
    this.launchParams = null;
    this.storageCache = new Map();
    this.retryQueue = [];
    
    // Настройки retry
    this.maxRetries = 3;
    this.retryDelay = 1000; // начальная задержка
    
    this.debugMode = window.location.search.includes('debug=1') || 
                     window.location.hostname === 'localhost';
  }

  debug(message, data = null) {
    if (this.debugMode) {
      console.log(`[VKManager] ${message}`, data || '');
    }
  }

  async init() {
    if (this.isReady) return true;
    if (this.isInitializing) {
      // Ждем завершения текущей инициализации
      return new Promise((resolve) => {
        const checkReady = () => {
          if (this.isReady || !this.isInitializing) {
            resolve(this.isReady);
          } else {
            setTimeout(checkReady, 100);
          }
        };
        checkReady();
      });
    }

    this.isInitializing = true;
    this.debug('Initializing VK Manager...');

    try {
      // Загружаем VK Bridge если нужно
      if (!window.vkBridge) {
        await this.loadVKBridge();
      }

      this.bridge = window.vkBridge;
      
      // Инициализируем VK Bridge
      await this.bridge.send('VKWebAppInit');
      this.debug('VK Bridge initialized');

      // Парсим launch параметры
      this.launchParams = this.parseLaunchParams();
      this.debug('Launch params parsed', this.launchParams);

      // Загружаем данные пользователя
      try {
        this.userData = await this.bridge.send('VKWebAppGetUserInfo');
        this.debug('User data loaded', this.userData);
      } catch (error) {
        this.debug('Failed to load user data:', error);
      }

      // Настраиваем интерфейс
      await this.setupInterface();

      this.isReady = true;
      this.isInitializing = false;

      // Обрабатываем отложенные операции
      this.processPendingOperations();

      // Запускаем retry queue processor
      this.startRetryProcessor();

      this.debug('VK Manager ready');
      return true;

    } catch (error) {
      this.debug('VK Manager initialization failed:', error);
      this.isInitializing = false;
      return false;
    }
  }

  // 🔹 Безопасное добавление на главный экран
async addToHomeScreenSafe() {
  // Уже добавлено
  if (this.isAddedToHomeScreen()) {
    return {
      alreadyAdded: true
    };
  }

  // Метод не поддерживается
  if (!this.isSupported('VKWebAppAddToHomeScreen')) {
    throw new Error('VKWebAppAddToHomeScreen not supported');
  }

  await this.send('VKWebAppAddToHomeScreen');
  return { added: true };
}


  isAddedToHomeScreen() {
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get('vk_has_shortcut') === '1';
  } catch (e) {
    return false;
  }
}

  async loadVKBridge() {
    if (window.vkBridge) return;

    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/@vkontakte/vk-bridge/dist/browser.min.js';
      
      const timeout = setTimeout(() => {
        reject(new Error('VK Bridge load timeout'));
      }, 10000);

      script.onload = () => {
        clearTimeout(timeout);
        
        // Ждем пока vkBridge станет доступен
        const checkBridge = (attempts = 50) => {
          if (window.vkBridge) {
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
        reject(new Error('Failed to load VK Bridge'));
      };

      document.head.appendChild(script);
    });
  }

  parseLaunchParams() {
    const params = new URLSearchParams(window.location.search);
    return {
      user_id: params.get('vk_user_id'),
      app_id: params.get('vk_app_id'),
      platform: params.get('vk_platform') || 'web',
      language: params.get('vk_language') || 'ru',
      is_app_user: params.get('vk_is_app_user') === '1',
      are_notifications_enabled: params.get('vk_are_notifications_enabled') === '1',
      group_id: params.get('vk_group_id'),
      ref: params.get('vk_ref'),
      sign: params.get('sign'),
      ts: params.get('vk_ts')
    };
  }

  async setupInterface() {
    const operations = [
      {
        method: 'VKWebAppSetViewSettings',
        params: {
          status_bar_style: 'light',
          action_bar_color: '#1d2330',
          navigation_bar_color: '#1d2330'
        }
      },
      {
        method: 'VKWebAppDisableSwipeBack',
        params: {}
      }
    ];

    const results = await Promise.allSettled(
      operations.map(op => this.send(op.method, op.params))
    );

    this.debug('Interface setup results', results);
  }

  async send(method, params = {}) {
    if (!this.isReady) {
      return new Promise((resolve, reject) => {
        this.pendingOperations.push({ method, params, resolve, reject });
      });
    }

    if (!this.bridge?.supports(method)) {
      throw new Error(`Method ${method} not supported`);
    }

    try {
      const result = await this.bridge.send(method, params);
      this.debug(`${method} success`, result);
      return result;
    } catch (error) {
      this.debug(`${method} failed`, error);
      
      // Добавляем в retry queue для некритичных операций
      if (this.shouldRetry(method, error)) {
        this.addToRetryQueue(method, params);
      }
      
      throw error;
    }
  }

  shouldRetry(method, error) {
    // Retry для storage операций и некритичных методов
    const retryableMethods = ['VKWebAppStorageSet', 'VKWebAppStorageGet'];
    const retryableErrors = [408, 429, 500, 502, 503, 504]; // timeout, rate limit, server errors
    
    return retryableMethods.includes(method) && 
           (retryableErrors.includes(error.error_data?.error_code) || 
            error.message?.includes('timeout'));
  }

  addToRetryQueue(method, params, attempt = 1) {
    if (attempt > this.maxRetries) {
      this.debug(`Max retries exceeded for ${method}`);
      return;
    }

    this.retryQueue.push({
      method,
      params,
      attempt,
      timestamp: Date.now()
    });
  }

  startRetryProcessor() {
    setInterval(() => {
      this.processRetryQueue();
    }, 5000); // проверяем каждые 5 секунд
  }

  async processRetryQueue() {
    if (this.retryQueue.length === 0) return;

    const now = Date.now();
    const operations = this.retryQueue.splice(0); // берем все операции

    for (const op of operations) {
      const delay = this.retryDelay * Math.pow(2, op.attempt - 1); // exponential backoff
      
      if (now - op.timestamp >= delay) {
        try {
          await this.send(op.method, op.params);
          this.debug(`Retry success: ${op.method} (attempt ${op.attempt})`);
        } catch (error) {
          this.debug(`Retry failed: ${op.method} (attempt ${op.attempt})`, error);
          this.addToRetryQueue(op.method, op.params, op.attempt + 1);
        }
      } else {
        // Возвращаем в очередь если еще рано
        this.retryQueue.push(op);
      }
    }
  }

  processPendingOperations() {
    const operations = this.pendingOperations.splice(0);
    
    operations.forEach(async (op) => {
      try {
        const result = await this.send(op.method, op.params);
        op.resolve(result);
      } catch (error) {
        op.reject(error);
      }
    });
  }

  // Методы для работы с хранилищем с кешированием
  async getStorageData(keys) {
    const keyArray = Array.isArray(keys) ? keys : [keys];
    const result = { keys: [] };
    const uncachedKeys = [];

    // Проверяем кеш
    keyArray.forEach(key => {
      if (this.storageCache.has(key)) {
        const cached = this.storageCache.get(key);
        result.keys.push({ key, value: cached.value });
      } else {
        uncachedKeys.push(key);
      }
    });

    // Загружаем недостающие данные
    if (uncachedKeys.length > 0) {
      try {
        const response = await this.send('VKWebAppStorageGet', { keys: uncachedKeys });
        
        if (response.keys) {
          response.keys.forEach(item => {
            // Обновляем кеш
            this.storageCache.set(item.key, {
              value: item.value,
              timestamp: Date.now()
            });
            result.keys.push(item);
          });
        }
      } catch (error) {
        this.debug('Storage get failed, trying fallback', error);
        
        // Fallback на localStorage
        // Fallback на localStorage (user-specific + backward compatibility)
        
uncachedKeys.forEach(key => {
  try {
    // Новый формат: vk_storage_<userId>_<key>
    const fallbackKey = this.getStorageFallbackKey(key);
    let localValue = localStorage.getItem(fallbackKey);

    // Backward compatibility: старый общий ключ (если надо)
    if (!localValue) {
      localValue = localStorage.getItem(`vk_storage_${key}`);
    }

    if (localValue) {
      result.keys.push({ key, value: localValue });
    }
  } catch (e) {
    this.debug('LocalStorage fallback error', e);
  }
});

      }
    }

    return result;
  }

getStorageFallbackKey(key) {
  let userId = 'anonymous';

  // 0. Самый надёжный источник — query-параметр
  try {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get('vk_user_id');
    if (fromUrl) {
      userId = String(fromUrl);
    }
  } catch (e) {
    // игнорируем
  }

  // 1. Если вдруг из URL не достали — пробуем launchParams
  if (userId === 'anonymous') {
    const lp = this.getLaunchParams && this.getLaunchParams();
    if (lp?.user_id) {
      userId = String(lp.user_id);
    } else if (this.userData?.id) {
      userId = String(this.userData.id);
    }
  }

  return `vk_storage_${userId}_${key}`;
}



  async setStorageData(key, value) {
    const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
    
    try {
      await this.send('VKWebAppStorageSet', { key, value: stringValue });
      
      // Обновляем кеш
      this.storageCache.set(key, {
        value: stringValue,
        timestamp: Date.now()
      });

      // Дублируем в localStorage как fallback
      //localStorage.setItem(`vk_storage_${key}`, stringValue);
      const fallbackKey = this.getStorageFallbackKey(key);
localStorage.setItem(fallbackKey, stringValue);
      
      return true;
    } catch (error) {
      this.debug('Storage set failed, using localStorage fallback', error);
      //localStorage.setItem(`vk_storage_${key}`, stringValue);
      const fallbackKey = this.getStorageFallbackKey(key);
localStorage.setItem(fallbackKey, stringValue);
      return false;
    }
  }

  // Методы для получения данных
  getUserData() {
    return this.userData;
  }

  getLaunchParams() {
    return this.launchParams;
  }

  isSupported(method) {
    return this.bridge?.supports(method) || false;
  }

  isAvailable() {
    return this.isReady && !!this.bridge;
  }

  // Методы для sharing и других VK функций
  async shareResult(score, level) {
    return this.send('VKWebAppShare', {
      link: `${window.location.href}?shared_score=${score}&level=${level}`
    });
  }

  async showAd() {
    return this.send('VKWebAppShowNativeAds', {
      ad_format: 'interstitial'
    });
  }

  async allowNotifications() {
    try {
      return await this.send('VKWebAppAllowNotifications');
    } catch (error) {
      // Обрабатываем специфичные ошибки уведомлений
      if (error.error_data?.error_code === 15) {
        this.debug('Notifications: App needs moderation approval');
      } else if (error.error_data?.error_code === 4) {
        this.debug('Notifications: User denied permission');
      }
      throw error;
    }
  }

  // Cleanup
  destroy() {
    this.storageCache.clear();
    this.pendingOperations.length = 0;
    this.retryQueue.length = 0;
    this.isReady = false;
    this.bridge = null;
  }
}

// Создаем глобальный экземпляр
window.VKManager = new VKManager();

export default window.VKManager;
