/**
 * ProgressSyncManager.js - Центральный менеджер синхронизации прогресса
 * для VK Mini Apps с поддержкой multi-platform sync
 */

class ProgressSyncManager {
  constructor() {
    this.version = '1.0';
    this.localKey = 'findpair_progress';
    this.vkKey = 'findpair_progress';
    this.achievementsKey = 'findpair_achievements';
    
    this.isSyncing = false;
    this.lastSyncTime = 0;
    this.syncQueue = [];
    
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
    
    this.init();
  }

  async init() {
    console.log('🔄 ProgressSyncManager initialized');
    await this.loadInitialData();
    this.startAutoSync();
    this.subscribeToVKEvents();
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
      lastModified: Date.now()
    };

    const allLevels = new Set([
      ...Object.keys(localData.levels || {}),
      ...Object.keys(vkData.levels || {})
    ]);

    merged.levels = {};
    
    for (const levelIndex of allLevels) {
      const local = localData.levels?.[levelIndex];
      const vk = vkData.levels?.[levelIndex];
      
      merged.levels[levelIndex] = this.mergeLevelData(local, vk);
    }

    merged.achievements = {
      ...vkData.achievements,
      ...localData.achievements
    };

    merged.stats = this.mergeStats(localData.stats, vkData.stats);

    console.log('✅ Merge completed');
    return merged;
  }

  mergeLevelData(local, vk) {
    if (!local && !vk) return null;
    if (!vk) return local;
    if (!local) return vk;
    
    if (local.stars !== vk.stars) {
      return local.stars > vk.stars ? local : vk;
    }
    
    if (local.bestTime !== vk.bestTime) {
      return local.bestTime < vk.bestTime ? local : vk;
    }
    
    return local.errors < vk.errors ? local : vk;
  }

  mergeStats(localStats = {}, vkStats = {}) {
    return {
      gamesPlayed: (localStats.gamesPlayed || 0) + (vkStats.gamesPlayed || 0),
      totalTime: (localStats.totalTime || 0) + (vkStats.totalTime || 0),
      totalErrors: (localStats.totalErrors || 0) + (vkStats.totalErrors || 0),
      bestTime: Math.min(
        localStats.bestTime || Infinity,
        vkStats.bestTime || Infinity
      ),
      lastPlayed: Math.max(
        localStats.lastPlayed || 0,
        vkStats.lastPlayed || 0
      )
    };
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
      return this.migrateDataIfNeeded(data);
    } catch (error) {
      console.error('❌ Failed to load from localStorage:', error);
      return this.getDefaultProgressData();
    }
  }

  async saveToVK(data) {
    if (!this.isVKAvailable()) {
      throw new Error('VK Storage not available');
    }

    const compressed = this.compressData(data);
    
    for (let attempt = 1; attempt <= this.settings.retryAttempts; attempt++) {
      try {
        await window.VKHelpers.setStorageData(this.vkKey, compressed);
        console.log('☁️ Saved to VK Storage');
        return;
        
      } catch (error) {
        console.warn(`⚠️ VK save attempt ${attempt} failed:`, error);
        
        if (attempt === this.settings.retryAttempts) {
          throw error;
        }
        
        await this.delay(this.settings.retryDelay * attempt);
      }
    }
  }

  async loadFromVK() {
    if (!this.isVKAvailable()) {
      throw new Error('VK Storage not available');
    }

    for (let attempt = 1; attempt <= this.settings.retryAttempts; attempt++) {
      try {
        const result = await window.VKHelpers.getStorageData([this.vkKey]);
        
        if (result.keys && result.keys[0] && result.keys[0].value) {
          const rawValue = result.keys[0].value;
          
          // ИСПРАВЛЕНИЕ: Проверяем тип данных
          let data;
          if (typeof rawValue === 'string') {
            data = this.decompressData(rawValue);
          } else if (typeof rawValue === 'object') {
            data = rawValue;
          } else {
            console.warn('⚠️ Unexpected data type from VK:', typeof rawValue);
            return this.getDefaultProgressData();
          }
          
          return this.migrateDataIfNeeded(data);
        }
        
        return this.getDefaultProgressData();
        
      } catch (error) {
        console.warn(`⚠️ VK load attempt ${attempt} failed:`, error);
        
        if (attempt === this.settings.retryAttempts) {
          throw error;
        }
        
        await this.delay(this.settings.retryDelay * attempt);
      }
    }
  }

  compressData(data) {
    const str = JSON.stringify(data);
    
    if (str.length > this.settings.compressionThreshold) {
      console.log(`📦 Data size: ${str.length} bytes`);
    }
    
    return str;
  }

  decompressData(compressed) {
    try {
      // ИСПРАВЛЕНИЕ: Безопасная десериализация
      if (typeof compressed === 'object') {
        return compressed;
      }
      return JSON.parse(compressed);
    } catch (error) {
      console.error('❌ Failed to decompress data:', error);
      throw error;
    }
  }

  validateProgressData(data) {
    if (!data || typeof data !== 'object') return false;
    if (!data.version) return false;
    if (!data.timestamp) return false;
    
    return true;
  }

  migrateDataIfNeeded(data) {
    // ИСПРАВЛЕНИЕ: Проверяем что data это объект
    if (typeof data === 'string') {
      console.warn('⚠️ Data is string, parsing...');
      try {
        data = JSON.parse(data);
      } catch (error) {
        console.error('❌ Failed to parse data string:', error);
        return this.getDefaultProgressData();
      }
    }
    
    if (!data || typeof data !== 'object') {
      console.warn('⚠️ Invalid data structure, returning defaults');
      return this.getDefaultProgressData();
    }
    
    if (!data.version || data.version !== this.version) {
      console.log(`🔄 Migrating data from ${data.version} to ${this.version}`);
      // Создаем новый объект вместо мутации
      return {
        ...data,
        version: this.version
      };
    }
    
    return data;
  }

  getDefaultProgressData() {
    return {
      version: this.version,
      timestamp: Date.now(),
      deviceId: this.getDeviceId(),
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
    setInterval(() => {
      if (this.isVKAvailable() && this.shouldSync()) {
        this.performSync();
      }
    }, this.settings.syncInterval);
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
    return window.VKHelpers && 
           window.VK_BRIDGE_READY && 
           window.VKSafe && 
           window.VKSafe.isAvailable();
  }

  handleSyncError(error) {
    console.error('❌ Sync error:', error);
    
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
      queueLength: this.syncQueue.length
    };
  }

  async clearAllData() {
    localStorage.removeItem(this.localKey);
    
    if (this.isVKAvailable()) {
      try {
        await window.VKHelpers.setStorageData(this.vkKey, '{}');
      } catch (error) {
        console.warn('Failed to clear VK data:', error);
      }
    }
  }
}

window.ProgressSyncManager = ProgressSyncManager;
