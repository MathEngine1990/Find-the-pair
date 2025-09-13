//---scenes/MenuScene.js - С СИСТЕМОЙ ПРОГРЕССА И ЗВЕЗДОЧЕК

window.MenuScene = class MenuScene extends Phaser.Scene {
  constructor(){ super('MenuScene'); }

  init(data){ 
    this.levelPage = data?.page || 0; 
    
    // Получаем VK данные если есть
    this.vkUserData = data?.userData || window.VK_USER_DATA;
    this.isVKEnvironment = data?.isVK || !!window.VK_LAUNCH_PARAMS;
  }

  create(){
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

  // Получение прогресса игрока
  getProgress() {
    try {
      const saved = localStorage.getItem('findpair_progress');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      console.warn('Error loading progress:', e);
      return {};
    }
  }

  // Получение статистики
  getStats() {
    const progress = this.getProgress();
    const levels = Object.keys(progress);
    
    return {
      totalLevels: window.LEVELS.length,
      completedLevels: levels.length,
      totalStars: levels.reduce((sum, key) => sum + progress[key].stars, 0),
      maxStars: window.LEVELS.length * 3,
      averageStars: levels.length > 0 ? 
        levels.reduce((sum, key) => sum + progress[key].stars, 0) / levels.length : 0
    };
  }

  getSceneWH(){
    const s = this.scale, cam = this.cameras?.main;
    const W = (s && (s.width ?? s.gameSize?.width))  || cam?.width  || this.sys.game.config.width  || 1500;
    const H = (s && (s.height ?? s.gameSize?.height)) || cam?.height || this.sys.game.config.height || 1500;
    return { W: Math.floor(W), H: Math.floor(H) };
  }

  getDPR(){ return Math.min(2.0, Math.max(1, (window.devicePixelRatio || 1))); }

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
    if (this._wheelHandler){ this.input.off('wheel', this._wheelHandler); this._wheelHandler = null; }
    
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

    // Показ возрастных ограничений при первом запуске
    const isFirstLaunch = !localStorage.getItem('firstLaunchShown');
    if (isFirstLaunch && this.isVKEnvironment) {
      this.showAgeRating();
      localStorage.setItem('firstLaunchShown', 'true');
      return;
    }

    const COLS=3, ROWS=3, PER_PAGE=COLS*ROWS;
    const PAGES = Math.max(1, Math.ceil(window.LEVELS.length / PER_PAGE));

    const titlePx = Math.round(Phaser.Math.Clamp(H * (window.THEME.titleSizeFactor || 0.08), 22, 56));
    const title = this.add.text(W/2, H*0.13, 'Сколько пар играть?', {
      fontFamily: window.THEME.fontTitle || window.THEME.font,
      fontSize:   `${titlePx}px`,
      fontStyle:  window.THEME.titleStyle || 'bold',
      color:      window.THEME.titleColor || '#E8E1C9',
      align: 'center'
    }).setOrigin(0.5);
    title.setStroke('#0A1410', Math.max(1, Math.round(titlePx * 0.06)));
    title.setShadow(0, Math.max(1, Math.round(titlePx * 0.10)), '#000000', Math.round(titlePx * 0.18), false, true);
    this.levelButtons.push(title);

    // Персонализация для VK пользователей
    if (this.vkUserData && this.vkUserData.first_name) {
      const greeting = this.add.text(W/2, H*0.06, `Привет, ${this.vkUserData.first_name}!`, {
        fontFamily: window.THEME.font,
        fontSize: Math.round(titlePx * 0.5) + 'px',
        color: '#4ECDC4',
        fontStyle: '600'
      }).setOrigin(0.5);
      this.levelButtons.push(greeting);
    }

    // Общая статистика прогресса
    const stats = this.getStats();
    let statsText = `Пройдено: ${stats.completedLevels}/${stats.totalLevels}`;
    if (stats.totalStars > 0) {
      statsText += ` | Звезд: ${stats.totalStars}/${stats.maxStars}`;
    }

    const statsDisplay = this.add.text(W/2, H*0.17, statsText, {
      fontFamily: window.THEME.font,
      fontSize: Math.round(titlePx * 0.4) + 'px',
      color: '#B8B8B8',
      align: 'center'
    }).setOrigin(0.5);
    this.levelButtons.push(statsDisplay);

    const topY = H*0.24, bottomY = H*0.78;
    const areaH = bottomY - topY;
    const areaW = Math.min(W*0.90, 1080);
    const cellH = areaH / ROWS;
    const cellW = areaW / COLS;
    const gridLeft = (W - areaW) / 2;
    const gridTop  = topY;

    const startIdx = this.levelPage * PER_PAGE;
    const endIdx   = Math.min(startIdx + PER_PAGE, window.LEVELS.length);
    const pageLevels = window.LEVELS.slice(startIdx, endIdx);

    // Создание кнопок уровней с отображением прогресса
    pageLevels.forEach((lvl, i) => {
      const levelIndex = startIdx + i;
      const r = (i / COLS) | 0, c = i % COLS;
      const x = gridLeft + c * cellW + cellW/2;
      const y = gridTop  + r * cellH + cellH/2;
      const w = Math.min(320, cellW*0.9);
      const h = Math.min(200, cellH*0.86);

      this.createLevelButton(x, y, w, h, lvl, levelIndex);
    });

    const yNav = H*0.86;
    const size = Math.max(52, Math.round(H*0.06));
    const prevActive = this.levelPage > 0;
    const nextActive = this.levelPage < PAGES - 1;

    const prevBtn = window.makeIconButton(this, W*0.30, yNav, size, '‹', () => {
      if (prevActive) this.drawMenu(this.levelPage - 1);
    });
    prevBtn.setAlpha(prevActive?1:0.45); this.levelButtons.push(prevBtn);

    const pageTxt = this.add.text(W*0.5, yNav, `${this.levelPage+1} / ${PAGES}`, {
      fontFamily: window.THEME.font, fontSize: Math.round(Math.min(Math.max(size*0.30,14),22)) + 'px',
      color:'#E8E1C9', fontStyle:'600'
    }).setOrigin(0.5);
    this.levelButtons.push(pageTxt);

    const nextBtn = window.makeIconButton(this, W*0.70, yNav, size, '›', () => {
      if (nextActive) this.drawMenu(this.levelPage + 1);
    });
    nextBtn.setAlpha(nextActive?1:0.45); this.levelButtons.push(nextBtn);

    this._wheelHandler = (_p, _objs, _dx, dy) => {
      if (dy > 0 && nextActive) this.drawMenu(this.levelPage + 1);
      else if (dy < 0 && prevActive) this.drawMenu(this.levelPage - 1);
    };
    this.input.on('wheel', this._wheelHandler);
  }

  // Создание кнопки уровня с прогрессом
  createLevelButton(x, y, w, h, level, levelIndex) {
    // Контейнер для всех элементов уровня
    const levelContainer = this.add.container(x, y);

    // Получаем прогресс для этого уровня
    const progress = this.getProgress();
    const levelProgress = progress[levelIndex];

    // Основная кнопка уровня
    const btnY = -h*0.15; // Сдвигаем кнопку вверх, чтобы место для звезд
    const btn = window.makeImageButton(this, 0, btnY, w, h*0.7, level.label, () => {
      // Передаем VK данные в GameScene
      this.scene.start('GameScene', { 
        level: level, 
        page: this.levelPage,
        userData: this.vkUserData,
        isVK: this.isVKEnvironment
      });
    });

    levelContainer.add(btn);

    // Отображение звездочек и прогресса
    const starsY = h*0.25;
    const starSize = Math.min(22, w*0.08);
    const starSpacing = starSize + 6;

    if (levelProgress) {
      // Показываем заработанные звездочки
      for (let star = 1; star <= 3; star++) {
        const starX = (star - 2) * starSpacing;
        const filled = star <= levelProgress.stars;
        const starText = this.add.text(starX, starsY, filled ? '★' : '☆', {
          fontSize: starSize + 'px',
          color: filled ? '#FFD700' : '#444444'
        }).setOrigin(0.5);
        levelContainer.add(starText);
      }

      // Показываем лучшее время
      const timeText = this.add.text(0, starsY + 28, `⏱ ${this.formatTime(levelProgress.bestTime)}`, {
        fontFamily: window.THEME.font,
        fontSize: Math.round(starSize * 0.55) + 'px',
        color: '#4ECDC4'
      }).setOrigin(0.5);
      levelContainer.add(timeText);

      // Показываем точность
      const accuracyText = this.add.text(0, starsY + 42, `🎯 ${levelProgress.bestAccuracy}%`, {
        fontFamily: window.THEME.font,
        fontSize: Math.round(starSize * 0.55) + 'px',
        color: '#2ECC71'
      }).setOrigin(0.5);
      levelContainer.add(accuracyText);

    } else {
      // Уровень не пройден - показываем пустые звездочки
      for (let star = 1; star <= 3; star++) {
        const starX = (star - 2) * starSpacing;
        const starText = this.add.text(starX, starsY, '☆', {
          fontSize: starSize + 'px',
          color: '#333333'
        }).setOrigin(0.5);
        levelContainer.add(starText);
      }

      // Подсказка для непройденного уровня
      const hintText = this.add.text(0, starsY + 35, 'Не пройден', {
        fontFamily: window.THEME.font,
        fontSize: Math.round(starSize * 0.5) + 'px',
        color: '#666666'
      }).setOrigin(0.5);
      levelContainer.add(hintText);
    }

    this.levelButtons.push(levelContainer);
  }

  // Форматирование времени
  formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `${secs}с`;
  }

  // Диалог возрастных ограничений (улучшенный)
  showAgeRating() {
    const { W, H } = this.getSceneWH();
    
    // Затемнение фона
    const overlay = this.add.graphics()
      .fillStyle(0x000000, 0.8)
      .fillRect(0, 0, W, H)
      .setDepth(1000)
      .setInteractive();

    // Модальное окно
    const modalW = Math.min(400, W * 0.8);
    const modalH = Math.min(320, H * 0.7);
    const modal = this.add.graphics()
      .fillStyle(0x1a1a1a)
      .fillRoundedRect(W/2 - modalW/2, H/2 - modalH/2, modalW, modalH, 10)
      .lineStyle(2, 0x4a4a4a)
      .strokeRoundedRect(W/2 - modalW/2, H/2 - modalH/2, modalW, modalH, 10)
      .setDepth(1001);

    // Заголовок
    const title = this.add.text(W/2, H/2 - modalH/3, 'Возрастные ограничения', {
      fontFamily: window.THEME.font,
      fontSize: '22px',
      color: '#FFFFFF',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(1002);

    // Основной текст
    const text = this.add.text(W/2, H/2 - 20, 
      'Игра "Память: Найди пару"\nне содержит контента,\nзапрещенного для несовершеннолетних\n\n🔞 Возрастное ограничение: 0+\n\n✅ Безопасно для всей семьи', {
      fontFamily: window.THEME.font,
      fontSize: '16px',
      color: '#CCCCCC',
      align: 'center',
      lineSpacing: 8
    }).setOrigin(0.5).setDepth(1002);

    // Дополнительная информация для VK
    if (this.isVKEnvironment) {
      const vkInfo = this.add.text(W/2, H/2 + modalH/3 - 80, 
        '🔒 Данные обрабатываются согласно\nполитике конфиденциальности ВКонтакте', {
        fontFamily: window.THEME.font,
        fontSize: '12px',
        color: '#888888',
        align: 'center',
        lineSpacing: 4
      }).setOrigin(0.5).setDepth(1002);
    }

    // Кнопка "Понятно"
    const okButton = window.makeImageButton(
      this, W/2, H/2 + modalH/3 - 40, 
      140, 45, '✓ Понятно', 
      () => {
        overlay.destroy();
        modal.destroy();
        title.destroy();
        text.destroy();
        okButton.destroy();
        if (this.isVKEnvironment && vkInfo) vkInfo.destroy();
        this.drawMenu(this.levelPage);
      }
    );
    okButton.setDepth(1003);
  }

  // Синхронизация прогресса с VK
  async syncProgressWithVK() {
    if (!this.isVKEnvironment || !window.VKHelpers) return false;

    try {
      // Получаем данные из VK облака
      const result = await window.VKHelpers.getStorageData(['findpair_progress']);
      const vkProgress = result.keys && result.keys[0]?.value ? 
        JSON.parse(result.keys[0].value) : {};
      
      // Получаем локальные данные
      const localProgress = this.getProgress();
      
      // Мержим прогресс (берем лучший результат)
      const merged = { ...vkProgress };
      
      Object.keys(localProgress).forEach(levelIndex => {
        const local = localProgress[levelIndex];
        const vk = vkProgress[levelIndex];
        
        if (!vk || local.stars > vk.stars || 
            (local.stars === vk.stars && local.bestTime < vk.bestTime)) {
          merged[levelIndex] = local;
        }
      });
      
      // Сохраняем обратно в VK и локально
      await window.VKHelpers.setStorageData('findpair_progress', merged);
      localStorage.setItem('findpair_progress', JSON.stringify(merged));
      
      console.log('Progress synced with VK cloud');
      return true;
    } catch (error) {
      console.warn('Failed to sync progress with VK:', error);
      return false;
    }
  }
};
