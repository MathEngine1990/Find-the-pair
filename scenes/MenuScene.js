//---scenes/MenuScene.js - ПОЛНАЯ ВЕРСИЯ С ИНТЕГРАЦИЕЙ ProgressSyncManager

window.MenuScene = class MenuScene extends Phaser.Scene {
  constructor(){ 
    super('MenuScene'); 
  }

  init(data){ 
    this.levelPage = data?.page || 0; 
    
    // Получаем VK данные если есть
    this.vkUserData = data?.userData || window.VK_USER_DATA;
    this.isVKEnvironment = data?.isVK || !!window.VK_LAUNCH_PARAMS;
    
    // Определяем мобильное устройство
    this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    // ДОБАВЛЕНО: Инициализация синхронизации
    this.syncManager = null;
    this.progress = {};
    this.isSyncing = false;
  }

  async create(){
    if (this.scale && this.scale.updateBounds) this.scale.updateBounds();
    this.scale.on('resize', () => { 
      if (this.scale && this.scale.updateBounds) this.scale.updateBounds(); 
    });

    this.levelButtons = [];
    this._wheelHandler = null;

    this.ensureGradientBackground();

    // ДОБАВЛЕНО: Инициализация ProgressSyncManager
    await this.initializeSyncManager();

    this.drawMenu(this.levelPage);

    this.scale.on('resize', () => {
      this.ensureGradientBackground();
      this.drawMenu(this.levelPage);
    });

    // Очистка при завершении сцены
    this.events.once('shutdown', this.cleanup, this);
    this.events.once('destroy', this.cleanup, this);
  }

  // НОВЫЙ МЕТОД: Инициализация менеджера синхронизации
  async initializeSyncManager() {
    try {
      // Используем глобальный менеджер или создаем новый
      this.syncManager = window.progressSyncManager || new ProgressSyncManager();
      
      // Подписываемся на события синхронизации
      this.syncManager.onProgressUpdate = (progressData) => {
        console.log('📊 Progress updated, refreshing UI');
        this.progress = progressData;
        this.refreshUI();
      };
      
      this.syncManager.onSyncStart = () => {
        console.log('🔄 Sync started');
        this.isSyncing = true;
        this.showSyncIndicator();
      };
      
      this.syncManager.onSyncComplete = (data) => {
        console.log('✅ Sync completed');
        this.isSyncing = false;
        this.hideSyncIndicator();
        if (data) {
          this.progress = data;
          this.refreshUI();
        }
      };
      
      this.syncManager.onSyncError = (error) => {
        console.warn('⚠️ Sync error:', error);
        this.isSyncing = false;
        this.hideSyncIndicator();
        this.showSyncError(error);
      };
      
      // Загружаем прогресс через менеджер
      this.progress = await this.syncManager.loadProgress();
      console.log('📊 Progress loaded via sync manager:', this.progress);
      
    } catch (error) {
      console.error('❌ Failed to init sync manager:', error);
      // Fallback на старую логику
      this.progress = this.getProgress();
      this.showSyncError(error);
    }
  }

  cleanup() {
    console.log('MenuScene cleanup started');
    
    // Очистка слушателей колеса мыши
    if (this._wheelHandler) {
      this.input.off('wheel', this._wheelHandler);
      this._wheelHandler = null;
    }

    // Очистка кнопок уровней
    if (this.levelButtons) {
      this.levelButtons.forEach(btn => {
        if (btn && btn.zone && btn.zone.removeAllListeners) {
          btn.zone.removeAllListeners();
        }
      });
      this.levelButtons = [];
    }

    // Очистка слушателей resize
    this.scale.off('resize');

    // ДОБАВЛЕНО: Очистка синхронизации
    this.hideSyncIndicator();
    
    console.log('MenuScene cleanup completed');
  }

  // ОБНОВЛЕННЫЙ МЕТОД: Получение прогресса
  getProgress() {
    try {
      if (this.progress && Object.keys(this.progress).length > 0) {
        return this.progress.levels || {};
      }
      
      const saved = localStorage.getItem('findpair_progress');
      const parsed = saved ? JSON.parse(saved) : {};
      return parsed.levels || parsed; // Поддержка старого формата
    } catch (e) {
      console.warn('Error loading progress:', e);
      return {};
    }
  }

  // ОБНОВЛЕННЫЙ МЕТОД: Получение статистики
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
    
    // Добавляем данные из общей статистики если есть
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

  clearMenu(){
    if (this._wheelHandler){ 
      this.input.off('wheel', this._wheelHandler); 
      this._wheelHandler = null; 
    }
    
    // Улучшенная очистка
    if (this.levelButtons) {
      this.levelButtons.forEach(btn => {
        if (btn && typeof btn.destroy === 'function') {
          // Очищаем слушатели перед уничтожением
          if (btn.zone && btn.zone.removeAllListeners) {
            btn.zone.removeAllListeners();
          }
          btn.destroy();
        }
      });
      this.levelButtons = [];
    }

    // ДОБАВЛЕНО: Не очищаем индикаторы синхронизации
    // (они управляются отдельно)
  }

  drawMenu(page){
    this.clearMenu();
    const { W, H } = this.getSceneWH();
    this.levelPage = page;

    // ИСПРАВЛЕНО: Проверяем принятие соглашения
    const acceptedAgreement = localStorage.getItem('acceptedAgreement');
    const agreementVersion = localStorage.getItem('agreementVersion');
    const CURRENT_VERSION = '2025-09-13';

    if (!acceptedAgreement || agreementVersion !== CURRENT_VERSION) {
      this.showUserAgreement();
      return;
    }

    const COLS=3, ROWS=3, PER_PAGE=COLS*ROWS;
    const PAGES = Math.max(1, Math.ceil(window.LEVELS.length / PER_PAGE));

    // Заголовок с адаптивным размером
    const titlePx = Math.round(Phaser.Math.Clamp(H * 0.06, 20, 40));
    const title = this.add.text(W/2, H*0.08, 'Сколько пар играть?', {
      fontFamily: 'Arial, sans-serif',
      fontSize: `${titlePx}px`,
      fontStyle: 'bold',
      color: '#FFFFFF',
      align: 'center'
    }).setOrigin(0.5);
    title.setStroke('#000000', Math.max(2, Math.round(titlePx * 0.08)));
    title.setShadow(2, 2, '#000000', 6, false, true);
    this.levelButtons.push(title);

    // Персонализация для VK пользователей
    if (this.vkUserData && this.vkUserData.first_name) {
      const greeting = this.add.text(W/2, H*0.04, `Привет, ${this.vkUserData.first_name}!`, {
        fontFamily: 'Arial, sans-serif',
        fontSize: Math.round(titlePx * 0.6) + 'px',
        color: '#FFD700',
        fontStyle: 'bold'
      }).setOrigin(0.5);
      greeting.setStroke('#000000', 2);
      this.levelButtons.push(greeting);
    }

    // ОБНОВЛЕНО: Улучшенная статистика с синхронизацией
    const stats = this.getStats();
    if (stats.completedLevels > 0) {
      let statsText = `Пройдено: ${stats.completedLevels}/${stats.totalLevels} | Звезд: ${stats.totalStars}/${stats.maxStars}`;
      
      // Добавляем дополнительную статистику если есть
      if (stats.gamesPlayed > 0) {
        statsText += `\nИгр сыграно: ${stats.gamesPlayed}`;
        if (stats.perfectGames > 0) {
          statsText += ` | Идеальных: ${stats.perfectGames}`;
        }
        if (stats.bestTime) {
          statsText += ` | Лучшее время: ${this.formatTime(stats.bestTime)}`;
        }
      }
      
      const statsDisplay = this.add.text(W/2, H*0.14, statsText, {
        fontFamily: 'Arial, sans-serif',
        fontSize: Math.round(titlePx * 0.4) + 'px',
        color: '#E0E0E0',
        align: 'center',
        fontStyle: 'normal'
      }).setOrigin(0.5);
      statsDisplay.setStroke('#000000', 1);
      this.levelButtons.push(statsDisplay);
    }

    // ДОБАВЛЕНО: Кнопка принудительной синхронизации
    this.createSyncButton(W, H, titlePx);

    // Область для кнопок уровней
    const topY = H*0.20, bottomY = H*0.78;
    const areaH = bottomY - topY;
    const areaW = Math.min(W*0.90, 1080);
    const cellH = areaH / ROWS;
    const cellW = areaW / COLS;
    const gridLeft = (W - areaW) / 2;
    const gridTop  = topY;

    const startIdx = this.levelPage * PER_PAGE;
    const endIdx   = Math.min(startIdx + PER_PAGE, window.LEVELS.length);
    const pageLevels = window.LEVELS.slice(startIdx, endIdx);

    // Создание кнопок уровней
    pageLevels.forEach((lvl, i) => {
      const levelIndex = startIdx + i;
      const r = (i / COLS) | 0, c = i % COLS;
      const x = gridLeft + c * cellW + cellW/2;
      const y = gridTop  + r * cellH + cellH/2;
      const w = Math.min(320, cellW*0.9);
      const h = Math.min(200, cellH*0.86);

      this.createLevelButton(x, y, w, h, lvl, levelIndex);
    });

    // Навигация по страницам
    const yNav = H*0.86;
    const size = Math.max(52, Math.round(H*0.06));
    const prevActive = this.levelPage > 0;
    const nextActive = this.levelPage < PAGES - 1;

    const prevBtn = window.makeIconButton(this, W*0.30, yNav, size, '‹', () => {
      if (prevActive) this.drawMenu(this.levelPage - 1);
    });
    prevBtn.setAlpha(prevActive?1:0.45); 
    this.levelButtons.push(prevBtn);

    const pageTxt = this.add.text(W*0.5, yNav, `${this.levelPage+1} / ${PAGES}`, {
      fontFamily: 'Arial, sans-serif', 
      fontSize: Math.round(Math.min(Math.max(size*0.30,14),22)) + 'px',
      color:'#FFFFFF', 
      fontStyle: 'bold'
    }).setOrigin(0.5);
    pageTxt.setStroke('#000000', 1);
    this.levelButtons.push(pageTxt);

    const nextBtn = window.makeIconButton(this, W*0.70, yNav, size, '›', () => {
      if (nextActive) this.drawMenu(this.levelPage + 1);
    });
    nextBtn.setAlpha(nextActive?1:0.45); 
    this.levelButtons.push(nextBtn);

    // Обработка колеса мыши для навигации
    this._wheelHandler = (_p, _objs, _dx, dy) => {
      if (dy > 0 && nextActive) this.drawMenu(this.levelPage + 1);
      else if (dy < 0 && prevActive) this.drawMenu(this.levelPage - 1);
    };
    this.input.on('wheel', this._wheelHandler);
  }

  // НОВЫЙ МЕТОД: Создание кнопки синхронизации
  createSyncButton(W, H, titlePx) {
    if (!this.syncManager) return;

    const syncStatus = this.syncManager.getSyncStatus();
    
    // Определяем цвет и текст кнопки
    let btnColor = '#3498DB';
    let btnText = '🔄';
    let btnTooltip = 'Синхронизация';
    
    if (!syncStatus.isVKAvailable) {
      btnColor = '#95A5A6';
      btnText = '📱';
      btnTooltip = 'Только локально';
    } else if (this.isSyncing) {
      btnColor = '#F39C12';
      btnText = '⏳';
      btnTooltip = 'Синхронизация...';
    } else if (syncStatus.lastSyncTime > 0) {
      btnColor = '#27AE60';
      btnText = '✅';
      btnTooltip = 'Синхронизировано';
    }

    const syncBtn = window.makeIconButton(
      this, 
      W - 40, 
      40, 
      Math.round(titlePx * 0.8), 
      btnText, 
      () => this.forceSyncProgress()
    );
    
    syncBtn.setTint(parseInt(btnColor.replace('#', '0x')));
    this.levelButtons.push(syncBtn);

    // Добавляем tooltip
    syncBtn.zone.on('pointerover', () => {
      this.showTooltip(syncBtn.x, syncBtn.y - 30, btnTooltip);
    });
    
    syncBtn.zone.on('pointerout', () => {
      this.hideTooltip();
    });
  }

  // НОВЫЙ МЕТОД: Принудительная синхронизация
  async forceSyncProgress() {
    if (!this.syncManager) {
      this.showSyncError(new Error('Менеджер синхронизации недоступен'));
      return;
    }

    try {
      console.log('🔄 Manual sync triggered');
      const success = await this.syncManager.forceSync();
      
      if (success) {
        this.showSyncSuccess();
      } else {
        this.showSyncError(new Error('Синхронизация не удалась'));
      }
      
    } catch (error) {
      console.error('❌ Manual sync failed:', error);
      this.showSyncError(error);
    }
  }

  // НОВЫЙ МЕТОД: Показать индикатор синхронизации
  showSyncIndicator() {
    if (this.syncIndicator) return;
    
    const { W, H } = this.getSceneWH();
    
    this.syncIndicator = this.add.container(W - 80, 80);
    
    // Фон индикатора
    const bg = this.add.graphics();
    bg.fillStyle(0x2C3E50, 0.9);
    bg.lineStyle(2, 0xF39C12, 1);
    bg.fillRoundedRect(-30, -15, 60, 30, 15);
    bg.strokeRoundedRect(-30, -15, 60, 30, 15);
    
    // Иконка синхронизации
    const icon = this.add.text(0, 0, '🔄', {
      fontSize: '20px'
    }).setOrigin(0.5);
    
    this.syncIndicator.add([bg, icon]);
    this.syncIndicator.setDepth(1000);
    
    // Анимация вращения
    this.syncRotationTween = this.tweens.add({
      targets: icon,
      rotation: Math.PI * 2,
      duration: 1000,
      repeat: -1,
      ease: 'Linear'
    });
  }

  // НОВЫЙ МЕТОД: Скрыть индикатор синхронизации
  hideSyncIndicator() {
    if (this.syncIndicator) {
      if (this.syncRotationTween) {
        this.syncRotationTween.destroy();
        this.syncRotationTween = null;
      }
      this.syncIndicator.destroy();
      this.syncIndicator = null;
    }
  }

  // НОВЫЙ МЕТОД: Обновить UI после синхронизации
  refreshUI() {
    // Пропускаем обновление если сцена не активна
    if (!this.scene.isActive()) return;
    
    console.log('🔄 Refreshing MenuScene UI');
    
    // Перерисовываем только кнопки уровней, не весь экран
    this.updateLevelButtons();
    
    // Обновляем статистику
    this.updateStatsDisplay();
  }

  // НОВЫЙ МЕТОД: Обновление кнопок уровней
  updateLevelButtons() {
    const progressLevels = this.getProgress();
    
    this.levelButtons.forEach(button => {
      if (button.levelIndex !== undefined) {
        this.updateSingleLevelButton(button, button.levelIndex, progressLevels);
      }
    });
  }

  // НОВЫЙ МЕТОД: Обновление статистики
  updateStatsDisplay() {
    // Находим элемент статистики и обновляем его
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

  // НОВЫЙ МЕТОД: Обновление одной кнопки уровня
  updateSingleLevelButton(button, levelIndex, progressLevels) {
    const levelProgress = progressLevels[levelIndex];
    
    // Обновляем звезды
    if (button.starsContainer) {
      button.starsContainer.destroy();
    }
    
    button.starsContainer = this.add.container(button.x, button.y + 35);
    
    const starSize = 18;
    const starSpacing = starSize + 4;
    const stars = levelProgress ? levelProgress.stars : 0;
    
    for (let star = 1; star <= 3; star++) {
      const starX = (star - 2) * starSpacing;
      const filled = star <= stars;
      const starText = this.add.text(starX, 0, filled ? '★' : '☆', {
        fontSize: starSize + 'px',
        color: filled ? '#FFD700' : '#666666'
      }).setOrigin(0.5);
      
      button.starsContainer.add(starText);
    }
    
    button.starsContainer.setDepth(button.depth + 1);
    
    // Обновляем статистику
    if (button.statsContainer) {
      button.statsContainer.destroy();
    }
    
    button.statsContainer = this.add.container(button.x, button.y + 57);
    
    if (levelProgress) {
      const statsText = `${this.formatTime(levelProgress.bestTime)} | ${levelProgress.accuracy || 100}%`;
      const statsDisplay = this.add.text(0, 0, statsText, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '12px',
        color: '#CCCCCC'
      }).setOrigin(0.5);
      
      button.statsContainer.add(statsDisplay);
    } else {
      const hintText = this.add.text(0, 0, 'Не пройден', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '11px',
        color: '#888888',
        fontStyle: 'italic'
      }).setOrigin(0.5);
      
      button.statsContainer.add(hintText);
    }
    
    button.statsContainer.setDepth(button.depth + 1);
  }

  // НОВЫЙ МЕТОД: Показать успех синхронизации
  showSyncSuccess() {
    this.showToast('✅ Данные синхронизированы', '#27AE60');
  }

  // НОВЫЙ МЕТОД: Показать ошибку синхронизации
  showSyncError(error) {
    console.error('Sync error:', error);
    this.showToast('⚠️ Ошибка синхронизации', '#E74C3C');
  }

  // НОВЫЙ МЕТОД: Показать tooltip
  showTooltip(x, y, text) {
    this.hideTooltip();
    
    const tooltip = this.add.container(x, y);
    
    const bg = this.add.graphics();
    bg.fillStyle(0x2C3E50, 0.9);
    bg.fillRoundedRect(-30, -10, 60, 20, 5);
    
    const label = this.add.text(0, 0, text, {
      fontFamily: 'Arial, sans-serif',
      fontSize: '10px',
      color: '#FFFFFF'
    }).setOrigin(0.5);
    
    tooltip.add([bg, label]);
    tooltip.setDepth(2000);
    
    this.currentTooltip = tooltip;
    
    // Автоскрытие через 3 секунды
    this.tooltipTimer = this.time.delayedCall(3000, () => {
      this.hideTooltip();
    });
  }

  // НОВЫЙ МЕТОД: Скрыть tooltip
  hideTooltip() {
    if (this.currentTooltip) {
      this.currentTooltip.destroy();
      this.currentTooltip = null;
    }
    
    if (this.tooltipTimer) {
      this.tooltipTimer.destroy();
      this.tooltipTimer = null;
    }
  }

  // НОВЫЙ МЕТОД: Показать toast уведомление
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
    
    // Анимация появления
    toast.setAlpha(0);
    this.tweens.add({
      targets: toast,
      alpha: 1,
      duration: 300,
      ease: 'Power2.easeOut'
    });
    
    // Автоматическое скрытие
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

  /////////////////////////////////////////////////////////////
  // ИСПРАВЛЕННЫЙ МЕТОД: Показ пользовательского соглашения
  /////////////////////////////////////////////////////////////

  showUserAgreement() {
    const { W, H } = this.getSceneWH();
    
    // Затемнение фона
    const overlay = this.add.graphics()
      .fillStyle(0x000000, 0.85)
      .fillRect(0, 0, W, H)
      .setDepth(1000)
      .setInteractive();

    // ИСПРАВЛЕНИЕ: Адаптивные размеры модального окна
    const modalW = Math.min(this.isMobile ? W * 0.95 : 500, W * 0.9);
    const modalH = Math.min(this.isMobile ? H * 0.90 : 600, H * 0.85);
    const modal = this.add.graphics()
      .fillStyle(0x2C3E50, 0.95)
      .fillRoundedRect(W/2 - modalW/2, H/2 - modalH/2, modalW, modalH, 15)
      .lineStyle(3, 0x3498DB, 0.8)
      .strokeRoundedRect(W/2 - modalW/2, H/2 - modalH/2, modalW, modalH, 15)
      .setDepth(1001);

    // ИСПРАВЛЕНИЕ: Адаптивный размер заголовка
    const titleSize = this.isMobile ? '18px' : '22px';
    const title = this.add.text(W/2, H/2 - modalH/2 + 50, 'Пользовательское соглашение', {
      fontFamily: 'Arial, sans-serif',
      fontSize: titleSize,
      color: '#FFFFFF',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(1002);
    title.setStroke('#000000', 2);

    // ИСПРАВЛЕНИЕ: Адаптивный размер основного текста
    const textSize = this.isMobile ? '12px' : '14px';
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
      fontSize: textSize,
      color: '#E8E8E8',
      align: 'center',
      lineSpacing: this.isMobile ? 6 : 8,
      wordWrap: { width: modalW - 40 }
    }).setOrigin(0.5).setDepth(1002);

    // ИСПРАВЛЕНИЕ: Адаптивные размеры кнопок
    const btnHeight = this.isMobile ? 40 : 35;
    const btnWidth = this.isMobile ? 160 : 140;
    
    // Кнопка для просмотра полного соглашения
    const fullAgreementBtn = window.makeImageButton(
      this, W/2, H/2 + modalH/2 - (this.isMobile ? 140 : 120), 
      btnWidth, btnHeight, 'Полный текст', 
      () => {
        // ИСПРАВЛЕНИЕ: Надежное открытие внешних ссылок
        if (this.isVKEnvironment && window.VKHelpers && window.VKHelpers.openExternalUrl) {
          window.VKHelpers.openExternalUrl('user-agreement.html');
        } else if (this.isVKEnvironment && window.vkBridge) {
          try {
            window.vkBridge.send('VKWebAppOpenApp', {
              app_id: 0,
              location: 'user-agreement.html'
            });
          } catch (e) {
            window.open('user-agreement.html', '_blank');
          }
        } else {
          window.open('user-agreement.html', '_blank');
        }
      }
    );
    fullAgreementBtn.setDepth(1003);

    // ИСПРАВЛЕНИЕ: Адаптивное позиционирование кнопок принятия/отклонения
    const btnSpacing = this.isMobile ? 80 : 70;
    const btnY = H/2 + modalH/2 - (this.isMobile ? 80 : 60);
    
    const acceptBtn = window.makeImageButton(
      this, W/2 - btnSpacing, btnY, 
      this.isMobile ? 140 : 120, this.isMobile ? 50 : 45, 'Принимаю', 
      () => {
        // КЛЮЧЕВОЕ ИСПРАВЛЕНИЕ: Сохраняем принятие соглашения
        localStorage.setItem('acceptedAgreement', 'true');
        localStorage.setItem('agreementVersion', '2025-09-13');
        localStorage.setItem('agreementAcceptedAt', new Date().toISOString());
        
        if (this.isVKEnvironment) {
          localStorage.setItem('vk_agreement_shown', 'true');
        }

        // ИСПРАВЛЕНО: Правильная очистка всех элементов
        this.cleanupAgreementDialog([
          overlay, modal, title, text, 
          fullAgreementBtn, acceptBtn, declineBtn
        ]);
        
        // Отрисовываем меню
        this.drawMenu(this.levelPage);
      }
    );
    acceptBtn.setDepth(1003);

    const declineBtn = window.makeImageButton(
      this, W/2 + btnSpacing, btnY, 
      this.isMobile ? 140 : 120, this.isMobile ? 50 : 45, 'Отклонить', 
      () => {
        // ИСПРАВЛЕНО: Более понятное поведение кнопки "Отклонить"
        
        // Показываем предупреждение об отклонении
        if (confirm('Без принятия соглашения игра недоступна.\nВы уверены, что хотите выйти?')) {
          // Очищаем диалог перед выходом
          this.cleanupAgreementDialog([
            overlay, modal, title, text, 
            fullAgreementBtn, acceptBtn, declineBtn
          ]);
          
          // Пытаемся закрыть приложение
          if (this.isVKEnvironment && window.VKHelpers && window.VKHelpers.closeApp) {
            window.VKHelpers.closeApp();
          } else if (this.isVKEnvironment && window.vkBridge) {
            try {
              window.vkBridge.send('VKWebAppClose', {
                status: 'success'
              });
            } catch (e) {
              // Если VK методы не работают, просто закрываем вкладку/окно
              try {
                window.close();
              } catch (closeError) {
                // Последний fallback - перенаправляем на главную VK
                if (this.isVKEnvironment) {
                  window.location.href = 'https://vk.com';
                } else {
                  window.history.back();
                }
              }
            }
          } else {
            // Не VK окружение - просто возвращаемся назад
            try {
              window.close();
            } catch (e) {
              window.history.back();
            }
          }
        }
        // Если пользователь отменил confirm, ничего не делаем - диалог остается
      }
    );
    declineBtn.setDepth(1003);
  }

  // НОВЫЙ МЕТОД: Безопасная очистка диалогового окна
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

  // ДОПОЛНИТЕЛЬНО: Метод для принудительного показа соглашения (для отладки)
  showAgreementForDebug() {
    // Сбрасываем все флаги для тестирования
    localStorage.removeItem('acceptedAgreement');
    localStorage.removeItem('agreementVersion');
    localStorage.removeItem('vk_agreement_shown');
    localStorage.removeItem('firstLaunchShown');
    
    // Показываем соглашение
    this.showUserAgreement();
  }

  /////////////////////////////////////////////////////////////
  // СОЗДАНИЕ КНОПОК УРОВНЕЙ
  /////////////////////////////////////////////////////////////

  createLevelButton(x, y, w, h, level, levelIndex) {
    // Контейнер для всех элементов уровня
    const levelContainer = this.add.container(x, y);

    // Получаем прогресс для этого уровня
    const progressLevels = this.getProgress();
    const levelProgress = progressLevels[levelIndex];

    // Основная кнопка уровня
    const btnY = -h*0.1;
    const btn = window.makeImageButton(this, 0, btnY, w, h*0.75, level.label, () => {
      // ОБНОВЛЕНО: Передаем данные синхронизации в GameScene
      this.scene.start('GameScene', { 
        level: level, 
        levelIndex: levelIndex,  // ДОБАВЛЕНО: передаем индекс уровня
        page: this.levelPage,
        userData: this.vkUserData,
        isVK: this.isVKEnvironment,
        syncManager: this.syncManager  // ДОБАВЛЕНО: передаем менеджер синхронизации
      });
    });

    levelContainer.add(btn);
    
    // ДОБАВЛЕНО: Сохраняем ссылку на индекс уровня для обновлений
    levelContainer.levelIndex = levelIndex;

    // Звездочки и прогресс
    const starsY = h*0.32;
    const starSize = Math.min(18, w*0.06);
    const starSpacing = starSize + 4;

    if (levelProgress) {
      // Показываем заработанные звездочки
      for (let star = 1; star <= 3; star++) {
        const starX = (star - 2) * starSpacing;
        const filled = star <= levelProgress.stars;
        const starText = this.add.text(starX, starsY, filled ? '★' : '☆', {
          fontSize: starSize + 'px',
          color: filled ? '#FFD700' : '#555555'
        }).setOrigin(0.5);
        levelContainer.add(starText);
      }

      // ОБНОВЛЕНО: Улучшенная статистика
      const accuracy = levelProgress.accuracy || 
        (levelProgress.attempts > 0 ? 
          Math.round((levelProgress.attempts - (levelProgress.errors || 0)) / levelProgress.attempts * 100) : 100);
      
      const statsText = `${this.formatTime(levelProgress.bestTime)} | ${accuracy}%`;
      const statsDisplay = this.add.text(0, starsY + 22, statsText, {
        fontFamily: 'Arial, sans-serif',
        fontSize: Math.round(starSize * 0.65) + 'px',
        color: '#CCCCCC',
        fontStyle: 'normal'
      }).setOrigin(0.5);
      levelContainer.add(statsDisplay);

    } else {
      // Уровень не пройден - показываем пустые звездочки
      for (let star = 1; star <= 3; star++) {
        const starX = (star - 2) * starSpacing;
        const starText = this.add.text(starX, starsY, '☆', {
          fontSize: starSize + 'px',
          color: '#444444'
        }).setOrigin(0.5);
        levelContainer.add(starText);
      }

      // Подсказка для непройденного уровня
      const hintText = this.add.text(0, starsY + 22, 'Не пройден', {
        fontFamily: 'Arial, sans-serif',
        fontSize: Math.round(starSize * 0.6) + 'px',
        color: '#888888',
        fontStyle: 'italic'
      }).setOrigin(0.5);
      levelContainer.add(hintText);
    }

    this.levelButtons.push(levelContainer);
  }

  /////////////////////////////////////////////////////////////
  // УТИЛИТАРНЫЕ МЕТОДЫ
  /////////////////////////////////////////////////////////////

  // Форматирование времени
  formatTime(seconds) {
    if (!seconds) return '0с';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `${secs}с`;
  }

  // ОБНОВЛЕННЫЙ МЕТОД: Синхронизация прогресса с VK (теперь через ProgressSyncManager)
  async syncProgressWithVK() {
    if (!this.syncManager) {
      console.warn('Sync manager not available');
      return false;
    }

    try {
      const success = await this.syncManager.forceSync();
      
      if (success) {
        console.log('✅ Progress synced successfully');
        this.showSyncSuccess();
        return true;
      } else {
        console.warn('⚠️ Sync completed but no changes detected');
        return false;
      }
      
    } catch (error) {
      console.error('❌ Sync failed:', error);
      this.showSyncError(error);
      return false;
    }
  }

  // НОВЫЙ МЕТОД: Сохранение прогресса через синхронизатор
  async saveProgress(levelIndex, stars, time, errors, attempts) {
    try {
      if (!this.syncManager) {
        console.warn('Sync manager not available, using fallback');
        return this.saveProgressFallback(levelIndex, stars, time, errors, attempts);
      }

      // Загружаем текущий прогресс
      const currentProgress = await this.syncManager.loadProgress();
      
      // Обновляем прогресс для уровня
      if (!currentProgress.levels) {
        currentProgress.levels = {};
      }
      
      const existingLevel = currentProgress.levels[levelIndex];
      const accuracy = attempts > 0 ? Math.round((attempts - errors) / attempts * 100) : 100;
      
      const newLevel = {
        stars,
        bestTime: time,
        errors,
        attempts,
        accuracy,
        timestamp: Date.now(),
        completedAt: new Date().toISOString()
      };
      
      // Сохраняем только если результат лучше
      if (!existingLevel || 
          stars > existingLevel.stars || 
          (stars === existingLevel.stars && time < existingLevel.bestTime)) {
        
        currentProgress.levels[levelIndex] = newLevel;
        
        // Обновляем общую статистику
        if (!currentProgress.stats) {
          currentProgress.stats = {
            gamesPlayed: 0,
            totalTime: 0,
            totalErrors: 0,
            bestTime: null,
            lastPlayed: 0,
            perfectGames: 0,
            totalStars: 0
          };
        }
        
        const stats = currentProgress.stats;
        stats.gamesPlayed++;
        stats.totalTime += time;
        stats.totalErrors += errors;
        stats.lastPlayed = Date.now();
        
        if (errors === 0) {
          stats.perfectGames++;
        }
        
        if (!stats.bestTime || time < stats.bestTime) {
          stats.bestTime = time;
        }
        
        // Пересчитываем общее количество звезд
        stats.totalStars = Object.values(currentProgress.levels)
          .reduce((total, level) => total + (level.stars || 0), 0);
        
        // Сохраняем через синхронизатор
        await this.syncManager.saveProgress(currentProgress, true);
        
        console.log('💾 Progress saved via sync manager:', {
          level: levelIndex,
          stars,
          time,
          accuracy
        });
        
        // Обновляем локальный кеш
        this.progress = currentProgress;
        
        return true;
      }
      
      return false;
      
    } catch (error) {
      console.error('❌ Failed to save progress:', error);
      // Fallback к старому методу
      return this.saveProgressFallback(levelIndex, stars, time, errors, attempts);
    }
  }

  // НОВЫЙ МЕТОД: Fallback сохранение прогресса
  saveProgressFallback(levelIndex, stars, time, errors, attempts) {
    try {
      const progress = this.getProgress();
      const existingLevel = progress[levelIndex];
      const accuracy = attempts > 0 ? Math.round((attempts - errors) / attempts * 100) : 100;
      
      const newLevel = {
        stars,
        bestTime: time,
        errors,
        attempts,
        accuracy,
        timestamp: Date.now()
      };
      
      // Сохраняем только если результат лучше
      if (!existingLevel || 
          stars > existingLevel.stars || 
          (stars === existingLevel.stars && time < existingLevel.bestTime)) {
        
        progress[levelIndex] = newLevel;
        localStorage.setItem('findpair_progress', JSON.stringify({ levels: progress }));
        
        console.log('💾 Progress saved via fallback');
        return true;
      }
      
      return false;
      
    } catch (error) {
      console.error('❌ Fallback save failed:', error);
      return false;
    }
  }

  /////////////////////////////////////////////////////////////
  // ОБРАБОТЧИКИ СОБЫТИЙ СЦЕНЫ
  /////////////////////////////////////////////////////////////

  // НОВЫЙ МЕТОД: Обработчик возврата из GameScene
  onProgressSynced(data) {
    console.log('📊 Progress synced event received');
    this.progress = data;
    this.refreshUI();
  }

  /////////////////////////////////////////////////////////////
  // ДОПОЛНИТЕЛЬНЫЕ ДИАЛОГИ (если нужны)
  /////////////////////////////////////////////////////////////

  // Показ возрастных ограничений (альтернативный диалог)
  showAgeRating() {
    const { W, H } = this.getSceneWH();
    
    // Затемнение фона
    const overlay = this.add.graphics()
      .fillStyle(0x000000, 0.8)
      .fillRect(0, 0, W, H)
      .setDepth(1000)
      .setInteractive();

    // Модальное окно
    const modalW = Math.min(this.isMobile ? W * 0.9 : 450, W * 0.85);
    const modalH = Math.min(this.isMobile ? H * 0.8 : 350, H * 0.75);
    const modal = this.add.graphics()
      .fillStyle(0x2C3E50, 0.95)
      .fillRoundedRect(W/2 - modalW/2, H/2 - modalH/2, modalW, modalH, 15)
      .lineStyle(3, 0x3498DB, 0.8)
      .strokeRoundedRect(W/2 - modalW/2, H/2 - modalH/2, modalW, modalH, 15)
      .setDepth(1001);

    // Заголовок
    const titleSize = this.isMobile ? '20px' : '24px';
    const title = this.add.text(W/2, H/2 - modalH/3, 'Возрастные ограничения', {
      fontFamily: 'Arial, sans-serif',
      fontSize: titleSize,
      color: '#FFFFFF',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(1002);
    title.setStroke('#000000', 2);

    // Основной текст
    const textSize = this.isMobile ? '14px' : '16px';
    const text = this.add.text(W/2, H/2 - 20, 
      'Игра "Память: Найди пару"\nне содержит контента,\nзапрещенного для несовершеннолетних\n\nВозрастное ограничение: 0+\n\nБезопасно для всей семьи', {
      fontFamily: 'Arial, sans-serif',
      fontSize: textSize,
      color: '#E8E8E8',
      align: 'center',
      lineSpacing: 6,
      fontStyle: 'normal'
    }).setOrigin(0.5).setDepth(1002);

    // Дополнительная информация для VK
    let vkInfo = null;
    if (this.isVKEnvironment) {
      const infoSize = this.isMobile ? '10px' : '12px';
      vkInfo = this.add.text(W/2, H/2 + modalH/3 - 80, 
        'Данные обрабатываются согласно\nполитике конфиденциальности ВКонтакте', {
        fontFamily: 'Arial, sans-serif',
        fontSize: infoSize,
        color: '#AAAAAA',
        align: 'center',
        lineSpacing: 4,
        fontStyle: 'italic'
      }).setOrigin(0.5).setDepth(1002);
    }

    // Кнопка "Понятно"
    const btnWidth = this.isMobile ? 180 : 150;
    const btnHeight = this.isMobile ? 55 : 50;
    const okButton = window.makeImageButton(
      this, W/2, H/2 + modalH/3 - 30, 
      btnWidth, btnHeight, 'Понятно', 
      () => {
        // Очистка элементов
        overlay.destroy();
        modal.destroy();
        title.destroy();
        text.destroy();
        if (vkInfo) vkInfo.destroy();
        okButton.destroy();
        this.drawMenu(this.levelPage);
      }
    );
    okButton.setDepth(1003);
  }
};
