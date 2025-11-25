//---scenes/PreloadScene.js - УЛУЧШЕННАЯ версия с VK интеграцией

window.PreloadScene = class PreloadScene extends Phaser.Scene {
  constructor() { super('PreloadScene'); }

  init() {
    // Инициализация VK данных
    this.vkUserData = window.VK_USER_DATA || null;
    this.vkLaunchParams = window.VK_LAUNCH_PARAMS || null;
    this.isVKEnvironment = !!this.vkLaunchParams;
    
    console.log('🎮 PreloadScene init:', {
      isVK: this.isVKEnvironment,
      userData: !!this.vkUserData,
      params: this.vkLaunchParams
    });
  }

  createLoadingScreen(width, height) {
    // Фон
    const bg = this.add.graphics();
    bg.fillStyle(0x1d2330);
    bg.fillRect(0, 0, width, height);

    // Логотип/заголовок
    // ✅ Везде используем BoldPixels
    this.titleText = this.add.text(width / 2, height / 2 - 100, 'Find the Pair', {
      fontFamily: 'BoldPixels, "Courier New", monospace',
      fontSize: '48px',
      color: '#4ECDC4',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    // Описание
    this.subtitleText = this.add.text(width / 2, height / 2 - 50, 'Тренируйте память с красивыми карточками', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '18px',
      color: '#E8E1C9'
    }).setOrigin(0.5);

    // VK приветствие (если есть данные пользователя)
    if (this.vkUserData) {
      const userName = this.vkUserData.first_name || 'Игрок';
      this.welcomeText = this.add.text(width / 2, height / 2 - 20, `Привет, ${userName}! 👋`, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '16px',
        color: '#F39C12'
      }).setOrigin(0.5);
    }

    // Контейнер прогресс-бара
    const progressBoxWidth = 320;
    const progressBoxHeight = 50;
    const progressBoxX = width / 2 - progressBoxWidth / 2;
    const progressBoxY = height / 2 + 50;

    // Фон прогресс-бара
    this.progressBox = this.add.graphics();
    this.progressBox.fillStyle(0x222222, 0.8);
    this.progressBox.fillRoundedRect(progressBoxX, progressBoxY, progressBoxWidth, progressBoxHeight, 10);
    
    // Рамка прогресс-бара
    this.progressBox.lineStyle(2, 0x4ECDC4, 0.8);
    this.progressBox.strokeRoundedRect(progressBoxX, progressBoxY, progressBoxWidth, progressBoxHeight, 10);

    // Сам прогресс-бар
    this.progressBar = this.add.graphics();

    // Текст прогресса
    this.progressText = this.add.text(width / 2, progressBoxY + progressBoxHeight / 2, '0%', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '16px',
      color: '#FFFFFF',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    // Текст загружаемого файла
    this.loadingText = this.add.text(width / 2, progressBoxY + progressBoxHeight + 30, 'Инициализация...', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '14px',
      color: '#95A5A6'
    }).setOrigin(0.5);

    // Анимация заголовка
    this.tweens.add({
      targets: this.titleText,
      scaleX: 1.05,
      scaleY: 1.05,
      duration: 2000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
  }

  setupLoadingHandlers() {
    const { width, height } = this.scale;
    const progressBoxWidth = 300;
    const progressBoxX = width / 2 - 160;
    const progressBoxY = height / 2 + 50;

    // Обновление прогресса
    this.load.on('progress', (value) => {
      this.progressBar.clear();
      this.progressBar.fillStyle(0x4ECDC4);
      this.progressBar.fillRoundedRect(
        progressBoxX + 10,
        progressBoxY + 10,
        progressBoxWidth * value,
        30,
        5
      );
      
      const percentage = Math.round(value * 100);
      this.progressText.setText(`${percentage}%`);
    });

    // Загрузка файла
    this.load.on('fileprogress', (file) => {
      this.loadingText.setText(`Загрузка: ${file.key}`);
    });



    // Ошибка загрузки
    this.load.on('fileerror', (file) => {
      console.error('❌ File load error:', file.key);
      this.loadingText.setText(`Ошибка загрузки: ${file.key}`);
      this.loadingText.setColor('#E74C3C');
    });

        // Завершение загрузки
this.load.on('complete', () => {
  console.log('[PreloadScene] Loader complete event');
  this.loadingText.setText('Загрузка завершена!');
  
  this.time.delayedCall(500, () => {
    this.startNextScene();
  });
});
    
  }






  

  // ================================
  // ⭐ ВАЖНО: preload делаем async
  // ================================
// ================================
//  ✅ ВАЖНО: preload СИНХРОННЫЙ
// ================================
// ⚠️ Обрати внимание: здесь async!
preload() {
  const { width, height } = this.scale;

  // 1️⃣ Стартуем загрузку кастомных шрифтов — НИЧЕГО не ждём, не блокируем Phaser
  this.loadCustomFont()
    .then((ok) => {
      console.log('🔤 BoldPixels load result:', ok);
      if (!ok) {
        this.showFontErrorNotification();
      }
    })
    .catch((e) => {
      console.warn('⚠️ loadCustomFont error in preload:', e);
    });

  // 2️⃣ Loreley Antiqua — тоже фаер-энд-форгет
  this.loadLoreleyFont()
    .then((ok) => {
      console.log('🔤 Loreley load result:', ok);
    })
    .catch((e) => {
      console.warn('⚠️ loadLoreleyFont error in preload:', e);
    });

  // 3️⃣ Рисуем экран загрузки
  this.createLoadingScreen(width, height);

  // 4️⃣ Вешаем обработчики загрузчика
  this.setupLoadingHandlers();

  // 5️⃣ Кладём ассеты в очередь
  this.load.setPath('assets/');
  this.loadGameAssets();

  if (this.isVKEnvironment) {
    this.loadVKAssets();
  }
}





  // ===============================================
  // ✅ УЛУЧШЕННАЯ ЗАГРУЗКА BoldPixels БЕЗ МИГАНИЯ
  // ===============================================
// ===============================================
// ✅ УЛУЧШЕННАЯ ЗАГРУЗКА BoldPixels БЕЗ БЛОКИРОВКИ PHASER
// ===============================================
loadCustomFont() {
  console.log('🔤 Loading BoldPixels font...');

  const fontName = 'BoldPixels';
  const fontPath = 'assets/fonts/BoldPixels.ttf';

  // Если Font API нет — просто выходим, игра работает дальше
  if (!document.fonts || !window.FontFace) {
    console.warn('⚠️ Font API not supported, using fallback fonts');
    return Promise.resolve(false);
  }

  // Уже загружен?
  if (document.fonts.check(`12px "${fontName}"`)) {
    console.log('✅ BoldPixels already loaded');
    return Promise.resolve(true);
  }

  // Асинхронная загрузка, НЕ блокирующая Phaser
  const fontFace = new FontFace(fontName, `url(${fontPath})`);

  return Promise.race([
    fontFace.load(),
    new Promise((_, reject) => setTimeout(() => reject('timeout'), 5000))
  ])
    .then((loadedFace) => {
      // Если не timeout, добавляем шрифт
      if (loadedFace && loadedFace instanceof FontFace) {
        document.fonts.add(loadedFace);
      }

      // Финальная проверка
      if (!document.fonts.check(`12px "${fontName}"`)) {
        console.warn('⚠️ BoldPixels not reported as ready by document.fonts, но будем всё равно использовать');
        return false;
      }

      console.log('🎉 BoldPixels fully loaded');
      return true;
    })
    .catch((err) => {
      console.warn('⚠️ Failed to load BoldPixels:', err);
      return false;
    });
}

  
  async loadLoreleyFont() {
  const fontName = 'Loreley Antiqua';
  const fontPath = 'assets/fonts/LoreleyAntiqua.ttf'; // проверь название файла

  if (document.fonts.check(`12px "${fontName}"`)) {
    console.log('✔ Loreley already loaded');
    return;
  }

  try {
    const face = new FontFace(fontName, `url(${fontPath})`);
    const loaded = await face.load();
    document.fonts.add(loaded);

    // гарантирует, что браузер применит шрифт
    await document.fonts.ready;

    console.log('✔ Loreley fully loaded');
  } catch (err) {
    console.warn('⚠ Loreley failed to load:', err);
  }
}



  // ✅ НОВЫЙ МЕТОД: Уведомление об ошибке шрифта
  showFontErrorNotification() {
    const { width, height } = this.scale;
    
    const warningText = this.add.text(
      width / 2,
      height - 50,
      '⚠️ Кастомный шрифт не загружен',
      {
        fontFamily: 'Arial, sans-serif',
        fontSize: '14px',
        color: '#F39C12',
        backgroundColor: '#2C3E50',
        padding: { x: 10, y: 5 }
      }
    ).setOrigin(0.5);
    
    this.time.delayedCall(3000, () => {
      warningText.destroy();
    });
  }

  loadGameAssets() {
    // ✅ FIX: Определяем нужно ли загружать HD версии
    const DPR = window.devicePixelRatio || 1;
    const useHD = DPR >= 1.5; // Retina/HD экраны
    
    console.log(`📦 Loading assets (HD: ${useHD}, DPR: ${DPR})`);
    
    // ✅ FIX: Загружаем карты с @2x суффиксом для HD
    window.ALL_CARD_KEYS.forEach(key => {
      const path = useHD
        ? `cards/${key}@2x.png`
        : `cards/${key}.png`;
      
      this.load.image(key, path);
    });

    // ✅ FIX: Задняя сторона карты тоже в HD
    const backPath = useHD ? 'back_card02@2x.png' : 'back_card02.png';
    this.load.image('back', backPath);

    // ✅ FIX: UI элементы в HD
    const button01Path = useHD ? 'button01@2x.png' : 'button01.png';
    this.load.image('button01', button01Path);

    // Фоны
    if (useHD) {
      this.load.image('bg_menu', 'bg_menu@2x.png');
      this.load.image('bg_game', 'bg_game@2x.png');
    } else {
      this.load.image('bg_menu', 'bg_menu.png');
      this.load.image('bg_game', 'bg_game.png');
    }

    // Дополнительные ассеты
    const starPath = useHD ? 'star@2x.png' : 'star.png';
    const trophyPath = useHD ? 'trophy@2x.png' : 'trophy.png';
    this.load.image('star', starPath);
    this.load.image('trophy', trophyPath);

    // Звуки
    if (this.load.audioDecodeByList) {
      this.load.audio('card_flip', ['sounds/card_flip.mp3', 'sounds/card_flip.wav']);
      this.load.audio('match_sound', ['sounds/match.mp3', 'sounds/match.wav']);
      this.load.audio('win_sound', ['sounds/win.mp3', 'sounds/win.wav']);
    }
    
    this.registry.set('useHDTextures', useHD);
    this.registry.set('textureDPR', DPR);
  }

  loadVKAssets() {
    console.log('📦 Loading VK-specific assets...');
    
    if (this.vkUserData && this.vkUserData.photo_100) {
      this.load.image('user_avatar', this.vkUserData.photo_100);
    }
  }

startNextScene() {
  // 🔐 защита от двойного запуска
  if (this._sceneStarted) return;
  this._sceneStarted = true;

  console.log('[PreloadScene] startNextScene called');

  if (window.progressSyncManager) {
    this.registry.set('progressSyncManager', window.progressSyncManager);
    console.log('🔗 progressSyncManager registered in scene registry');
  }
  
  if (this.isVKEnvironment) {
    try {
      this.initVKAchievements();
    } catch (e) {
      console.warn('⚠️ VK Achievement init error:', e);
    }
  }

  this.scene.start('MenuScene', { 
    page: 0,
    userData: this.vkUserData,
    isVK: this.isVKEnvironment
  });
}

  initVKAchievements() {
    try {
      if (!window.VKAchievementManager) {
        window.VKAchievementManager = new VKAchievementManager(this.vkUserData);
      }
      console.log('🏆 VK Achievement Manager initialized');
    } catch (error) {
      console.warn('⚠️ VK Achievement Manager init failed:', error);
    }
  }

create() {
  console.log('[PreloadScene] create()');

  // фильтры текстур
  this.applyTextureFiltering();

  // флаг: сцена уже стартанула?
  this._sceneStarted = false;

  // 🔄 Fallback: если по какой-то причине COMPLETE не сработает,
  // всё равно попробуем стартануть меню через 800 мс
  this.time.delayedCall(800, () => {
    if (!this._sceneStarted) {
      console.warn('[PreloadScene] Fallback startNextScene from create()');
      this.startNextScene();
    }
  });
}


  applyTextureFiltering() {
    console.log('🎨 Applying texture filtering...');
    
    const textures = this.textures;
    const useHD = this.registry.get('useHDTextures') || false;
    
    const applySmooth = (key) => {
      if (textures.exists(key)) {
        const texture = textures.get(key);
        texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
      }
    };
    
    const applySharp = (key) => {
      if (textures.exists(key)) {
        const texture = textures.get(key);
        texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
      }
    };
    
    // Сейчас используем сглаженный вариант
    console.log('Using SMOOTH filtering (LINEAR + antialias)');
    window.ALL_CARD_KEYS.forEach(key => applySmooth(key));
    applySmooth('back');
    applySmooth('button01');
    applySmooth('star');
    applySmooth('trophy');
    
    console.log('✅ Texture filtering applied');
  }
};

// ============================================
// VK Achievement Manager - система достижений
// ============================================
class VKAchievementManager {
  constructor(userData) {
    this.userData = userData;
    this.achievements = this.loadAchievements();
    this.isVKEnvironment = !!window.VK_LAUNCH_PARAMS;

    this.initSyncManager();
    
    this.vkAchievements = {
      first_win: {
        title: 'Первая победа',
        description: 'Найдите все пары в первый раз',
        icon: 'trophy',
        points: 100
      },
      perfect_game: {
        title: 'Идеальная игра',
        description: 'Пройдите уровень без ошибок',
        icon: 'star',
        points: 200
      },
      speed_runner: {
        title: 'Скоростной бегун',
        description: 'Пройдите уровень за 30 секунд',
        icon: 'lightning',
        points: 300
      },
      persistent: {
        title: 'Упорство',
        description: 'Сыграйте 10 игр подряд',
        icon: 'medal',
        points: 150
      },
      expert: {
        title: 'Эксперт памяти',
        description: 'Пройдите сложный уровень',
        icon: 'crown',
        points: 250
      }
    };
  }

  loadAchievements() {
    if (this.isVKEnvironment && window.vkBridge) {
      return this.loadFromVKStorage();
    }
    
    const saved = localStorage.getItem('findpair_achievements');
    return saved ? JSON.parse(saved) : this.getDefaultAchievements();
  }

  async loadFromVKStorage() {
    try {
      const result = await window.vkBridge.send('VKWebAppStorageGet', {
        keys: ['achievements']
      });
      
      if (result.keys && result.keys.length > 0) {
        const achievementsData = result.keys[0].value;
        return achievementsData ? JSON.parse(achievementsData) : this.getDefaultAchievements();
      }
    } catch (error) {
      console.warn('⚠️ Failed to load achievements from VK Storage:', error);
    }
    
    return this.getDefaultAchievements();
  }

  getDefaultAchievements() {
    return {
      first_win: false,
      perfect_game: false,
      speed_runner: false,
      persistent: false,
      expert: false
    };
  }

  async initSyncManager() {
    try {
      this.syncManager = window.progressSyncManager || new ProgressSyncManager();
      
      if (!window.progressSyncManager) {
        window.progressSyncManager = this.syncManager;
        await this.syncManager.init();
      }
      
      const progressData = await this.syncManager.loadProgress();
      if (progressData && progressData.achievements) {
        this.achievements = { ...progressData.achievements };
      }
      
      console.log('🎯 Achievement sync manager initialized');
      
    } catch (error) {
      console.error('❌ Failed to init sync manager:', error);
      this.achievements = this.loadAchievements();
    }
  }

  async saveAchievements() {
    try {
      if (this.syncManager) {
        const currentProgress = await this.syncManager.loadProgress();
        currentProgress.achievements = { ...this.achievements };
        await this.syncManager.saveProgress(currentProgress, true);
      } else {
        if (this.isVKEnvironment && window.vkBridge) {
          await window.vkBridge.send('VKWebAppStorageSet', {
            key: 'achievements',
            value: JSON.stringify(this.achievements)
          });
        }
        localStorage.setItem('findpair_achievements', JSON.stringify(this.achievements));
      }
      
      console.log('✅ Achievements saved via sync manager');
      
    } catch (error) {
      console.error('❌ Failed to save achievements:', error);
      throw error;
    }
  }

  async unlockAchievement(achievementId) {
    if (this.achievements[achievementId]) {
      return false;
    }

    this.achievements[achievementId] = true;
    await this.saveAchievements();

    if (this.isVKEnvironment && window.vkBridge) {
      try {
        await this.sendVKAchievement(achievementId);
      } catch (error) {
        console.warn('⚠️ Failed to send VK achievement:', error);
      }
    }

    return true;
  }

  async sendVKAchievement(achievementId) {
    const achievement = this.vkAchievements[achievementId];
    if (!achievement) return;

    try {
      await window.vkBridge.send('VKWebAppAddToCommunity');
      await window.vkBridge.send('VKWebAppShowWallPostBox', {
        message: `🏆 Получено достижение "${achievement.title}"!\n${achievement.description}\n\n#FindThePair #ИграПамять`,
        attachments: window.location.href
      });
    } catch (error) {
      console.log('VK sharing cancelled or not permitted');
    }
  }

  getAchievementProgress() {
    const total = Object.keys(this.vkAchievements).length;
    const unlocked = Object.values(this.achievements).filter(Boolean).length;
    return { unlocked, total, percentage: Math.round((unlocked / total) * 100) };
  }

  getTotalPoints() {
    return Object.entries(this.achievements)
      .filter(([_, unlocked]) => unlocked)
      .reduce((total, [id, _]) => {
        return total + (this.vkAchievements[id]?.points || 0);
      }, 0);
  }
}

// Экспортируем для использования в других сценах
window.VKAchievementManager = VKAchievementManager;
