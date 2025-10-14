/**
 * ProgressSyncManager.js - ПОЛНОСТЬЮ ИСПРАВЛЕННАЯ ВЕРСИЯ
 * Синглтон для управления синхронизацией прогресса VK Mini Apps
 */

class ProgressSyncManager {
  constructor() {
    // Проверка синглтона
    if (ProgressSyncManager.instance) {
      console.log('📦 Returning existing ProgressSyncManager instance');
      return ProgressSyncManager.instance;
    }
    
    this.version = '1.0';
    this.localKey = 'findpair_progress';
    this.vkKey = 'findpair_progress';
    this.achievementsKey = 'findpair_achievements';
    
    this.isSyncing = false;
    this.isInitialized = false;
    this.lastSyncTime = 0;
    this.syncQueue = [];
    this.autoSyncInterval = null;
    
    this.settings = {
      syncInterval: 30000,
      retryAttempts: 3,
      retryDelay: 1000,
      debounceDelay: 2000,
      compressionThreshold: 1024
    };
    
    this.onSyncStart = null;
    this.onSyncComplete = null;
    this.onSyncError = null;
    this.onProgressUpdate = null;

    this._vkAvailabilityLogged = false; // ← Флаг для логирования
    
    // Сохраняем экземпляр
    ProgressSyncManager.instance = this;
    
    // Автоинициализация при создании
    console.log('🆕 ProgressSyncManager singleton created');
    // Запускаем инициализацию асинхронно
    setTimeout(() => this.init().catch(console.error), 0);
  }

  async init() {
    if (this.isInitialized) {
      console.log('⚠️ ProgressSyncManager already initialized');
      return;
    }
    
    console.log('🔄 ProgressSyncManager initializing...');
    this.isInitialized = true;
    
    try {
      await this.loadInitialData();
      this.startAutoSync();
      this.subscribeToVKEvents();
      console.log('✅ ProgressSyncManager initialized successfully');
    } catch (error) {
      console.error('❌ ProgressSyncManager initialization failed:', error);
      this.isInitialized = false;
      throw error;
    }
  }

  async loadInitialData() {
  try {
    console.log('📂 Loading initial data...');
    
    // Сначала загружаем локальные данные
    const localData = this.loadFromLocal();
    
    // ✅ ИСПРАВЛЕНО: Проверяем VK ТОЛЬКО если явно включен
    if (!this.isVKAvailable()) {
      console.log('📱 VK not available - using local storage only');
      return localData;
    }
    
    // Пытаемся синхронизироваться с VK (неблокирующе)
    try {
      console.log('☁️ Attempting VK sync...');
      const synced = await this.performSync();
      
      if (synced) {
        console.log('✅ Initial VK sync completed');
        return this.loadFromLocal(); // Возвращаем актуальные данные
      }
    } catch (vkError) {
      // ✅ ВАЖНО: Не падаем на ошибке VK, просто логируем
      console.log('📱 VK sync failed, continuing with local data:', vkError.message);
    }
    
    return localData;
    
  } catch (error) {
    console.error('❌ Failed to load initial data:', error);
    // Возвращаем дефолтные данные вместо падения
    return this.getDefaultProgressData();
  }
}

  // === ProgressSyncManager.js:85-126 - ОБЕРНУТЬ performSync ===

// === ProgressSyncManager.js:85-126 - ЗАМЕНИТЬ performSync ===

async performSync() {
  // ✅ ДОБАВИТЬ: Проверка существующего debounce
  if (this._syncDebounceTimer) {
    console.log('⏳ Sync debounced (timer active)');
    return false; // Прерываем, не создаём новый Promise
  }
  
  // ✅ ДОБАВИТЬ: Защита от параллельных вызовов
  if (this.isSyncing) {
    console.log('⏳ Sync already in progress');
    return false;
  }
  
  return new Promise((resolve, reject) => {
    this._syncDebounceTimer = setTimeout(async () => {
      this._syncDebounceTimer = null;
      
      if (!this.isVKAvailable()) {
        console.log('📱 Sync skipped - VK not available');
        resolve(false);
        return;
      }
      
      this.isSyncing = true;
      
      if (this.onSyncStart) {
        this.onSyncStart();
      }
      
      try {
        console.log('🔄 Starting VK sync...');
        
        const vkData = await this.loadFromVK();
        const localData = this.loadFromLocal();
        const mergedData = this.mergeProgressData(localData, vkData);
        
        await this.saveToVK(mergedData);
        this.saveToLocal(mergedData);
        
        this.lastSyncTime = Date.now();
        
        console.log('✅ Sync completed successfully');
        
        if (this.onSyncComplete) {
          this.onSyncComplete(mergedData);
        }
        
        resolve(true);
        
      } catch (error) {
        console.error('❌ Sync failed:', error);
        this.handleSyncError(error);
        reject(error);
        
      } finally {
        this.isSyncing = false;
      }
    }, this.settings.debounceDelay); // 2000ms
  });
}

  async loadFromVK() {
    if (!this.isVKAvailable()) {
      throw new Error('VK Storage not available');
    }

    for (let attempt = 1; attempt <= this.settings.retryAttempts; attempt++) {
      try {
        // ИСПРАВЛЕНО: Используем безопасный метод VK Bridge
        const result = await this.safeVKCall('VKWebAppStorageGet', {
          keys: [this.vkKey]
        });
        
        if (result?.keys?.length > 0) {
          const rawData = result.keys[0].value;
          const parsedData = rawData ? JSON.parse(rawData) : this.getDefaultProgressData();
          return parsedData;
        }
        
        return this.getDefaultProgressData();
        
      } catch (error) {
        console.warn(`VK Storage load attempt ${attempt} failed:`, error);
        
        if (attempt === this.settings.retryAttempts) {
          throw error;
        }
        
        await this.delay(this.settings.retryDelay * attempt);
      }
    }
  }

  // НОВЫЙ МЕТОД: Безопасный вызов VK Bridge
  // === ProgressSyncManager.js:148-180 - ЗАМЕНИТЬ safeVKCall ===

async safeVKCall(method, params = {}) {
  if (!window.vkBridge) {
    throw new Error('VK Bridge not available');
  }
  
  try {
    const result = await window.vkBridge.send(method, params);
    return result;
    
  } catch (error) {
    const errorCode = error.error_data?.error_code;
    const errorMsg = error.error_data?.error_reason || error.message;
    
    console.warn(`⚠️ VK API error [${method}]:`, errorCode, errorMsg);
    
    switch (errorCode) {
      case 2: // Method not found / not supported
        throw new Error(`VK method ${method} not supported on this platform`);
        
      case 4: // User denied access
        console.log('ℹ️ User denied VK permission');
        throw error;
        
      case 6: // Too many requests (rate limit)
        console.log('⏳ Rate limited, retrying after 2s...');
        await this.delay(2000);
        return await window.vkBridge.send(method, params); // Retry once
        
      case 7: // Permission denied by app settings
        throw new Error(`VK permission denied for ${method}`);
        
      case 15: // Access denied (moderation required)
        console.log('🔒 VK feature requires moderation approval');
        throw error;
        
      case 10: // Internal server error
        console.log('🔧 VK server error, retrying...');
        await this.delay(1000);
        return await window.vkBridge.send(method, params); // Retry once
        
      default:
        // Неизвестная ошибка - пробрасываем
        throw error;
    }
  }
}

  saveToLocal(data) {
    try {
      const compressed = this.compressData(data);
      localStorage.setItem(this.localKey, compressed);
      console.log('💾 Saved to localStorage');
    } catch (error) {
      console.error('❌ Failed to save to localStorage:', error);
      
      // ИСПРАВЛЕНО: Попытка очистить старые данные при переполнении
      if (error.name === 'QuotaExceededError') {
        this.cleanupLocalStorage();
        try {
          localStorage.setItem(this.localKey, compressed);
        } catch (retryError) {
          throw retryError;
        }
      } else {
        throw error;
      }
    }
  }

  // НОВЫЙ МЕТОД: Очистка localStorage при переполнении
  cleanupLocalStorage() {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('findpair_') && !key.includes('progress')) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
    console.log(`🧹 Cleaned up ${keysToRemove.length} old localStorage items`);
  }

  loadFromLocal() {
    try {
      const compressed = localStorage.getItem(this.localKey);
      if (!compressed) return this.getDefaultProgressData();
      
      const data = this.decompressData(compressed);
      return this.safelyMigrateData(data);
    } catch (error) {
      console.error('❌ Failed to load from localStorage:', error);
      return this.getDefaultProgressData();
    }
  }

  // === ProgressSyncManager.js:189-230 - ДОБАВИТЬ после saveToLocal ===

async saveToVK(progressData) {
  if (!this.isVKAvailable()) {
    console.warn('VK Storage not available');
    return false;
  }
  
  for (let attempt = 1; attempt <= this.settings.retryAttempts; attempt++) {
    try {
      const dataString = JSON.stringify(progressData);
      
      // ✅ ДОБАВИТЬ: Проверка размера (VK Storage лимит ~10MB)
      const sizeKB = new Blob([dataString]).size / 1024;
      if (sizeKB > 10000) { // 10MB
        console.warn(`⚠️ Data size ${sizeKB}KB exceeds VK Storage limit`);
        
        // Оптимизируем данные
        const optimized = this.optimizeData(progressData);
        const optimizedString = JSON.stringify(optimized);
        const optimizedSizeKB = new Blob([optimizedString]).size / 1024;
        
        console.log(`📦 Optimized: ${sizeKB}KB → ${optimizedSizeKB}KB`);
        
        if (optimizedSizeKB > 10000) {
          throw new Error('Data too large even after optimization');
        }
        
        // Используем оптимизированные данные
        await this.safeVKCall('VKWebAppStorageSet', {
          key: this.vkKey,
          value: optimizedString
        });
      } else {
        await this.safeVKCall('VKWebAppStorageSet', {
          key: this.vkKey,
          value: dataString
        });
      }
      
      console.log('✅ Saved to VK Storage');
      return true;
      
    } catch (error) {
      // ✅ ДОБАВИТЬ: Обработка QuotaExceededError
      if (error.message?.includes('quota') || 
          error.message?.includes('Quota') ||
          error.error_data?.error_code === 11) { // VK quota error
        
        console.warn('⚠️ VK Storage quota exceeded, cleaning up...');
        
        try {
          // Очищаем старые уровни (оставляем только 30 последних)
          const cleanedData = this.optimizeData(progressData, 30);
          const cleanedString = JSON.stringify(cleanedData);
          
          await this.safeVKCall('VKWebAppStorageSet', {
            key: this.vkKey,
            value: cleanedString
          });
          
          console.log('✅ Saved after cleanup');
          return true;
          
        } catch (cleanupError) {
          console.error('❌ Cleanup failed:', cleanupError);
          throw cleanupError;
        }
      }
      
      console.warn(`VK Storage save attempt ${attempt} failed:`, error);
      
      if (attempt === this.settings.retryAttempts) {
        throw error;
      }
      
      await this.delay(this.settings.retryDelay * attempt);
    }
  }
  
  return false;
}

// === ProgressSyncManager.js:282-299 - ОБНОВИТЬ optimizeData ===

optimizeData(data, maxLevels = 50) {
  const optimized = { ...data };
  
  if (optimized.levels && Object.keys(optimized.levels).length > maxLevels) {
    // Сортируем по lastPlayed и оставляем только maxLevels последних
    const sortedLevels = Object.entries(optimized.levels)
      .sort((a, b) => (b[1].lastPlayed || 0) - (a[1].lastPlayed || 0))
      .slice(0, maxLevels);
    
    optimized.levels = Object.fromEntries(sortedLevels);
    
    console.log(`📦 Optimized: kept ${maxLevels} most recent levels`);
  }
  
  // ✅ ДОБАВИТЬ: Удаляем избыточные поля
  if (optimized.stats) {
    delete optimized.stats.matchTimes; // Может быть очень большим массивом
  }
  
  return optimized;
}

  compressData(data) {
    try {
      const compressed = JSON.stringify(data);
      
      // Проверка размера
      if (compressed.length > this.settings.compressionThreshold) {
        console.log(`📦 Data size: ${compressed.length} bytes`);
        
        // ИСПРАВЛЕНО: Оптимизация данных при превышении порога
        if (compressed.length > 10000) {
          data = this.optimizeData(data);
          return JSON.stringify(data);
        }
      }
      
      return compressed;
    } catch (error) {
      console.error('Failed to compress data:', error);
      throw error;
    }
  }



  decompressData(compressed) {
    try {
      return JSON.parse(compressed);
    } catch (error) {
      console.error('Decompression failed:', error);
      throw error;
    }
  }

  safelyMigrateData(data) {
    // Гарантируем что работаем с объектом
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      console.warn('⚠️ Invalid data for migration');
      return this.getDefaultProgressData();
    }
    
    // ВСЕГДА создаём новый объект
    const migrated = {
      version: this.version,
      timestamp: data.timestamp || Date.now(),
      deviceId: data.deviceId || this.getDeviceId(),
      lastModified: Date.now(),
      levels: data.levels || {},
      achievements: data.achievements || {},
      stats: data.stats || {
        gamesPlayed: 0,
        totalTime: 0,
        totalErrors: 0,
        bestTime: null,
        lastPlayed: 0
      }
    };
    
    // Логирование миграции
    if (!data.version || data.version !== this.version) {
      console.log(`🔄 Data migrated from v${data.version || 'unknown'} to v${this.version}`);
    }
    
    return migrated;
  }

  mergeProgressData(localData, vkData) {
    if (!localData && !vkData) {
      return this.getDefaultProgressData();
    }
    
    if (!vkData) return localData;
    if (!localData) return vkData;

    console.log('🔀 Merging progress data...');
    
    const merged = {
      version: this.version,
      timestamp: Math.max(localData.timestamp || 0, vkData.timestamp || 0),
      deviceId: localData.deviceId || this.getDeviceId(),
      lastModified: Date.now(),
      levels: {},
      achievements: {},
      stats: {}
    };

    // Merge levels - ИСПРАВЛЕНО: корректное слияние
    const allLevels = new Set([
      ...Object.keys(localData.levels || {}),
      ...Object.keys(vkData.levels || {})
    ]);

    for (const levelIndex of allLevels) {
      const local = localData.levels?.[levelIndex];
      const vk = vkData.levels?.[levelIndex];
      
      const mergedLevel = this.mergeLevelData(local, vk);
      if (mergedLevel) {
        merged.levels[levelIndex] = mergedLevel;
      }
    }

    // Merge achievements - берём объединение
    merged.achievements = {
      ...(vkData.achievements || {}),
      ...(localData.achievements || {})
    };

    // Merge stats
    merged.stats = this.mergeStats(localData.stats, vkData.stats);

    console.log('✅ Merge completed');
    return merged;
  }

  // sync/ProgressSyncManager.js
// ДОБАВИТЬ после метода getCurrentLevel() (строка ~290)

/**
 * Устанавливает текущий уровень для отслеживания
 * @param {number} levelIndex - Индекс уровня
 */
setCurrentLevel(levelIndex) {
  if (typeof levelIndex !== 'number' || levelIndex < 0) {
    console.warn('[ProgressSyncManager] Invalid levelIndex:', levelIndex);
    return;
  }
  
  this.currentLevel = levelIndex;
  
  // Сохраняем в localStorage для восстановления после перезагрузки
  try {
    localStorage.setItem('findpair_current_level', levelIndex.toString());
    console.log(`[ProgressSyncManager] Current level set to: ${levelIndex}`);
  } catch (e) {
    console.warn('[ProgressSyncManager] Cannot save currentLevel:', e);
  }
}

/**
 * Получает текущий уровень
 * @returns {number} Индекс текущего уровня
 */
getCurrentLevel() {
  if (this.currentLevel !== undefined) {
    return this.currentLevel;
  }
  
  // Восстановление из localStorage
  try {
    const saved = localStorage.getItem('findpair_current_level');
    return saved ? parseInt(saved, 10) : 0;
  } catch (e) {
    return 0;
  }
}

  mergeLevelData(local, vk) {
    if (!local && !vk) return null;
    if (!vk) return local;
    if (!local) return vk;
    
    // ИСПРАВЛЕНО: Более детальное слияние данных уровня
    const merged = {
      stars: Math.max(local.stars || 0, vk.stars || 0),
      bestTime: Math.min(
        local.bestTime || Infinity,
        vk.bestTime || Infinity
      ) === Infinity ? null : Math.min(
        local.bestTime || Infinity,
        vk.bestTime || Infinity
      ),
      errors: Math.min(
        local.errors || Infinity,
        vk.errors || Infinity
      ) === Infinity ? null : Math.min(
        local.errors || Infinity,
        vk.errors || Infinity
      ),
      attempts: Math.max(local.attempts || 0, vk.attempts || 0),
      completed: local.completed || vk.completed || false,
      lastPlayed: Math.max(local.lastPlayed || 0, vk.lastPlayed || 0)
    };
    
    return merged;
  }

  mergeStats(localStats = {}, vkStats = {}) {
    return {
      gamesPlayed: Math.max(localStats.gamesPlayed || 0, vkStats.gamesPlayed || 0),
      totalTime: Math.max(localStats.totalTime || 0, vkStats.totalTime || 0),
      totalErrors: Math.max(localStats.totalErrors || 0, vkStats.totalErrors || 0),
      bestTime: Math.min(
        localStats.bestTime || Infinity,
        vkStats.bestTime || Infinity
      ) === Infinity ? null : Math.min(
        localStats.bestTime || Infinity,
        vkStats.bestTime || Infinity
      ),
      lastPlayed: Math.max(
        localStats.lastPlayed || 0,
        vkStats.lastPlayed || 0
      )
    };
  }

  async saveProgress(progressData, forceSync = false) {
    const timestamp = Date.now();
    
    const enrichedData = {
      ...progressData,
      version: this.version,
      timestamp,
      deviceId: this.getDeviceId(),
      lastModified: timestamp
    };

    if (!this.validateProgressData(enrichedData)) {
      throw new Error('Invalid progress data structure');
    }

    this.saveToLocal(enrichedData);

    if (forceSync) {
      await this.performSync();
    } else {
      this.queueSync();
    }

    if (this.onProgressUpdate) {
      this.onProgressUpdate(enrichedData);
    }

    return enrichedData;
  }

  async loadProgress() {
    try {
      if (this.isVKAvailable() && this.shouldSync()) {
        await this.performSync();
      }
      
      return this.loadFromLocal();
      
    } catch (error) {
      console.warn('⚠️ Sync failed, using local data:', error);
      return this.loadFromLocal();
    }
  }

  // НОВЫЙ МЕТОД: Сохранение прогресса уровня
  async saveLevelProgress(levelIndex, levelData) {
    const progress = await this.loadProgress();
    
    progress.levels[levelIndex] = {
      ...progress.levels[levelIndex],
      ...levelData,
      lastPlayed: Date.now()
    };
    
    progress.stats.gamesPlayed = (progress.stats.gamesPlayed || 0) + 1;
    progress.stats.lastPlayed = Date.now();
    
    return await this.saveProgress(progress);
  }

  // НОВЫЙ МЕТОД: Сохранение достижений
  async saveAchievement(achievementId, data = {}) {
    const progress = await this.loadProgress();
    
    progress.achievements[achievementId] = {
      unlocked: true,
      unlockedAt: Date.now(),
      ...data
    };
    
    return await this.saveProgress(progress, true); // Форсируем синхронизацию для достижений
  }

  validateProgressData(data) {
    if (!data || typeof data !== 'object') return false;
    if (!data.version) return false;
    if (!data.timestamp) return false;
    
    return true;
  }

  getDefaultProgressData() {
    return {
      version: this.version,
      timestamp: Date.now(),
      deviceId: this.getDeviceId(),
      lastModified: Date.now(),
      levels: {},
      achievements: {},
      stats: {
        gamesPlayed: 0,
        totalTime: 0,
        totalErrors: 0,
        bestTime: null,
        lastPlayed: 0
      }
    };
  }

  getDeviceId() {
    let deviceId = localStorage.getItem('device_id');
    if (!deviceId) {
      deviceId = 'device_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('device_id', deviceId);
    }
    return deviceId;
  }

  queueSync() {
    clearTimeout(this.syncTimeout);
    this.syncTimeout = setTimeout(() => {
      if (this.isVKAvailable() && this.shouldSync()) {
        this.performSync();
      }
    }, this.settings.debounceDelay);
  }

  startAutoSync() {
    // Очищаем старый интервал если есть
    if (this.autoSyncInterval) {
      clearInterval(this.autoSyncInterval);
    }
    
    this.autoSyncInterval = setInterval(() => {
      if (this.isVKAvailable() && this.shouldSync()) {
        this.performSync();
      }
    }, this.settings.syncInterval);
    
    console.log('⏰ Auto-sync started');
  }

  stopAutoSync() {
    if (this.autoSyncInterval) {
      clearInterval(this.autoSyncInterval);
      this.autoSyncInterval = null;
      console.log('⏰ Auto-sync stopped');
    }
  }

  // === ProgressSyncManager.js:365-384 - ЗАМЕНИТЬ subscribeToVKEvents ===

subscribeToVKEvents() {
  if (!window.vkBridge || !window.vkBridge.subscribe) {
    console.log('VK Bridge subscribe not available');
    return;
  }
  
  // ✅ КРИТИЧНО: Сохраняем ссылку на handler
  this._vkEventHandler = (e) => {
    const eventType = e.detail?.type;
    
    if (eventType === 'VKWebAppViewRestore') {
      setTimeout(() => {
        if (this.shouldSync()) {
          this.performSync();
        }
      }, 1000);
    }
    
    if (eventType === 'VKWebAppUpdateConfig') {
      const scheme = e.detail?.data?.scheme;
      if (scheme) {
        document.body.setAttribute('data-scheme', scheme);
      }
    }
  };
  
  window.vkBridge.subscribe(this._vkEventHandler);
  console.log('⏰ VK Events subscription initialized');
}

  shouldSync() {
    const timeSinceLastSync = Date.now() - this.lastSyncTime;
    return timeSinceLastSync > 5000; // Минимум 5 секунд между синхронизациями
  }

  isVKAvailable() {
  // ✅ КРИТИЧНО: Строгая проверка с логированием
  const checks = {
    bridgeReady: window.VK_BRIDGE_READY === true,
    bridgeExists: !!window.vkBridge,
    sendMethod: typeof window.vkBridge?.send === 'function',
    // ✅ ДОБАВЛЕНО: Проверка окружения
    isVKEnv: /vk_(app_id|user_id|platform)/i.test(window.location.search) ||
             window.location.hostname.includes('vk.com') ||
             window.location.hostname.includes('vk-apps.com')
  };
  
  const available = checks.bridgeReady && checks.bridgeExists && checks.sendMethod && checks.isVKEnv;
  
  // Логируем только при первом вызове
  if (!this._vkAvailabilityLogged) {
    console.log('🔍 VK Availability check:', checks, '→', available);
    this._vkAvailabilityLogged = true;
  }
  
  return available;
}

  handleSyncError(error) {
    console.error('❌ Sync error:', error);
    
    if (error.stack) {
      console.error('Stack trace:', error.stack);
    }
    
    if (this.onSyncError) {
      this.onSyncError(error);
    }
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async forceSync() {
    console.log('🔄 Force sync requested');
    return await this.performSync();
  }

  getSyncStatus() {
    return {
      isSyncing: this.isSyncing,
      lastSyncTime: this.lastSyncTime,
      isVKAvailable: this.isVKAvailable(),
      queueLength: this.syncQueue.length,
      isInitialized: this.isInitialized,
      timeSinceLastSync: Date.now() - this.lastSyncTime
    };
  }

  async clearAllData() {
    localStorage.removeItem(this.localKey);
    localStorage.removeItem('device_id');
    localStorage.removeItem(this.achievementsKey);
    
    if (this.isVKAvailable()) {
      try {
        await this.safeVKCall('VKWebAppStorageSet', {
          key: this.vkKey,
          value: '{}'
        });
      } catch (error) {
        console.warn('Failed to clear VK data:', error);
      }
    }
    
    console.log('🗑️ All data cleared');
  }

  // === ProgressSyncManager.js:467-485 - ОБНОВИТЬ destroy ===

destroy() {
  this.stopAutoSync();
  
  if (this.syncTimeout) {
    clearTimeout(this.syncTimeout);
  }
  
  // ✅ ДОБАВИТЬ: Отписка от VK событий
  if (this._vkEventHandler && window.vkBridge?.unsubscribe) {
    window.vkBridge.unsubscribe(this._vkEventHandler);
    this._vkEventHandler = null;
    console.log('🗑️ VK Events unsubscribed');
  }
  
  this.onSyncStart = null;
  this.onSyncComplete = null;
  this.onSyncError = null;
  this.onProgressUpdate = null;
  
  ProgressSyncManager.instance = null;
  this.isInitialized = false;
  
  console.log('🗑️ ProgressSyncManager destroyed');
}
}

// Статическое свойство для хранения экземпляра
ProgressSyncManager.instance = null;

// Экспорт класса
window.ProgressSyncManager = ProgressSyncManager;

// ✅ ПОЛНОСТЬЮ ПЕРЕПИСАННАЯ ИНИЦИАЛИЗАЦИЯ
if (typeof window !== 'undefined') {
  // Детекция VK окружения
  const isVKEnvironment = 
    window.location.search.includes('vk_') || 
    window.location.hostname.includes('vk.com') ||
    window.location.hostname.includes('vk-apps.com') ||
    window.parent !== window; // В iframe (может быть VK)
  
  console.log('🔍 Environment detection:', {
    isVK: isVKEnvironment,
    bridgeReady: !!window.VK_BRIDGE_READY,
    bridgeExists: !!window.vkBridge,
    url: window.location.href
  });
  
  if (isVKEnvironment) {
    // ===== В VK ОКРУЖЕНИИ =====
    
    if (window.VK_BRIDGE_READY && window.vkBridge) {
      // Bridge уже готов - создаём сразу
      console.log('✅ VK Bridge ready - creating manager');
      window.progressSyncManager = new ProgressSyncManager();
      
    } else {
      // Bridge ещё не готов - ждём события
      console.log('⏳ Waiting for VK Bridge...');
      
      window.addEventListener('vk-bridge-ready', () => {
        if (!window.progressSyncManager) {
          console.log('✅ VK Bridge ready (event) - creating manager');
          window.progressSyncManager = new ProgressSyncManager();
        }
      });
      
      // Fallback: если событие не придёт через 3 секунды
      setTimeout(() => {
        if (!window.progressSyncManager) {
          console.log('⚠️ VK Bridge timeout - creating local-only manager');
          window.progressSyncManager = new ProgressSyncManager();
          // Форсируем локальный режим
          window.progressSyncManager.isVKAvailable = () => false;
        }
      }, 3000);
    }
    
  } else {
    // ===== ВНЕ VK (GitHub Pages, localhost) =====
    
    console.log('📱 Non-VK environment - creating local storage manager');
    window.progressSyncManager = new ProgressSyncManager();
    
    // ✅ КРИТИЧНО: Переопределяем метод для локального режима
    const originalIsVKAvailable = window.progressSyncManager.isVKAvailable;
    window.progressSyncManager.isVKAvailable = function() {
      return false; // Всегда false вне VK
    };
    
    console.log('📦 Local storage only mode activated');
  }
}
