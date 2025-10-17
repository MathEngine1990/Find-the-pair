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
    
    // Получаем VK данные если есть
    this.vkUserData = data?.userData || window.VK_USER_DATA;
    this.isVKEnvironment = data?.isVK || !!window.VK_LAUNCH_PARAMS;
    
    // Инициализация синхронизации
    this.syncManager = null;
    this.progress = {};
    this.isSyncing = false;
}

// === MenuScene.js:48-56 - ЗАМЕНИТЬ ===

async create() {
  console.log('MenuScene.create() started');
  
  this.textManager = new TextManager(this);
  
  this.progress = this.getProgressLocal();
  this.ensureGradientBackground();
  this.drawMenu(this.levelPage);
  
  Promise.all([
    document.fonts.ready.catch(() => console.warn('Fonts timeout')),
    this.initializeSyncManager().catch(e => console.error('Sync init failed:', e))
  ]).then(async () => {
    // ⬇️ КРИТИЧНО: Триггерим синхронизацию после инициализации
    if (this.syncManager && this.syncManager.isVKAvailable()) {
      try {
        console.log('🔄 Triggering initial sync in MenuScene');
        const synced = await this.syncManager.performSync();
        if (synced) {
          this.progress = await this.syncManager.loadProgress();
          this.refreshUI();
        }
      } catch (err) {
        console.warn('⚠️ Initial sync failed:', err);
      }
    }});
  
  // ✅ ИЗМЕНЕНО: Используем глобальный debounced-resize event
  this.game.events.on('debounced-resize', this.handleResize, this);
  
  this.events.once('shutdown', this.cleanup, this);
}

// ✅ НОВЫЙ МЕТОД
handleResize() {
  if (!this.scene.isActive()) return;
  
  // 1️⃣ Обновляем размеры в TextManager
  this.textManager.updateDimensions();
  
  // 2️⃣ Обновляем существующие элементы (если не перерисовываем всё)
  // Если drawMenu() полностью пересоздаёт UI, можно пропустить
  // Иначе добавить:
  // this.levelButtons.forEach(btn => {
  //   if (btn.levelText) this.textManager.updateText(btn.levelText, 'levelNumber');
  // });
  
  this.ensureGradientBackground();
  this.drawMenu(this.levelPage);
}



  // Инициализация менеджера синхронизации
async initializeSyncManager() {
  this.syncManager = this.registry.get('progressSyncManager');
  
  if (!this.syncManager) {
    console.error('❌ ProgressSyncManager not found in registry!');
    console.warn('⚠️ Using fallback syncManager (localStorage only)');
    
    // ✅ ПОЛНЫЙ fallback с ВСЕМИ методами из ProgressSyncManager
    this.syncManager = {
  // Только критичные методы для работы UI
  loadProgress: () => this.getProgressLocal(),
  saveProgress: (data) => {
    try {
      localStorage.setItem('findpair_progress', JSON.stringify(data));
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
  getCurrentLevel: () => 0
};
  }
  
  
  
  // ⬇️ КРИТИЧНО: Подписка на события
  const originalOnSyncStart = this.syncManager.onSyncStart;
  this.syncManager.onSyncStart = () => {
    if (originalOnSyncStart) originalOnSyncStart();
    this.isSyncing = true;
    if (this.scene.isActive()) this.updateSyncButton();
  };
  
  const originalOnSyncComplete = this.syncManager.onSyncComplete;
  this.syncManager.onSyncComplete = (data) => {
    if (originalOnSyncComplete) originalOnSyncComplete(data);
    this.isSyncing = false;
    this.progress = data;
    if (this.scene.isActive()) {
      this.updateSyncButton();
      this.refreshUI();
    }
  };
  
  const originalOnSyncError = this.syncManager.onSyncError;
  this.syncManager.onSyncError = (error) => {
    if (originalOnSyncError) originalOnSyncError(error);
    this.isSyncing = false;
    if (this.scene.isActive()) {
      this.updateSyncButton();
      this.showToast('⚠️ Ошибка синхронизации', '#E74C3C');
    }
  };
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

  getProgress() {
    try {
      // Если есть синхронизированные данные - используем их
      if (this.progress && this.progress.levels) {
        return this.progress.levels;
      }
      
      // Иначе загружаем локальные
      return this.getProgressLocal();
    } catch (e) {
      console.warn('Error loading progress:', e);
      return {};
    }
}

  getProgressLocal() {
    try {
      const saved = localStorage.getItem('findpair_progress');
      if (!saved) return {};
      
      const parsed = JSON.parse(saved);
      return parsed.levels || parsed || {};
    } catch (e) {
      console.warn('Error loading local progress:', e);
      return {};
    }
}

  getStats() {
    const progressLevels = this.getProgress();
    const levels = Object.keys(progressLevels);
    
    const stats = {
      totalLevels: window.LEVELS.length,
      completedLevels: levels.length,
      totalStars: levels.reduce((sum, key) => sum + (progressLevels[key].stars || 0), 0),
      maxStars: window.LEVELS.length * 3,
      averageStars: levels.length > 0 ? 
        levels.reduce((sum, key) => sum + (progressLevels[key].stars || 0), 0) / levels.length : 0
    };
    
    if (this.progress && this.progress.stats) {
      const globalStats = this.progress.stats;
      stats.gamesPlayed = globalStats.gamesPlayed || 0;
      stats.totalTime = globalStats.totalTime || 0;
      stats.bestTime = globalStats.bestTime || null;
      stats.perfectGames = globalStats.perfectGames || 0;
      stats.totalErrors = globalStats.totalErrors || 0;
    }
    
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

  drawMenu(page = 0) {
    console.log('Drawing menu, page:', page);
    this.clearMenu();
    const { W, H } = this.getSceneWH();
    console.log('Scene dimensions:', W, H);

      // ✅ ДОБАВИТЬ: Обновляем размеры
  this.textManager.updateDimensions();
    
    // КРИТИЧНО: Определяем мобильное устройство
    const isMobile = W < 768 || H < 600 || 
                     /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const scaleFactor = isMobile ? 1.8 : 1.0; // Увеличиваем все размеры для мобильных
    
    this.levelPage = Math.max(0, Math.min(page, Math.ceil(window.LEVELS.length / 9) - 1));

    // Проверяем принятие соглашения
    const acceptedAgreement = localStorage.getItem('acceptedAgreement');
    const agreementVersion = localStorage.getItem('agreementVersion');
    const CURRENT_VERSION = '2025-09-13';
    
    // ДЛЯ ОТЛАДКИ: Автоматически принимаем соглашение
    if (!acceptedAgreement && window.VK_DEBUG) {
        console.log('Auto-accepting agreement for debugging');
        localStorage.setItem('acceptedAgreement', 'true');
        localStorage.setItem('agreementVersion', CURRENT_VERSION);
    }

    if (!acceptedAgreement || agreementVersion !== CURRENT_VERSION) {
        console.log('Showing user agreement');
        this.showUserAgreement();
        return;
    }

    console.log('Creating menu content...');

    // ИСПРАВЛЕНО: Адаптивная сетка для мобильных
    const COLS = isMobile ? 3 : 3;
    const ROWS = isMobile ? 3 : 3;
    const PER_PAGE = COLS * ROWS;
    const PAGES = Math.max(1, Math.ceil(window.LEVELS.length / PER_PAGE));

    // ✅ ДОБАВИТЬ после строки 285:
const safeArea = this.getSafeAreaInsets(); // ← НОВОЕ
const topSafeZone = safeArea.top + 10; // 10px отступ от notch
    let currentY = safeArea.top + 10; // Начинаем с safe area

      // ✅ НОВЫЙ КОД: Персонализация для VK
  if (this.vkUserData && this.vkUserData.first_name) {
    const greeting = this.textManager.createText(
      W/2, currentY,
      `Привет, ${this.vkUserData.first_name}!`,
      'titleMedium'
    );
    greeting.setOrigin(0.5,0);
    greeting.setColor('#5EFFC9');
    this.levelButtons.push(greeting);

    currentY += this.textManager.getSize('statLabel') + 30;
  }

  // ✅ НОВЫЙ КОД: Заголовок
  const titleText = isMobile && W < 400 ? 'Сколько пар играть?' : 'Сколько пар играть?';
  const title = this.textManager.createText(
   W/2, currentY, // ← ИЗМЕНИТЬ: было H * 0.08
    titleText,
    isMobile ? 'titleLarge_mobile' : 'titleLarge_desktop'
  );
  title.setOrigin(0.5);
  this.levelButtons.push(title);

    currentY += this.textManager.getSize('titleLarge') + 15; // Сдвиг вниз
    

  // ✅ НОВЫЙ КОД: Статистика
  const stats = this.getStats();
  if (stats.completedLevels > 0) {
    let statsText = `Пройдено: ${stats.completedLevels}/${stats.totalLevels} | Звезд: ${stats.totalStars}/${stats.maxStars}`;
    
    // if (stats.gamesPlayed > 0) {
    //   statsText += `\nИгр сыграно: ${stats.gamesPlayed}`;
    //   if (stats.perfectGames > 0) {
    //     statsText += ` | Идеальных: ${stats.perfectGames}`;
    //   }
    //   if (stats.bestTime) {
    //     statsText += ` | Лучшее время: ${this.formatTime(stats.bestTime)}`;
    //   }
    // }
    
    const statsDisplay = this.textManager.createText(
      W/2, currentY,
      statsText,
      'statLabel'
    );
    statsDisplay.setOrigin(0.5);
    this.levelButtons.push(statsDisplay);
    currentY += this.textManager.getSize('statLabel') + 18;
  }

    // Кнопка синхронизации (если есть)
    if (this.syncManager) {
        this.createSyncButton(W, H, this.textManager.getSize('titleLarge'));
    }

    // КРИТИЧНО: Увеличенная область для кнопок на мобильных
    const topY = H * (isMobile ? 0.20 : 0.16);
    const bottomY = H * (isMobile ? 0.75 : 0.79);
    const areaH = bottomY - topY;
    const areaW = Math.min(W * (isMobile ? 0.98 : 0.90), isMobile ? W : 1080);
    
    // ИСПРАВЛЕНО: Увеличенные размеры ячеек
    const cellH = areaH / ROWS;
    const cellW = areaW / COLS;
    const gridLeft = (W - areaW) / 2;
    const gridTop = topY;

    const startIdx = this.levelPage * PER_PAGE;
    const endIdx = Math.min(startIdx + PER_PAGE, window.LEVELS.length);
    const pageLevels = window.LEVELS.slice(startIdx, endIdx);

    console.log('Creating level buttons:', pageLevels.length, 'Mobile:', isMobile);

    // КРИТИЧНО: Создание увеличенных кнопок уровней
    pageLevels.forEach((lvl, i) => {
        const levelIndex = startIdx + i;
        const r = Math.floor(i / COLS);
        const c = i % COLS;
        const x = gridLeft + c * cellW + cellW/2;
        const y = gridTop + r * cellH + cellH/2;
        
        // ИСПРАВЛЕНО: Увеличенные размеры кнопок для мобильных
        const btnW = Math.min(
            isMobile ? cellW * 0.92 : 320, 
            cellW * 0.9
        );
        const btnH = Math.min(
            isMobile ? cellH * 0.88 : 200, 
            cellH * 0.86
        );

        this.createLevelButton(x, y, btnW, btnH, lvl, levelIndex, scaleFactor);
    });

  // ✅ ИСПРАВИТЬ: Навигация (страницы)
  const yNav = H * (isMobile ? 0.88 : 0.86);
  const navSize = Math.max(
    isMobile ? 60 : 52, 
    Math.round(H * 0.07 * scaleFactor)
  );
    
    const prevActive = this.levelPage > 0;
    const nextActive = this.levelPage < PAGES - 1;

    // Кнопка "Назад"
    const prevBtn = window.makeIconButton(this, W * 0.25, yNav, navSize, '‹', () => {
        if (prevActive) this.drawMenu(this.levelPage - 1);
    });
    prevBtn.setAlpha(prevActive ? 1 : 0.45);
    this.levelButtons.push(prevBtn);

    // Текст страницы с увеличенным шрифтом
    const pageTextSize = Math.max(
        isMobile ? 20 : 16,
        Math.round(navSize * 0.35)
    );
    
  const pageTxt = this.textManager.createText(
    W * 0.5, yNav,
    `${this.levelPage + 1} / ${PAGES}`,
    'buttonText'
  );
  pageTxt.setOrigin(0.5);
  this.levelButtons.push(pageTxt);

    // Кнопка "Вперед"
    const nextBtn = window.makeIconButton(this, W * 0.75, yNav, navSize, '›', () => {
        if (nextActive) this.drawMenu(this.levelPage + 1);
    });
    nextBtn.setAlpha(nextActive ? 1 : 0.45);
    this.levelButtons.push(nextBtn);

    // Колесо мыши (для десктопа)
    if (!isMobile) {
        this._wheelHandler = (_p, _objs, _dx, dy) => {
            if (dy > 0 && nextActive) this.drawMenu(this.levelPage + 1);
            else if (dy < 0 && prevActive) this.drawMenu(this.levelPage - 1);
        };
        this.input.on('wheel', this._wheelHandler);
    }
    
    console.log('Menu drawn, total buttons:', this.levelButtons.length);
}



  createSyncButton(W, H, titlePx) {
    const syncStatus = this.syncManager.getSyncStatus();
    
    let btnColor = 0x3498DB;
    let btnText = '🔄';
    let btnTooltip = 'Синхронизация';
    
    if (!syncStatus.isVKAvailable) {
      btnColor = 0x95A5A6;
      btnText = '📱';
      btnTooltip = 'Только локально';
    } else if (this.isSyncing) {
      btnColor = 0xF39C12;
      btnText = '⏳';
      btnTooltip = 'Синхронизация...';
    } else if (syncStatus.lastSyncTime > 0) {
      btnColor = 0x27AE60;
      btnText = '✅';
      btnTooltip = 'Синхронизировано';
    }

    const size = Math.round(titlePx * 0.8);
    const x = W - 40;
    const y = 40;

    const syncButton = this.add.container(x, y);
    
    const bg = this.add.graphics();
    bg.fillStyle(btnColor, 0.8);
    bg.fillCircle(0, 0, size / 2);
    bg.lineStyle(2, 0xFFFFFF, 0.3);
    bg.strokeCircle(0, 0, size / 2);
    
    const text = this.add.text(0, 0, btnText, {
      fontSize: Math.round(size * 0.5) + 'px',
      color: '#FFFFFF'
    }).setOrigin(0.5);
    
    syncButton.add([bg, text]);
    syncButton.setDepth(10);
    syncButton.setSize(size, size);
    syncButton.setInteractive({ useHandCursor: true });
    
    syncButton.on('pointerdown', () => {
      this.forceSyncProgress();
    });
    
    syncButton.bgElement = bg;
    syncButton.textElement = text;
    syncButton.currentColor = btnColor;
    syncButton.size = size;
    
    this.levelButtons.push(syncButton);
    this.syncButton = syncButton;
  }

  updateSyncButton() {
    // ✅ КРИТИЧНО: Проверка существования
    if (!this.syncButton || !this.syncManager) {
        console.warn('⚠️ syncButton or syncManager not initialized');
        return;
    }
    
    // ✅ ДОБАВИТЬ: Проверка уничтожения сцены
    if (!this.scene.isActive() || !this.syncButton.scene) {
        console.warn('⚠️ Scene inactive or button destroyed');
        return;
    }

    const syncStatus = this.syncManager.getSyncStatus();
    
    let btnColor = 0x3498DB;
    let btnText = '🔄';
    
    if (!syncStatus.isVKAvailable) {
      btnColor = 0x95A5A6;
      btnText = '📱';
    } else if (this.isSyncing) {
      btnColor = 0xF39C12;
      btnText = '⏳';
    } else if (syncStatus.lastSyncTime > 0) {
      btnColor = 0x27AE60;
      btnText = '✅';
    }

        // ✅ КРИТИЧНО: Проверка элементов перед использованием
    if (!this.syncButton.bgElement || !this.syncButton.textElement) {
        console.error('❌ syncButton elements missing');
        return;
    }

    if (btnColor !== this.syncButton.currentColor) {
      this.syncButton.bgElement.clear();
      this.syncButton.bgElement.fillStyle(btnColor, 0.8);
      this.syncButton.bgElement.fillCircle(0, 0, this.syncButton.size / 2);
      this.syncButton.bgElement.lineStyle(2, 0xFFFFFF, 0.3);
      this.syncButton.bgElement.strokeCircle(0, 0, this.syncButton.size / 2);
      this.syncButton.currentColor = btnColor;
    }

    if (btnText !== this.syncButton.textElement.text) {
      this.syncButton.textElement.setText(btnText);
    }
  }

  async forceSyncProgress() {
    if (!this.syncManager) return;

    try {
      console.log('🔄 Manual sync triggered');
      const success = await this.syncManager.forceSync();
      
      if (success) {
        this.showToast('✅ Данные синхронизированы', '#27AE60');
      } else {
        this.showToast('⚠️ Синхронизация не удалась', '#E74C3C');
      }
    } catch (error) {
      console.error('❌ Manual sync failed:', error);
      this.showToast('⚠️ Ошибка синхронизации', '#E74C3C');
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
        'По вопросам: support@findpair-game.example', 
        {
            fontFamily: 'BoldPixels, sans-serif',
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
    if (!this.levelButtons || this.levelButtons.length === 0) return;
    
    console.log('🔄 Refreshing MenuScene UI');
    this.updateLevelButtons();
    this.updateStatsDisplay();
  }

  updateLevelButtons() {
    const progressLevels = this.getProgress();
    
    
  }

  updateStatsDisplay() {
    const statsElement = this.levelButtons.find(btn => 
      btn.type === 'Text' && btn.text && btn.text.includes('Пройдено:'));
    
    if (statsElement) {
      const stats = this.getStats();
      if (stats.completedLevels > 0) {
        let statsText = `Пройдено: ${stats.completedLevels}/${stats.totalLevels} | Звезд: ${stats.totalStars}/${stats.maxStars}`;
        
        if (stats.gamesPlayed > 0) {
          statsText += `\nИгр сыграно: ${stats.gamesPlayed}`;
          if (stats.perfectGames > 0) {
            statsText += ` | Идеальных: ${stats.perfectGames}`;
          }
          if (stats.bestTime) {
            statsText += ` | Лучшее время: ${this.formatTime(stats.bestTime)}`;
          }
        }
        
        statsElement.setText(statsText);
      }
    }
  }



  // ИСПРАВЛЕНИЕ: Удаляем старые контейнеры перед созданием новых
updateSingleLevelButton(button, levelIndex, progressLevels) {
    const levelProgress = progressLevels[levelIndex];
    const stars = levelProgress ? levelProgress.stars : 0;
    
    // Обновляем существующие звёзды
    if (button.starsContainer && button.starsContainer.list) {
        button.starsContainer.list.forEach((starText, index) => {
            const filled = (index + 1) <= stars;
            starText.setText(filled ? '★' : '☆');
            starText.setColor(filled ? '#FFD700' : '#666666');
        });
    }
    
    // Обновляем существующую статистику
    if (button.statsContainer && button.statsContainer.list[0]) {
        if (levelProgress && levelProgress.bestTime) {
            const statsText = `${this.formatTime(levelProgress.bestTime)} | ${levelProgress.accuracy || 100}%`;
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
      fontFamily: 'BoldPixels, sans-serif',
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
      fontFamily: 'BoldPixels, sans-serif',
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
      fontFamily: 'BoldPixels, sans-serif',
      fontSize: '14px',
      color: '#E8E8E8',
      align: 'center',
      lineSpacing: 8,
      wordWrap: { width: modalW - 40 }
    }).setOrigin(0.5).setDepth(1002);

    const acceptBtn = window.makeImageButton(
      this, W/2 - 70, H/2 + modalH/2 - 60, 
      120, 45, 'Принимаю', 
      () => {
        localStorage.setItem('acceptedAgreement', 'true');
        localStorage.setItem('agreementVersion', '2025-09-13');
        localStorage.setItem('agreementAcceptedAt', new Date().toISOString());
        
        this.cleanupAgreementDialog([
          overlay, modal, title, text, acceptBtn, declineBtn
        ]);
        
        this.drawMenu(this.levelPage);
      }
    );
    acceptBtn.setDepth(1003);

    const declineBtn = window.makeImageButton(
      this, W/2 + 70, H/2 + modalH/2 - 60, 
      120, 45, 'Отклонить', 
      () => {
        if (confirm('Без принятия соглашения игра недоступна.\nВы уверены, что хотите выйти?')) {
          this.cleanupAgreementDialog([
            overlay, modal, title, text, acceptBtn, declineBtn
          ]);
          
          try {
            window.close();
          } catch (e) {
            window.history.back();
          }
        }
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

  // === MenuScene.js:444-472 - ЗАМЕНИТЬ createLevelButton ===

createLevelButton(x, y, w, h, lvl, levelIndex, scaleFactor = 1.0) {
    const isMobile = w > 150;
    
    const btn = window.makeImageButton(this, x, y, w, h, '', () => {
        if (this.syncManager) this.syncManager.setCurrentLevel(levelIndex);
        this.scene.start('GameScene', { level: levelIndex });
    });
    
  // 🔥 НОВОЕ: Номер уровня с правильным пресетом
  const levelText = this.textManager.createText(
    0, -h*0.02,  // ⬆️ Чуть выше, чтобы не перекрывались звёзды
    lvl.label,
    'levelNumber'  // ⬅️ ИЗМЕНЕНО: используем новый пресет
  );
  levelText.setOrigin(0.5);
    
    btn.add(levelText);
    btn.levelIndex = levelIndex;
    
  // 🔥 ИСПРАВЛЕНО: Звёзды с правильным размером
  const starSize = this.textManager.getSize('stars');
  const progressLevels = this.getProgress();
  const levelProgress = progressLevels[levelIndex];
    
    // ✅ Создаём контейнеры ОДИН РАЗ при создании кнопки
    btn.starsContainer = this.add.container(x, y + h * 0.38);
    btn.starsContainer.setDepth(btn.depth + 1);
    
    const starSpacing = starSize + 4;
    const stars = levelProgress ? levelProgress.stars : 0;
    
    for (let star = 1; star <= 3; star++) {
        const starX = (star - 2) * starSpacing;
        const filled = star <= stars;
        const starText = this.add.text(starX, 0, filled ? '★' : '☆', {
            fontSize: starSize + 'px',
            color: filled ? '#FFD700' : '#666666',
            fontStyle: 'bold'
        }).setOrigin(0.5);

         // 🔥 НОВОЕ: Тень для звёзд
    if (filled) {
      starText.setShadow(0, 2, 'rgba(255, 215, 0, 0.6)', 4, false, true);
    }
        
        btn.starsContainer.add(starText);
    }
    
    // ✅ Статистика под звёздами
    btn.statsContainer = this.add.container(x, y + h * 0.52);
    btn.statsContainer.setDepth(btn.depth + 1);
    
    if (levelProgress && levelProgress.bestTime) {
    const accuracy = levelProgress.accuracy || 100;
    const statsText = `${this.formatTime(levelProgress.bestTime)} | ${accuracy}%`;
    
    const statsDisplay = this.textManager.createText(
      0, 0,
      statsText,
      'statValue'
    );
    statsDisplay.setOrigin(0.5);
    
    btn.statsContainer.add(statsDisplay);
  }

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
