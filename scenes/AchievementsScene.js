// --- scenes/AchievementsScene.js

window.AchievementsScene = class AchievementsScene extends Phaser.Scene {
  constructor() {
    super('AchievementsScene');
  }

  init(data) {
    this.levelPage = data?.page || 0;

    this.vkUserData = this.registry.get('vkUserData') ||
      data?.userData ||
      window.VK_USER_DATA;

    this.isVKEnvironment = this.registry.get('isVKEnvironment') ||
      data?.isVK ||
      !!window.VK_LAUNCH_PARAMS;

    this.syncManager = this.registry.get('progressSyncManager') ||
      window.progressSyncManager ||
      null;

    this.progress = {
      achievements: {},
      stats: {},
      levels: {}
    };

    this.items = [];
  }

  async create() {
    // TextManager
    this.textManager = new TextManager(this);

    this.ensureGradientBackground();

    // ждём шрифты, но с таймаутом
    if (document.fonts && document.fonts.ready) {
      try {
        await Promise.race([
          document.fonts.ready,
          new Promise(res => setTimeout(res, 2000))
        ]);
      } catch (e) {
        console.warn('AchievementsScene fonts timeout', e);
      }
    }

    await this.loadProgress();
    this.buildAchievementsConfig();
    this.drawUI();

    // реагируем на debounced-resize из main.js
    this.game.events.on('debounced-resize', this.handleResize, this);

    this.events.once('shutdown', this.cleanup, this);
    this.events.once('destroy', this.cleanup, this);
  }

  async loadProgress() {
    try {
      if (this.syncManager?.getProgress) {
        this.progress = await this.syncManager.getProgress();
      } else if (this.syncManager?.loadProgress) {
        this.progress = await this.syncManager.loadProgress();
      }
    } catch (e) {
      console.warn('AchievementsScene: loadProgress failed', e);
    }

    if (!this.progress || typeof this.progress !== 'object') {
      this.progress = { achievements: {}, stats: {}, levels: {} };
    }

    if (!this.progress.achievements) this.progress.achievements = {};
    if (!this.progress.stats) this.progress.stats = {};
    if (!this.progress.levels) this.progress.levels = {};
  }

  // Все возможные достижения – единый список
  buildAchievementsConfig() {
    this.achievementsConfig = [
      {
        id: 'first_win',
        icon: '🏆',
        title: 'Первая победа',
        description: 'Выиграйте любую игру хотя бы один раз.'
      },
      {
        id: 'perfect_game',
        icon: '🧠',
        title: 'Идеальная память',
        description: 'Пройдите уровень без единой ошибки.'
      },
      {
        id: 'speed_runner',
        icon: '⚡',
        title: 'Скоростной бегун',
        description: 'Завершите уровень за 30 секунд или быстрее.'
      },
      {
        id: 'expert',
        icon: '🎓',
        title: 'Эксперт памяти',
        description: 'Пройдите сложный уровень (12+ пар).'
      },
      {
        id: 'persistent',
        icon: '🎯',
        title: 'Упорство',
        description: 'Сыграйте как минимум 10 игр.'
      },
      {
        id: 'collector',
        icon: '📚',
        title: 'Коллекционер звёзд',
        description: 'Соберите суммарно 30 звёзд.'
      },
      {
        id: 'marathoner',
        icon: '🏃',
        title: 'Марафонец',
        description: 'Проведите в игре не менее часа.'
      }
    ];
  }

  getSceneWH() {
    const s = this.scale, cam = this.cameras?.main;
    const W = (s && (s.width ?? s.gameSize?.width)) ||
      cam?.width ||
      this.sys.game.config.width ||
      800;
    const H = (s && (s.height ?? s.gameSize?.height)) ||
      cam?.height ||
      this.sys.game.config.height ||
      600;
    return { W: Math.floor(W), H: Math.floor(H) };
  }

  ensureGradientBackground() {
    const { W, H } = this.getSceneWH();

    if (this.textures.exists('bg_menu')) {
      if (this.bgImage && this.bgImage.destroy) this.bgImage.destroy();
      const img = this.add.image(W / 2, H / 2, 'bg_menu')
        .setOrigin(0.5)
        .setDepth(-1000);
      const src = this.textures.get('bg_menu').getSourceImage();
      const scale = Math.max(W / src.width, H / src.height);
      img.setDisplaySize(src.width * scale, src.height * scale);
      this.bgImage = img;

      if (this.vignette && this.vignette.destroy) this.vignette.destroy();
      this.vignette = this.add.graphics()
        .setDepth(-999)
        .fillStyle(0x000000, 0.20)
        .fillRect(0, 0, W, H);
      return;
    }

    const key = 'bg-grad-achievements';
    const DPR = Math.min(2, Math.max(1, window._cachedDPR || window._DPR || 1));

    if (this.textures.exists(key)) {
      const src = this.textures.get(key).getSourceImage();
      if (src.width !== Math.round(W * DPR) || src.height !== Math.round(H * DPR)) {
        this.textures.remove(key);
      }
    }

    if (!this.textures.exists(key)) {
      const tex = this.textures.createCanvas(
        key,
        Math.max(2, Math.round(W * DPR)),
        Math.max(2, Math.round(H * DPR))
      );
      const ctx = tex.getContext();
      ctx.save();
      ctx.scale(DPR, DPR);

      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, window.THEME.bgTop);
      g.addColorStop(0.6, window.THEME.bgMid);
      g.addColorStop(1, window.THEME.bgBottom);

      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
      tex.refresh();
    }

    if (this.bgImage && this.bgImage.destroy) this.bgImage.destroy();
    this.bgImage = this.add.image(0, 0, key)
      .setOrigin(0, 0)
      .setDepth(-1000)
      .setDisplaySize(W, H);

    if (this.vignette && this.vignette.destroy) this.vignette.destroy();
    this.vignette = this.add.graphics()
      .setDepth(-999)
      .fillStyle(0x000000, 0.20)
      .fillRect(0, 0, W, H);
  }

  drawUI() {
    const { W, H } = this.getSceneWH();
    this.textManager.updateDimensions();

    // Заголовок
    const title = this.textManager.createText(
      W / 2,
      H * 0.06,
      'Достижения',
      'titleLarge'
    );
    title.setOrigin(0.5);
    title.setColor('#F2DC9B');
    this.items.push(title);

    // Кнопка "назад"
    const backSize = Math.round(H * 0.07);
    const backBtn = window.makeIconButton(
      this,
      backSize * 0.9 - 10 ,
      H * 0.07,
      backSize,
      '‹',
      () => {
        this.scene.start('MenuScene', { page: this.levelPage || 0 });
      },
      {
        color: '#F2DC9B',
        bgColor: '#243540',
        bgAlpha: 0.9,
        borderColor: '#F2DC9B',
        borderWidth: 2,
        borderAlpha: 0.9
      }
    );
    backBtn.setDepth(10);
    this.items.push(backBtn);



    // Список достижений
    const achievements = this.achievementsConfig || [];
    const count = achievements.length;
    if (!count) return;

        // 🔹 Простейшее определение мобильной версии
    const isMobile = !!(window.isMobile || (this.scale && this.scale.width <= 800));

    const topMargin    = H * 0.16;   // чуть ниже заголовка
    const bottomMargin = H * 0.06;   // отступ снизу
    const gap          = H * 0.015;  // расстояние между карточками

    const availableH = H - topMargin - bottomMargin - gap * (count - 1);

    // динамическая высота карточки с ограничениями
    let itemHeight = availableH / count;
    itemHeight = Phaser.Math.Clamp(itemHeight, 70, 110);

    // первая карточка (центр по Y)
    const startY = topMargin + itemHeight / 2;

    const listWidth = Math.min(W * 0.9, 700);
    const left = (W - listWidth) / 2;

    achievements.forEach((ach, i) => { 
      const unlocked = !!this.progress.achievements[ach.id];

      // центр карточки по Y
      const centerY = startY + i * (itemHeight + gap);
      const panelX  = left;
      const panelY  = centerY - itemHeight / 2;

      const container = this.add.container(0, 0);
      container.setDepth(5);

      // фон карточки
      const bg = this.add.graphics();
      const bgColor     = unlocked ? 0x243540 : 0x151A24;
      const borderColor = unlocked ? 0xF2DC9B : 0x3A475A;

      bg.fillStyle(bgColor, 0.95);
      bg.lineStyle(2, borderColor, 0.9);
      bg.fillRoundedRect(panelX, panelY, listWidth, itemHeight, 16);
      bg.strokeRoundedRect(panelX, panelY, listWidth, itemHeight, 16);

      container.add(bg);

      // иконка слева (по центру по вертикали)
      const icon = this.add.text(
        panelX + itemHeight * 0.4,
        centerY,
        ach.icon,
        {
          fontSize: Math.round(itemHeight * 0.45) + 'px'
        }
      ).setOrigin(0.5);
      container.add(icon);

      // заголовок
      const titleText = this.textManager.createText(
        panelX + itemHeight * 0.9,
        centerY - itemHeight * 0.22,
        ach.title,
        'achievementTitle'
      );
      titleText.setOrigin(0, 0.5);
      container.add(titleText);

      // описание
      // описание
      const descText = this.textManager.createText(
        panelX + itemHeight * 0.9,
        centerY + itemHeight * 0.18,
        ach.description,
        'achievementDescArial'
      );
      descText.setOrigin(0, 0.5);

      // 🔹 Мобильная версия: поменьше шрифт и жёсткий перенос в 2 строки
      if (isMobile) {
        // немного уменьшаем шрифт относительно высоты карточки
        const mobileFontSize = Math.round(itemHeight * 0.18);
        if (descText.setFontSize) {
          descText.setFontSize(mobileFontSize);
        }

        // ширина текста, чтобы он гарантированно ушёл в несколько строк
        const wrapWidth = listWidth - (itemHeight * 1.4) - 32; // отступы слева/справа
        if (descText.setStyle) {
          descText.setStyle({
            wordWrap: { width: wrapWidth, useAdvancedWrap: true }
          });
        } else if (typeof descText.wordWrapWidth !== 'undefined') {
          descText.wordWrapWidth = wrapWidth;
        }
      }

      container.add(descText);

      // статус справа (чуть выше центра)
      const statusY = centerY - itemHeight * (isMobile ? 0.12 : 0.08);
      const status = this.add.text(
        panelX + listWidth - 16,
        statusY,
        unlocked ? 'Получено' : 'Не получено',
        {
          fontFamily: 'Arial, sans-serif',
          fontSize: Math.round(itemHeight * 0.22) + 'px',
          color: unlocked ? '#27AE60' : '#7F8C8D',
          fontStyle: 'bold'
        }
      ).setOrigin(1, 0.5);
      container.add(status);


      // визуальное ослабление заблокированных
      if (!unlocked) {
        container.setAlpha(0.55);
      }

      this.items.push(container);
    });


  }

  async handleResize() {
    if (!this.scene.isActive()) return;

    this.ensureGradientBackground();

    // почистить старые элементы и нарисовать заново
    this.items.forEach(item => {
      if (item && item.destroy) {
        try { item.destroy(); } catch (e) {}
      }
    });
    this.items = [];

    this.drawUI();
  }

  cleanup() {
    this.game?.events?.off('debounced-resize', this.handleResize, this);

    this.items.forEach(item => {
      if (item && item.destroy) {
        try { item.destroy(); } catch (e) {}
      }
    });
    this.items = [];

    if (this.bgImage && this.bgImage.destroy) this.bgImage.destroy();
    if (this.vignette && this.vignette.destroy) this.vignette.destroy();
    this.bgImage = null;
    this.vignette = null;
  }
};
