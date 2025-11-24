//---scenes/PreloadScene.js - УЛУЧШЕННАЯ версия с VK интеграцией

window.PreloadScene = class PreloadScene extends Phaser.Scene {
  constructor(){ super('PreloadScene'); }

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
  // ✅ ФИХ: Теперь используем BoldPixels везде
  this.titleText = this.add.text(width/2, height/2 - 100, 'Find the Pair', {
    fontFamily: 'BoldPixels, "Courier New", monospace', // ✅ ИЗМЕНЕНО
    fontSize: '48px',
    color: '#4ECDC4',
    fontStyle: 'bold'
  }).setOrigin(0.5);

    // Описание
    this.subtitleText = this.add.text(width/2, height/2 - 50, 'Тренируйте память с красивыми карточками', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '18px',
      color: '#E8E1C9'
    }).setOrigin(0.5);

    // VK приветствие (если есть данные пользователя)
    if (this.vkUserData) {
      const userName = this.vkUserData.first_name || 'Игрок';
      this.welcomeText = this.add.text(width/2, height/2 - 20, `Привет, ${userName}! 👋`, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '16px',
        color: '#F39C12'
      }).setOrigin(0.5);
    }

    // Контейнер прогресс-бара
    const progressBoxWidth = 320;
    const progressBoxHeight = 50;
    const progressBoxX = width/2 - progressBoxWidth/2;
    const progressBoxY = height/2 + 50;

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
    this.progressText = this.add.text(width/2, progressBoxY + progressBoxHeight/2, '0%', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '16px',
      color: '#FFFFFF',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    // Текст загружаемого файла
    this.loadingText = this.add.text(width/2, progressBoxY + progressBoxHeight + 30, 'Инициализация...', {
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
    const progressBoxX = width/2 - 160;
    const progressBoxY = height/2 + 50;

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

    // Завершение загрузки
    this.load.on('complete', () => {
      this.loadingText.setText('Загрузка завершена!');
      
      // Небольшая задержка перед переходом
      this.time.delayedCall(500, () => {
        this.startNextScene();
      });
    });

    // Ошибка загрузки
    this.load.on('fileerror', (file) => {
      console.error('❌ File load error:', file.key);
      this.loadingText.setText(`Ошибка загрузки: ${file.key}`);
      this.loadingText.setColor('#E74C3C');
    });
  }

  // Scene.js:152 - ЗАМЕНИТЬ ВЕСЬ МЕТОД loadGameAssets

  // ПЕРЕД loadGameAssets()
preload() {
  const { width, height } = this.scale;

  // ❗ Запускаем загрузку шрифта "в фоне", без await
  this.loadCustomFont().catch(err => {
    console.warn('Font load error in preload:', err);
  });

  // Дальше — обычный phaser-preload
  this.createLoadingScreen(width, height);
  this.setupLoadingHandlers();
  this.load.setPath('assets/');
  this.loadGameAssets();
  if (this.isVKEnvironment) {
    this.loadVKAssets();
  }
}



// ✅ НОВЫЙ МЕТОД: Загрузка кастомного шрифта
async loadCustomFont() {
  console.log('🔤 Loading BoldPixels font...');
  
  const fontName = 'BoldPixels';
  const fontPath = 'assets/fonts/BoldPixels.ttf'; // Относительно index.html
  
  try {
    // Проверяем, загружен ли уже через CSS
    const isFontInDocument = document.fonts.check(`16px "${fontName}"`);
    
    if (isFontInDocument) {
      console.log('✅ BoldPixels already loaded via CSS');
      return;
    }
    
    // Если нет — загружаем программно
    console.log('📥 Loading BoldPixels programmatically...');
    
    const fontFace = new FontFace(fontName, `url(${fontPath})`);
    
    // Загружаем с таймаутом 5 секунд
    const loadedFont = await Promise.race([
      fontFace.load(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Font load timeout')), 5000)
      )
    ]);
    
    // Добавляем в document
    document.fonts.add(loadedFont);
    
    console.log('✅ BoldPixels loaded programmatically');
    
    // Ждём готовности всех шрифтов
    await document.fonts.ready;
    
    // Финальная проверка
    const isReady = document.fonts.check(`16px "${fontName}"`);
    if (!isReady) {
      throw new Error('Font check failed after load');
    }
    
    console.log('✅ BoldPixels ready for use');
    
  } catch (error) {
    console.error('❌ Failed to load BoldPixels:', error);
    console.warn('⚠️ Falling back to system font');
    
    // Показать предупреждение пользователю
    this.showFontErrorNotification();
  }
}

// ✅ НОВЫЙ МЕТОД: Уведомление об ошибке шрифта
showFontErrorNotification() {
  // Показать временное уведомление
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
  
  // Удалить через 3 секунды
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
      ? `cards/${key}@2x.png`  // 400×600px для HD
      : `cards/${key}.png`;     // 200×300px для обычных
    
    this.load.image(key, path);
  });

  // ✅ FIX: Задняя сторона карты тоже в HD
  const backPath = useHD ? 'back_card02@2x.png' : 'back_card02.png';
  this.load.image('back', backPath);

  // ✅ FIX: UI элементы в HD
  const button01Path = useHD ? 'button01@2x.png' : 'button01.png';
  this.load.image('button01', button01Path);

  // Фоны (если используются)
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

  // Звуки (без изменений)
  if (this.load.audioDecodeByList) {
    this.load.audio('card_flip', ['sounds/card_flip.mp3', 'sounds/card_flip.wav']);
    this.load.audio('match_sound', ['sounds/match.mp3', 'sounds/match.wav']);
    this.load.audio('win_sound', ['sounds/win.mp3', 'sounds/win.wav']);
  }
  
  // ✅ FIX: Сохраняем флаг для использования в других сценах
  this.registry.set('useHDTextures', useHD);
  this.registry.set('textureDPR', DPR);
}

  loadVKAssets() {
    console.log('📦 Loading VK-specific assets...');
    
    // VK специфичные ассеты (иконки, темы и т.д.)
    // Можно добавить загрузку аватара пользователя, если нужно
    if (this.vkUserData && this.vkUserData.photo_100) {
      this.load.image('user_avatar', this.vkUserData.photo_100);
    }
  }

  startNextScene() {
      // Привязать глобальный ProgressSyncManager к registry Phaser
  if (window.progressSyncManager) {
    this.registry.set('progressSyncManager', window.progressSyncManager);
    console.log('🔗 progressSyncManager registered in scene registry');
  }
    
    // Инициализация VK достижений
    if (this.isVKEnvironment) {
      this.initVKAchievements();
    }

    // Переходим к меню
    this.scene.start('MenuScene', { 
      page: 0,
      userData: this.vkUserData,
      isVK: this.isVKEnvironment
    });
  }

  initVKAchievements() {
    try {
      // Создаем менеджер VK достижений
      // ProgressSyncManager уже инициализирован глобально в main.js
      if (!window.VKAchievementManager) {
        window.VKAchievementManager = new VKAchievementManager(this.vkUserData);
      }
      console.log('🏆 VK Achievement Manager initialized');
    } catch (error) {
      console.warn('⚠️ VK Achievement Manager init failed:', error);
    }
  }

  create() {
    // Этот метод вызывается после preload
    // Здесь можно добавить дополнительную логику, если нужно
    this.applyTextureFiltering();

  }

  applyTextureFiltering() {
  console.log('🎨 Applying texture filtering...');
  
  const textures = this.textures;
  const useHD = this.registry.get('useHDTextures') || false;
  
  // ✅ ВАРИАНТ A: Для стилизованной/векторной графики (плавные края)
  // Используем LINEAR фильтр + antialias
  const applySmooth = (key) => {
    if (textures.exists(key)) {
      const texture = textures.get(key);
      // LINEAR = 1 (smooth scaling)
      texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
    }
  };
  
  // ✅ ВАРИАНТ B: Для пиксель-арт графики (четкие края)
  // Используем NEAREST фильтр
  const applySharp = (key) => {
    if (textures.exists(key)) {
      const texture = textures.get(key);
      // NEAREST = 0 (pixel-perfect)
      texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
  };
  
  // ✅ ВЫБЕРИТЕ ОДИН ИЗ ВАРИАНТОВ:
  
  // Если у вас ВЕКТОРНАЯ/ФОТОГРАФИЧЕСКАЯ графика:
  console.log('Using SMOOTH filtering (LINEAR + antialias)');
  window.ALL_CARD_KEYS.forEach(key => applySmooth(key));
  applySmooth('back');
  applySmooth('button01');
  applySmooth('star');
  applySmooth('trophy');
  
  /* ИЛИ если у вас ПИКСЕЛЬНАЯ графика:
  console.log('Using SHARP filtering (NEAREST)');
  window.ALL_CARD_KEYS.forEach(key => applySharp(key));
  applySharp('back');
  applySharp('button01');
  applySharp('star');
  applySharp('trophy');
  */
  
  console.log('✅ Texture filtering applied');
}
};

// VK Achievement Manager - система достижений для VK
class VKAchievementManager {
  constructor(userData) {
    this.userData = userData;
    this.achievements = this.loadAchievements();
    this.isVKEnvironment = !!window.VK_LAUNCH_PARAMS;

    // ДОБАВЛЕНО: Интеграция с ProgressSyncManager
      this.initSyncManager();
    
    // Определения достижений VK
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
    // Сначала пытаемся загрузить из VK Storage, потом из localStorage
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
            // ИСПОЛЬЗУЕМ ГЛОБАЛЬНЫЙ МЕНЕДЖЕР
      this.syncManager = window.progressSyncManager || new ProgressSyncManager();
      
      if (!window.progressSyncManager) {
        window.progressSyncManager = this.syncManager;
        await this.syncManager.init();
      }
      
      // Загружаем существующие достижения
      const progressData = await this.syncManager.loadProgress();
      if (progressData && progressData.achievements) {
        this.achievements = { ...progressData.achievements };
      }
      
      console.log('🎯 Achievement sync manager initialized');
      
    } catch (error) {
      console.error('❌ Failed to init sync manager:', error);
      // Fallback на старую логику
      this.achievements = this.loadAchievements();
    }
  }

  

  async saveAchievements() {
    try {
      if (this.syncManager) {
        // Используем новый синхронизатор
        const currentProgress = await this.syncManager.loadProgress();
        currentProgress.achievements = { ...this.achievements };
        await this.syncManager.saveProgress(currentProgress, true);
      } else {
        // Fallback на старую логику
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
      return false; // Уже разблокировано
    }

    this.achievements[achievementId] = true;
    await this.saveAchievements();

    // Отправляем событие во VK (если поддерживается)
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

    // Отправляем статистику во VK
    try {
      await window.vkBridge.send('VKWebAppAddToCommunity');
      
      // Можно также отправить пост на стену (если разрешено)
      await window.vkBridge.send('VKWebAppShowWallPostBox', {
        message: `🏆 Получено достижение "${achievement.title}"!\n${achievement.description}\n\n#FindThePair #ИграПамять`,
        attachments: window.location.href
      });
    } catch (error) {
      // Пользователь отменил или нет разрешений
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
