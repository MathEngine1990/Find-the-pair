/**
 * ProgressSyncManager.js - Исправленная версия с типобезопасностью
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
        
        if (result?.keys?.[0]?.value) {
          const rawValue = result.keys[0].value;
          
          // ИСПРАВЛЕНИЕ: Универсальная десериализация с проверкой типов
          let data = this.safeParseData(rawValue);
          
          if (!data) {
            console.warn('⚠️ Failed to parse VK data, using defaults');
            return this.getDefaultProgressData();
          }
          
          // ИСПРАВЛЕНИЕ: Безопасная миграция без мутации
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

  /**
   * НОВЫЙ МЕТОД: Безопасный парсинг данных с обработкой всех типов
   */
  safeParseData(data) {
    // Уже объект - возвращаем как есть
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      return data;
    }
    
    // Строка - пытаемся распарсить
    if (typeof data === 'string') {
      try {
        const parsed = JSON.parse(data);
        
        // Проверяем что получился объект
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          return parsed;
        }
      } catch (error) {
        console.error('❌ JSON parse failed:', error);
      }
    }
    
    // Все остальные случаи - возвращаем null
    return null;
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
      // Безопасная десериализация
      return this.safeParseData(compressed) || this.getDefaultProgressData();
    } catch (error) {
      console.error('❌ Failed to decompress data:', error);
      return this.getDefaultProgressData();
    }
  }

  validateProgressData(data) {
    if (!data || typeof data !== 'object') return false;
    if (!data.version) return false;
    if (!data.timestamp) return false;
    
    return true;
  }

  /**
   * ИСПРАВЛЕННЫЙ МЕТОД: Безопасная миграция без мутации
   */
  migrateDataIfNeeded(data) {
    // Дополнительная проверка типа на входе
    if (!data || typeof data === 'string') {
      const parsed = this.safeParseData(data);
      if (!parsed) {
        console.warn('⚠️ Invalid data for migration, using defaults');
        return this.getDefaultProgressData();
      }
      data = parsed;
    }
    
    // Проверяем что это объект
    if (typeof data !== 'object' || Array.isArray(data)) {
      console.warn('⚠️ Invalid data structure, returning defaults');
      return this.getDefaultProgressData();
    }
    
    // ИСПРАВЛЕНИЕ: Всегда создаём новый объект, никогда не мутируем оригинал
    if (!data.version || data.version !== this.version) {
      console.log(`🔄 Migrating data from v${data.version || 'unknown'} to v${this.version}`);
      
      // Создаём новый объект с правильной версией
      const migrated = {
        ...data,
        version: this.version,
        // Добавляем недостающие поля
        deviceId: data.deviceId || this.getDeviceId(),
        timestamp: data.timestamp || Date.now(),
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
      
      return migrated;
    }
    
    // Данные уже актуальной версии - возвращаем копию для безопасности
    return { ...data };
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
    
    // Добавляем детальную информацию об ошибке
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
      queueLength: this.syncQueue.length
    };
  }

  async clearAllData() {
    localStorage.removeItem(this.localKey);
    localStorage.removeItem('device_id');
    
    if (this.isVKAvailable()) {
      try {
        await window.VKHelpers.setStorageData(this.vkKey, '{}');
      } catch (error) {
        console.warn('Failed to clear VK data:', error);
      }
    }
  }
  
  /**
   * НОВЫЙ МЕТОД: Валидация структуры данных
   */
  validateDataStructure(data) {
    const requiredFields = ['version', 'timestamp', 'deviceId'];
    const optionalFields = ['levels', 'achievements', 'stats', 'lastModified'];
    
    // Проверка обязательных полей
    for (const field of requiredFields) {
      if (!data.hasOwnProperty(field)) {
        console.warn(`Missing required field: ${field}`);
        return false;
      }
    }
    
    // Проверка типов
    if (typeof data.version !== 'string') return false;
    if (typeof data.timestamp !== 'number') return false;
    if (typeof data.deviceId !== 'string') return false;
    
    return true;
  }
}

// Экспорт для использования
window.ProgressSyncManager = ProgressSyncManager;
