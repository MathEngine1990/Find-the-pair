//---scenes/GameScene.js - ИСПРАВЛЕННАЯ версия с фиксом resize + система времени и достижений

window.GameScene = class GameScene extends Phaser.Scene {
  
  constructor(){ super('GameScene'); }

  init(data){
    this.currentLevel = data?.level || null;
    this.levelPage = data?.page || 0;
    
    // Система достижений
    this.achievements = this.getAchievements();
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
      isMemorizationPhase: false // Фаза запоминания (5 сек)
    };
    
    // Seed для детерминированной генерации
    this.gameSeed = this.generateSeed();
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

  _pxClamp(px, minPx, maxPx){ return Math.round(Phaser.Math.Clamp(px, minPx, maxPx)); }
  _pxByH(fraction, minPx, maxPx){ const { H } = this.getSceneWH(); return this._pxClamp(H * fraction, minPx, maxPx); }
  getDPR(){ return Math.min(2.0, Math.max(1, (window.devicePixelRatio || 1))); }

  _createHiDPICanvasTexture(key, w, h, drawFn){
    const DPR = this.getDPR();
    const tex = this.textures.createCanvas(key, Math.max(2, Math.round(w*DPR)), Math.max(2, Math.round(h*DPR)));
    const ctx = tex.getContext();
    ctx.save(); ctx.scale(DPR, DPR); drawFn(ctx, w, h); ctx.restore();
    tex.refresh();
    return tex;
  }

  preload(){}

  create(){
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

    this.makePlaceholdersIfNeeded();
    this.ensureGradientBackground();

    if (!this.currentLevel){
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

    // Очищаем визуальные элементы
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
        } else if (!wasMemorizing) {
          card.setInteractive({ useHandCursor: true });
        }
      }
    });
    
    // Перерисовываем HUD
    this.drawHUD();
    
    // Восстанавливаем таймер
    if (this.gameState.gameStarted && !wasMemorizing) {
      this.currentTimeSeconds = currentTime;
      if (this.timeText) {
        this.timeText.setText(this.formatTime(this.currentTimeSeconds));
      }
      if (!this.gameTimer) {
        this.startGameTimer();
      }
    }
    
    console.log('Layout redrawn, game state preserved');
  }

  // ДОБАВЛЕНО: Очистка визуальных элементов
  clearVisualElements() {
    this.cards.forEach(card => card.destroy());
    this.cards = [];
    
    this.clearHUD();
  }

  getSceneWH(){
    const s = this.scale, cam = this.cameras?.main;
    const W = (s && (s.width ?? s.gameSize?.width)) || cam?.width || this.sys.game.config.width || 800;
    const H = (s && (s.height ?? s.gameSize?.height)) || cam?.height || this.sys.game.config.height || 600;
    return { W: Math.floor(W), H: Math.floor(H) };
  }

  // Система достижений
  getAchievements() {
    const saved = localStorage.getItem('findpair_achievements');
    return saved ? JSON.parse(saved) : {
      firstWin: false,
      perfectGame: false,
      speedRunner: false, // выиграл за < 30 сек
      persistent: false,  // сыграл 10 игр подряд
      expert: false       // прошел сложный уровень
    };
  }

  saveAchievements() {
    localStorage.setItem('findpair_achievements', JSON.stringify(this.achievements));
  }

  // Форматирование времени
  formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `${secs}с`;
  }

  // УЛУЧШЕНО: Обновление HUD с таймером
  drawHUD(){
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

  clearHUD(){
    if (this.hud) this.hud.destroy();
    if (this.mistakeText) this.mistakeText.destroy();
    if (this.timeText) this.timeText.destroy();
    if (this.exitBtn) this.exitBtn.destroy();
    this.hud = this.mistakeText = this.timeText = this.exitBtn = null;
  }

  // Управление таймером
  startGameTimer() {
    if (this.gameTimer) return; // Предотвращаем дублирование таймеров
    
    this.gameTimer = this.time.addEvent({
      delay: 1000,
      callback: () => {
        this.currentTimeSeconds++;
        if (this.timeText) {
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

  startGame(level){
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
      startTime: Date.now(),
      attempts: 0,
      errors: 0,
      pairs: Math.floor(total / 2),
      level: level,
      timeToFirstMatch: null,
      matchTimes: []
    };  

    // ИСПРАВЛЕНО: Детерминированная генерация колоды только если её еще нет
    if (!this.gameState.deck) {
      const pairs = Math.floor(total / 2);
      const shuffledKeys = this.shuffleWithSeed([...ALL_CARD_KEYS], this.gameSeed);
      const base = Array.from({length: pairs}, (_, i) => 
        shuffledKeys[i % shuffledKeys.length]);
      
      // Создаем пары и перемешиваем их детерминированно
      this.gameState.deck = this.shuffleWithSeed(
        base.concat(base), 
        this.gameSeed + 1000 // Другой seed для финального перемешивания
      );
      
      console.log('Generated deterministic deck with seed:', this.gameSeed);
    }

    this.clearVisualElements();
    this.ensureGradientBackground();
    
    this.opened = [];
    this.canClick = false;
    this.gameState.gameStarted = false;
    this.gameState.isMemorizationPhase = true;

    this.drawHUD();
    this.createCardLayout(this.gameState.deck);

    // 5-секундный показ карт для запоминания
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
        
        const card = this.add.image(x, y, key)
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

  // 5-секундный показ карт для запоминания
  showCardsForMemorization() {
    console.log('Showing cards for memorization...');
    
    // Блокируем resize во время показа карт
    this.gameState.canResize = false;
    this.gameState.isMemorizationPhase = true;
    
    // Показываем все карты лицом
    this.cards.forEach(card => {
      card.setTexture(card.getData('key'));
      card.disableInteractive();
    });

    // Через 5 секунд переворачиваем и начинаем игру
    this.time.delayedCall(5000, () => {
      console.log('Starting actual game...');
      
      this.cards.forEach(card => {
        card.setTexture('back');
        card.setInteractive({ useHandCursor: true });
      });
      
      this.canClick = true;
      this.gameState.gameStarted = true;
      this.gameState.isMemorizationPhase = false;
      this.gameState.canResize = true; // Разблокируем resize после начала игры
      
      // Запускаем таймер только после показа карт
      this.startGameTimer();
    });
  }

  onCardClick(card){
    if (!this.canClick || this._processingCards) return;
    if (card.getData('opened') || card.getData('matched')) return;

    // Защита от быстрых кликов
    if (this._lastClickTime && Date.now() - this._lastClickTime < 300) return;
    this._lastClickTime = Date.now();
    
    this.gameMetrics.attempts++;

    card.setTexture(card.getData('key'));
    card.setData('opened', true);
    this.opened.push(card);

    if (this.opened.length === 2){
      this.canClick = false;
      this._processingCards = true;
      
      this.time.delayedCall(450, () => {
        const [a, b] = this.opened;
        if (a.getData('key') === b.getData('key')){
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
    }
  }

  // УЛУЧШЕНО: Экран победы с подробной статистикой
  showWin(){
    this.canClick = false;
    this.gameState.gameStarted = false; // Игра завершена
    this.stopGameTimer(); // Останавливаем таймер
    this.cards.forEach(c => c.disableInteractive());

    const gameTime = this.currentTimeSeconds;
    const accuracy = this.gameMetrics.attempts > 0 ? 
      Math.round((1 - this.gameMetrics.errors / this.gameMetrics.attempts) * 100) : 100;

    // Проверка достижений
    this.checkAchievements(gameTime, this.gameMetrics.errors, this.currentLevel);

    console.log('Game finished:', {
      time: gameTime,
      attempts: this.gameMetrics.attempts,
      errors: this.gameMetrics.errors,
      accuracy: accuracy
    });

    const { W, H } = this.getSceneWH();

    // Полупрозрачный фон
    const overlay = this.add.graphics().setDepth(100);
    overlay.fillStyle(0x000000, 0.8);
    overlay.fillRect(0, 0, W, H);

    // Красивое окно результатов
    const panelW = Math.min(500, W * 0.9);
    const panelH = Math.min(400, H * 0.7);
    const panelX = W/2;
    const panelY = H/2;

    const panel = this.add.graphics().setDepth(101);
    panel.fillStyle(0x2C3E50, 0.95);
    panel.lineStyle(3, 0x3498DB, 0.8);
    panel.fillRoundedRect(panelX - panelW/2, panelY - panelH/2, panelW, panelH, 20);
    panel.strokeRoundedRect(panelX - panelW/2, panelY - panelH/2, panelW, panelH, 20);

    // Заголовок
    this.add.text(panelX, panelY - panelH/2 + 60, '🎉 ПОБЕДА! 🎉', {
      fontFamily: THEME.font, 
      fontSize: this._pxByH(0.06, 24, 42) + 'px', 
      color: '#F39C12', 
      fontStyle: '800'
    }).setOrigin(0.5).setDepth(102);

    // Детальная статистика
    const statsY = panelY - panelH/2 + 120;
    const lineHeight = 35;
    
    this.add.text(panelX, statsY, `⏱️ Время: ${this.formatTime(gameTime)}`, {
      fontFamily: THEME.font, fontSize: '20px', color: '#4ECDC4', fontStyle: '600'
    }).setOrigin(0.5).setDepth(102);

    this.add.text(panelX, statsY + lineHeight, `🎯 Попыток: ${this.gameMetrics.attempts}`, {
      fontFamily: THEME.font, fontSize: '18px', color: '#E8E1C9', fontStyle: '500'
    }).setOrigin(0.5).setDepth(102);

    this.add.text(panelX, statsY + lineHeight * 2, `❌ Ошибок: ${this.mistakeCount}`, {
      fontFamily: THEME.font, fontSize: '18px', color: '#E74C3C', fontStyle: '500'
    }).setOrigin(0.5).setDepth(102);

    this.add.text(panelX, statsY + lineHeight * 3, `📊 Точность: ${accuracy}%`, {
      fontFamily: THEME.font, fontSize: '18px', color: '#2ECC71', fontStyle: '500'
    }).setOrigin(0.5).setDepth(102);

    // Оценка производительности
    let rating = '⭐';
    if (accuracy >= 90 && gameTime <= 60) rating = '⭐⭐⭐';
    else if (accuracy >= 80 && gameTime <= 90) rating = '⭐⭐';
    
    this.add.text(panelX, statsY + lineHeight * 4.5, `Рейтинг: ${rating}`, {
      fontFamily: THEME.font, fontSize: '20px', color: '#F39C12', fontStyle: '700'
    }).setOrigin(0.5).setDepth(102);

    // Кнопки
    const btnY = panelY + panelH/2 - 80;
    const btnW = Math.min(180, panelW * 0.35);
    const btnH = 50;

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

  // Перезапуск уровня
  restartLevel() {
    this.gameState.gameStarted = false;
    this.gameState.deck = null; // Очищаем сохраненную колоду для новой генерации
    this.gameSeed = this.generateSeed(); // Новый seed
    this.startGame(this.currentLevel);
  }

  // Проверка достижений
  checkAchievements(gameTime, errors, level) {
    let newAchievements = [];
    
    if (!this.achievements.firstWin) {
      this.achievements.firstWin = true;
      newAchievements.push('Первая победа!');
    }
    
    if (errors === 0 && !this.achievements.perfectGame) {
      this.achievements.perfectGame = true;
      newAchievements.push('Идеальная игра!');
    }
    
    if (gameTime < 30 && !this.achievements.speedRunner) {
      this.achievements.speedRunner = true;
      newAchievements.push('Скоростной бегун!');
    }
    
    const totalPairs = level.cols * level.rows / 2;
    if (totalPairs >= 9 && !this.achievements.expert) {
      this.achievements.expert = true;
      newAchievements.push('Эксперт памяти!');
    }
    
    this.sessionStats.gamesPlayed++;
    if (this.sessionStats.gamesPlayed >= 5 && !this.achievements.persistent) {
      this.achievements.persistent = true;
      newAchievements.push('Упорство!');
    }
    
    if (newAchievements.length > 0) {
      this.saveAchievements();
      this.showAchievements(newAchievements);
    }
  }

  // Показ достижений
  showAchievements(achievements) {
    const { W, H } = this.getSceneWH();
    
    achievements.forEach((achievement, index) => {
      const achievementText = this.add.text(W/2, 100 + index * 40, `🏆 ${achievement}`, {
        fontFamily: THEME.font, 
        fontSize: '18px', 
        color: '#F39C12', 
        fontStyle: '600',
        backgroundColor: 'rgba(0,0,0,0.7)',
        padding: { x: 20, y: 10 }
      }).setOrigin(0.5).setDepth(200);

      // Анимация появления
      achievementText.setAlpha(0);
      this.tweens.add({
        targets: achievementText,
        alpha: 1,
        y: achievementText.y - 20,
        duration: 500,
        delay: index * 200,
        ease: 'Back.easeOut'
      });

      // Удаляем через 3 секунды
      this.time.delayedCall(3000 + index * 200, () => {
        if (achievementText) achievementText.destroy();
      });
    });
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

  // Остальные методы остаются без изменений
  ensureGradientBackground(){
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
    if (!this.textures.exists(key)){
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

  makePlaceholdersIfNeeded(){
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
    
    ALL_CARD_KEYS.forEach(key => {
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
    }
  };
  
  console.log('🎮 Dev commands available:');
  console.log('devGameScene.revealAll() - показать все карты');
  console.log('devGameScene.testPair() - показать тестовую пару');
  console.log('devGameScene.setSeed(123) - установить seed');
  console.log('devGameScene.getCurrentSeed() - получить текущий seed');
  console.log('devGameScene.forceResize() - принудительно протестировать resize');
}