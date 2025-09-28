//---scenes/MenuScene.js - ИНТЕГРИРОВАННАЯ ВЕРСИЯ с исправлениями синхронизации

window.MenuScene = class MenuScene extends Phaser.Scene {
  constructor(){ 
    super('MenuScene'); 
  }

  init(data){ 
    this.levelPage = data?.page || 0; 
    
    // Получаем VK данные если есть
    this.vkUserData = data?.userData || window.VK_USER_DATA;
    this.isVKEnvironment = data?.isVK || !!window.VK_LAUNCH_PARAMS;
    
    // ИСПРАВЛЕНИЕ: Получаем единый менеджер прогресса
    this.progressManager = window.GameProgressManager;
    
    // Определяем мобильное устройство
    this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }

  create(){
    console.log('MenuScene started with unified progress manager');
    
    // ИСПРАВЛЕНИЕ: Инициализируем менеджер прогресса если не готов
    if (this.progressManager && !this.progressManager.isLoaded) {
      this.progressManager.init().then(() => {
        this.continueCreate();
      }).catch(error => {
        console.error('Failed to initialize progress manager:', error);
        this.continueCreate(); // Продолжаем без менеджера
      });
    } else {
      this.continueCreate();
    }
  }

  continueCreate() {
    if (this.scale && this.scale.updateBounds) this.scale.updateBounds();
    this.scale.on('resize', () => { 
      if (this.scale && this.scale.updateBounds) this.scale.updateBounds(); 
    });

    this.levelButtons = [];
    this._wheelHandler = null;

    this.ensureGradientBackground();
    this.drawMenu(this.levelPage);

    this.scale.on('resize', () => {
      this.ensureGradientBackground();
      this.drawMenu(this.levelPage);
    });

    // Очистка при завершении сцены
    this.events.once('shutdown', this.cleanup, this);
    this.events.once('destroy', this.cleanup, this);

    // ИСПРАВЛЕНИЕ: Подписываемся на события достижений
    window.addEventListener('achievementUnlocked', (event) => {
      this.showAchievementNotification(event.detail.achievementId);
    });
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
    
    console.log('MenuScene cleanup completed');
  }

  // ИСПРАВЛЕНИЕ: Получение прогресса через единый менеджер
  getProgress() {
    if (this.progressManager && this.progressManager.isLoaded) {
      return this.progressManager.getAllProgress();
    }
    
    // Fallback на localStorage если менеджер не работает
    try {
      const saved = localStorage.getItem('findpair_progress');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      console.warn('Error loading progress:', e);
      return {};
    }
  }

  // ИСПРАВЛЕНИЕ: Получение статистики через единый менеджер
  getStats() {
    if (this.progressManager && this.progressManager.isLoaded) {
      const stats = this.progressManager.getStats();
      const progress = this.progressManager.getAllProgress();
      const completedLevels = Object.keys(progress).length;
      const totalStars = this.progressManager.getTotalStars();
      
      return {
        totalLevels: window.LEVELS.length,
        completedLevels: completedLevels,
        totalStars: totalStars,
        maxStars: window.LEVELS.length * 3,
        averageStars: completedLevels > 0 ? totalStars / completedLevels : 0,
        gamesPlayed: stats.gamesPlayed,
        bestTime: stats.bestTime,
        bestAccuracy: stats.bestAccuracy
      };
    }
    
    // Fallback расчет статистики
    const progress = this.getProgress();
    const levels = Object.keys(progress);
    
    return {
      totalLevels: window.LEVELS.length,
      completedLevels: levels.length,
      totalStars: levels.reduce((sum, key) => sum + (progress[key].stars || 0), 0),
      maxStars: window.LEVELS.length * 3,
      averageStars: levels.length > 0 ? 
        levels.reduce((sum, key) => sum + (progress[key].stars || 0), 0) / levels.length : 0
    };
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

    // ИСПРАВЛЕНИЕ: Показываем статистику с данными из единого менеджера
    const stats = this.getStats();
    if (stats.completedLevels > 0) {
      let statsText = `Пройдено: ${stats.completedLevels}/${stats.totalLevels} | Звезд: ${stats.totalStars}/${stats.maxStars}`;
      
      // Добавляем дополнительную статистику если доступна
      if (this.progressManager && this.progressManager.isLoaded) {
        const gameStats = this.progressManager.getStats();
        if (gameStats.gamesPlayed > 0) {
          statsText += ` | Игр: ${gameStats.gamesPlayed}`;
        }
      }
      
      const statsDisplay = this.add.text(W/2, H*0.14, statsText, {
        fontFamily: 'Arial, sans-serif',
        fontSize: Math.round(titlePx * 0.45) + 'px',
        color: '#E0E0E0',
        align: 'center',
        fontStyle: 'normal'
      }).setOrigin(0.5);
      statsDisplay.setStroke('#000000', 1);
      this.levelButtons.push(statsDisplay);
    }

    // ИСПРАВЛЕНИЕ: Кнопка синхронизации данных
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

  // НОВЫЙ МЕТОД: Кнопка синхронизации данных
  createSyncButton(W, H, titlePx) {
    if (!this.progressManager || !this.isVKEnvironment) return;

    const syncButton = this.add.rectangle(W - 60, 60, 100, 35, 0xe74c3c)
      .setInteractive();
    
    const syncText = this.add.text(W - 60, 60, 'SYNC', {
      fontSize: Math.round(titlePx * 0.3) + 'px',
      fill: '#ffffff',
      fontWeight: 'bold'
    }).setOrigin(0.5);
    
    this.levelButtons.push(syncButton);
    this.levelButtons.push(syncText);
    
    syncButton.on('pointerdown', async () => {
      // Показываем индикатор синхронизации
      const indicator = this.add.text(W - 60, 90, 'Syncing...', {
        fontSize: Math.round(titlePx * 0.25) + 'px',
        fill: '#f39c12'
      }).setOrigin(0.5);
      
      try {
        // Принудительная синхронизация
        await this.progressManager.save(true);
        
        // Перезагружаем данные
        await this.progressManager.load();
        
        indicator.setText('Synced!').setFill('#27ae60');
        
        // Обновляем интерфейс
        setTimeout(() => {
          indicator.destroy();
          this.drawMenu(this.levelPage);
        }, 1000);
        
      } catch (error) {
        console.error('Sync failed:', error);
        indicator.setText('Sync failed').setFill('#e74c3c');
        
        setTimeout(() => {
          indicator.destroy();
        }, 2000);
      }
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
        // ИСПРАВЛЕНИЕ: Надежное открытие внешних ссылок через VKManager
        if (this.isVKEnvironment && window.VKManager?.isAvailable()) {
          try {
            window.VKManager.send('VKWebAppOpenApp', {
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
        if (confirm('Без принятия соглашения игра недоступна.\nВы уверены, что хотите выйти?')) {
          // Очищаем диалог перед выходом
          this.cleanupAgreementDialog([
            overlay, modal, title, text, 
            fullAgreementBtn, acceptBtn, declineBtn
          ]);
          
          // Пытаемся закрыть приложение через VKManager
          if (this.isVKEnvironment && window.VKManager?.isAvailable()) {
            try {
              window.VKManager.send('VKWebAppClose', {
                status: 'success'
              });
            } catch (e) {
              try {
                window.close();
              } catch (closeError) {
                if (this.isVKEnvironment) {
                  window.location.href = 'https://vk.com';
                } else {
                  window.history.back();
                }
              }
            }
          } else {
            try {
              window.close();
            } catch (e) {
              window.history.back();
            }
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

  /////////////////////////////////////////////////////////////
  // СОЗДАНИЕ КНОПОК УРОВНЕЙ
  /////////////////////////////////////////////////////////////

  createLevelButton(x, y, w, h, level, levelIndex) {
    // Контейнер для всех элементов уровня
    const levelContainer = this.add.container(x, y);

    // ИСПРАВЛЕНИЕ: Получаем прогресс через единый менеджер
    let levelProgress = null;
    if (this.progressManager && this.progressManager.isLoaded) {
      levelProgress = this.progressManager.getLevelProgress(levelIndex);
    } else {
      // Fallback на старый метод
      const progress = this.getProgress();
      levelProgress = progress[levelIndex];
    }

    // Основная кнопка уровня
    const btnY = -h*0.1;
    const btn = window.makeImageButton(this, 0, btnY, w, h*0.75, level.label, () => {
      // ИСПРАВЛЕНИЕ: Передаем единый менеджер прогресса в GameScene
      this.scene.start('GameScene', { 
        level: level,
        levelIndex: levelIndex, // Добавляем индекс для менеджера
        page: this.levelPage,
        userData: this.vkUserData,
        isVK: this.isVKEnvironment,
        progressManager: this.progressManager // Передаем менеджер
      });
    });

    levelContainer.add(btn);

    // Звездочки и прогресс
    const starsY = h*0.32;
    const starSize = Math.min(18, w*0.06);
    const starSpacing = starSize + 4;

    if (levelProgress) {
      // Показываем заработанные звездочки
      for (let star = 1; star <= 3; star++) {
        const starX = (star - 2) * starSpacing;
        const filled = star <= (levelProgress.stars || 0);
        const starText = this.add.text(starX, starsY, filled ? '★' : '☆', {
          fontSize: starSize + 'px',
          color: filled ? '#FFD700' : '#555555'
        }).setOrigin(0.5);
        levelContainer.add(starText);
      }

      // ИСПРАВЛЕНИЕ: Статистика с поддержкой новых полей
      let statsText = '';
      if (levelProgress.bestTime) {
        statsText += this.formatTime(levelProgress.bestTime);
      }
      if (levelProgress.accuracy || levelProgress.bestAccuracy) {
        const accuracy = levelProgress.accuracy || levelProgress.bestAccuracy || 0;
        if (statsText) statsText += ' | ';
        statsText += `${accuracy.toFixed(1)}%`;
      }
      
      if (statsText) {
        const statsDisplay = this.add.text(0, starsY + 22, statsText, {
          fontFamily: 'Arial, sans-serif',
          fontSize: Math.round(starSize * 0.65) + 'px',
          color: '#CCCCCC',
          fontStyle: 'normal'
        }).setOrigin(0.5);
        levelContainer.add(statsDisplay);
      }

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
  formatTime(timeMs) {
    const seconds = Math.floor(timeMs / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `${secs}с`;
  }

  // ИСПРАВЛЕНИЕ: Синхронизация прогресса через единый менеджер
  async syncProgressWithVK() {
    if (!this.progressManager || !this.isVKEnvironment) return false;

    try {
      console.log('Syncing progress with VK through GameProgressManager...');
      
      // Принудительная синхронизация через менеджер
      await this.progressManager.save(true);
      
      // Перезагрузка данных из облака
      await this.progressManager.load();
      
      console.log('Progress synced successfully');
      return true;
    } catch (error) {
      console.warn('Failed to sync progress through GameProgressManager:', error);
      return false;
    }
  }

  // НОВЫЙ МЕТОД: Показ уведомления о достижении
  showAchievementNotification(achievementId) {
    const { W, H } = this.getSceneWH();
    
    // Получаем данные достижения
    const achievement = window.ACHIEVEMENTS?.[achievementId];
    if (!achievement) return;
    
    const notification = this.add.container(W/2, 50);
    
    const bg = this.add.rectangle(0, 0, 300, 60, 0xf39c12, 0.9);
    const icon = this.add.text(-120, 0, achievement.icon || '🏆', {
      fontSize: '24px'
    }).setOrigin(0.5);
    
    const title = this.add.text(-80, -10, 'Achievement Unlocked!', {
      fontSize: '12px',
      fill: '#ffffff',
      fontWeight: 'bold'
    }).setOrigin(0, 0.5);
    
    const name = this.add.text(-80, 10, achievement.name || achievementId, {
      fontSize: '14px',
      fill: '#ffffff'
    }).setOrigin(0, 0.5);
    
    notification.add([bg, icon, title, name]);
    notification.setDepth(2000);
    
    // Анимация появления и исчезновения
    notification.setAlpha(0).setY(20);
    
    this.tweens.add({
      targets: notification,
      alpha: 1,
      y: 50,
      duration: 300,
      ease: 'Back.easeOut'
    });
    
    this.time.delayedCall(3000, () => {
      this.tweens.add({
        targets: notification,
        alpha: 0,
        y: 20,
        duration: 200,
        onComplete: () => notification.destroy()
      });
    });
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

  // НОВЫЙ МЕТОД: Показ настроек через единый менеджер
  showSettings() {
    if (!this.progressManager) return;

    const { W, H } = this.getSceneWH();
    
    // Затемнение фона
    const overlay = this.add.graphics()
      .fillStyle(0x000000, 0.8)
      .fillRect(0, 0, W, H)
      .setDepth(1000)
      .setInteractive();

    // Модальное окно
    const modalW = Math.min(this.isMobile ? W * 0.9 : 400, W * 0.85);
    const modalH = Math.min(this.isMobile ? H * 0.8 : 300, H * 0.75);
    const modal = this.add.graphics()
      .fillStyle(0x34495e, 0.95)
      .fillRoundedRect(W/2 - modalW/2, H/2 - modalH/2, modalW, modalH, 15)
      .setDepth(1001);

    const title = this.add.text(W/2, H/2 - modalH/2 + 40, 'НАСТРОЙКИ', {
      fontSize: '24px',
      fill: '#ffffff',
      fontWeight: 'bold'
    }).setOrigin(0.5).setDepth(1002);

    // Переключатель звука
    const soundEnabled = this.progressManager.getSetting('soundEnabled');
    const soundButton = this.add.rectangle(W/2, H/2 - 40,
      200, 40, soundEnabled ? 0x27ae60 : 0xe74c3c)
      .setInteractive()
      .setDepth(1002);
    
    this.add.text(W/2, H/2 - 40, 
      `Sound: ${soundEnabled ? 'ON' : 'OFF'}`, {
      fontSize: '16px',
      fill: '#ffffff'
    }).setOrigin(0.5).setDepth(1003);
    
    soundButton.on('pointerdown', () => {
      const newValue = !this.progressManager.getSetting('soundEnabled');
      this.progressManager.setSetting('soundEnabled', newValue);
      
      // Закрываем и показываем заново
      overlay.destroy();
      modal.destroy();
      title.destroy();
      soundButton.destroy();
      this.showSettings();
    });

    // Кнопка закрытия
    const closeButton = this.add.rectangle(W/2, H/2 + modalH/2 - 40,
      100, 40, 0x3498db)
      .setInteractive()
      .setDepth(1002);
    
    this.add.text(W/2, H/2 + modalH/2 - 40, 'CLOSE', {
      fontSize: '16px',
      fill: '#ffffff',
      fontWeight: 'bold'
    }).setOrigin(0.5).setDepth(1003);
    
    closeButton.on('pointerdown', () => {
      overlay.destroy();
      modal.destroy();
      title.destroy();
      soundButton.destroy();
      closeButton.destroy();
      this.drawMenu(this.levelPage);
    });
  }
};
