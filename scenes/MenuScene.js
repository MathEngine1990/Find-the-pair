//---scenes/MenuScene.js - ПОЛНОСТЬЮ ИСПРАВЛЕННАЯ ВЕРСИЯ

window.MenuScene = class MenuScene extends Phaser.Scene {
  constructor(){ 
    super('MenuScene'); 
  }

  init(data){ 
    this.levelPage = data?.page || 0; 
    
    // ✅ КРИТИЧНО: Инициализация коллекций UI
    this.levelButtons = [];
    this.syncButton = null;
    this._resizeDebounce = false;
    this._wheelHandler = null;
      this._syncInitiated = false; // ← ✅ НОВОЕ: Флаг для sync
    
    // Получаем VK данные если есть
    this.vkUserData = data?.userData || window.VK_USER_DATA;
    this.isVKEnvironment = data?.isVK || !!window.VK_LAUNCH_PARAMS;
    
    // Инициализация синхронизации
    this.syncManager = null;
    this.progress = {};
    this.isSyncing = false;
}

// === MenuScene.js:48-56 - ЗАМЕНИТЬ ===

// === MenuScene.js:48-87 - ЗАМЕНИТЬ async create() ===

async create() {
  console.log('MenuScene.create() started');
  
  // Создаем TextManager ДО любых операций
  this.textManager = new TextManager(this);

  // Флаги
  this._isInitializing = true;
  this._isDrawing = false;  // просто инициализация, НЕ ставим true перед drawMenu

  // Базовая структура прогресса
  this.progress = {
    levels: {},
    achievements: {},
    stats: {}
  };

  // Фон сразу
  this.ensureGradientBackground();

  // 1. Инициализируем syncManager
  try {
    await this.initializeSyncManager();
    console.log('✅ SyncManager initialized');
  } catch (e) {
    console.error('❌ Sync init failed:', e);
  }

  // 2. Один раз пытаемся получить прогресс
  if (this.syncManager?.getProgress) {
    try {
      this.progress = await this.syncManager.getProgress();
      console.log(
        '✅ Progress loaded:',
        Object.keys(this.progress.levels || {}).length,
        'levels'
      );
    } catch (err) {
      console.warn('⚠️ Initial getProgress failed, using empty progress:', err);
      this.progress = { levels: {}, achievements: {}, stats: {} };
    }
  }

  // 3. Ждём шрифты (с таймаутом)
  try {
    await Promise.race([
      document.fonts.ready,
      new Promise(resolve => setTimeout(resolve, 2000))
    ]);
    console.log('✅ Fonts ready');
  } catch (e) {
    console.warn('⚠️ Fonts timeout:', e);
  }

  // 4. Рисуем меню (ТЕПЕРЬ без внешнего _isDrawing)
  try {
    await this.drawMenu(this.levelPage);
  } catch (e) {
    console.error('❌ drawMenu error:', e);
  }

  // 5. Фоновая синхронизация VK один раз
  if (this.syncManager?.isVKAvailable?.() && !this._syncInitiated) {
    console.log('🔄 Triggering initial background sync');
    this._syncInitiated = true;

    this.syncManager.performSync()
      .then((synced) => {
        if (synced) {
          console.log('✅ Background sync completed');
          if (this.scene.isActive()) {
            this.syncManager.getProgress()
              .then(progress => {
                this.progress = progress;
                this.refreshUI();
              })
              .catch(err => {
                console.warn('⚠️ getProgress after sync failed:', err);
              });
          }
        }
      })
      .catch(err => {
        console.warn('⚠️ Background sync failed:', err);
      });
  }

  // Разблокируем resize ПОСЛЕ всех операций
  this._isInitializing = false;

  // глобальный debounced-resize
  this.game.events.on('debounced-resize', this.handleResize, this);

  this.events.once('shutdown', this.cleanup, this);
}



// ✅ НОВЫЙ МЕТОД
// === MenuScene.js:90-103 - ЗАМЕНИТЬ handleResize ===

async handleResize() {
  // ✅ FIX #5: Блокируем resize во время инициализации
  if (this._isInitializing) {
    console.log('⏸️ Resize blocked: scene initializing');
    return;
  }
  
  if (!this.scene.isActive()) {
    console.log('⏸️ Resize blocked: scene inactive');
    return;
  }
  
  // ✅ Проверка TextManager
  if (!this.textManager) {
    console.warn('⚠️ TextManager missing during resize, recreating');
    this.textManager = new TextManager(this);
  }
  
  // 1️⃣ Обновляем размеры в TextManager
  this.textManager.updateDimensions();
  
  // 2️⃣ Перерисовываем UI
  this.ensureGradientBackground();
  await this.drawMenu(this.levelPage);
}



  // Инициализация менеджера синхронизации
// Инициализация менеджера синхронизации
async initializeSyncManager() {
  this.syncManager = this.registry.get('progressSyncManager');
  
  if (!this.syncManager) {
    console.error('❌ ProgressSyncManager not found in registry!');
    console.warn('⚠️ Using fallback syncManager (localStorage only)');
    
    // ✅ ИСПРАВЛЕННЫЙ fallback
    this.syncManager = {
      // Метод загрузки прогресса
      loadProgress: async () => {
        try {
          const key = `findpair_progress_${window.VK_USER_DATA?.id || 'guest'}`;
          const saved = localStorage.getItem(key);
          if (!saved) return { levels: {} };
          
          const parsed = JSON.parse(saved);
          return parsed;
        } catch (e) {
          console.warn('Fallback loadProgress error:', e);
          return { levels: {} };
        }
      },
      
      // ✅ ИСПРАВЛЕНО: независимая реализация
      getProgress: async () => {
        try {
          const key = `findpair_progress_${window.VK_USER_DATA?.id || 'guest'}`;
          const saved = localStorage.getItem(key);
          if (!saved) return { levels: {} };
          
          const parsed = JSON.parse(saved);
          return parsed;
        } catch (e) {
          console.warn('Fallback getProgress error:', e);
          return { levels: {} };
        }
      },
      
      saveProgress: (data) => {
        try {
          const key = `findpair_progress_${window.VK_USER_DATA?.id || 'guest'}`;
          localStorage.setItem(key, JSON.stringify(data));
        } catch (e) {
          console.error('💾 Fallback save error:', e);
        }
      },
      
      isVKAvailable: () => false,
      
      getSyncStatus: () => ({ 
        isVKAvailable: false, 
        lastSyncTime: 0,
        isSyncing: false,
        queueLength: 0,
        timeSinceLastSync: 0,
        isInitialized: true
      }),
      
      forceSync: async () => {
        console.warn('⚠️ Fallback: VK not available');
        return false;
      },
      
      setCurrentLevel: () => {},
      getCurrentLevel: () => 0,
      
      // ✅ Пустые обработчики
      onSyncStart: null,
      onSyncComplete: null,
      onSyncError: null
    };
  }
  
  // ⬇️ КРИТИЧНО: Подписка на события (только если методы существуют)
  if (this.syncManager.onSyncStart !== undefined) {
    const originalOnSyncStart = this.syncManager.onSyncStart;
    this.syncManager.onSyncStart = () => {
      if (originalOnSyncStart) originalOnSyncStart();
      this.isSyncing = true;
    };
  }
  
  if (this.syncManager.onSyncComplete !== undefined) {
    const originalOnSyncComplete = this.syncManager.onSyncComplete;
    this.syncManager.onSyncComplete = (data) => {
      if (originalOnSyncComplete) originalOnSyncComplete(data);
      this.isSyncing = false;
      this.progress = data;
      if (this.scene.isActive()) {
        this.refreshUI();
      }
    };
  }
  
  if (this.syncManager.onSyncError !== undefined) {
    const originalOnSyncError = this.syncManager.onSyncError;
    this.syncManager.onSyncError = (error) => {
      if (originalOnSyncError) originalOnSyncError(error);
      this.isSyncing = false;
      if (this.scene.isActive()) {
        this.showToast('⚠️ Ошибка синхронизации', '#E74C3C');
      }
    };
  }
}

  cleanup() {
    console.log('MenuScene cleanup started');

// ✅ ДОБАВИТЬ: Удаление resize handler
    if (this._resizeHandler) {
        this.scale.off('resize', this._resizeHandler, this);
        this._resizeHandler = null;
    }
    
    if (this._wheelHandler) {
      this.input.off('wheel', this._wheelHandler);
      this._wheelHandler = null;
    }

    if (this.levelButtons) {
      this.levelButtons.forEach(btn => {
        if (btn && btn.zone && btn.zone.removeAllListeners) {
          btn.zone.removeAllListeners();
        }
      });
      this.levelButtons = [];
    }

    console.log('MenuScene cleanup completed');
  }

async getProgress() {
  try {
    // ✅ Проверяем наличие метода перед вызовом
    if (!this.syncManager?.getProgress) {
      console.warn('⚠️ syncManager.getProgress not available');
      return {};
    }
    
    const progress = await this.syncManager.getProgress();
    return progress?.levels || {};
  } catch (e) {
    console.warn('Error loading progress:', e);
    return {};
  }
}



getStats() {
  // Прогресс уровней берем из уже загруженного this.progress
  const progressLevels = (this.progress && this.progress.levels) || {};
  const levelKeys = Object.keys(progressLevels);

  const totalLevels = window.LEVELS.length;
  const completedLevels = levelKeys.length;
  const totalStars = levelKeys.reduce((sum, key) => {
    const lvl = progressLevels[key] || {};
    return sum + (lvl.stars || 0);
  }, 0);

  const stats = {
    totalLevels,
    completedLevels,
    totalStars,
    maxStars: totalLevels * 3,
    averageStars: completedLevels > 0
      ? totalStars / completedLevels
      : 0
  };

  // Глобальная статистика — тоже из this.progress
  const globalStats = (this.progress && this.progress.stats) || {};
  stats.gamesPlayed  = globalStats.gamesPlayed  || 0;
  stats.totalTime    = globalStats.totalTime    || 0;
  stats.bestTime     = globalStats.bestTime     || null;
  stats.perfectGames = globalStats.perfectGames || 0;
  stats.totalErrors  = globalStats.totalErrors  || 0;

  return stats;
}


  getSceneWH(){
    const s = this.scale, cam = this.cameras?.main;
    const W = (s && (s.width ?? s.gameSize?.width))  || cam?.width  || this.sys.game.config.width  || 1500;
    const H = (s && (s.height ?? s.gameSize?.height)) || cam?.height || this.sys.game.config.height || 1500;
    return { W: Math.floor(W), H: Math.floor(H) };
  }

  getDPR(){ 
    return Math.min(2.0, Math.max(1, (window.devicePixelRatio || 1))); 
  }

  ensureGradientBackground(){
    const { W, H } = this.getSceneWH();

    if (this.textures.exists('bg_menu')) {
      this.bgImage && this.bgImage.destroy();
      const img = this.add.image(W/2, H/2, 'bg_menu').setOrigin(0.5).setDepth(-1000);
      const src = this.textures.get('bg_menu').getSourceImage();
      const scale = Math.max(W / src.width, H / src.height);
      img.setDisplaySize(src.width * scale, src.height * scale);
      this.bgImage = img;

      this.vignette && this.vignette.destroy();
      const vignette = this.add.graphics().setDepth(-999);
      vignette.fillStyle(0x000000, 0.20).fillRect(0,0,W,H);
      this.vignette = vignette;
      return;
    }

    const key = 'bg-grad-menu';
    const DPR = this.getDPR();
    if (this.textures.exists(key)) {
      const src = this.textures.get(key).getSourceImage();
      if (src.width !== Math.round(W*DPR) || src.height !== Math.round(H*DPR)) this.textures.remove(key);
    }
    if (!this.textures.exists(key)){
      const tex = this.textures.createCanvas(key, Math.max(2, Math.round(W*DPR)), Math.max(2, Math.round(H*DPR)));
      const ctx = tex.getContext(); ctx.save(); ctx.scale(DPR, DPR);
      const g = ctx.createLinearGradient(0,0,0,H);
      g.addColorStop(0, window.THEME.bgTop); g.addColorStop(0.6, window.THEME.bgMid); g.addColorStop(1, window.THEME.bgBottom);
      ctx.fillStyle = g; ctx.fillRect(0,0,W,H);
      ctx.restore(); tex.refresh();
    }
    this.bgImage && this.bgImage.destroy();
    this.bgImage = this.add.image(0,0,key).setOrigin(0,0).setDepth(-1000).setDisplaySize(W,H);

    this.vignette && this.vignette.destroy();
    this.vignette = this.add.graphics().setDepth(-999).fillStyle(0x000000, 0.20).fillRect(0,0,W,H);
  }

  // === MenuScene.js:211-229 - ЗАМЕНИТЬ clearMenu ===

clearMenu() {
    if (this._wheelHandler) { 
        this.input.off('wheel', this._wheelHandler); 
        this._wheelHandler = null; 
    }

   // ✅ ДОБАВИТЬ: Сброс debounce флага
    this._resizeDebounce = false;
  
    
    if (this.levelButtons) {
        this.levelButtons.forEach(btn => {
            if (btn && typeof btn.destroy === 'function') {

               // ✅ КРИТИЧНО: Проверка наличия контейнеров перед destroy
                if (btn.starsContainer && !btn.starsContainer.scene) {
                    // Уже уничтожен родителем
                    btn.starsContainer = null;
                } else if (btn.starsContainer) {
                    btn.starsContainer.destroy();
                    btn.starsContainer = null;
                }
                
                if (btn.statsContainer && !btn.statsContainer.scene) {
                    btn.statsContainer = null;
                } else if (btn.statsContainer) {
                    btn.statsContainer.destroy();
                    btn.statsContainer = null;
                }
                
                if (btn.zone && btn.zone.removeAllListeners) {
                    btn.zone.removeAllListeners();
                }
                
                btn.destroy();
            }
        });
        this.levelButtons = [];
    }
}

getSafeAreaInsets() {
  try {
    const style = getComputedStyle(document.body);
    return {
      top: parseInt(style.paddingTop) || 0,
      bottom: parseInt(style.paddingBottom) || 0,
      left: parseInt(style.paddingLeft) || 0,
      right: parseInt(style.paddingRight) || 0
    };
  } catch (e) {
    return { top: 0, bottom: 0, left: 0, right: 0 };
  }
}

async drawMenu(page = 0) {
  // Защита от параллельных перерисовок
  if (this._isDrawing) {
    console.log('⏸️ drawMenu skipped: drawing already in progress');
    return;
  }

  this._isDrawing = true;
  console.log('Drawing menu, page:', page);

  try {
    this.clearMenu();
    const { W, H } = this.getSceneWH();
    console.log('Scene dimensions:', W, H);

    // Обновляем размеры текстов
    if (this.textManager) {
      this.textManager.updateDimensions();
    }

    // Определяем мобильное устройство
    const isMobile = W < 768 || H < 600 ||
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const scaleFactor = isMobile ? 1.8 : 1.0;

    // Корректный номер страницы
    const PER_PAGE = 9; // 3×3
    const maxPage = Math.max(0, Math.ceil(window.LEVELS.length / PER_PAGE) - 1);
    this.levelPage = Math.max(0, Math.min(page, maxPage));

    // Проверяем принятие соглашения
    const acceptedAgreement = localStorage.getItem('acceptedAgreement');
    const agreementVersion  = localStorage.getItem('agreementVersion');
    const CURRENT_VERSION   = '2025-09-13';

    if (!acceptedAgreement && window.VK_DEBUG) {
      console.log('Auto-accepting agreement for debugging');
      localStorage.setItem('acceptedAgreement', 'true');
      localStorage.setItem('agreementVersion', CURRENT_VERSION);
    }

    if (!localStorage.getItem('acceptedAgreement') ||
        localStorage.getItem('agreementVersion') !== CURRENT_VERSION) {
      console.log('Showing user agreement');
      this.showUserAgreement();
      return;
    }

    console.log('Creating menu content...');

    // Адаптивная сетка
    const COLS = 3;
    const ROWS = 3;
    const PAGES = Math.max(1, Math.ceil(window.LEVELS.length / PER_PAGE));

    const safeArea = this.getSafeAreaInsets();
    let currentY = safeArea.top + 10;

    // Персонализация для VK
    if (this.vkUserData && this.vkUserData.first_name) {
      const greeting = this.textManager.createText(
        W / 2, currentY,
        `Привет, ${this.vkUserData.first_name}!`,
        'titleMedium'
      );
      greeting.setOrigin(0.5, 0);
      greeting.setColor('#243540');
      this.levelButtons.push(greeting);

      currentY += this.textManager.getSize('statLabel') + 30;
    }

    // Заголовок
    const titleText = 'Сколько пар играть?';
    const title = this.textManager.createText(
      W / 2,
      currentY,
      titleText,
      isMobile ? 'titleLarge_mobile' : 'titleLarge_desktop'
    );
    title.setOrigin(0.5);
    this.levelButtons.push(title);

    currentY += this.textManager.getSize('titleLarge') + 10;

    // 🔢 Статистика — синхронно, из this.progress
    const stats = this.getStats();
    if (stats.completedLevels > 0) {
      const statsText =
        `Пройдено: ${stats.completedLevels}/${stats.totalLevels} ` +
        `| Звезд: ${stats.totalStars}/${stats.maxStars}`;

      const statsDisplay = this.textManager.createText(
        W / 2, currentY,
        statsText,
        'statLabel'
      );
      statsDisplay.setOrigin(0.5);
      this.levelButtons.push(statsDisplay);

      currentY += this.textManager.getSize('statLabel') + 18;
    }

    // Область для кнопок уровней
    const topY    = H * (isMobile ? 0.20 : 0.16);
    const bottomY = H * (isMobile ? 0.75 : 0.79);
    const areaH   = bottomY - topY;
    const areaW   = Math.min(
      W * (isMobile ? 0.98 : 0.90),
      isMobile ? W : 1080
    );

    const cellH   = areaH / ROWS;
    const cellW   = areaW / COLS;
    const gridLeft = (W - areaW) / 2;
    const gridTop  = topY;

    const startIdx    = this.levelPage * PER_PAGE;
    const endIdx      = Math.min(startIdx + PER_PAGE, window.LEVELS.length);
    const pageLevels  = window.LEVELS.slice(startIdx, endIdx);
    const progressLevels = (this.progress && this.progress.levels) || {};

    console.log('Creating level buttons:', pageLevels.length, 'Mobile:', isMobile);

pageLevels.forEach((lvl, i) => {
  const levelIndex = startIdx + i;
  const r = Math.floor(i / COLS);
  const c = i % COLS;

  const x = gridLeft + c * cellW + cellW / 2;
  let   y = gridTop  + r * cellH + cellH / 2;

  const btnW = Math.min(
    isMobile ? cellW * 0.92 : 320,
    cellW * 0.9
  );

  // исходная высота, как была раньше
  let btnH = Math.min(
    isMobile ? cellH * 0.88 : 200,
    cellH * 0.86
  );

  // 🔽 только для мобилы уменьшаем высоту и поднимаем низ
  if (isMobile) {
    const oldH = btnH;
    const newH = cellH * 0.70; // поэкспериментируй: 0.65 / 0.60 если ещё тесно

    btnH = newH;

    // поднимаем центр на половину разницы, чтобы верхняя граница осталась на месте
    const diff = oldH - newH;
    y -= diff / 2;
  }

  this.createLevelButton(
    x, y,
    btnW, btnH,
    lvl, levelIndex,
    scaleFactor,
    progressLevels
  );
});


    // Навигация по страницам
    const yNav = H * (isMobile ? 0.88 : 0.86);
    const navSize = Math.max(
      isMobile ? 60 : 52,
      Math.round(H * 0.07 * scaleFactor)
    );

    const prevActive = this.levelPage > 0;
    const nextActive = this.levelPage < PAGES - 1;

    const arrowStyle = {
      color: '#F2DC9B',
      hoverColor: '#C4451A',
      bgColor: '#243540',
      bgAlpha: 0.8,
      borderColor: '#243540',
      borderAlpha: 1.0,
      borderWidth: 3
    };

    // Кнопка "Назад"
const prevBtn = window.makeIconButton(
  this,
  W * 0.25,
  yNav + 20,
  navSize,
  '‹',
  async () => {
    if (!prevActive) return;
    if (this._isDrawing || this._isInitializing) return;

    await this.drawMenu(this.levelPage - 1);
  },
  arrowStyle
);
prevBtn.setAlpha(prevActive ? 1 : 0.45);
this.levelButtons.push(prevBtn);


    // Текст страницы
const pageTxt = this.textManager.createText(
  W * 0.5, yNav + 20,
  `${this.levelPage + 1} / ${PAGES}`,
  'buttonText'
);
pageTxt.setOrigin(0.5);
this.levelButtons.push(pageTxt);


    // Кнопка "Вперед"
const nextBtn = window.makeIconButton(
  this,
  W * 0.75,
  yNav + 20,
  navSize,
  '›',
  async () => {
    if (!nextActive) return;
    if (this._isDrawing || this._isInitializing) return;

    await this.drawMenu(this.levelPage + 1);
  },
  arrowStyle
);
nextBtn.setAlpha(nextActive ? 1 : 0.45);
this.levelButtons.push(nextBtn);

// Кнопка "Достижения"
// Кнопка "Достижения"
const achBtn = window.makeImageButton(
  this,
  W / 2,
  H * 0.95,
  90, 42,
  'Достижения',
  () => this.scene.start('AchievementsScene', { fromPage: this.levelPage }),
  {
    color: '#F2DC9B'      // базовый цвет текста
    // hoverColor здесь не используется в makeImageButton, так что можно не указывать
  }
);
achBtn.setDepth(200);
this.levelButtons.push(achBtn);




// 🔥 Ховер- и клик-анимация как у уровней
const achBaseScaleX = achBtn.scaleX;
const achBaseScaleY = achBtn.scaleY;

// Если makeImageButton создаёт интерактивную зону (как у кнопок уровней)
if (achBtn.zone) {
  achBtn.zone.on('pointerover', () => {
    if (achBtn._hoverTween) achBtn._hoverTween.stop();
    achBtn._hoverTween = this.tweens.add({
      targets: achBtn,
      scaleX: achBaseScaleX * 1.05,
      scaleY: achBaseScaleY * 1.05,
      duration: 110,
      ease: 'Sine.easeOut'
    });
  });

  achBtn.zone.on('pointerout', () => {
    if (achBtn._hoverTween) achBtn._hoverTween.stop();
    achBtn._hoverTween = this.tweens.add({
      targets: achBtn,
      scaleX: achBaseScaleX,
      scaleY: achBaseScaleY,
      duration: 110,
      ease: 'Sine.easeIn'
    });
  });

  achBtn.zone.on('pointerdown', () => {
    this.tweens.add({
      targets: achBtn,
      scaleX: achBaseScaleX * 0.97,
      scaleY: achBaseScaleY * 0.97,
      yoyo: true,
      duration: 60,
      ease: 'Quad.easeOut'
    });
  });
}

this.levelButtons.push(achBtn);



    // Колесо мыши (для десктопа)
    if (!isMobile) {
  this._wheelHandler = async (_p, _objs, _dx, dy) => {
    if (this._isDrawing || this._isInitializing) return;

    if (dy > 0 && nextActive) {
      await this.drawMenu(this.levelPage + 1);
    } else if (dy < 0 && prevActive) {
      await this.drawMenu(this.levelPage - 1);
    }
  };
  this.input.on('wheel', this._wheelHandler);
}


    console.log('Menu drawn, total buttons:', this.levelButtons.length);
  } catch (e) {
    console.error('❌ drawMenu fatal error:', e);
  } finally {
    this._isDrawing = false;
  }




}





  showFullText() {
    const { W, H } = this.getSceneWH();
    
    // Создаём полноэкранное модальное окно
    const overlay = this.add.graphics()
        .fillStyle(0x000000, 0.95)
        .fillRect(0, 0, W, H)
        .setDepth(2000)
        .setInteractive();

    const container = this.add.container(W/2, H/2).setDepth(2001);
    
    // Контент соглашения
    const content = this.add.text(0, -H*0.3, 
        'ПОЛЬЗОВАТЕЛЬСКОЕ СОГЛАШЕНИЕ\n\n' +
        '1. Общие положения\n' +
        'Данное соглашение регулирует использование игры "Память: Найди пару".\n\n' +
        '2. Сбор данных\n' +
        'Приложение собирает: ID пользователя, игровую статистику.\n\n' +
        '3. Возрастные ограничения\n' +
        'Возрастное ограничение: 0+\n\n' +
        '4. Контакты\n' +
        'По вопросам: mr.kinder@mail.ru', 
        {
            fontFamily: 'Loreley Antiqua, sans-serif',
            fontSize: Math.max(16, Math.round(H * 0.025)) + 'px',
            color: '#FFFFFF',
            wordWrap: { width: Math.min(W * 0.8, 800) },
            align: 'left'
        }
    ).setOrigin(0.5, 0);
    
    // Кнопка закрытия
    const closeBtn = window.makeImageButton(
        this, 0, H*0.35, 200, 50, 'Закрыть',
        () => {
            container.destroy();
            overlay.destroy();
        }
    );
    
    container.add([content, closeBtn]);
}
  
  refreshUI() {
  if (!this.scene.isActive()) return;
  if (this._isDrawing) return; // чтобы не ковырять UI во время полной перерисовки
  if (!this.levelButtons || this.levelButtons.length === 0) return;
    
    console.log('🔄 Refreshing MenuScene UI');
    this.updateLevelButtons();
    this.updateStatsDisplay();
  }

updateLevelButtons() {
  const progressLevels = (this.progress && this.progress.levels) || {};

  this.levelButtons.forEach(btn => {
    if (btn.levelIndex !== undefined) {
      this.updateSingleLevelButton(btn, btn.levelIndex, progressLevels);
    }
  });
}


 updateStatsDisplay() {
  const statsElement = this.levelButtons.find(btn =>
    btn.type === 'Text' && btn.text && btn.text.includes('Пройдено:')
  );

  if (!statsElement) return;

  const stats = this.getStats();
  if (stats.completedLevels > 0) {
    const statsText =
      `Пройдено: ${stats.completedLevels}/${stats.totalLevels} ` +
      `| Звезд: ${stats.totalStars}/${stats.maxStars}`;
    statsElement.setText(statsText);
  }
}




  // ИСПРАВЛЕНИЕ: Удаляем старые контейнеры перед созданием новых
updateSingleLevelButton(button, levelIndex, progressLevels) {
  const levelProgress = progressLevels[levelIndex];
  const stars = levelProgress ? (levelProgress.stars || 0) : 0;

  // Обновляем существующие звёзды
  if (button.starsContainer && button.starsContainer.list) {
    button.starsContainer.list.forEach((starText, index) => {
      const filled = (index + 1) <= stars;

      // те же символы
      starText.setText(filled ? '♣' : '♧');

      // ТЕ ЖЕ цвета, что и в createLevelButton:
      //   filled  → '#243540'
      //   empty   → '#F2DC9B'
      starText.setColor(filled ? '#243540' : '#F2DC9B');

      // и та же логика тени
      if (filled) {
        starText.setShadow(0, 2, 'rgba(255, 215, 0, 0.6)', 4, false, true);
      } else {
        // убираем тень у пустых
        starText.setShadow(0, 0, '#000000', 0);
      }
    });
  }

  // Обновляем существующую статистику
if (button.statsContainer && button.statsContainer.list[0]) {
  if (levelProgress && levelProgress.bestTime) {
    const accuracy =
      levelProgress.lastAccuracy ??
      levelProgress.bestAccuracy ??
      levelProgress.accuracy ??
      100;

    const statsText = `${this.formatTime(levelProgress.bestTime)} | ${accuracy}%`;
    button.statsContainer.list[0].setText(statsText);
    button.statsContainer.setVisible(true);
  } else {
    button.statsContainer.setVisible(false);
  }
}

}


  showToast(message, color = '#3498DB', duration = 2000) {
    const { W, H } = this.getSceneWH();
    
    const toast = this.add.container(W / 2, H - 100);
    
    const bg = this.add.graphics();
    bg.fillStyle(parseInt(color.replace('#', '0x')), 0.9);
    bg.fillRoundedRect(-100, -15, 200, 30, 15);
    
    const text = this.add.text(0, 0, message, {
      fontFamily: 'Loreley Antiqua, sans-serif',
      fontSize: '14px',
      color: '#FFFFFF',
      fontStyle: 'bold'
    }).setOrigin(0.5);
    
    toast.add([bg, text]);
    toast.setDepth(2000);
    
    toast.setAlpha(0);
    this.tweens.add({
      targets: toast,
      alpha: 1,
      duration: 300,
      ease: 'Power2.easeOut'
    });
    
    this.time.delayedCall(duration, () => {
      this.tweens.add({
        targets: toast,
        alpha: 0,
        duration: 300,
        ease: 'Power2.easeIn',
        onComplete: () => {
          toast.destroy();
        }
      });
    });
  }

  showUserAgreement() {
    const { W, H } = this.getSceneWH();
    
    const overlay = this.add.graphics()
      .fillStyle(0x000000, 0.85)
      .fillRect(0, 0, W, H)
      .setDepth(1000)
      .setInteractive();

    const modalW = Math.min(W * 0.9, 500);
    const modalH = Math.min(H * 0.85, 600);
    const modal = this.add.graphics()
      .fillStyle(0x2C3E50, 0.95)
      .fillRoundedRect(W/2 - modalW/2, H/2 - modalH/2, modalW, modalH, 15)
      .lineStyle(3, 0x3498DB, 0.8)
      .strokeRoundedRect(W/2 - modalW/2, H/2 - modalH/2, modalW, modalH, 15)
      .setDepth(1001);

    const title = this.add.text(W/2, H/2 - modalH/2 + 50, 'Пользовательское соглашение', {
      fontFamily: 'Loreley Antiqua',
      fontSize: '24px',
      color: '#FFFFFF',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(1002);
    title.setStroke('#000000', 2);

    const agreementText = `Игра "Память: Найди пару"

• Сбор данных: ID пользователя, игровая статистика
• Возрастное ограничение: 0+ (безопасно для всех)
• Данные используются только для работы игры
• Соответствует политике ВКонтакте

Нажимая "Принимаю", вы соглашаетесь
с условиями использования приложения.

Версия: 2025-09-13`;

    const text = this.add.text(W/2, H/2 - 50, agreementText, {
      fontFamily: 'Arial',
      fontSize: '14px',
      color: '#E8E8E8',
      align: 'center',
      lineSpacing: 8,
      wordWrap: { width: modalW - 40 }
    }).setOrigin(0.5).setDepth(1002);

    const acceptBtn = window.makeImageButton(
  this, W/2 - 70, H/2 + modalH/2 - 60, 
  120, 45, 'Принимаю', 
  async () => {  // ← добавить async
    localStorage.setItem('acceptedAgreement', 'true');
    localStorage.setItem('agreementVersion', '2025-09-13');
    localStorage.setItem('agreementAcceptedAt', new Date().toISOString());
    
    this.cleanupAgreementDialog([
      overlay, modal, title, text, acceptBtn, declineBtn
    ]);
    
    await this.drawMenu(this.levelPage);
  }
);
    
    acceptBtn.setDepth(1003);

    const declineBtn = window.makeImageButton(
      this, W/2 + 70, H/2 + modalH/2 - 60, 
      120, 45, 'Отклонить', 
      () => {
        this.showExitConfirmation([
      overlay, modal, title, text, acceptBtn, declineBtn
    ]);
      }
    );
    declineBtn.setDepth(1003);
  }

  cleanupAgreementDialog(elements) {
    elements.forEach(element => {
      if (element && typeof element.destroy === 'function') {
        try {
          element.destroy();
        } catch (error) {
          console.warn('Error destroying agreement dialog element:', error);
        }
      }
    });
  }

  // === MenuScene.js:958+ - ДОБАВИТЬ НОВЫЙ МЕТОД ===

showExitConfirmation(previousDialogElements) {
  const { W, H } = this.getSceneWH();
  
  // Затемнение (более темное для второго слоя)
  const confirmOverlay = this.add.graphics()
    .fillStyle(0x000000, 0.95)
    .fillRect(0, 0, W, H)
    .setDepth(2000)
    .setInteractive();

  const confirmW = Math.min(W * 0.8, 400);
  const confirmH = 200;
  
  // Модалка подтверждения
  const confirmModal = this.add.graphics()
    .fillStyle(0x2C3E50, 0.98)
    .fillRoundedRect(W/2 - confirmW/2, H/2 - confirmH/2, confirmW, confirmH, 15)
    .lineStyle(3, 0xE74C3C, 0.9)
    .strokeRoundedRect(W/2 - confirmW/2, H/2 - confirmH/2, confirmW, confirmH, 15)
    .setDepth(2001);

  const confirmTitle = this.add.text(W/2, H/2 - 50, '⚠️ Подтверждение выхода', {
    fontFamily: 'BoldPixels, Arial',
    fontSize: '20px',
    color: '#E74C3C',
    fontStyle: 'bold'
  }).setOrigin(0.5).setDepth(2002);

  const confirmText = this.add.text(W/2, H/2, 
    'Без принятия соглашения\nигра недоступна.\n\nВы уверены, что хотите выйти?', {
    fontFamily: 'Arial',
    fontSize: '14px',
    color: '#E8E8E8',
    align: 'center',
    lineSpacing: 4
  }).setOrigin(0.5).setDepth(2002);

  // Кнопка "Да, выйти"
  const yesBtn = window.makeImageButton(
    this, W/2 - 60, H/2 + 60, 
    100, 40, 'Выйти', 
    () => {
      // Закрываем все диалоги
      [confirmOverlay, confirmModal, confirmTitle, confirmText, yesBtn, noBtn].forEach(el => el.destroy());
      previousDialogElements.forEach(el => el.destroy?.());
      
      // Пытаемся выйти
      try {
        window.close();
      } catch (e) {
        window.history.back();
      }
    }
  );
  yesBtn.setDepth(2003);

  // Кнопка "Отмена"
  const noBtn = window.makeImageButton(
    this, W/2 + 60, H/2 + 60, 
    100, 40, 'Отмена', 
    () => {
      // Просто закрываем диалог подтверждения
      confirmOverlay.destroy();
      confirmModal.destroy();
      confirmTitle.destroy();
      confirmText.destroy();
      yesBtn.destroy();
      noBtn.destroy();
    }
  );
  noBtn.setDepth(2003);
}

  // === MenuScene.js:444-472 - ЗАМЕНИТЬ createLevelButton ===

createLevelButton(
  x,
  y,
  w,
  h,
  lvl,
  levelIndex,
  scaleFactor = 1.0,
  progressLevels = null
) {
  const btn = window.makeImageButton(this, x, y, w, h, '', () => {
    if (this.syncManager?.setCurrentLevel) {
      this.syncManager.setCurrentLevel(levelIndex);
    }
    this.scene.start('GameScene', { level: levelIndex });
  });

  // --- определяем, мобильный ли девайс (используем дальше и для текстов) ---
  const { W, H } = this.getSceneWH();
  const isMobile = W < 768 || H < 600 ||
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  // --- Номер уровня ---
  const levelBaseSize = this.textManager.getSize('levelNumber');
  const levelOverrides = isMobile
    ? { fontSize: Math.round(levelBaseSize * 0.8) + 'px' } // чуть меньше на мобиле
    : {};

  const levelText = this.textManager.createText(
    0,
    h * 0.03,
    lvl.label,
    'levelNumber',
    levelOverrides
  );
  levelText.setOrigin(0.5);
  btn.add(levelText);
  btn.levelIndex = levelIndex;

  // --- Прогресс уровня ---
  const levelsData = progressLevels || (this.progress?.levels || {});
  const levelProgress = levelsData[levelIndex];

  // --- ЗВЁЗДЫ ---
  const starSize = this.textManager.getSize('stars');
  const starsOffsetY = isMobile ? h * 0.70 : h * 0.52;
  btn.starsContainer = this.add.container(x, y + starsOffsetY).setDepth(btn.depth + 1);

  const starSpacing = starSize + 4;
  const stars = levelProgress ? (levelProgress.stars || 0) : 0;

  for (let star = 1; star <= 3; star++) {
    const starX = (star - 2) * starSpacing;
    const filled = star <= stars;

    const starText = this.add.text(starX, 0, filled ? '♣' : '♧', {
      fontSize: `${starSize}px`,
      color: filled ? '#243540' : '#F2DC9B',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    if (filled) {
      starText.setShadow(0, 2, 'rgba(255,215,0,0.6)', 4, false, true);
    }

    btn.starsContainer.add(starText);
  }

  // --- Статистика ---
  const statsOffsetY = isMobile ? h * 0.88 : h * 0.65;
  btn.statsContainer = this.add.container(x, y + statsOffsetY).setDepth(btn.depth + 1);

  if (levelProgress?.bestTime) {
    const accuracy =
      levelProgress.lastAccuracy ??
      levelProgress.bestAccuracy ??
      levelProgress.accuracy ??
      100;

    const statsText = `${this.formatTime(levelProgress.bestTime)} | ${accuracy}%`;

    const statBaseSize = this.textManager.getSize('statValue');
    const statOverrides = isMobile
      ? { fontSize: Math.round(statBaseSize * 0.8) + 'px' } // тоже чуть меньше
      : {};

    const statsDisplay = this.textManager.createText(
      0,
      0,
      statsText,
      'statValue',
      statOverrides
    ).setOrigin(0.5);

    btn.statsContainer.add(statsDisplay);
  }

  // --- ХОВЕР-МАСШТАБ (как у стрелок!) ---
  const baseScaleX = btn.scaleX;
  const baseScaleY = btn.scaleY;

  btn.zone.on('pointerover', () => {
    if (btn._hoverTween) btn._hoverTween.stop();
    btn._hoverTween = this.tweens.add({
      targets: btn,
      scaleX: baseScaleX * 1.05,
      scaleY: baseScaleY * 1.05,
      duration: 110,
      ease: 'Sine.easeOut'
    });
  });

  btn.zone.on('pointerout', () => {
    if (btn._hoverTween) btn._hoverTween.stop();
    btn._hoverTween = this.tweens.add({
      targets: btn,
      scaleX: baseScaleX,
      scaleY: baseScaleY,
      duration: 110,
      ease: 'Sine.easeIn'
    });
  });

  btn.zone.on('pointerdown', () => {
    this.tweens.add({
      targets: btn,
      scaleX: baseScaleX * 0.97,
      scaleY: baseScaleY * 0.97,
      yoyo: true,
      duration: 60,
      ease: 'Quad.easeOut'
    });
  });

  this.levelButtons.push(btn);
  return btn;
}







  formatTime(seconds) {
    if (!seconds) return '0с';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `${secs}с`;
  }
};
