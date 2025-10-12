//---scenes/MenuScene.js - ПОЛНОСТЬЮ ИСПРАВЛЕННАЯ ВЕРСИЯ

window.MenuScene = class MenuScene extends Phaser.Scene {
  constructor(){ 
    super('MenuScene'); 
  }

  init(data){ 
    this.levelPage = data?.page || 0; 
    
    // Получаем VK данные если есть
    this.vkUserData = data?.userData || window.VK_USER_DATA;
    this.isVKEnvironment = data?.isVK || !!window.VK_LAUNCH_PARAMS;
    
    // Инициализация синхронизации
    this.syncManager = null;
    this.progress = {};
    this.isSyncing = false;
  }

  async create(){
    console.log('MenuScene.create() started');
    
    if (this.scale && this.scale.updateBounds) this.scale.updateBounds();
    this.scale.on('resize', () => { 
      if (this.scale && this.scale.updateBounds) this.scale.updateBounds(); 
    });

        // ✅ ДОБАВИТЬ: Ждём загрузки шрифтов
    await document.fonts.ready;
    console.log('✅ Fonts ready');

    this.levelButtons = [];
    this._wheelHandler = null;

    console.log('Creating background...');
    this.ensureGradientBackground();

    console.log('Initializing sync manager...');
    // НЕ ждем инициализации, делаем ее асинхронно
this.initializeSyncManager().then(() => {
    console.log('Sync manager initialized');
}).catch(error => {
    console.error('Sync manager failed:', error);
});

// Используем локальные данные сразу
this.progress = this.getProgressLocal();

   // ✅ ЕДИНЫЙ ОБРАБОТЧИК RESIZE (debounced)
    this.scale.off('resize'); // Удаляем старые подписки
    
    const resizeHandler = Phaser.Utils.Debounce(() => {
        this.ensureGradientBackground();
        this.drawMenu(this.levelPage);
    }, 150);
    
    this.scale.on('resize', resizeHandler, this);
    this._resizeHandler = resizeHandler; // Сохраняем для cleanup
    
    // ✅ ПРИНУДИТЕЛЬНЫЙ ПЕРВЫЙ RESIZE через 1 тик (после fonts.ready)
    this.time.delayedCall(16, () => {
        this.scale.emit('resize');
        console.log('✅ Initial layout complete');
    });

    // Очистка при завершении сцены
    this.events.once('shutdown', this.cleanup, this);
    this.events.once('destroy', this.cleanup, this);
    
    console.log('MenuScene.create() completed');
  }

  // Инициализация менеджера синхронизации
  async initializeSyncManager() {
    try {
      // Используем глобальный менеджер или создаем новый
      if (window.progressSyncManager) {
        this.syncManager = window.progressSyncManager;
      } else if (window.ProgressSyncManager) {
        this.syncManager = new ProgressSyncManager();
        window.progressSyncManager = this.syncManager;
      } else {
        console.warn('ProgressSyncManager not found');
        return;
      }
      
      // Подписываемся на события синхронизации
      this.syncManager.onProgressUpdate = (progressData) => {
        console.log('📊 Progress updated, refreshing UI');
        this.progress = progressData;
        this.refreshUI();
      };
      
      this.syncManager.onSyncStart = () => {
        console.log('🔄 Sync started');
        this.isSyncing = true;
        this.updateSyncButton();
      };
      
      this.syncManager.onSyncComplete = (data) => {
        console.log('✅ Sync completed');
        this.isSyncing = false;
        this.updateSyncButton();
        if (data) {
          this.progress = data;
          this.refreshUI();
        }
      };
      
      this.syncManager.onSyncError = (error) => {
        console.warn('⚠️ Sync error:', error);
        this.isSyncing = false;
        this.updateSyncButton();
      };
      
      // Загружаем прогресс через менеджер
      // Загружаем асинхронно, не блокируя UI
this.syncManager.loadProgress().then(data => {
    this.progress = data;
    console.log('📊 Progress loaded via sync manager:', this.progress);
    this.refreshUI();
}).catch(error => {
    console.error('Failed to load progress:', error);
});
     // console.log('📊 Progress loaded via sync manager:', this.progress);
      
    } catch (error) {
      console.error('❌ Failed to init sync manager:', error);
      // Fallback на старую логику
      this.progress = this.getProgress();
    }
  }

  cleanup() {
    console.log('MenuScene cleanup started');
    
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

    this.scale.off('resize');
    
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

  clearMenu() {
    if (this._wheelHandler) { 
      this.input.off('wheel', this._wheelHandler); 
      this._wheelHandler = null; 
    }
    
    if (this.levelButtons) {
      this.levelButtons.forEach(btn => {
        if (btn && typeof btn.destroy === 'function') {
          
          if (btn.starsContainer) {
            btn.starsContainer.destroy();
            btn.starsContainer = null;
          }
          
          if (btn.statsContainer) {
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

  drawMenu(page = 0) {
    console.log('Drawing menu, page:', page);
    this.clearMenu();
    const { W, H } = this.getSceneWH();
    console.log('Scene dimensions:', W, H);
    
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

    // КРИТИЧНО: Увеличенный размер заголовка
    const titlePx = Math.round(Phaser.Math.Clamp(
        H * (isMobile ? 0.055 : 0.06) * scaleFactor, 
        isMobile ? 32 : 20,
        isMobile ? 48 : 40
    ));
    
    const title = this.add.text(W/2, H * 0.08, 'Сколько пар играть?', {
        fontFamily: 'Arial, sans-serif',
        fontSize: `${titlePx}px`,
        fontStyle: 'bold',
        color: '#FFFFFF',
        align: 'center'
    }).setOrigin(0.5);
    title.setStroke('#000000', Math.max(3, Math.round(titlePx * 0.1)));
    title.setShadow(2, 2, '#000000', 8, false, true);
    this.levelButtons.push(title);

    // Персонализация для VK (если есть)
    if (this.vkUserData && this.vkUserData.first_name) {
        const greetingSize = Math.round(titlePx * 0.7);
        const greeting = this.add.text(W/2, H * 0.04, `Привет, ${this.vkUserData.first_name}!`, {
            fontFamily: 'Arial, sans-serif',
            fontSize: greetingSize + 'px',
            color: '#FFD700',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        greeting.setStroke('#000000', 2);
        this.levelButtons.push(greeting);
    }

    // Статистика (с увеличенным шрифтом)
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
        
        const statsSize = Math.max(
            isMobile ? 16 : 14,
            Math.round(titlePx * 0.5)
        );
        
        const statsDisplay = this.add.text(W/2, H * 0.14, statsText, {
            fontFamily: 'Arial, sans-serif',
            fontSize: statsSize + 'px',
            color: '#E0E0E0',
            align: 'center',
            lineSpacing: isMobile ? 8 : 4
        }).setOrigin(0.5);
        statsDisplay.setStroke('#000000', 1);
        this.levelButtons.push(statsDisplay);
    }

    // Кнопка синхронизации (если есть)
    if (this.syncManager) {
        this.createSyncButton(W, H, titlePx);
    }

    // КРИТИЧНО: Увеличенная область для кнопок на мобильных
    const topY = H * (isMobile ? 0.18 : 0.20);
    const bottomY = H * (isMobile ? 0.82 : 0.78);
    const areaH = bottomY - topY;
    const areaW = Math.min(W * (isMobile ? 0.95 : 0.90), isMobile ? W : 1080);
    
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

    // ИСПРАВЛЕНО: Увеличенная навигация
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
    
    const pageTxt = this.add.text(W * 0.5, yNav, `${this.levelPage + 1} / ${PAGES}`, {
        fontFamily: 'Arial, sans-serif',
        fontSize: pageTextSize + 'px',
        color: '#FFFFFF',
        fontStyle: 'bold'
    }).setOrigin(0.5);
    pageTxt.setStroke('#000000', 2);
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

// ДОПОЛНИТЕЛЬНО: Обновите метод createLevelButton
createLevelButton(x, y, w, h, lvl, levelIndex, scaleFactor = 1.0) {
    const isMobile = w > 150; // Простая проверка размера
    
    const btn = window.makeImageButton(this, x, y, w, h, '', () => {
        if (this.syncManager) this.syncManager.setCurrentLevel(levelIndex);
        this.scene.start('GameScene', { level: levelIndex });
    });
    
    // КРИТИЧНО: Увеличенный размер текста на кнопках
    const fontSize = Math.max(
        24,  // Минимум 24px
        Math.round(h * 0.35 * scaleFactor)
    );
    
    // Основной текст уровня (числа пар)
    const levelText = this.add.text(0, -h*0.1, lvl.label, {
        fontFamily: 'Arial, sans-serif',
        fontSize: fontSize + 'px',
        fontStyle: 'bold',
        color: '#FFFFFF'
    }).setOrigin(0.5);
    
    btn.add(levelText);
    btn.levelIndex = levelIndex;
    
    // Размер звёздочек (увеличен)
    const starSize = Math.max(22, Math.round(h * 0.15 * scaleFactor));
    
    // Создаём контейнеры для звёзд и статистики с правильными позициями
    const progressLevels = this.getProgress();
    const levelProgress = progressLevels[levelIndex];
    
    // Звёздочки - фиксированная позиция
    btn.starsContainer = this.add.container(x, y + h * 0.25);
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
        
        btn.starsContainer.add(starText);
    }
    
    // Статистика под звёздами
    if (levelProgress && levelProgress.bestTime) {
        const statsSize = Math.max(
            isMobile ? 16 : 14,
            Math.round(starSize * 0.65)
        );
        
        const accuracy = levelProgress.accuracy || 100;
        const statsText = `${this.formatTime(levelProgress.bestTime)} | ${accuracy}%`;
        
        btn.statsContainer = this.add.container(x, y + h * 0.38);
        btn.statsContainer.setDepth(btn.depth + 1);
        
        const statsDisplay = this.add.text(0, 0, statsText, {
            fontFamily: 'Arial, sans-serif',
            fontSize: statsSize + 'px',
            color: '#CCCCCC'
        }).setOrigin(0.5);
        
        btn.statsContainer.add(statsDisplay);
    }

  // Добавляем звёзды и статистику
    this.updateSingleLevelButton(btn, levelIndex, this.getProgress());
    
    this.levelButtons.push(btn);
    return btn;
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
    if (!this.syncButton || !this.syncManager) return;

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
            fontFamily: 'Arial, sans-serif',
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
    
    this.levelButtons.forEach(button => {
      if (button.levelIndex !== undefined) {
        this.updateSingleLevelButton(button, button.levelIndex, progressLevels);
      }
    });
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
    
    // ОБНОВЛЯЕМ существующие звёзды, НЕ ПЕРЕСОЗДАЁМ контейнер
    if (button.starsContainer && button.starsContainer.list) {
        button.starsContainer.list.forEach((starText, index) => {
            const filled = (index + 1) <= stars;
            starText.setText(filled ? '★' : '☆');
            starText.setColor(filled ? '#FFD700' : '#666666');
        });
    }
    
    // ОБНОВЛЯЕМ существующую статистику
    if (button.statsContainer && button.statsContainer.list[0]) {
        if (levelProgress && levelProgress.bestTime) {
            const statsText = `${this.formatTime(levelProgress.bestTime)} | ${levelProgress.accuracy || 100}%`;
            button.statsContainer.list[0].setText(statsText);
            button.statsContainer.setVisible(true);
        } else {
            button.statsContainer.setVisible(false);
        }
    }
    
    // Создаём новые контейнеры с фиксированными позициями
    const btnX = button.x;
    const btnY = button.y;
    const btnH = button.displayHeight || button.height;
    
    // Звёзды всегда на фиксированной позиции относительно кнопки
    button.starsContainer = this.add.container(btnX, btnY + btnH * 0.32);
    button.starsContainer.setDepth(button.depth + 1);
    
    const starSize = Math.max(18, Math.round(btnH * 0.12));
    const starSpacing = starSize + 4;
    //const stars = levelProgress ? levelProgress.stars : 0;
    
    for (let star = 1; star <= 3; star++) {
        const starX = (star - 2) * starSpacing;
        const filled = star <= stars;
        const starText = this.add.text(starX, 0, filled ? '★' : '☆', {
            fontSize: starSize + 'px',
            color: filled ? '#FFD700' : '#666666'
        }).setOrigin(0.5);
        
        button.starsContainer.add(starText);
    }
    
    // Статистика на фиксированной позиции
    button.statsContainer = this.add.container(btnX, btnY + btnH * 0.42);
    button.statsContainer.setDepth(button.depth + 1);
    
    if (levelProgress) {
        const statsText = `${this.formatTime(levelProgress.bestTime)} | ${levelProgress.accuracy || 100}%`;
        const statsDisplay = this.add.text(0, 0, statsText, {
            fontFamily: 'Arial, sans-serif',
            fontSize: Math.max(14, Math.round(starSize * 0.7)) + 'px', // Минимум 14px
            color: '#CCCCCC'
        }).setOrigin(0.5);
        
        button.statsContainer.add(statsDisplay);
    }
  }

  showToast(message, color = '#3498DB', duration = 2000) {
    const { W, H } = this.getSceneWH();
    
    const toast = this.add.container(W / 2, H - 100);
    
    const bg = this.add.graphics();
    bg.fillStyle(parseInt(color.replace('#', '0x')), 0.9);
    bg.fillRoundedRect(-100, -15, 200, 30, 15);
    
    const text = this.add.text(0, 0, message, {
      fontFamily: 'Arial, sans-serif',
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
      fontFamily: 'Arial, sans-serif',
      fontSize: '22px',
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
      fontFamily: 'Arial, sans-serif',
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

  createLevelButton(x, y, w, h, level, levelIndex) {
    const progressLevels = this.getProgress();
    const levelProgress = progressLevels[levelIndex];

    const btnY = y - h*0.1;
    
    const btn = window.makeImageButton(this, x, btnY, w, h*0.75, level.label, () => {
      this.scene.start('GameScene', { 
        level: level, 
        levelIndex: levelIndex,
        page: this.levelPage,
        userData: this.vkUserData,
        isVK: this.isVKEnvironment,
        syncManager: this.syncManager
      });
    });

    btn.levelIndex = levelIndex;
    btn.setDepth(5);
    this.levelButtons.push(btn);

    btn.starsContainer = this.add.container(x, y + h*0.32);
    
    const starSize = Math.min(18, w*0.06);
    const starSpacing = starSize + 4;
    const stars = levelProgress ? levelProgress.stars : 0;
    
    for (let star = 1; star <= 3; star++) {
      const starX = (star - 2) * starSpacing;
      const filled = star <= stars;
      const starText = this.add.text(starX, 0, filled ? '★' : '☆', {
        fontSize: starSize + 'px',
        color: filled ? '#FFD700' : '#555555'
      }).setOrigin(0.5);
      
      btn.starsContainer.add(starText);
    }
    
    btn.starsContainer.setDepth(10);
    
    btn.statsContainer = this.add.container(x, y + h*0.32 + 22);
    
    if (levelProgress) {
      const accuracy = levelProgress.accuracy || 
        (levelProgress.attempts > 0 ? 
          Math.round((levelProgress.attempts - (levelProgress.errors || 0)) / levelProgress.attempts * 100) : 100);
      
      const statsText = `${this.formatTime(levelProgress.bestTime)} | ${accuracy}%`;
      const statsDisplay = this.add.text(0, 0, statsText, {
        fontFamily: 'Arial, sans-serif',
        fontSize: Math.round(starSize * 0.65) + 'px',
        color: '#CCCCCC',
        fontStyle: 'normal'
      }).setOrigin(0.5);
      
      btn.statsContainer.add(statsDisplay);
    } else {
      const hintText = this.add.text(0, 0, 'Не пройден', {
        fontFamily: 'Arial, sans-serif',
        fontSize: Math.round(starSize * 0.6) + 'px',
        color: '#888888',
        fontStyle: 'italic'
      }).setOrigin(0.5);
      
      btn.statsContainer.add(hintText);
    }
    
    btn.statsContainer.setDepth(10);
  }

  formatTime(seconds) {
    if (!seconds) return '0с';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `${secs}с`;
  }
};
