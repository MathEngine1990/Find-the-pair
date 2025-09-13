//---scenes/GameScene.js - ПОЛНОСТЬЮ ИСПРАВЛЕННАЯ ВЕРСИЯ

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

    // Состояние игры для сохранения при resize
    this.gameState = {
      deck: null,           
      openedCards: [],      
      matchedCards: [],     
      gameStarted: false,   
      canResize: true,      
      isMemorizationPhase: false,
      currentSeed: null,
      cardWidth: null,
      cardHeight: null
    };
    
    // Seed для детерминированной генерации
    this.gameSeed = this.generateSeed();
    this.gameState.currentSeed = this.gameSeed;

    console.log('GameScene init:', {
      isVK: this.isVKEnvironment,
      hasVKUser: !!this.vkUserData,
      hasVKAchievements: !!this.vkAchievementManager,
      seed: this.gameSeed
    });
  }

  // Генерация детерминированного seed
  generateSeed() {
    const urlParams = new URLSearchParams(window.location.search);
    const urlSeed = urlParams.get('seed');
    
    if (urlSeed) {
      return parseInt(urlSeed, 36);
    }
    
    const levelHash = this.currentLevel ? 
      (this.currentLevel.cols * 1000 + this.currentLevel.rows) : 1;
    return (Date.now() + levelHash) % 2147483647;
  }

  // Детерминированное перемешивание
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
    this.pairsText = null;  // ДОБАВЛЕНО: счётчик пар
    this.gameTimer = null;
    this.currentTimeSeconds = 0;

    this._wheelHandler = null;
    this.bgImage = null;
    this._texId = 0;

    // Таймеры для управления (ИСПРАВЛЕНО: единый источник правды)
    this.memorizeTimer = null;
    this.flipTimer = null;
    this.revealTimeout = 5000; // ДОБАВЛЕНО: единый таймер 5 секунд

    this.makePlaceholdersIfNeeded();
    this.ensureGradientBackground();

    if (!this.currentLevel) {
      this.scene.start('MenuScene', { page: this.levelPage });
      return;
    }

    this.startGame(this.currentLevel);

    // Обработка resize - не перетасовывать карты
    this.scale.on('resize', () => {
      if (this.scale && this.scale.updateBounds) this.scale.updateBounds();
      
      console.log('Resize detected, gameStarted:', this.gameState.gameStarted);
      
      if (!this.gameState.canResize) {
        console.log('Resize blocked during critical game phase');
        return;
      }

      this.ensureGradientBackground();
      
      if (this.gameState.gameStarted || this.gameState.isMemorizationPhase) {
        this.saveGameState();
        this.redrawLayout();
      } else {
        this.startGame(this.currentLevel);
      }
    });
    
    this.events.once('shutdown', this.cleanup, this);
    this.events.once('destroy', this.cleanup, this);
  }

  // Полная очистка при завершении сцены
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

  // Сохранение состояния игры
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

  // Перерисовка layout без изменения игровой логики
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

    // Останавливаем все активные процессы перед очисткой
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
          card.setAlpha(window.THEME.cardDimAlpha).disableInteractive();
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

  // Остановка всех активных процессов
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

  // Безопасная очистка визуальных элементов
  clearVisualElements() {
    // Безопасное уничтожение карт
    if (this.cards && Array.isArray(this.cards)) {
      this.cards.forEach(card => {
        if (card && card.scene) {
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
    if (this.vkAchievementManager) {
      return this.vkAchievementManager.achievements;
    }
    
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
        this.vkAchievementManager.achievements = this.achievements;
        await this.vkAchievementManager.saveAchievements();
      } else {
        localStorage.setItem('findpair_achievements', JSON.stringify(this.achievements));
      }
    } catch (error) {
      console.warn('Failed to save achievements:', error);
      localStorage.setItem('findpair_achievements', JSON.stringify(this.achievements));
    }
  }

  // Форматирование времени
  formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `${secs}с`;
  }

  // ✅ ИСПРАВЛЕНО: HUD без некорректных fontStyle
  drawHUD() {
    this.clearHUD();
    const { W, H } = this.getSceneWH();
    const hudH = Math.min(100, Math.round(H * 0.12));

    // Фон HUD
    const hud = this.add.graphics().setDepth(5);
    hud.fillStyle(window.THEME?.hudFill || 0x000000, 0.90);
    hud.fillRoundedRect(0, 0, W, hudH, 0);
    this.hud = hud;

    const fontSize = this._pxByH(0.032, 14, 20);
    const fontFamily = window.THEME?.font || 'Arial, sans-serif';

    // ✅ ИСПРАВЛЕНО: Счетчик ошибок слева (без '600')
    this.mistakeText = this.add.text(20, hudH/2, 'Ошибок: ' + this.mistakeCount, {
      fontFamily,
      fontSize: fontSize + 'px', 
      color: '#FF6B6B', 
      fontStyle: 'bold'  // было: 'fontStyle: 600' - НЕДОПУСТИМО!
    }).setOrigin(0, 0.5).setDepth(6);

    // ✅ ИСПРАВЛЕНО: Таймер в центре (без '600')
    this.timeText = this.add.text(W/2, hudH/2, this.formatTime(this.currentTimeSeconds), {
      fontFamily,
      fontSize: (fontSize + 2) + 'px', 
      color: '#4ECDC4', 
      fontStyle: 'bold'  // было: 'fontStyle: 600' - НЕДОПУСТИМО!
    }).setOrigin(0.5, 0.5).setDepth(6);

    // ✅ ДОБАВЛЕНО: Счётчик пар (избегаем налазания текста)
    const matchedPairs = Math.floor(this.cards.filter(c => c.getData('matched')).length / 2);
    const totalPairs = this.gameMetrics ? this.gameMetrics.pairs : Math.floor(this.cards.length / 2);
    
    this.pairsText = this.add.text(W - 20, hudH/2 - 20, `Пар: ${matchedPairs}/${totalPairs}`, {
      fontFamily,
      fontSize: (fontSize - 2) + 'px',
      color: window.THEME?.hudText || '#E8E1C9',
      fontStyle: 'bold'
    }).setOrigin(1, 0.5).setDepth(6);

    // Кнопка домой справа внизу
    const size = Math.round(hudH * 0.65);
    const homeBtn = window.makeIconButton(
      this, W - (size/2 + 14), hudH/2 + 10, size,
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
    if (this.hud && this.hud.scene) this.hud.destroy();
    if (this.mistakeText && this.mistakeText.scene) this.mistakeText.destroy();
    if (this.timeText && this.timeText.scene) this.timeText.destroy();
    if (this.pairsText && this.pairsText.scene) this.pairsText.destroy();
    if (this.exitBtn && this.exitBtn.scene) this.exitBtn.destroy();
    this.hud = this.mistakeText = this.timeText = this.pairsText = this.exitBtn = null;
  }

  // Управление таймером
  startGameTimer() {
    if (this.gameTimer) {
      this.gameTimer.destroy();
      this.gameTimer = null;
    }
    
    this.gameTimer = this.time.addEvent({
      delay: 1000,
      callback: () => {
        this.currentTimeSeconds++;
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
    console.log('Starting game with level:', level);
    
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

    // Детерминированная генерация колоды
    if (!this.gameState.deck || this.gameState.currentSeed !== this.gameSeed) {
      const pairs = Math.floor(total / 2);
      const shuffledKeys = this.shuffleWithSeed([...window.ALL_CARD_KEYS], this.gameSeed);
      const base = Array.from({length: pairs}, (_, i) => 
        shuffledKeys[i % shuffledKeys.length]);
      
      this.gameState.deck = this.shuffleWithSeed(
        base.concat(base), 
        this.gameSeed + 1000
      );
      
      this.gameState.currentSeed = this.gameSeed;
      
      console.log('Generated deterministic deck with seed:', this.gameSeed);
    }

    // Останавливаем все процессы перед очисткой
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

    // ✅ ИСПРАВЛЕНО: Единый таймер 5 секунд через revealTimeout
    this.showCardsForMemorization();
  }

  // Создание layout карт с фиксированными размерами
  createCardLayout(deck) {
    const level = this.currentLevel;
    const { W, H } = this.getSceneWH();
    const hudH = Math.min(100, Math.round(H * 0.12));
    const gameAreaH = H - hudH - 20;
    
    // Фиксируем размеры карт при первом создании
    if (!this.gameState.cardWidth || !this.gameState.cardHeight) {
      const maxCardW = Math.min(140, (W - 40) / level.cols - 10);
      const maxCardH = Math.min(190, gameAreaH / level.rows - 10);
      
      this.gameState.cardWidth = Math.min(maxCardW, maxCardH * 0.7);
      this.gameState.cardHeight = Math.min(maxCardH, maxCardW / 0.7);
    }
    
    // Используем зафиксированные размеры
    const cardW = this.gameState.cardWidth;
    const cardH = this.gameState.cardHeight;
    
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
        
        const card = this.add.image(x, y, key) // Начинаем лицом
          .setDisplaySize(cardW, cardH) // Явно устанавливаем размер
          .setData('key', key)
          .setData('opened', false)
          .setData('matched', false)
          .setInteractive({ useHandCursor: true })
          .on('pointerdown', () => this.onCardClick(card));
        
        this.cards.push(card);
      }
    }
  }

  // ✅ ИСПРАВЛЕНО: Единый источник правды для таймера запоминания
  showCardsForMemorization() {
    console.log(`Showing cards for memorization (${this.revealTimeout/1000} seconds)...`);
    
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
    const fontFamily = window.THEME?.font || 'Arial, sans-serif';
    const notification = this.add.text(W/2, H*0.15, 'Запомните карты!', {
      fontFamily,
      fontSize: this._pxByH(0.05, 24, 32) + 'px',
      color: '#FFD700',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(1000);

    // Обратный отсчёт
    let countdown = Math.floor(this.revealTimeout / 1000); // 5 секунд
    const countdownText = this.add.text(W/2, H*0.22, countdown.toString(), {
      fontFamily,
      fontSize: this._pxByH(0.08, 36, 48) + 'px',
      color: '#FF4444',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(1000);

    // ✅ ИСПРАВЛЕНО: Таймер обратного отсчёта на основе revealTimeout
    this.memorizeTimer = this.time.addEvent({
      delay: 1000,
      repeat: countdown - 1,
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

  // Переворот карт без изменения размеров
  flipAllCardsAndStartGame() {
    console.log('Flipping all cards and starting game...');
    
    // Анимированное переворачивание карт с сохранением размеров
    this.cards.forEach((card, index) => {
      // Сохраняем текущие размеры
      const currentWidth = card.displayWidth;
      const currentHeight = card.displayHeight;
      
      this.tweens.add({
        targets: card,
        scaleX: 0,
        duration: 200,
        delay: index * 30,
        ease: 'Power2.easeIn',
        onComplete: () => {
          card.setTexture('back');
          // Восстанавливаем размеры после смены текстуры
          card.setDisplaySize(currentWidth, currentHeight);
          
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
      // Включаем интерактивность карт с сохранением размеров
      this.cards.forEach(card => {
        card.setInteractive({ useHandCursor: true });
        // Убеждаемся что размеры сохранены
        card.setDisplaySize(this.gameState.cardWidth, this.gameState.cardHeight);
      });
      
      this.canClick = true;
      this.gameState.gameStarted = true;
      this.gameState.isMemorizationPhase = false;
      this.gameState.canResize = true;
      
      // Запускаем таймер игры только после показа карт
      this.gameMetrics.startTime = Date.now();
      this.startGameTimer();
      
      console.log('Game fully started, timer running, clicks enabled');
    });
  }

  // ✅ ИСПРАВЛЕНО: Блокировка ввода во время анимаций
  onCardClick(card) {
    if (!this.canClick || this._processingCards) return;
    if (card.getData('opened') || card.getData('matched')) return;

    // Защита от быстрых кликов (анти-дабл-клик)
    const now = Date.now();
    if (this._lastClickTime && now - this._lastClickTime < 300) {
      console.log('Click ignored - too fast (anti-double-click)');
      return;
    }
    this._lastClickTime = now;
    
    // ✅ ИСПРАВЛЕНО: Блокируем дальнейшие клики на время обработки
    this._processingCards = true;
    this.canClick = false; // Полная блокировка ввода
    
    this.gameMetrics.attempts++;

    // Сохраняем размеры при смене текстуры
    const currentWidth = card.displayWidth;
    const currentHeight = card.displayHeight;
    
    card.setTexture(card.getData('key'));
    card.setDisplaySize(currentWidth, currentHeight); // Восстанавливаем размер
    card.setData('opened', true);
    this.opened.push(card);

    if (this.opened.length === 2) {
      // ✅ ИСПРАВЛЕНО: Увеличиваем время задержки для ~800мс как в ТЗ
      const checkTimer = this.time.delayedCall(800, () => {
        const [a, b] = this.opened;
        if (a.getData('key') === b.getData('key')) {
          // Трекинг времени матчей
          const matchTime = (Date.now() - this.gameMetrics.startTime) / 1000;
          this.gameMetrics.matchTimes.push(matchTime);
          
          if (this.gameMetrics.timeToFirstMatch === null) {
            this.gameMetrics.timeToFirstMatch = matchTime;
          }
          
          a.setData('matched', true).setAlpha(window.THEME.cardDimAlpha).disableInteractive();
          b.setData('matched', true).setAlpha(window.THEME.cardDimAlpha).disableInteractive();
          a.setData('opened', false); 
          b.setData('opened', false);
        } else {
          this.mistakeCount++;
          this.gameMetrics.errors++;
          if (this.mistakeText) this.mistakeText.setText('
