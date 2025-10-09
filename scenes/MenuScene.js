//---scenes/MenuScene.js - ИСПРАВЛЕННАЯ ВЕРСИЯ

window.MenuScene = class MenuScene extends Phaser.Scene {
  constructor(){ 
    super('MenuScene'); 
  }

  init(data){ 
    this.levelPage = data?.page || 0; 
    
    // Получаем VK данные если есть
    this.vkUserData = data?.userData || window.VK_USER_DATA;
    this.isVKEnvironment = data?.isVK || !!window.VK_LAUNCH_PARAMS;
    
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

  // ОБНОВЛЕННЫЙ МЕТОД: Инициализация менеджера синхронизации с правильными обработчиками
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
        this.updateSyncButton();
        this.showSyncButtonAnimation();
      };
      
      this.syncManager.onSyncComplete = (data) => {
        console.log('✅ Sync completed');
        this.isSyncing = false;
        this.hideSyncIndicator();
        this.updateSyncButton();
        this.hideSyncButtonAnimation();
        if (data) {
          this.progress = data;
          this.refreshUI();
        }
      };
      
      this.syncManager.onSyncError = (error) => {
        console.warn('⚠️ Sync error:', error);
        this.isSyncing = false;
        this.hideSyncIndicator();
        this.updateSyncButton();
        this.hideSyncButtonAnimation();
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

  // ИСПРАВЛЕННЫЙ МЕТОД clearMenu
  clearMenu() {
    if (this._wheelHandler) { 
      this.input.off('wheel', this._wheelHandler); 
      this._wheelHandler = null; 
    }
    
    // Улучшенная очистка с учетом контейнеров
    if (this.levelButtons) {
      this.levelButtons.forEach(btn => {
        if (btn && typeof btn.destroy === 'function') {
          
          // ВАЖНО: Сначала очищаем вложенные контейнеры
          if (btn.starsContainer) {
            btn.starsContainer.destroy();
            btn.starsContainer = null;
          }
          
          if (btn.statsContainer) {
            btn.statsContainer.destroy();
            btn.statsContainer = null;
          }
          
          // Очищаем слушатели перед уничтожением
          if (btn.zone && btn.zone.removeAllListeners) {
            btn.zone.removeAllListeners();
          }
          
          // Теперь уничтожаем саму кнопку
          btn.destroy();
        }
      });
      this.levelButtons = [];
    }
    
    // Очистка любых оставшихся текстовых элементов
    // которые могли быть добавлены вне контейнеров
    this.children.list.forEach(child => {
      if (child && child.type === 'Text' && 
          (child.text === '★' || child.text === '☆' || 
           child.text.includes('Не пройден') || 
           child.text.includes('%'))) {
        child.destroy();
      }
    });
  }

  drawMenu(page){
    console.log('Drawing menu, page:', page);
    this.clearMenu();
    const { W, H } = this.getSceneWH();
    console.log('Scene dimensions:', W, H);
    this.levelPage = page;

    // ИСПРАВЛЕНО: Проверяем принятие соглашения
    const acceptedAgreement = localStorage.getItem('acceptedAgreement');
    const agreementVersion = localStorage.getItem('agreementVersion');
    const CURRENT_VERSION = '2025-09-13';
    
    console.log('Agreement check:', {
      accepted: acceptedAgreement,
      version: agreementVersion,
      shouldShow: !acceptedAgreement || agreementVersion !== CURRENT_VERSION
    });

    // ДЛЯ ТЕСТИРОВАНИЯ: Автоматически принимаем соглашение
    // Закомментируйте эти строки в продакшн версии!
    if (!acceptedAgreement) {
      console.log('Auto-accepting agreement for testing');
      localStorage.setItem('acceptedAgreement', 'true');
      localStorage.setItem('agreementVersion', CURRENT_VERSION);
    }

    if (!acceptedAgreement || agreementVersion !== CURRENT_VERSION) {
      console.log('Showing user agreement');
      this.showUserAgreement();
      return;
    }

    console.log('Creating menu content...');

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

    console.log('Creating level buttons:', pageLevels.length);

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
    
    console.log('Menu drawn, total buttons:', this.levelButtons.length);
  }

  // ИСПРАВЛЕННЫЙ МЕТОД: Создание кнопки синхронизации
  createSyncButton(W, H, titlePx) {
    if (!this.syncManager) return;

    const syncStatus = this.syncManager.getSyncStatus();
    
    // Определяем цвет и текст кнопки
    let btnColor = 0x3498DB; // Используем hex число
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

    // Создаем кнопку вручную для полного контроля
    const syncButton = this.add.container(x, y);
    
    // Фон кнопки
    const bg = this.add.graphics();
    bg.fillStyle(btnColor, 0.8);
    bg.fillCircle(0, 0, size / 2);
    bg.lineStyle(2, 0xFFFFFF, 0.3);
    bg.strokeCircle(0, 0, size / 2);
    
    // Текст кнопки
    const text = this.add.text(0, 0, btnText, {
      fontSize: Math.round(size * 0.5) + 'px',
      color: '#FFFFFF'
    }).setOrigin(0.5);
    
    syncButton.add([bg, text]);
    syncButton.setDepth(10);
    
    // Интерактивность
    syncButton.setSize(size, size);
    syncButton.setInteractive({ useHandCursor: true });
    
    // Обработчики событий
    syncButton.on('pointerdown', () => {
      this.forceSyncProgress();
      this.tweens.add({
        targets: [bg, text],
        scaleX: 0.9,
        scaleY: 0.9,
        duration: 100,
        yoyo: true,
        ease: 'Power2'
      });
    });
    
    syncButton.on('pointerover', () => {
      bg.setAlpha(1);
      text.setScale(1.1);
      this.showTooltip(x, y - 35, btnTooltip);
    });
    
    syncButton.on('pointerout', () => {
      bg.setAlpha(0.8);
      text.setScale(1);
      this.hideTooltip();
    });
    
    // Сохраняем ссылки для возможного обновления
    syncButton.bgElement = bg;
    syncButton.textElement = text;
    syncButton.currentColor = btnColor;
    syncButton.currentTooltip = btnTooltip;
    syncButton.size = size;
    
    this.levelButtons.push(syncButton);
    
    // Сохраняем ссылку на кнопку синхронизации для обновлений
    this.syncButton = syncButton;
  }

  // НОВЫЙ МЕТОД: Обновление состояния кнопки синхронизации
  updateSyncButton() {
    if (!this.syncButton || !this.syncManager) return;

    const syncStatus = this.syncManager.getSyncStatus();
    
    // Определяем новое состояние
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

    // Обновляем только если состояние изменилось
    if (btnColor !== this.syncButton.currentColor) {
      // Плавная анимация изменения цвета
      this.tweens.add({
        targets: this.syncButton.bgElement,
        alpha: 0.5,
        duration: 150,
        yoyo: true,
        onComplete: () => {
          this.syncButton.bgElement.clear();
          this.syncButton.bgElement.fillStyle(btnColor, 0.8);
          this.syncButton.bgElement.fillCircle(0, 0, this.syncButton.size / 2);
          this.syncButton.bgElement.lineStyle(2, 0xFFFFFF, 0.3);
          this.syncButton.bgElement.strokeCircle(0, 0, this.syncButton.size / 2);
          this.syncButton.currentColor = btnColor;
        }
      });
    }

    // Обновляем текст если изменился
    if (btnText !== this.syncButton.textElement.text) {
      this.syncButton.textElement.setText(btnText);
    }

    // Обновляем tooltip
    this.syncButton.currentTooltip = btnTooltip;
  }

  // НОВЫЙ МЕТОД: Показать анимацию синхронизации на кнопке
  showSyncButtonAnimation() {
    if (!this.syncButton) return;

    // Запускаем вращение иконки для синхронизации
    if (this.syncButton.textElement.text === '🔄' || this.syncButton.textElement.text === '⏳') {
      this.syncButtonRotation = this.tweens.add({
        targets: this.syncButton.textElement,
        rotation: Math.PI * 2,
        duration: 1500,
        repeat: -1,
        ease: 'Linear'
      });
    }
  }

  // НОВЫЙ МЕТОД: Остановить анимацию синхронизации на кнопке
  hideSyncButtonAnimation() {
    if (this.syncButtonRotation) {
      this.syncButtonRotation.destroy();
      this.syncButtonRotation = null;
      
      if (this.syncButton && this.syncButton.textElement) {
        this.syncButton.textElement.setRotation(0);
      }
    }
  }

  async initSyncManager() {
    try {
      // Используем глобальный синглтон если доступен
      if (window.progressSyncManager) {
        this.syncManager = window.progressSyncManager;
      } else {
        this.syncManager = new ProgressSyncManager();
        await this.syncManager.init(); // Явная инициализация
      }
    } catch (error) {
      console.error('❌ Failed to initialize sync manager:', error);
      this.syncManager = null;
    }
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
    
    // Пропускаем если это первая загрузка (кнопки еще не созданы)
    if (!this.levelButtons || this.levelButtons.length === 0) return;
    
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

  // ИСПРАВЛЕННЫЙ МЕТОД: updateSingleLevelButton
  updateSingleLevelButton(button, levelIndex, progressLevels) {
    const levelProgress = progressLevels[levelIndex];
    
    // Обновляем звезды
    if (button.starsContainer) {
      button.starsContainer.destroy();
      button.starsContainer = null;
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
    
    button.starsContainer.setDepth(10);
    
    // Обновляем статистику
    if (button.statsContainer) {
      button.statsContainer.destroy();
      button.statsContainer = null;
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
    
    button.statsContainer.setDepth(10);
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

  // ИСПРАВЛЕННЫЙ МЕТОД: Показ пользовательского соглашения
  showUserAgreement() {
    const { W, H } = this.getSceneWH();
    
    // Затемнение фона
    const overlay = this.add.graphics()
      .fillStyle(0x000000, 0.85)
      .fillRect(0, 0, W, H)
      .setDepth(1000)
      .setInteractive();

    // Адаптивные размеры модального окна
    const modalW = Math.min(W * 0.9, 500);
    const modalH = Math.min(H * 0.85, 600);
    const modal = this.add.graphics()
      .fillStyle(0x2C3E50, 0.95)
      .fillRoundedRect(W/2 - modalW/2, H/2 - modalH/2, modalW, modalH, 15)
      .lineStyle(3, 0x3498DB, 0.8)
      .strokeRoundedRect(W/2 - modalW/2, H/2 - modalH/2, modalW, modalH, 15)
      .setDepth(1001);

    // Заголовок
    const title = this.add.text(W/2, H/2 - modalH/2 + 50, 'Пользовательское соглашение', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '22px',
      color: '#FFFFFF',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(1002);
    title.setStroke('#000000', 2);

    // Основной текст
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

    // Кнопка "Принимаю"
    const acceptBtn = window.makeImageButton(
      this, W/2 - 70, H/2 + modalH/2 - 60, 
      120, 45, 'Принимаю', 
      () => {
        // Сохраняем принятие соглашения
        localStorage.setItem('acceptedAgreement', 'true');
        localStorage.setItem('agreementVersion', '2025-09-13');
        localStorage.setItem('agreementAcceptedAt', new Date().toISOString());
        
        // Очистка элементов
        this.cleanupAgreementDialog([
          overlay, modal, title, text, acceptBtn, declineBtn
        ]);
        
        // Отрисовываем меню
        this.drawMenu(this.levelPage);
      }
    );
    acceptBtn.setDepth(1003);

    // Кнопка "Отклонить"
    const declineBtn = window.makeImageButton(
      this, W/2 + 70, H/2 + modalH/2 - 60, 
      120, 45, 'Отклонить', 
      () => {
        if (confirm('Без принятия соглашения игра недоступна.\nВы уверены, что хотите выйти?')) {
          this.cleanupAgreementDialog([
            overlay, modal, title, text, acceptBtn, declineBtn
          ]);
          
          // Пытаемся закрыть приложение
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

  // ИСПРАВЛЕННЫЙ МЕТОД: createLevelButton
  createLevelButton(x, y, w, h, level, levelIndex) {
    console.log('Creating level button:', levelIndex);
    
    const progressLevels = this.getProgress();
    const levelProgress = progressLevels[levelIndex];

    const btnY = y - h*0.1;
    
    // Создаем кнопку
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
    btn.setDepth(5); // Устанавливаем depth для кнопки
    this.levelButtons.push(btn);

    // Создаем контейнеры для звездочек
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
    
    btn.starsContainer.setDepth(10); // Явно задаем depth
    
    // Создаем контейнер для статистики
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
    
    btn.statsContainer.setDepth(10); // Явно задаем depth
    
    console.log('Button created:', {
      levelIndex,
      hasStarsContainer: !!btn.starsContainer,
      starsCount: btn.starsContainer.list.length,
      hasStatsContainer: !!btn.statsContainer,
      statsCount: btn.statsContainer.list.length,
      buttonDepth: btn.depth
    });
  }

  // Форматирование времени
  formatTime(seconds) {
    if (!seconds) return '0с';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `${secs}с`;
  }

  // ... остальные методы без изменений ...
};
