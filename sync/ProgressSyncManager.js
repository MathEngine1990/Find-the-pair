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
    const localData = this.loadFromLocal();
    
    // ИСПРАВЛЕНО: Проверяем доступность VK перед синхронизацией
    if (this.isVKAvailable() && window.vkBridge) {
      try {
        const synced = await this.performSync();
        if (synced) {
          console.log('✅ Initial sync completed');
          return;
        }
      } catch (vkError) {
        console.log('📱 VK sync not available, using local data');
      }
    }
    
    console.log('📱 Using local data only');
    
  } catch (error) {
    console.error('❌ Failed to load initial data:', error);
    // Не вызываем handleSyncError для избежания зацикливания
  }
}

  async performSync() {
    if (this.isSyncing) {
      console.log('⏳ Sync already in progress');
      return false;
    }

    this.isSyncing = true;
    
    if (this.onSyncStart) {
      this.onSyncStart();
    }

    try {
      console.log('🔄 Starting sync...');
      
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
      
      return true;
      
    } catch (error) {
      console.error('❌ Sync failed:', error);
      this.handleSyncError(error);
      return false;
      
    } finally {
      this.isSyncing = false;
    }
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
  async safeVKCall(method, params = {}) {
    if (!window.vkBridge) {
      throw new Error('VK Bridge not available');
    }
    
    try {
      return await window.vkBridge.send(method, params);
    } catch (error) {
      // Обработка специфичных ошибок VK
      if (error.error_data?.error_code === 6) {
        // Слишком много запросов
        await this.delay(1000);
        return await window.vkBridge.send(method, params);
      }
      throw error;
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

  async saveToVK(progressData) {
    if (!this.isVKAvailable()) {
      console.warn('VK Storage not available');
      return false;
    }

    for (let attempt = 1; attempt <= this.settings.retryAttempts; attempt++) {
      try {
        // ИСПРАВЛЕНО: Используем безопасный метод
        await this.safeVKCall('VKWebAppStorageSet', {
          key: this.vkKey,
          value: JSON.stringify(progressData)
        });
        
        console.log('✅ Saved to VK Storage');
        return true;
        
      } catch (error) {
        console.warn(`VK Storage save attempt ${attempt} failed:`, error);
        
        if (attempt === this.settings.retryAttempts) {
          throw error;
        }
        
        await this.delay(this.settings.retryDelay * attempt);
      }
    }
    
    return false;
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

  // НОВЫЙ МЕТОД: Оптимизация данных
  optimizeData(data) {
    const optimized = { ...data };
    
    // Удаляем старые записи уровней (оставляем только последние 50)
    if (optimized.levels && Object.keys(optimized.levels).length > 50) {
      const sortedLevels = Object.entries(optimized.levels)
        .sort((a, b) => (b[1].lastPlayed || 0) - (a[1].lastPlayed || 0))
        .slice(0, 50);
      optimized.levels = Object.fromEntries(sortedLevels);
    }
    
    return optimized;
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

  subscribeToVKEvents() {
    if (window.vkBridge && window.vkBridge.subscribe) {
      window.vkBridge.subscribe((e) => {
        const eventType = e.detail?.type;
        
        if (eventType === 'VKWebAppViewRestore') {
          // Синхронизация при возвращении в приложение
          setTimeout(() => {
            if (this.shouldSync()) {
              this.performSync();
            }
          }, 1000);
        }
        
        // ДОБАВЛЕНО: Обработка изменения темы
        if (eventType === 'VKWebAppUpdateConfig') {
          const scheme = e.detail?.data?.scheme;
          if (scheme) {
            document.body.setAttribute('data-scheme', scheme);
          }
        }
      });
    }
  }

  shouldSync() {
    const timeSinceLastSync = Date.now() - this.lastSyncTime;
    return timeSinceLastSync > 5000; // Минимум 5 секунд между синхронизациями
  }

  isVKAvailable() {
    // ИСПРАВЛЕНО: Более надёжная проверка
    return !!(
      window.VK_BRIDGE_READY && 
      window.vkBridge &&
      typeof window.vkBridge.send === 'function'
    );
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

  destroy() {
    this.stopAutoSync();
    
    if (this.syncTimeout) {
      clearTimeout(this.syncTimeout);
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

// ИСПРАВЛЕНО: Безопасная автоматическая инициализация
if (typeof window !== 'undefined') {
  // Проверяем, находимся ли мы в VK
  const isVKEnvironment = window.location.search.includes('vk_') || 
                          window.location.hostname.includes('vk.com') ||
                          window.location.hostname.includes('vk-apps.com');
  
  if (isVKEnvironment && window.VK_BRIDGE_READY) {
    // В VK и Bridge готов - создаем менеджер
    window.progressSyncManager = new ProgressSyncManager();
  } else if (isVKEnvironment) {
    // В VK, но Bridge еще не готов - ждем
    window.addEventListener('vk-bridge-ready', () => {
      if (!window.progressSyncManager) {
        window.progressSyncManager = new ProgressSyncManager();
      }
    });
  } else {
    // НЕ в VK (GitHub Pages) - создаем менеджер без VK функций
    window.progressSyncManager = new ProgressSyncManager();
    // Отключаем VK функции
    window.progressSyncManager.isVKAvailable = () => false;
    console.log('📱 Running outside VK - local storage only mode');
  }
}
