//---scenes/GameScene.js - ПОЛНАЯ ВЕРСИЯ С ПРОГРЕССОМ И ЗВЁЗДОЧКАМИ

window.GameScene = class GameScene extends Phaser.Scene {
  
  constructor() { 
    super('GameScene'); 
  }

  init(data) {
    this.currentLevel = data?.level || null;
    this.levelPage = data?.page || 0;
    
    // VK данные из PreloadScene
    this.vkUserData = data?.userData || window.VK_USER_DATA;
    this.isVKEnvironment = data?.isVK || !!window.VK_LAUNCH_PARAMS;
    
    // Система достижений (локальная + VK)
    this.achievements = this.getAchievements();
    this.vkAchievementManager = window.VKAchievementManager || null;
    
    this.sessionStats = {
      gamesPlayed: 0,
      totalTime: 0,
      totalErrors: 0,
      perfectGames: 0
    };

    // ИСПРАВЛЕНО: Состояние игры для сохранения при resize
    this.gameState = {
      deck: null,           // Исходная колода (детерминированная)
      openedCards: [],      // Открытые карты
      matchedCards: [],     // Найденные пары
      gameStarted: false,   // Флаг начатой игры
      canResize: true,      // Можно ли делать resize
      isMemorizationPhase: false, // Фаза запоминания (5 сек)
      currentSeed: null     // Текущий seed для детерминированности
    };
    
    // Seed для детерминированной генерации
    this.gameSeed = this.generateSeed();
    this.gameState.currentSeed = this.gameSeed;

    console.log('🎮 GameScene init:', {
      isVK: this.isVKEnvironment,
      hasVKUser: !!this.vkUserData,
      hasVKAchievements: !!this.vkAchievementManager,
      seed: this.gameSeed
    });
  }

  // ДОБАВЛЕНО: Генерация детерминированного seed
  generateSeed() {
    const urlParams = new URLSearchParams(window.location.search);
    const urlSeed = urlParams.get('seed');
    
    if (urlSeed) {
      return parseInt(urlSeed, 36); // Для отладки: ?seed=abc123
    }
    
    // Детерминированный seed на основе уровня + случайность
    const levelHash = this.currentLevel ? 
      (this.currentLevel.cols * 1000 + this.currentLevel.rows) : 1;
    return (Date.now() + levelHash) % 2147483647;
  }

  // ДОБАВЛЕНО: Детерминированное перемешивание
  seededRandom(seed) {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  }

  shuffleWithSeed(array, seed) {
    const result = [...array];
    let currentSeed = seed;
    
    for (let i = result.length - 1; i > 0; i--) {
      currentSeed = (currentSeed * 1103515245 + 12345) & 0x7fffffff;
      const j = Math.floor(this.seededRandom(currentSeed) * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  _pxClamp(px, minPx, maxPx) { 
    return Math.round(Phaser.Math.Clamp(px, minPx, maxPx)); 
  }
  
  _pxByH(fraction, minPx, maxPx) { 
    const { H } = this.getSceneWH(); 
    return this._pxClamp(H * fraction, minPx, maxPx); 
  }
  
  getDPR() { 
    return Math.min(2.0, Math.max(1, (window.devicePixelRatio || 1))); 
  }

  _createHiDPICanvasTexture(key, w, h, drawFn) {
    const DPR = this.getDPR();
    const tex = this.textures.createCanvas(key, Math.max(2, Math.round(w*DPR)), Math.max(2, Math.round(h*DPR)));
    const ctx = tex.getContext();
    ctx.save(); ctx.scale(DPR, DPR); drawFn(ctx, w, h); ctx.restore();
    tex.refresh();
    return tex;
  }

  preload() {}

  create() {
    if (this.scale && this.scale.updateBounds) this.scale.updateBounds();

    this.levelButtons = [];
    this.cards = [];
    this.opened = [];
    this.canClick = false;

    this.hud = null;
    this.mistakeCount = 0;
    this.mistakeText = null;
    
    // UI элементы для времени
    this.timeText = null;
    this.gameTimer = null;
    this.currentTimeSeconds = 0;

    this._wheelHandler = null;
    this.bgImage = null;
    this._texId = 0;

    // ДОБАВЛЕНО: Таймеры для управления
    this.memorizeTimer = null;
    this.flipTimer = null;

    this.makePlaceholdersIfNeeded();
    this.ensureGradientBackground();

    if (!this.currentLevel) {
      this.scene.start('MenuScene', { page: this.levelPage });
      return;
    }

    this.startGame(this.currentLevel);

    // ИСПРАВЛЕНО: Правильная обработка resize - не перетасовывать карты
    this.scale.on('resize', () => {
      if (this.scale && this.scale.updateBounds) this.scale.updateBounds();
      
      console.log('Resize detected, gameStarted:', this.gameState.gameStarted);
      
      if (!this.gameState.canResize) {
        console.log('Resize blocked during critical game phase');
        return;
      }

      this.ensureGradientBackground();
      
      if (this.gameState.gameStarted || this.gameState.isMemorizationPhase) {
        // Сохраняем состояние игры перед resize
        this.saveGameState();
        // Перерисовываем только layout, не меняя логику игры
        this.redrawLayout();
      } else {
        // Игра еще не началась, можно пересоздать
        this.startGame(this.currentLevel);
      }
    });
    
    this.events.once('shutdown', this.cleanup, this);
    this.events.once('destroy', this.cleanup, this);
  }

  // ДОБАВЛЕНО: Полная очистка при завершении сцены
  cleanup() {
    console.log('GameScene cleanup started');
    
    // Очистка всех таймеров
    if (this.memorizeTimer) {
      this.memorizeTimer.destroy();
      this.memorizeTimer = null;
    }
    
    if (this.flipTimer) {
      this.flipTimer.destroy();
      this.flipTimer = null;
    }
    
    if (this.gameTimer) {
      this.gameTimer.destroy();
      this.gameTimer = null;
    }

    // Очистка слушателей карт
    if (this.cards) {
      this.cards.forEach(card => {
        if (card && card.removeAllListeners) {
          card.removeAllListeners();
        }
      });
      this.cards = [];
    }

    // Очистка слушателей кнопок
    if (this.exitBtn && this.exitBtn.zone) {
      this.exitBtn.zone.removeAllListeners();
    }

    // Очистка resize слушателя
    this.scale.off('resize');

    // Очистка переменных
    this.opened = [];
    this.currentLevel = null;
    this.gameMetrics = null;
    this._lastClickTime = null;
    this._processingCards = false;
    
    console.log('GameScene cleanup completed');
  }

  // ДОБАВЛЕНО: Сохранение состояния игры
  saveGameState() {
    if (!this.cards.length) return;
    
    this.gameState.openedCards = this.cards
      .map((card, index) => ({
        index,
        key: card.getData('key'),
        opened: card.getData('opened'),
        matched: card.getData('matched')
      }))
      .filter(cardData => cardData.opened || cardData.matched);
      
    console.log('Game state saved:', this.gameState.openedCards.length, 'special cards');
  }

  // ДОБАВЛЕНО: Перерисовка layout без изменения игровой логики
  redrawLayout() {
    if (!this.gameState.deck || !this.currentLevel) {
      console.warn('Cannot redraw: missing deck or level');
      return;
    }

    console.log('Redrawing layout with preserved state...');
    
    // Сохраняем текущее состояние
    const currentOpenedState = this.cards.map(card => ({
      opened: card.getData('opened'),
      matched: card.getData('matched')
    }));

    const wasMemorizing = this.gameState.isMemorizationPhase;
    const currentTime = this.currentTimeSeconds;
    const wasGameStarted = this.gameState.gameStarted;

    // ИСПРАВЛЕНО: Останавливаем все активные процессы перед очисткой
    this.stopAllActiveProcesses();
    
    // Очищаем визуальные элементы безопасно
    this.clearVisualElements();
    
    // Перерисовываем карты с тем же deck
    this.createCardLayout(this.gameState.deck);
    
    // Восстанавливаем состояние карт
    this.cards.forEach((card, index) => {
      if (currentOpenedState[index]) {
        card.setData('opened', currentOpenedState[index].opened);
        card.setData('matched', currentOpenedState[index].matched);
        
        // Визуально показываем состояние
        if (wasMemorizing || currentOpenedState[index].opened || currentOpenedState[index].matched) {
          card.setTexture(card.getData('key'));
        } else {
          card.setTexture('back');
        }

        // Восстанавливаем интерактивность
        if (currentOpenedState[index].matched) {
          card.setAlpha(THEME.cardDimAlpha).disableInteractive();
        } else if (!wasMemorizing && wasGameStarted) {
          card.setInteractive({ useHandCursor: true });
        }
      }
    });
    
    // Восстанавливаем состояние игры
    this.gameState.gameStarted = wasGameStarted;
    this.gameState.isMemorizationPhase = wasMemorizing;
    
    // Перерисовываем HUD
    this.drawHUD();
    
    // Восстанавливаем таймер
    if (wasGameStarted && !wasMemorizing) {
      this.currentTimeSeconds = currentTime;
      if (this.timeText) {
        this.timeText.setText(this.formatTime(this.currentTimeSeconds));
      }
      this.startGameTimer();
    }
    
    console.log('Layout redrawn, game state preserved');
  }

  // ДОБАВЛЕНО: Остановка всех активных процессов
  stopAllActiveProcesses() {
    // Останавливаем таймер
    this.stopGameTimer();
    
    // Останавливаем таймеры запоминания
    if (this.memorizeTimer) {
      this.memorizeTimer.destroy();
      this.memorizeTimer = null;
    }
    
    if (this.flipTimer) {
      this.flipTimer.destroy();
      this.flipTimer = null;
    }
    
    // Отменяем все активные задержки
    if (this.time && this.time.delayedCall) {
      this.time.removeAllEvents();
    }
    
    // Сбрасываем флаги обработки
    this.canClick = false;
    this._processingCards = false;
    
    // Очищаем массив открытых карт
    this.opened = [];
  }

  // ДОБАВЛЕНО: Безопасная очистка визуальных элементов
  clearVisualElements() {
    // ИСПРАВЛЕНО: Безопасное уничтожение карт
    if (this.cards && Array.isArray(this.cards)) {
      this.cards.forEach(card => {
        if (card && card.scene) { // Проверяем что объект еще существует
          card.destroy();
        }
      });
    }
    this.cards = [];
    
    this.clearHUD();
  }

  getSceneWH() {
    const s = this.scale, cam = this.cameras?.main;
    const W = (s && (s.width ?? s.gameSize?.width)) || cam?.width || this.sys.game.config.width || 800;
    const H = (s && (s.height ?? s.gameSize?.height)) || cam?.height || this.sys.game.config.height || 600;
    return { W: Math.floor(W), H: Math.floor(H) };
  }

  // Система достижений
  getAchievements() {
    // Если есть VK менеджер достижений, используем его
    if (this.vkAchievementManager) {
      return this.vkAchievementManager.achievements;
    }
    
    // Иначе используем localStorage
    const saved = localStorage.getItem('findpair_achievements');
    return saved ? JSON.parse(saved) : {
      first_win: false,
      perfect_game: false,
      speed_runner: false,
      persistent: false,
      expert: false
    };
  }

  async saveAchievements() {
    try {
      if (this.vkAchievementManager) {
        // Сохраняем через VK менеджер
        this.vkAchievementManager.achievements = this.achievements;
        await this.vkAchievementManager.saveAchievements();
      } else {
        // Локальное сохранение
        localStorage.setItem('findpair_achievements', JSON.stringify(this.achievements));
      }
    } catch (error) {
      console.warn('⚠️ Failed to save achievements:', error);
      // Fallback к localStorage
      localStorage.setItem('findpair_achievements', JSON.stringify(this.achievements));
    }
  }

  // Форматирование времени
  formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `${secs}с`;
  }

  // УЛУЧШЕНО: Обновление HUD с таймером
  drawHUD() {
    this.clearHUD();
    const { W, H } = this.getSceneWH();
    const hudH = Math.min(100, Math.round(H * 0.12));

    // Фон HUD
    const hud = this.add.graphics().setDepth(5);
    hud.fillStyle(0x000000, 0.85);
    hud.fillRoundedRect(0, 0, W, hudH, 0);
    this.hud = hud;

    const fontSize = this._pxByH(0.035, 14, 20);

    // Счетчик ошибок слева
    this.mistakeText = this.add.text(20, hudH/2, 'Ошибок: ' + this.mistakeCount, {
      fontFamily: THEME.font, fontSize: fontSize + 'px', color: '#FF6B6B', fontStyle: '600'
    }).setOrigin(0, 0.5).setDepth(6);

    // Таймер по центру
    this.timeText = this.add.text(W/2, hudH/2, this.formatTime(this.currentTimeSeconds), {
      fontFamily: THEME.font, fontSize: (fontSize + 2) + 'px', color: '#4ECDC4', fontStyle: '700'
    }).setOrigin(0.5, 0.5).setDepth(6);

    // Кнопка домой справа
    const size = Math.round(hudH * 0.76);
    const homeBtn = window.makeIconButton(
      this, W - (size/2 + 14), Math.round(hudH/2), size,
      '⌂',
      () => { 
        this.stopGameTimer();
        this.scene.start('MenuScene', { page: this.levelPage }); 
      }
    );
    homeBtn.setDepth(7);
    this.exitBtn = homeBtn;
  }

  clearHUD() {
    // ИСПРАВЛЕНО: Безопасное удаление UI элементов
    if (this.hud && this.hud.scene) this.hud.destroy();
    if (this.mistakeText && this.mistakeText.scene) this.mistakeText.destroy();
    if (this.timeText && this.timeText.scene) this.timeText.destroy();
    if (this.exitBtn && this.exitBtn.scene) this.exitBtn.destroy();
    this.hud = this.mistakeText = this.timeText = this.exitBtn = null;
  }

  // Управление таймером
  startGameTimer() {
    // ИСПРАВЛЕНО: Предотвращаем создание множественных таймеров
    if (this.gameTimer) {
      this.gameTimer.destroy();
      this.gameTimer = null;
    }
    
    this.gameTimer = this.time.addEvent({
      delay: 1000,
      callback: () => {
        this.currentTimeSeconds++;
        // ИСПРАВЛЕНО: Проверяем существование элемента перед обновлением
        if (this.timeText && this.timeText.scene) {
          this.timeText.setText(this.formatTime(this.currentTimeSeconds));
        }
      },
      loop: true
    });
  }

  stopGameTimer() {
    if (this.gameTimer) {
      this.gameTimer.destroy();
      this.gameTimer = null;
    }
  }

  startGame(level) {
    console.log('🚀 Starting game with level:', level);
    
    if (!level || !level.cols || !level.rows) {
      console.error('Invalid level data:', level);
      this.scene.start('MenuScene', { page: this.levelPage });
      return;
    }
       
    this.currentLevel = level;
    this.mistakeCount = 0;
    this.currentTimeSeconds = 0;

    const total = level.cols * level.rows;
    if (total % 2 !== 0) {
      console.error('Нечётное число ячеек в сетке', level);
      this.scene.start('MenuScene', { page: this.levelPage });
      return;
    }

    // Расширенные метрики игры
    this.gameMetrics = {
      startTime: null, // Стартует после показа карт
      attempts: 0,
      errors: 0,
      pairs: Math.floor(total / 2),
      level: level,
      timeToFirstMatch: null,
      matchTimes: []
    };  

    // ИСПРАВЛЕНО: Детерминированная генерация колоды только если её еще нет
    if (!this.gameState.deck || this.gameState.currentSeed !== this.gameSeed) {
      const pairs = Math.floor(total / 2);
      const shuffledKeys = this.shuffleWithSeed([...window.ALL_CARD_KEYS], this.gameSeed);
      const base = Array.from({length: pairs}, (_, i) => 
        shuffledKeys[i % shuffledKeys.length]);
      
      // Создаем пары и перемешиваем их детерминированно
      this.gameState.deck = this.shuffleWithSeed(
        base.concat(base), 
        this.gameSeed + 1000 // Другой seed для финального перемешивания
      );
      
      this.gameState.currentSeed = this.gameSeed;
      
      console.log('Generated deterministic deck with seed:', this.gameSeed);
    }

    // ИСПРАВЛЕНО: Останавливаем все процессы перед очисткой
    this.stopAllActiveProcesses();
    this.clearVisualElements();
    this.ensureGradientBackground();
    
    this.opened = [];
    this.canClick = false;
    this.gameState.gameStarted = false;
    this.gameState.isMemorizationPhase = true;
    this.gameState.canResize = false; // Блокируем resize на время показа

    this.drawHUD();
    this.createCardLayout(this.gameState.deck);

    // ДОБАВЛЕНО: 5-секундный показ карт для запоминания
    this.showCardsForMemorization();
  }

  // ДОБАВЛЕНО: Создание layout карт
  createCardLayout(deck) {
    const level = this.currentLevel;
    const { W, H } = this.getSceneWH();
    const hudH = Math.min(100, Math.round(H * 0.12));
    const gameAreaH = H - hudH - 20;
    
    const maxCardW = Math.min(140, (W - 40) / level.cols - 10);
    const maxCardH = Math.min(190, gameAreaH / level.rows - 10);
    
    const cardW = Math.min(maxCardW, maxCardH * 0.7);
    const cardH = Math.min(maxCardH, maxCardW / 0.7);
    
    const totalW = level.cols * cardW + (level.cols - 1) * 8;
    const totalH = level.rows * cardH + (level.rows - 1) * 8;
    
    const offsetX = (W - totalW) / 2;
    const offsetY = hudH + 20 + (gameAreaH - totalH) / 2;

    for (let row = 0; row < level.rows; row++) {
      for (let col = 0; col < level.cols; col++) {
        const index = row * level.cols + col;
        const key = deck[index];
        
        const x = offsetX + col * (cardW + 8) + cardW/2;
        const y = offsetY + row * (cardH + 8) + cardH/2;
        
        const card = this.add.image(x, y, key) // НАЧИНАЕМ ЛИЦОМ!
          .setDisplaySize(cardW, cardH)
          .setData('key', key)
          .setData('opened', false)
          .setData('matched', false)
          .setInteractive({ useHandCursor: true })
          .on('pointerdown', () => this.onCardClick(card));
        
        this.cards.push(card);
      }
    }
  }

  // ДОБАВЛЕНО: 5-секундный показ карт для запоминания
  showCardsForMemorization() {
    console.log('🧠 Showing cards for memorization (5 seconds)...');
    
    const { W, H } = this.getSceneWH();
    
    // Блокируем resize во время показа карт
    this.gameState.canResize = false;
    this.gameState.isMemorizationPhase = true;
    
    // Показываем все карты лицом (они уже такие после createCardLayout)
    this.cards.forEach(card => {
      card.setTexture(card.getData('key'));
      card.disableInteractive(); // Отключаем клики на время запоминания
    });

    // Показываем уведомление
    const notification = this.add.text(W/2, H*0.15, 'Запомните карты!', {
      fontFamily: THEME.font,
      fontSize: this._pxByH(0.05, 24, 32) + 'px',
      color: '#FFD700',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(1000);

    // Обратный отсчёт
    let countdown = 5;
    const countdownText = this.add.text(W/2, H*0.22, countdown.toString(), {
      fontFamily: THEME.font,
      fontSize: this._pxByH(0.08, 36, 48) + 'px',
      color: '#FF4444',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(1000);

    // Таймер обратного отсчёта
    this.memorizeTimer = this.time.addEvent({
      delay: 1000,
      repeat: 4,
      callback: () => {
        countdown--;
        if (countdown > 0) {
          countdownText.setText(countdown.toString());
          // Анимация пульсации
          this.tweens.add({
            targets: countdownText,
            scale: 1.3,
            duration: 200,
            yoyo: true,
            ease: 'Power2'
          });
        } else {
          // Скрываем интерфейс обратного отсчёта
          notification.destroy();
          countdownText.destroy();
          
          // Переворачиваем все карты
          this.flipAllCardsAndStartGame();
        }
      }
    });
  }

  // ДОБАВЛЕНО: Переворот карт и начало игры
  flipAllCardsAndStartGame() {
    console.log('🔄 Flipping all cards and starting game...');
    
    // Анимированное переворачивание карт
    this.cards.forEach((card, index) => {
      this.tweens.add({
        targets: card,
        scaleX: 0,
        duration: 200,
        delay: index * 30, // каскадный эффект
        ease: 'Power2.easeIn',
        onComplete: () => {
          card.setTexture('back');
          this.tweens.add({
            targets: card,
            scaleX: 1,
            duration: 200,
            ease: 'Power2.easeOut'
          });
        }
      });
    });

    // Финальная настройка после переворота
    this.flipTimer = this.time.delayedCall(1000, () => {
      // Включаем интерактивность карт
      this.cards.forEach(card => {
        card.setInteractive({ useHandCursor: true });
      });
      
      this.canClick = true;
      this.gameState.gameStarted = true;
      this.gameState.isMemorizationPhase = false;
      this.gameState.canResize = true; // Разблокируем resize после начала игры
      
      // ВАЖНО: Запускаем таймер игры только после показа карт
      this.gameMetrics.startTime = Date.now();
      this.startGameTimer();
      
      console.log('✅ Game fully started, timer running, clicks enabled');
    });
  }

  onCardClick(card) {
    if (!this.canClick || this._processingCards) return;
    if (card.getData('opened') || card.getData('matched')) return;

    // УЛУЧШЕННАЯ защита от быстрых кликов
    const now = Date.now();
    if (this._lastClickTime && now - this._lastClickTime < 250) {
      console.log('Click ignored - too fast');
      return;
    }
    this._lastClickTime = now;
    
    // Блокируем дальнейшие клики на время обработки
    this._processingCards = true;
    
    this.gameMetrics.attempts++;

    card.setTexture(card.getData('key'));
    card.setData('opened', true);
    this.opened.push(card);

    if (this.opened.length === 2) {
      this.canClick = false;
      
      // ИСПРАВЛЕНО: Используем delayedCall вместо setTimeout
      const checkTimer = this.time.delayedCall(450, () => {
        const [a, b] = this.opened;
        if (a.getData('key') === b.getData('key')) {
          // Трекинг времени матчей
          const matchTime = (Date.now() - this.gameMetrics.startTime) / 1000;
          this.gameMetrics.matchTimes.push(matchTime);
          
          if (this.gameMetrics.timeToFirstMatch === null) {
            this.gameMetrics.timeToFirstMatch = matchTime;
          }
          
          a.setData('matched', true).setAlpha(THEME.cardDimAlpha).disableInteractive();
          b.setData('matched', true).setAlpha(THEME.cardDimAlpha).disableInteractive();
          a.setData('opened', false); 
          b.setData('opened', false);
        } else {
          this.mistakeCount++;
          this.gameMetrics.errors++;
          if (this.mistakeText) this.mistakeText.setText('Ошибок: ' + this.mistakeCount);
          a.setTexture('back').setData('opened', false);
          b.setTexture('back').setData('opened', false);
        }
        
        this.opened = [];
        this.canClick = true;
        this._processingCards = false;

        if (this.cards.every(c => c.getData('matched'))) {
          this.showWin();
        }
      });
      
      // Сохраняем ссылку на таймер для возможной очистки
      this.gameTimer = checkTimer;
    } else {
      // Если открыта только одна карта
      this._processingCards = false;
    }
  }

  // УЛУЧШЕНО: Экран победы с системой прогресса и звёздочками
  showWin() {
    this.canClick = false;
    this.gameState.gameStarted = false; // Игра завершена
    this.stopGameTimer(); // Останавливаем таймер
    this.cards.forEach(c => c.disableInteractive());

    const gameTime = this.currentTimeSeconds;
    const accuracy = this.gameMetrics.attempts > 0 ? 
      Math.round((1 - this.gameMetrics.errors / this.gameMetrics.attempts) * 100) : 100;

    // ДОБАВЛЕНО: Сохранение прогресса с системой звёздочек
    const levelIndex = window.LEVELS.findIndex(l => l === this.currentLevel);
    const progressResult = this.saveProgress(levelIndex, gameTime, this.gameMetrics.attempts, this.gameMetrics.errors);

    // Проверка достижений
    this.checkAchievements(gameTime, this.gameMetrics.errors, this.currentLevel);

    // Отправляем статистику завершенной игры в VK
    this.sendVKGameStats(gameTime, accuracy);

    console.log('🏆 Game finished:', {
      time: gameTime,
      attempts: this.gameMetrics.attempts,
      errors: this.gameMetrics.errors,
      accuracy: accuracy,
      stars: progressResult.stars,
      improved: progressResult.improved
    });

    const { W, H } = this.getSceneWH();

    // Полупрозрачный фон
    const overlay = this.add.graphics().setDepth(100);
    overlay.fillStyle(0x000000, 0.8);
    overlay.fillRect(0, 0, W, H);

    // Красивое окно результатов
    const panelW = Math.min(500, W * 0.9);
    const panelH = Math.min(450, H * 0.8);
    const panelX = W/2;
    const panelY = H/2;

    const panel = this.add.graphics().setDepth(101);
    panel.fillStyle(0x2C3E50, 0.95);
    panel.lineStyle(3, 0x3498DB, 0.8);
    panel.fillRoundedRect(panelX - panelW/2, panelY - panelH/2, panelW, panelH, 20);
    panel.strokeRoundedRect(panelX - panelW/2, panelY - panelH/2, panelW, panelH, 20);

    // Заголовок
    this.add.text(panelX, panelY - panelH/2 + 50, '🎉 ПОБЕДА! 🎉', {
      fontFamily: THEME.font, 
      fontSize: this._pxByH(0.06, 24, 42) + 'px', 
      color: '#F39C12', 
      fontStyle: '800'
    }).setOrigin(0.5).setDepth(102);

    // ДОБАВЛЕНО: Отображение звёздочек
    this.showStarsAnimation(panelX, panelY - panelH/2 + 100, progressResult);

    // Детальная статистика
    const statsY = panelY - panelH/2 + 160;
    const lineHeight = 30;
    
    this.add.text(panelX, statsY, `⏱️ Время: ${this.formatTime(gameTime)}`, {
      fontFamily: THEME.font, fontSize: '18px', color: '#4ECDC4', fontStyle: '600'
    }).setOrigin(0.5).setDepth(102);

    this.add.text(panelX, statsY + lineHeight, `🎯 Попыток: ${this.gameMetrics.attempts}`, {
      fontFamily: THEME.font, fontSize: '16px', color: '#E8E1C9', fontStyle: '500'
    }).setOrigin(0.5).setDepth(102);

    this.add.text(panelX, statsY + lineHeight * 2, `❌ Ошибок: ${this.mistakeCount}`, {
      fontFamily: THEME.font, fontSize: '16px', color: '#E74C3C', fontStyle: '500'
    }).setOrigin(0.5).setDepth(102);

    this.add.text(panelX, statsY + lineHeight * 3, `📊 Точность: ${accuracy}%`, {
      fontFamily: THEME.font, fontSize: '16px', color: '#2ECC71', fontStyle: '500'
    }).setOrigin(0.5).setDepth(102);

    // ДОБАВЛЕНО: Показываем улучшение результата
    if (progressResult.improved) {
      this.add.text(panelX, statsY + lineHeight * 4, '🆕 Новый рекорд!', {
        fontFamily: THEME.font, fontSize: '18px', color: '#F39C12', fontStyle: '700'
      }).setOrigin(0.5).setDepth(102);
    }

    // Кнопки
    const btnY = panelY + panelH/2 - 60;
    const btnW = Math.min(160, panelW * 0.35);
    const btnH = 45;

    // Кнопка "Ещё раз"
    const playAgainBtn = window.makeImageButton(
      this, panelX - btnW/2 - 10, btnY, btnW, btnH,
      '🔄 Ещё раз',
      () => this.restartLevel()
    );
    playAgainBtn.setDepth(102);

    // Кнопка "Меню"
    const menuBtn = window.makeImageButton(
      this, panelX + btnW/2 + 10, btnY, btnW, btnH,
      '🏠 Меню',
      () => {
        this.gameState.gameStarted = false;
        this.scene.start('MenuScene', { page: this.levelPage });
      }
    );
    menuBtn.setDepth(102);
  }

  // ДОБАВЛЕНО: Система сохранения прогресса с звёздочками
  saveProgress(levelIndex, gameTime, attempts, errors) {
    const accuracy = attempts > 0 ? (attempts - errors) / attempts : 0;
    
    // Расчёт звёздочек (1-3 звезды)
    let stars = 1; // минимум 1 звезда за прохождение
    
    if (accuracy >= 0.9 && gameTime <= 60) stars = 3;      // отлично
    else if (accuracy >= 0.8 && gameTime <= 90) stars = 2; // хорошо
    
    // Получаем текущий прогресс
    const progress = this.getProgress();
    
    // Обновляем только если результат лучше
    const current = progress[levelIndex];
    const improved = !current || stars > current.stars || 
      (stars === current.stars && gameTime < current.bestTime);
    
    if (improved) {
      progress[levelIndex] = {
        stars,
        bestTime: gameTime,
        bestAccuracy: Math.round(accuracy * 100),
        attempts,
        errors,
        completedAt: Date.now()
      };
      
      // Сохраняем прогресс
      try {
        localStorage.setItem('findpair_progress', JSON.stringify(progress));
        
        // Также синхронизируем с VK если доступно
        if (this.isVKEnvironment && window.VKHelpers) {
          window.VKHelpers.setStorageData('findpair_progress', progress)
            .catch(err => console.warn('VK sync failed:', err));
        }
      } catch (e) {
        console.warn('Failed to save progress:', e);
      }
    }
    
    return { stars, improved, currentBest: progress[levelIndex] };
  }

  // ДОБАВЛЕНО: Получение прогресса
  getProgress() {
    try {
      const saved = localStorage.getItem('findpair_progress');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      console.warn('Error loading progress:', e);
      return {};
    }
  }

  // ДОБАВЛЕНО: Анимация звёздочек
  showStarsAnimation(x, y, progressResult) {
    const { stars, improved } = progressResult;
    const starSize = 32;
    const starSpacing = 50;
    
    for (let i = 1; i <= 3; i++) {
      const starX = x + (i - 2) * starSpacing;
      const filled = i <= stars;
      const star = this.add.text(starX, y, filled ? '★' : '☆', {
        fontSize: `${starSize}px`,
        color: filled ? '#FFD700' : '#666666'
      }).setOrigin(0.5).setDepth(102);
      
      if (filled && improved) {
        // Анимация новых звёздочек
        star.setScale(0);
        this.tweens.add({
          targets: star,
          scale: 1.3,
          duration: 400,
          delay: i * 200,
          ease: 'Back.easeOut',
          yoyo: true,
          repeat: 0,
          onComplete: () => {
            star.setScale(1);
            // Добавляем блеск
            this.createStarSparkle(starX, y);
          }
        });
      }
    }
    
    // Текст с количеством звёзд
    const starsText = `${stars}/3 ⭐`;
    this.add.text(x, y + 40, starsText, {
      fontFamily: THEME.font,
      fontSize: '16px',
      color: '#F39C12',
      fontStyle: '600'
    }).setOrigin(0.5).setDepth(102);
  }

  // ДОБАВЛЕНО: Эффект блеска звёзд
  createStarSparkle(x, y) {
    const sparkles = ['✨', '⭐', '💫'];
    
    for (let i = 0; i < 3; i++) {
      const sparkle = this.add.text(x, y, sparkles[i % sparkles.length], {
        fontSize: '16px'
      }).setOrigin(0.5).setDepth(103);
      
      const angle = (i / 3) * Math.PI * 2;
      const distance = 30;
      
      this.tweens.add({
        targets: sparkle,
        x: x + Math.cos(angle) * distance,
        y: y + Math.sin(angle) * distance,
        alpha: 0,
        scale: 1.5,
        duration: 600,
        ease: 'Power2',
        onComplete: () => sparkle.destroy()
      });
    }
  }

  // Перезапуск уровня
  restartLevel() {
    this.gameState.gameStarted = false;
    this.gameState.deck = null; // Очищаем сохраненную колоду для новой генерации
    this.gameSeed = this.generateSeed(); // Новый seed
    this.startGame(this.currentLevel);
  }

  // Проверка достижений с VK интеграцией
  async checkAchievements(gameTime, errors, level) {
    let newAchievements = [];
    
    // Первая победа
    if (!this.achievements.first_win) {
      this.achievements.first_win = true;
      newAchievements.push({
        id: 'first_win',
        title: 'Первая победа!',
        description: 'Найдите все пары в первый раз'
      });
    }
    
    // Идеальная игра (без ошибок)
    if (errors === 0 && !this.achievements.perfect_game) {
      this.achievements.perfect_game = true;
      newAchievements.push({
        id: 'perfect_game',
        title: 'Идеальная игра!',
        description: 'Пройдите уровень без ошибок'
      });
    }
    
    // Скоростное прохождение
    if (gameTime < 30 && !this.achievements.speed_runner) {
      this.achievements.speed_runner = true;
      newAchievements.push({
        id: 'speed_runner',
        title: 'Скоростной бегун!',
        description: 'Пройдите уровень за 30 секунд'
      });
    }
    
    // Эксперт (сложный уровень)
    const totalPairs = level.cols * level.rows / 2;
    if (totalPairs >= 9 && !this.achievements.expert) {
      this.achievements.expert = true;
      newAchievements.push({
        id: 'expert',
        title: 'Эксперт памяти!',
        description: 'Пройдите сложный уровень'
      });
    }
    
    // Упорство (много игр подряд)
    this.sessionStats.gamesPlayed++;
    if (this.sessionStats.gamesPlayed >= 5 && !this.achievements.persistent) {
      this.achievements.persistent = true;
      newAchievements.push({
        id: 'persistent',
        title: 'Упорство!',
        description: 'Сыграйте 5 игр подряд'
      });
    }
    
    // Сохраняем достижения
    if (newAchievements.length > 0) {
      await this.saveAchievements();
      
      // Разблокируем достижения в VK (если доступно)
      if (this.vkAchievementManager) {
        for (const achievement of newAchievements) {
          try {
            const unlocked = await this.vkAchievementManager.unlockAchievement(achievement.id);
            if (unlocked) {
              console.log('🏆 VK Achievement unlocked:', achievement.title);
            }
          } catch (error) {
            console.warn('⚠️ VK achievement unlock failed:', error);
          }
        }
      }
      
      // Показываем уведомления о достижениях
      this.showAchievements(newAchievements);
      
      // VK специфичные действия
      await this.handleVKAchievements(newAchievements);
    }
  }

  // ДОБАВЛЕНО: VK обработка достижений
  async handleVKAchievements(newAchievements) {
    if (!this.isVKEnvironment || !window.VKSafe || !window.VKSafe.send) return;
    
    try {
      // Тактильная обратная связь при получении достижения
      if (window.VKSafe.supports && window.VKSafe.supports('VKWebAppTapticNotificationOccurred')) {
        await window.VKSafe.send('VKWebAppTapticNotificationOccurred', {
          type: 'success'
        });
      }
      
      // Отправляем статистику во VK
      if (window.VKSafe.supports && window.VKSafe.supports('VKWebAppStorageSet')) {
        const stats = {
          totalGames: this.sessionStats.gamesPlayed,
          totalAchievements: Object.values(this.achievements).filter(Boolean).length,
          lastPlayed: Date.now()
        };
        
        await window.VKSafe.send('VKWebAppStorageSet', {
          key: 'game_stats',
          value: JSON.stringify(stats)
        });
      }
      
      // Предлагаем поделиться особыми достижениями
      const specialAchievements = ['first_win', 'perfect_game', 'speed_runner'];
      const hasSpecial = newAchievements.some(a => specialAchievements.includes(a.id));
      
      if (hasSpecial && Math.random() < 0.3) { // 30% шанс предложить поделиться
        this.showVKShareDialog(newAchievements[0]);
      }
      
    } catch (error) {
      console.warn('⚠️ VK achievement handling failed:', error);
    }
  }

  // ДОБАВЛЕНО: VK диалог поделиться
  async showVKShareDialog(achievement) {
    try {
      const userName = this.vkUserData?.first_name || 'Игрок';
      const message = `${userName} получил достижение "${achievement.title}" в игре "Find the Pair"! 🏆\n\n${achievement.description}`;
      
      // Показываем диалог поста на стену
      if (window.VKSafe.supports && window.VKSafe.supports('VKWebAppShowWallPostBox')) {
        await window.VKSafe.send('VKWebAppShowWallPostBox', {
          message: message,
          attachments: window.location.href
        });
      }
    } catch (error) {
      // Пользователь отменил или нет разрешений
      console.log('VK sharing cancelled');
    }
  }

  // Показ достижений с красивой анимацией
  showAchievements(achievements) {
    const { W, H } = this.getSceneWH();
    
    achievements.forEach((achievement, index) => {
      // Создаем более красивое уведомление
      const bgWidth = 320;
      const bgHeight = 80;
      const x = W / 2;
      const y = 100 + index * 100;
      
      // Фон достижения
      const achievementBg = this.add.graphics().setDepth(200);
      achievementBg.fillStyle(0x2C3E50, 0.95);
      achievementBg.lineStyle(3, 0xF39C12, 0.8);
      achievementBg.fillRoundedRect(x - bgWidth/2, y - bgHeight/2, bgWidth, bgHeight, 10);
      achievementBg.strokeRoundedRect(x - bgWidth/2, y - bgHeight/2, bgWidth, bgHeight, 10);
      
      // Иконка достижения
      const achievementIcon = this.add.text(x - bgWidth/2 + 25, y, '🏆', {
        fontSize: '32px'
      }).setOrigin(0.5).setDepth(201);
      
      // Заголовок достижения
      const achievementTitle = this.add.text(x - bgWidth/2 + 60, y - 10, achievement.title, {
        fontFamily: THEME.font,
        fontSize: '18px',
        color: '#F39C12',
        fontStyle: '700'
      }).setOrigin(0, 0.5).setDepth(201);
      
      // Описание достижения
      const achievementDesc = this.add.text(x - bgWidth/2 + 60, y + 15, achievement.description, {
        fontFamily: THEME.font,
        fontSize: '14px',
        color: '#E8E1C9',
        fontStyle: '500'
      }).setOrigin(0, 0.5).setDepth(201);
      
      // Группируем элементы
      const achievementGroup = this.add.container(0, 0, [
        achievementBg, achievementIcon, achievementTitle, achievementDesc
      ]);
      
      // Анимация появления
      achievementGroup.setAlpha(0);
      achievementGroup.setScale(0.8);
      
      this.tweens.add({
        targets: achievementGroup,
        alpha: 1,
        scale: 1,
        duration: 500,
        delay: index * 300,
        ease: 'Back.easeOut',
        onComplete: () => {
          // Частицы при появлении
          this.createAchievementParticles(x, y);
        }
      });

      // Удаляем через 4 секунды
      this.time.delayedCall(4000 + index * 300, () => {
        this.tweens.add({
          targets: achievementGroup,
          alpha: 0,
          scale: 0.8,
          duration: 300,
          onComplete: () => {
            achievementGroup.destroy();
          }
        });
      });
    });
    
    // Звук достижения (если есть)
    if (this.sound && this.sound.get('achievement_sound')) {
      this.sound.play('achievement_sound', { volume: 0.5 });
    }
  }

  // ДОБАВЛЕНО: Эффекты частиц для достижений
  createAchievementParticles(x, y) {
    // Простая анимация "звездочек" для достижений
    const emojis = ['✨', '⭐', '🎉', '💫'];
    
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const distance = 50;
      const particleX = x + Math.cos(angle) * distance;
      const particleY = y + Math.sin(angle) * distance;
      
      const particle = this.add.text(x, y, emojis[i % emojis.length], {
        fontSize: '16px'
      }).setDepth(202);
      
      this.tweens.add({
        targets: particle,
        x: particleX,
        y: particleY,
        alpha: 0,
        scale: 1.5,
        duration: 800,
        ease: 'Power2',
        onComplete: () => particle.destroy()
      });
    }
  }

  // ДОБАВЛЕНО: Отправка статистики в VK
  async sendVKGameStats(gameTime, accuracy) {
    if (!this.isVKEnvironment || !window.VKSafe || !window.VKSafe.send) return;
    
    try {
      // Сохраняем статистику игры в VK Storage
      const gameStats = {
        level: {
          cols: this.currentLevel.cols,
          rows: this.currentLevel.rows,
          pairs: this.gameMetrics.pairs
        },
        performance: {
          time: gameTime,
          attempts: this.gameMetrics.attempts,
          errors: this.gameMetrics.errors,
          accuracy: accuracy
        },
        timestamp: Date.now(),
        userId: window.VK_LAUNCH_PARAMS?.user_id
      };
      
      if (window.VKSafe.supports && window.VKSafe.supports('VKWebAppStorageSet')) {
        await window.VKSafe.send('VKWebAppStorageSet', {
          key: `game_result_${Date.now()}`,
          value: JSON.stringify(gameStats)
        });
      }
      
      console.log('📊 Game stats sent to VK Storage');
      
    } catch (error) {
      console.warn('⚠️ Failed to send VK game stats:', error);
    }
  }

  // Dev команды для отладки
  devRevealAll() {
    if (!this.cards) return;
    this.cards.forEach(card => {
      card.setTexture(card.getData('key'));
      card.setData('opened', true);
    });
    console.log('DEV: All cards revealed');
  }

  devTestPair() {
    if (!this.cards || this.cards.length < 2) return;
    const firstCard = this.cards[0];
    const matchingCard = this.cards.find(card => 
      card !== firstCard && card.getData('key') === firstCard.getData('key'));
    
    if (matchingCard) {
      [firstCard, matchingCard].forEach(card => {
        card.setTexture(card.getData('key'));
        card.setData('matched', true);
      });
      console.log('DEV: Test pair matched');
    }
  }

  // Остальные методы
  ensureGradientBackground() {
    const { W, H } = this.getSceneWH();

    if (this.textures.exists('bg_game')) {
      this.bgImage && this.bgImage.destroy();
      const img = this.add.image(W/2, H/2, 'bg_game').setOrigin(0.5).setDepth(-1000);
      const src = this.textures.get('bg_game').getSourceImage();
      const scale = Math.max(W / src.width, H / src.height);
      img.setDisplaySize(src.width * scale, src.height * scale);
      this.bgImage = img;
      return;
    }

    const key = 'bg-grad-game';
    const DPR = this.getDPR();
    if (this.textures.exists(key)) {
      const src = this.textures.get(key).getSourceImage();
      if (src.width !== Math.round(W*DPR) || src.height !== Math.round(H*DPR)) this.textures.remove(key);
    }
    if (!this.textures.exists(key)) {
      const tex = this.textures.createCanvas(key, Math.max(2, Math.round(W*DPR)), Math.max(2, Math.round(H*DPR)));
      const ctx = tex.getContext(); ctx.save(); ctx.scale(DPR, DPR);
      const g = ctx.createLinearGradient(0,0,0,H);
      g.addColorStop(0, THEME.bgTop); g.addColorStop(0.6, THEME.bgMid); g.addColorStop(1, THEME.bgBottom);
      ctx.fillStyle = g; ctx.fillRect(0,0,W,H);
      ctx.restore(); tex.refresh();
    }
    this.bgImage && this.bgImage.destroy();
    this.bgImage = this.add.image(0,0,key).setOrigin(0,0).setDepth(-1000).setDisplaySize(W,H);
  }

  makePlaceholdersIfNeeded() {
    if (this.textures.exists('back')) return;
    
    const tex = this.textures.createCanvas('back', 120, 160);
    const ctx = tex.getContext();
    ctx.fillStyle = '#2C3E50';
    ctx.fillRect(0, 0, 120, 160);
    ctx.strokeStyle = '#34495E';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, 118, 158);
    ctx.fillStyle = '#ECF0F1';
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('?', 60, 85);
    tex.refresh();
    
    window.ALL_CARD_KEYS.forEach(key => {
      if (!this.textures.exists(key)) {
        const cardTex = this.textures.createCanvas(key, 120, 160);
        const cardCtx = cardTex.getContext();
        cardCtx.fillStyle = '#E74C3C';
        cardCtx.fillRect(0, 0, 120, 160);
        cardCtx.fillStyle = '#FFFFFF';
        cardCtx.font = 'bold 20px Arial';
        cardCtx.textAlign = 'center';
        cardCtx.fillText(key.toUpperCase(), 60, 85);
        cardTex.refresh();
      }
    });
  }
};

// Dev команды в консоли (только в development)
if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.search.includes('debug=1'))) {
  window.devGameScene = {
    revealAll: () => {
      const scene = window.game?.scene?.getScene('GameScene');
      if (scene) scene.devRevealAll();
    },
    testPair: () => {
      const scene = window.game?.scene?.getScene('GameScene');
      if (scene) scene.devTestPair();
    },
    setSeed: (seed) => {
      const scene = window.game?.scene?.getScene('GameScene');
      if (scene) {
        scene.gameSeed = seed;
        scene.gameState.deck = null; // Сбрасываем колоду для пересоздания
        scene.gameState.currentSeed = null;
        console.log('Seed set to:', seed);
      }
    },
    getCurrentSeed: () => {
      const scene = window.game?.scene?.getScene('GameScene');
      if (scene) {
        console.log('Current seed:', scene.gameSeed);
        return scene.gameSeed;
      }
    },
    forceResize: () => {
      const scene = window.game?.scene?.getScene('GameScene');
      if (scene && scene.gameState.gameStarted) {
        console.log('Forcing resize test...');
        scene.saveGameState();
        scene.redrawLayout();
      }
    },
    testVKAchievement: (id) => {
      const scene = window.game?.scene?.getScene('GameScene');
      if (scene && scene.vkAchievementManager) {
        scene.vkAchievementManager.unlockAchievement(id);
      }
    },
    getProgress: () => {
      const scene = window.game?.scene?.getScene('GameScene');
      if (scene) {
        const progress = scene.getProgress();
        console.table(progress);
        return progress;
      }
    },
    clearProgress: () => {
      localStorage.removeItem('findpair_progress');
      console.log('Progress cleared');
    },
    setStars: (levelIndex, stars) => {
      const scene = window.game?.scene?.getScene('GameScene');
      if (scene) {
        const progress = scene.getProgress();
        progress[levelIndex] = { stars, bestTime: 30, bestAccuracy: 100, attempts: 10, errors: 0, completedAt: Date.now() };
        localStorage.setItem('findpair_progress', JSON.stringify(progress));
        console.log(`Level ${levelIndex} set to ${stars} stars`);
      }
    }
  };
  
  console.log('🎮 Dev commands available:');
  console.log('devGameScene.revealAll() - показать все карты');
  console.log('devGameScene.testPair() - показать тестовую пару');
  console.log('devGameScene.setSeed(123) - установить seed');
  console.log('devGameScene.getCurrentSeed() - получить текущий seed');
  console.log('devGameScene.forceResize() - принудительно протестировать resize');
  console.log('devGameScene.testVKAchievement("first_win") - протестировать VK достижение');
  console.log('devGameScene.getProgress() - показать прогресс');
  console.log('devGameScene.clearProgress() - очистить прогресс');
  console.log('devGameScene.setStars(0, 3) - установить звёзды для уровня');
}
