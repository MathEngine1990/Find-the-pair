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
      
      if (this.isVKAvailable()) {
        const synced = await this.performSync();
        if (synced) {
          console.log('✅ Initial sync completed');
          return;
        }
      }
      
      console.log('📱 Using local data only');
      
    } catch (error) {
      console.error('❌ Failed to load initial data:', error);
      this.handleSyncError(error);
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
        const result = await window.VKSafe.send('VKWebAppStorageGet', {
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

  saveToLocal(data) {
    try {
      const compressed = this.compressData(data);
      localStorage.setItem(this.localKey, compressed);
      console.log('💾 Saved to localStorage');
    } catch (error) {
      console.error('❌ Failed to save to localStorage:', error);
      throw error;
    }
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
        await window.VKSafe.send('VKWebAppStorageSet', {
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
        console.log(`📦 Data size: ${compressed.length} bytes (compression threshold: ${this.settings.compressionThreshold})`);
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

    // Merge levels
    const allLevels = new Set([
      ...Object.keys(localData.levels || {}),
      ...Object.keys(vkData.levels || {})
    ]);

    for (const levelIndex of allLevels) {
      const local = localData.levels?.[levelIndex];
      const vk = vkData.levels?.[levelIndex];
      
      merged.levels[levelIndex] = this.mergeLevelData(local, vk);
    }

    // Merge achievements
    merged.achievements = {
      ...vkData.achievements,
      ...localData.achievements
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
    
    // Возвращаем лучший результат
    if ((local.stars || 0) !== (vk.stars || 0)) {
      return (local.stars || 0) > (vk.stars || 0) ? local : vk;
    }
    
    if ((local.bestTime || Infinity) !== (vk.bestTime || Infinity)) {
      return (local.bestTime || Infinity) < (vk.bestTime || Infinity) ? local : vk;
    }
    
    return (local.errors || Infinity) < (vk.errors || Infinity) ? local : vk;
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
          setTimeout(() => {
            if (this.shouldSync()) {
              this.performSync();
            }
          }, 1000);
        }
      });
    }
  }

  shouldSync() {
    const timeSinceLastSync = Date.now() - this.lastSyncTime;
    return timeSinceLastSync > this.settings.syncInterval;
  }

  isVKAvailable() {
    return window.VK_BRIDGE_READY && 
           window.VKSafe && 
           window.VKSafe.isAvailable();
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
    return await this.performSync();
  }

  getSyncStatus() {
    return {
      isSyncing: this.isSyncing,
      lastSyncTime: this.lastSyncTime,
      isVKAvailable: this.isVKAvailable(),
      queueLength: this.syncQueue.length,
      isInitialized: this.isInitialized
    };
  }

  async clearAllData() {
    localStorage.removeItem(this.localKey);
    localStorage.removeItem('device_id');
    
    if (this.isVKAvailable()) {
      try {
        await window.VKSafe.send('VKWebAppStorageSet', {
          key: this.vkKey,
          value: '{}'
        });
      } catch (error) {
        console.warn('Failed to clear VK data:', error);
      }
    }
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
