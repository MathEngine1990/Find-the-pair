// utils/game-progress-manager.js - ЦЕНТРАЛЬНЫЙ МЕНЕДЖЕР ПРОГРЕССА
class GameProgressManager {
  constructor() {
    this.data = {
      version: '2.0',
      progress: {},
      achievements: {},
      stats: {
        gamesPlayed: 0,
        totalTime: 0,
        totalErrors: 0,
        bestTime: null,
        bestAccuracy: 0,
        lastPlayed: null
      },
      settings: {
        soundEnabled: true,
        musicEnabled: false,
        difficulty: 'medium'
      }
    };
    
    this.isLoaded = false;
    this.isSaving = false;
    this.syncInterval = null;
    this.lastSyncTime = 0;
    this.syncDelay = 30000; // 30 секунд
    
    this.debugMode = window.location.search.includes('debug=1');
  }

  debug(message, data = null) {
    if (this.debugMode) {
      console.log(`[GameProgress] ${message}`, data || '');
    }
  }

  async init() {
    if (this.isLoaded) return;
    
    this.debug('Initializing GameProgressManager...');
    
    // Ждем готовности VKManager
    if (window.VKManager && !window.VKManager.isAvailable()) {
      await window.VKManager.init();
    }
    
    await this.load();
    this.startAutoSync();
    this.isLoaded = true;
    
    this.debug('GameProgressManager ready');
  }

  async load() {
    try {
      // 1. Пытаемся загрузить из VK Cloud
      let vkData = null;
      if (window.VKManager?.isAvailable()) {
        try {
          const response = await window.VKManager.getStorageData(['game_data_v2']);
          if (response.keys?.[0]?.value) {
            vkData = JSON.parse(response.keys[0].value);
            this.debug('Loaded from VK Cloud', vkData);
          }
        } catch (error) {
          this.debug('VK Cloud load failed:', error);
        }
      }

      // 2. Загружаем из localStorage
      let localData = null;
      try {
        const stored = localStorage.getItem('findpair_data_v2');
        if (stored) {
          localData = JSON.parse(stored);
          this.debug('Loaded from localStorage', localData);
        }
      } catch (error) {
        this.debug('localStorage load failed:', error);
      }

      // 3. Мержим данные (берем лучший результат)
      if (vkData || localData) {
        this.data = this.mergeData(vkData, localData);
        this.debug('Data merged', this.data);
      }

      // 4. Мигрируем старые данные если нужно
      await this.migrateOldData();

    } catch (error) {
      console.error('Failed to load game progress:', error);
      this.debug('Using default data due to load error');
    }
  }

  mergeData(vkData, localData) {
    // Начинаем с пустой структуры
    const merged = JSON.parse(JSON.stringify(this.data));
    
    // Функция для слияния объектов
    const mergeObjects = (target, source) => {
      if (!source) return target;
      
      Object.keys(source).forEach(key => {
        if (typeof source[key] === 'object' && source[key] !== null && !Array.isArray(source[key])) {
          target[key] = mergeObjects(target[key] || {}, source[key]);
        } else {
          target[key] = source[key];
        }
      });
      
      return target;
    };

    // Сначала мержим локальные данные
    if (localData) {
      mergeObjects(merged, localData);
    }

    // Затем мержим VK данные (приоритет у VK)
    if (vkData) {
      mergeObjects(merged, vkData);
      
      // Специальная логика для progress - берем лучший результат по уровням
      if (localData?.progress && vkData?.progress) {
        Object.keys(localData.progress).forEach(levelKey => {
          const local = localData.progress[levelKey];
          const vk = vkData.progress[levelKey];
          
          if (!vk) {
            // VK данных нет - берем локальные
            merged.progress[levelKey] = local;
          } else {
            // Есть и там и там - берем лучший результат
            merged.progress[levelKey] = this.getBetterProgress(local, vk);
          }
        });
      }

      // Специальная логика для stats - берем максимальные значения
      if (localData?.stats && vkData?.stats) {
        merged.stats.gamesPlayed = Math.max(localData.stats.gamesPlayed || 0, vkData.stats.gamesPlayed || 0);
        merged.stats.totalTime = Math.max(localData.stats.totalTime || 0, vkData.stats.totalTime || 0);
        merged.stats.totalErrors = Math.max(localData.stats.totalErrors || 0, vkData.stats.totalErrors || 0);
        
        // Для времени берем лучший (меньший)
        if (localData.stats.bestTime && vkData.stats.bestTime) {
          merged.stats.bestTime = Math.min(localData.stats.bestTime, vkData.stats.bestTime);
        } else {
          merged.stats.bestTime = localData.stats.bestTime || vkData.stats.bestTime;
        }
        
        merged.stats.bestAccuracy = Math.max(localData.stats.bestAccuracy || 0, vkData.stats.bestAccuracy || 0);
        
        // Последняя игра - берем более позднюю
        if (localData.stats.lastPlayed && vkData.stats.lastPlayed) {
          merged.stats.lastPlayed = Math.max(localData.stats.lastPlayed, vkData.stats.lastPlayed);
        } else {
          merged.stats.lastPlayed = localData.stats.lastPlayed || vkData.stats.lastPlayed;
        }
      }

      // Для achievements - объединяем (OR логика)
      if (localData?.achievements && vkData?.achievements) {
        Object.keys(localData.achievements).forEach(key => {
          merged.achievements[key] = localData.achievements[key] || vkData.achievements[key];
        });
        
        Object.keys(vkData.achievements).forEach(key => {
          merged.achievements[key] = localData.achievements[key] || vkData.achievements[key];
        });
      }
    }

    return merged;
  }

  getBetterProgress(local, vk) {
    // Сравниваем результаты и возвращаем лучший
    
    // Сначала по звездам
    if ((local.stars || 0) > (vk.stars || 0)) {
      return local;
    } else if ((vk.stars || 0) > (local.stars || 0)) {
      return vk;
    }
    
    // Если звезды равны, то по времени (меньше = лучше)
    if (local.bestTime && vk.bestTime) {
      return local.bestTime < vk.bestTime ? local : vk;
    } else if (local.bestTime) {
      return local;
    } else if (vk.bestTime) {
      return vk;
    }
    
    // Если времени нет, по точности (больше = лучше)
    if ((local.accuracy || 0) > (vk.accuracy || 0)) {
      return local;
    }
    
    return vk;
  }

  async migrateOldData() {
    // Мигрируем старые форматы данных
    const oldProgressKey = 'findpair_progress';
    const oldAchievementsKey = 'findpair_achievements';
    
    try {
      const oldProgress = localStorage.getItem(oldProgressKey);
      const oldAchievements = localStorage.getItem(oldAchievementsKey);
      
      if (oldProgress) {
        const parsed = JSON.parse(oldProgress);
        
        // Мигрируем прогресс уровней
        Object.keys(parsed).forEach(key => {
          if (!this.data.progress[key] && parsed[key].bestTime) {
            this.data.progress[key] = {
              stars: parsed[key].stars || 1,
              bestTime: parsed[key].bestTime,
              accuracy: parsed[key].accuracy || 0,
              completed: true,
              attempts: parsed[key].attempts || 1
            };
          }
        });
        
        // Удаляем старые данные
        localStorage.removeItem(oldProgressKey);
        this.debug('Migrated old progress data');
      }
      
      if (oldAchievements) {
        const parsed = JSON.parse(oldAchievements);
        
        // Мигрируем достижения
        Object.keys(parsed).forEach(key => {
          if (parsed[key] && !this.data.achievements[key]) {
            this.data.achievements[key] = parsed[key];
          }
        });
        
        // Удаляем старые данные
        localStorage.removeItem(oldAchievementsKey);
        this.debug('Migrated old achievements data');
      }
      
    } catch (error) {
      this.debug('Migration failed:', error);
    }
  }

  async save(immediate = false) {
    if (this.isSaving && !immediate) return;
    
    // Дебаунс для автосохранения
    if (!immediate && Date.now() - this.lastSyncTime < this.syncDelay) {
      return;
    }
    
    this.isSaving = true;
    this.lastSyncTime = Date.now();
    
    try {
      // Добавляем метаданные
      const saveData = {
        ...this.data,
        lastSync: Date.now(),
        device: this.getDeviceInfo()
      };
      
      // 1. Всегда сохраняем в localStorage (fallback)
      localStorage.setItem('findpair_data_v2', JSON.stringify(saveData));
      this.debug('Saved to localStorage');
      
      // 2. Пытаемся сохранить в VK Cloud
      if (window.VKManager?.isAvailable()) {
        try {
          await window.VKManager.setStorageData('game_data_v2', saveData);
          this.debug('Saved to VK Cloud');
        } catch (error) {
          this.debug('VK Cloud save failed:', error);
          // Не критично - у нас есть localStorage fallback
        }
      }
      
    } catch (error) {
      console.error('Failed to save game progress:', error);
    } finally {
      this.isSaving = false;
    }
  }

  getDeviceInfo() {
    return {
      platform: window.VKManager?.getLaunchParams()?.platform || 'web',
      userAgent: navigator.userAgent.substring(0, 100),
      screen: `${screen.width}x${screen.height}`,
      timestamp: Date.now()
    };
  }

  startAutoSync() {
    // Автосохранение каждые 30 секунд
    this.syncInterval = setInterval(() => {
      this.save();
    }, this.syncDelay);
    
    // Сохранение при закрытии страницы
    window.addEventListener('beforeunload', () => {
      this.save(true);
    });
    
    // Сохранение при потере фокуса (для мобильных)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.save(true);
      }
    });
  }

  // API для работы с прогрессом уровней
  getLevelProgress(levelIndex) {
    return this.data.progress[levelIndex] || null;
  }

  setLevelProgress(levelIndex, progressData) {
    const current = this.data.progress[levelIndex];
    
    // Записываем только если новый результат лучше
    if (!current || this.getBetterProgress(progressData, current) === progressData) {
      this.data.progress[levelIndex] = {
        ...progressData,
        timestamp: Date.now()
      };
      
      this.save(); // Автосохранение
      return true;
    }
    
    return false;
  }

  // API для работы с достижениями
  isAchievementUnlocked(achievementId) {
    return !!this.data.achievements[achievementId];
  }

  unlockAchievement(achievementId) {
    if (!this.data.achievements[achievementId]) {
      this.data.achievements[achievementId] = {
        unlocked: true,
        timestamp: Date.now()
      };
      
      this.save(); // Автосохранение
      
      // Эмитим событие для UI
      window.dispatchEvent(new CustomEvent('achievementUnlocked', {
        detail: { achievementId }
      }));
      
      return true;
    }
    
    return false;
  }

  getAchievements() {
    return this.data.achievements;
  }

  // API для работы со статистикой
  getStats() {
    return { ...this.data.stats };
  }

  updateStats(newStats) {
    // Обновляем статистику
    this.data.stats = {
      ...this.data.stats,
      ...newStats,
      lastPlayed: Date.now()
    };
    
    this.save(); // Автосохранение
  }

  addGameResult(result) {
    // Добавляем результат игры к статистике
    this.data.stats.gamesPlayed += 1;
    this.data.stats.totalTime += result.time || 0;
    this.data.stats.totalErrors += result.errors || 0;
    
    if (!this.data.stats.bestTime || result.time < this.data.stats.bestTime) {
      this.data.stats.bestTime = result.time;
    }
    
    if (result.accuracy > this.data.stats.bestAccuracy) {
      this.data.stats.bestAccuracy = result.accuracy;
    }
    
    this.data.stats.lastPlayed = Date.now();
    
    this.save(); // Автосохранение
  }

  // API для работы с настройками
  getSetting(key) {
    return this.data.settings[key];
  }

  setSetting(key, value) {
    this.data.settings[key] = value;
    this.save(); // Автосохранение
  }

  // Утилиты
  getAllProgress() {
    return { ...this.data.progress };
  }

  getTotalStars() {
    return Object.values(this.data.progress).reduce((total, progress) => {
      return total + (progress.stars || 0);
    }, 0);
  }

  getTotalLevelsCompleted() {
    return Object.keys(this.data.progress).length;
  }

  getCompletionPercentage() {
    const totalLevels = window.LEVELS?.length || 16;
    return Math.round((this.getTotalLevelsCompleted() / totalLevels) * 100);
  }

  // Экспорт/импорт данных
  exportData() {
    return JSON.stringify(this.data, null, 2);
  }

  async importData(jsonData) {
    try {
      const importedData = JSON.parse(jsonData);
      
      // Валидируем структуру
      if (!importedData.version || !importedData.progress) {
        throw new Error('Invalid data format');
      }
      
      // Мержим с текущими данными
      this.data = this.mergeData(importedData, this.data);
      
      // Сохраняем
      await this.save(true);
      
      return true;
    } catch (error) {
      console.error('Failed to import data:', error);
      return false;
    }
  }

  // Сброс данных
  async resetProgress() {
    this.data.progress = {};
    await this.save(true);
  }

  async resetAchievements() {
    this.data.achievements = {};
    await this.save(true);
  }

  async resetAll() {
    this.data = {
      version: '2.0',
      progress: {},
      achievements: {},
      stats: {
        gamesPlayed: 0,
        totalTime: 0,
        totalErrors: 0,
        bestTime: null,
        bestAccuracy: 0,
        lastPlayed: null
      },
      settings: {
        soundEnabled: true,
        musicEnabled: false,
        difficulty: 'medium'
      }
    };
    
    await this.save(true);
  }

  // Cleanup
  destroy() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    
    this.isLoaded = false;
  }
}

// Создаем глобальный экземпляр
window.GameProgressManager = new GameProgressManager();

export default window.GameProgressManager;
