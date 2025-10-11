//---scenes/GameScene.js - ИСПРАВЛЕННАЯ ВЕРСИЯ
window.GameScene = class GameScene extends Phaser.Scene {
  
  constructor() { 
    super('GameScene'); 
  }

  init(data) {
    this.currentLevel = data?.level || null;
    this.currentLevelIndex = data?.levelIndex || 0;
    this.levelPage = data?.page || 0;
    
    // VK данные из PreloadScene
    this.vkUserData = data?.userData || window.VK_USER_DATA;
    this.isVKEnvironment = data?.isVK || !!window.VK_LAUNCH_PARAMS;
    
    // Инициализация синхронизации
    this.syncManager = data?.syncManager || window.progressSyncManager || null;
    this.progressData = null;
    
    // Система достижений (локальная + VK)
    this.achievements = this.getAchievements();
    this.vkAchievementManager = window.VKAchievementManager || null;
    
    // Состояние игры для сохранения при resize
    this.gameState = {
      deck: null,           
      openedCards: [],  
      gameStarted: false,   
      canResize: true,      
      isMemorizationPhase: false,
      currentSeed: null,
      showingVictory: false,
      cardWidth: null,
      cardHeight: null,
      gapSize: null
    };
    
    // Ссылки на элементы экрана победы для точной очистки
    this.victoryElements = null;
    this.victoryContainer = null;
    
    // Контейнер для карт
    this.cardsContainer = null;
    
    // Таймауты для resize
    this.resizeTimeout = null;
    
    // AbortController для отмены memorize
    this.memorizeController = null;
    
    // Seed для детерминированной генерации
    this.gameSeed = this.generateSeed();
    this.gameState.currentSeed = this.gameSeed;

    // Метрики для синхронизации
    this.gameMetrics = {
      startTime: null,
      attempts: 0,
      errors: 0,
      pairs: 0,
      level: this.currentLevel,
      timeToFirstMatch: null,
      matchTimes: [],
      levelIndex: this.currentLevelIndex
    };

    console.log('GameScene init:', {
      isVK: this.isVKEnvironment,
      hasVKUser: !!this.vkUserData,
      hasVKAchievements: !!this.vkAchievementManager,
      hasSyncManager: !!this.syncManager,
      seed: this.gameSeed,
      levelIndex: this.currentLevelIndex
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

  async create() {
    try {
      // ===== 1. ИНИЦИАЛИЗАЦИЯ БАЗОВЫХ ПЕРЕМЕННЫХ =====
      if (this.scale && this.scale.updateBounds) {
        this.scale.updateBounds();
      }
      
      // Базовые коллекции
      this.levelButtons = [];
      this.cards = [];
      this.opened = [];
      
      // Состояние игры
      this.canClick = false;
      this.mistakeCount = 0;
      this.currentTimeSeconds = 0;
      
      // UI элементы (null по умолчанию)
      this.hud = null;
      this.mistakeText = null;
      this.timeText = null;
      this.bgImage = null;
      
      // Таймеры (важно для правильной очистки)
      this.gameTimer = null;
      this.memorizeTimer = null;
      this.flipTimer = null;
      this.revealTimer = null;
      
      // Обработчики событий
      this._resizeHandler = null;
      this._wheelHandler = null;
      
      // Флаги для предотвращения повторных инициализаций
      this._fontsReady = false;
      this._lastTapTime = 0;
      
      // ===== 2. ОЖИДАНИЕ ЗАГРУЗКИ КРИТИЧЕСКИХ РЕСУРСОВ =====
      
      // Детектор long tasks
      if (window.PerformanceObserver) {
        const po = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.duration > 200) {
              console.warn(`⚠️ Long task detected: ${entry.duration}ms`, entry.name);
            }
          }
        });
        
        try {
          po.observe({ entryTypes: ['longtask'] });
          
          // Отключаем через 5 секунд после старта
          this.time.delayedCall(5000, () => po.disconnect());
        } catch (e) {
          // Браузер не поддерживает longtask
        }
      }
      
      // КРИТИЧНО: Ждём загрузку шрифтов ДО любой отрисовки текста
      if (document.fonts && document.fonts.ready) {
        await document.fonts.ready;
        this._fontsReady = true;
        console.log('✅ Fonts loaded and ready');
      }

      // Теперь безопасно создавать тексты
      await this.drawHUD();
      
      // ===== 3. АСИНХРОННАЯ ИНИЦИАЛИЗАЦИЯ МЕНЕДЖЕРОВ =====
      
      // Инициализация синхронизации БЕЗ блокировки
      this.initializeSyncManager().then(() => {
        console.log('✅ Sync manager initialized');
      }).catch(error => {
        console.warn('⚠️ Sync manager failed, using local storage:', error);
      });
      
      // ===== 4. ПОДГОТОВКА ВИЗУАЛЬНЫХ РЕСУРСОВ =====
      
      // Создаём заглушки текстур если их нет
      this.makePlaceholdersIfNeeded();
      
      // Отрисовка фона
      this.ensureGradientBackground();
      
      // ===== 5. ВАЛИДАЦИЯ И ЗАПУСК ИГРЫ =====
      
      if (!this.currentLevel || !this.currentLevel.cols || !this.currentLevel.rows) {
        console.error('❌ Invalid level data:', this.currentLevel);
        this.scene.start('MenuScene', { page: this.levelPage || 0 });
        return;
      }
      
      // ===== 6. СОЗДАНИЕ ОБРАБОТЧИКА RESIZE С ПРАВИЛЬНОЙ ОЧИСТКОЙ =====
      
      // Создаём debounced handler (200ms задержка)
      const resizeDebounceTime = 200;
      
      this._resizeHandler = (gameSize) => {
        // Очищаем предыдущий таймер
        if (this.resizeTimeout) {
          clearTimeout(this.resizeTimeout);
        }
        
        // Устанавливаем новый таймер
        this.resizeTimeout = setTimeout(() => {
          // Проверяем активность сцены
          if (!this.scene || !this.scene.isActive('GameScene')) {
            return;
          }
          
          // Проверяем, можно ли делать resize
          if (!this.gameState || !this.gameState.canResize) {
            console.log('⚠️ Resize blocked during critical phase');
            return;
          }
          
          console.log('📐 Resize executing after debounce');
          
          // Обновляем bounds
          if (this.scale && this.scale.updateBounds) {
            this.scale.updateBounds();
          }
          
          // Перерисовываем фон
          this.ensureGradientBackground();
          
          // Перерисовываем layout с сохранением состояния
          if (this.gameState.gameStarted || this.gameState.isMemorizationPhase) {
            this.saveGameState();
            this.redrawLayout();
          } else if (this.cards.length === 0) {
            // Если игра ещё не начата
            this.startGame(this.currentLevel);
          }
          
          this.resizeTimeout = null;
        }, resizeDebounceTime);
      };
      
      // Подписываемся на resize ОДИН раз
      this.scale.on('resize', this._resizeHandler, this);
      
      // ===== 7. ОБРАБОТЧИКИ ОЧИСТКИ =====
      
      // Регистрируем обработчики очистки
      this.events.once('shutdown', () => {
        console.log('🧹 Scene shutdown - cleaning up');
        this.cleanup();
      });
      
      this.events.once('destroy', () => {
        console.log('💥 Scene destroy - full cleanup');
        this.cleanup();
      });
      
      // ===== 8. БЕЗОПАСНЫЙ ЗАПУСК ИГРЫ =====
      
      // Используем requestAnimationFrame для плавного старта
      requestAnimationFrame(() => {
        // Запускаем игру только после полной инициализации
        this.startGame(this.currentLevel);
      });
      
      console.log('✅ GameScene created successfully');
      
    } catch (error) {
      console.error('❌ Critical error in GameScene.create:', error);
      
      // Безопасный fallback на меню
      this.time.delayedCall(100, () => {
        this.scene.start('MenuScene', { page: this.levelPage || 0 });
      });
    }
  }

  // НОВЫЙ МЕТОД: Неблокирующая инициализация менеджера синхронизации
  async initializeSyncManager() {
    try {
      // Если уже есть глобальный менеджер - используем его
      if (window.progressSyncManager) {
        this.syncManager = window.progressSyncManager;
        return;
      }
      
      // Проверяем, находимся ли мы в VK
      const isVK = window.VK_BRIDGE_READY && window.vkBridge;
      
      if (isVK && window.ProgressSyncManager) {
        this.syncManager = new window.ProgressSyncManager();
        window.progressSyncManager = this.syncManager;
      } else {
        // Вне VK - используем только localStorage
        console.log('📱 Running outside VK - local storage only');
        this.syncManager = {
          loadProgress: () => this.loadProgressLocal(),
          saveProgress: (data) => this.saveProgressLocal(data),
          isVKAvailable: () => false
        };
      }
      
      // Загружаем прогресс
      if (this.syncManager) {
        this.progressData = await this.syncManager.loadProgress();
      }
      
    } catch (error) {
      console.warn('⚠️ Sync manager initialization failed:', error);
      // Fallback на локальное хранилище
      this.progressData = this.loadProgressLocal();
    }
  }

  // ИСПРАВЛЕННЫЙ МЕТОД: Правильная очистка с проверками
  cleanup() {
    console.log('🧹 GameScene cleanup started');
    
    // ===== 1. ОЧИСТКА RESIZE TIMEOUT В ПЕРВУЮ ОЧЕРЕДЬ =====
    if (this.resizeTimeout) {
      clearTimeout(this.resizeTimeout);
      this.resizeTimeout = null;
    }
    
    // ===== 2. ОТМЕНА MEMORIZE CONTROLLER =====
    if (this.memorizeController) {
      this.memorizeController.abort();
      this.memorizeController = null;
    }
    
    // ===== 3. ОЧИСТКА ТАЙМЕРОВ =====
    const timers = [
      'memorizeTimer', 'flipTimer', 'gameTimer',
      'revealTimer', 'checkTimer', 'hideTimer'
    ];
    
    timers.forEach(timerName => {
      if (this[timerName]) {
        // Безопасная очистка с проверкой типа
        if (typeof this[timerName].destroy === 'function') {
          this[timerName].destroy();
        } else if (typeof this[timerName].remove === 'function') {
          this[timerName].remove();
        } else if (typeof this[timerName] === 'number') {
          // Если это ID таймера
          clearTimeout(this[timerName]);
        }
        this[timerName] = null;
      }
    });
    
    // ===== 4. ОЧИСТКА TIME EVENTS =====
    if (this.time) {
      this.time.removeAllEvents();
    }
    
    // ===== 5. ОЧИСТКА TWEENS =====
    if (this.tweens) {
      this.tweens.killAll();
    }
    
    // ===== 6. ОТПИСКА ОТ СОБЫТИЙ =====
    if (this.scale && this._resizeHandler) {
      this.scale.off('resize', this._resizeHandler);
      this._resizeHandler = null;
    }
    
    // Wheel handler
    if (this._wheelHandler && this.input) {
      this.input.off('wheel', this._wheelHandler);
      this._wheelHandler = null;
    }
    
    // Input события
    if (this.input) {
      this.input.off('pointerdown');
      this.input.off('pointerup');
      this.input.off('pointermove');
    }
    
    // ===== 7. ОЧИСТКА КОНТЕЙНЕРА КАРТ =====
    if (this.cardsContainer) {
      this.cardsContainer.removeAll(true);
      this.cardsContainer.destroy();
      this.cardsContainer = null;
    }
    
    // ===== 8. ОЧИСТКА КАРТ =====
    if (this.cards && Array.isArray(this.cards)) {
      this.cards.forEach(card => {
        if (card && card.scene) {
          card.removeAllListeners();
          card.destroy();
        }
      });
      this.cards = [];
    }
    
    // ===== 9. ОЧИСТКА UI ЭЛЕМЕНТОВ =====
    const uiElements = [
      'hud', 'mistakeText', 'timeText', 'bgImage',
      'exitBtn', 'victoryContainer'
    ];
    
    uiElements.forEach(elementName => {
      if (this[elementName] && this[elementName].destroy) {
        this[elementName].destroy();
        this[elementName] = null;
      }
    });
    
    // ===== 10. ОЧИСТКА МАССИВОВ =====
    this.opened = [];
    this.levelButtons = [];
    
    // ===== 11. СБРОС СОСТОЯНИЯ =====
    if (this.gameState) {
      this.gameState.canResize = true;
      this.gameState.gameStarted = false;
      this.gameState.isMemorizationPhase = false;
    }
    
    console.log('✅ GameScene cleanup completed');
  }

  // НОВЫЙ МЕТОД: Fallback загрузка прогресса
  getProgressFallback() {
    try {
      const saved = localStorage.getItem('findpair_progress');
      const parsed = saved ? JSON.parse(saved) : {};
      return parsed.levels ? parsed : { levels: parsed };
    } catch (error) {
      console.warn('Error loading fallback progress:', error);
      return { levels: {} };
    }
  }

  // Универсальная функция для установки размера карты
  setCardSize(card, width, height) {
    if (!card || !card.scene || !card.texture) return;
    
    // Безопасное получение размеров текстуры
    const source = card.texture.source;
    if (!source || !source[0]) {
      console.warn('Card texture not ready');
      return;
    }
    
    const originalWidth = source[0].width || 100;
    const originalHeight = source[0].height || 100;
    
    const scaleX = width / originalWidth;
    const scaleY = height / originalHeight;
    
    card.setScale(scaleX, scaleY);
    card.setData('targetWidth', width);
    card.setData('targetHeight', height);
    card.setData('scaleX', scaleX);
    card.setData('scaleY', scaleY);
  }

  // Восстановление размера карты
  restoreCardSize(card) {
    if (!card || !card.scene) return;
    
    const targetWidth = card.getData('targetWidth');
    const targetHeight = card.getData('targetHeight');
    
    if (targetWidth && targetHeight) {
      this.setCardSize(card, targetWidth, targetHeight);
    } else if (this.gameState.cardWidth && this.gameState.cardHeight) {
      this.setCardSize(card, this.gameState.cardWidth, this.gameState.cardHeight);
    }
  }

  // Смена текстуры карты с сохранением размера
  setCardTexture(card, textureKey) {
    if (!card || !card.scene) return;
    
    // Сохраняем текущие размеры
    const targetWidth = card.getData('targetWidth') || this.gameState.cardWidth;
    const targetHeight = card.getData('targetHeight') || this.gameState.cardHeight;
    
    // Меняем текстуру
    card.setTexture(textureKey);
    
    // Восстанавливаем размер
    if (targetWidth && targetHeight) {
      this.setCardSize(card, targetWidth, targetHeight);
    }
  }

  // Очистка экрана победы
  clearVictoryScreen() {
    console.log('Clearing victory screen...');
    
    // Очищаем через контейнер если он существует
    if (this.victoryContainer) {
      this.victoryContainer.destroy();
      this.victoryContainer = null;
    }
    
    // Очищаем через массив элементов если он существует
    if (this.victoryElements && Array.isArray(this.victoryElements)) {
      this.victoryElements.forEach(element => {
        if (element && element.destroy) {
          element.destroy();
        }
      });
      this.victoryElements = null;
    }
    
    // Дополнительная очистка всех объектов с высоким depth (экран победы)
    const toDestroy = [];
    this.children.list.forEach(child => {
      if (child && child.depth >= 100) {
        toDestroy.push(child);
      }
    });
    
    toDestroy.forEach(child => {
      if (child && child.destroy) {
        child.destroy();
      }
    });
    
    // Сбрасываем флаг
    this.gameState.showingVictory = false;
    
    console.log('Victory screen cleared');
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
  async redrawLayout() {
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
          this.setCardTexture(card, card.getData('key'));
        } else {
          this.setCardTexture(card, 'back');
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
    await this.drawHUD().catch(console.error);
    
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

  // ОБНОВЛЕННЫЙ МЕТОД: Безопасная очистка визуальных элементов
  clearVisualElements() {
    // Очищаем экран победы перед очисткой других элементов
    this.clearVictoryScreen();
    
    // Уничтожение контейнера карт
    if (this.cardsContainer) {
      this.cardsContainer.removeAll(true);
      this.cardsContainer.destroy();
      this.cardsContainer = null;
    }
    
    // Безопасное уничтожение карт
    if (this.cards && Array.isArray(this.cards)) {
      this.cards.forEach(card => {
        if (card && card.scene) {
          card.removeAllListeners();
          card.destroy();
        }
      });
    }
    this.cards = [];
    
    this.clearHUD();
  }

  getSceneWH() {
    const { width, height } = this.scale;
    return { W: width, H: height };
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

  // Обновление HUD с таймером
  async drawHUD() {
    if (document.fonts && !this._fontsReady) {
      await document.fonts.ready;
      this._fontsReady = true;
    }
    
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
      fontFamily: 'Arial, sans-serif', fontSize: fontSize + 'px', color: '#FF6B6B', fontStyle: 'bold'
    }).setOrigin(0, 0.5).setDepth(6);

    // Таймер по центру
    this.timeText = this.add.text(W/2, hudH/2, this.formatTime(this.currentTimeSeconds), {
      fontFamily: 'Arial, sans-serif', fontSize: (fontSize + 2) + 'px', color: '#4ECDC4', fontStyle: 'bold'
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
    if (this.hud && this.hud.scene) this.hud.destroy();
    if (this.mistakeText && this.mistakeText.scene) this.mistakeText.destroy();
    if (this.timeText && this.timeText.scene) this.timeText.destroy();
    if (this.exitBtn && this.exitBtn.scene) this.exitBtn.destroy();
    this.hud = this.mistakeText = this.timeText = this.exitBtn = null;
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

  async startGame(level) {
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
      levelIndex: this.currentLevelIndex,
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

    await this.drawHUD().catch(console.error);
    this.createCardLayout(this.gameState.deck);

    // 5-секундный показ карт для запоминания
    this.showCardsForMemorization();
  }

  // Создание layout карт с улучшенной системой размеров
  createCardLayout(deck) {
    const level = this.currentLevel;
    
    // Используем реальные размеры viewport без вычетов
    const { width: W, height: H } = this.scale;
    
    // Адаптивный HUD - меньше места занимает
    const hudH = Math.min(80, Math.round(H * 0.1));
    const gameAreaH = H - hudH - 10;
    
    // Динамический расчет размеров карт под любой экран
    const horizontalPadding = W * 0.02;
    const verticalPadding = H * 0.02;
    
    const availableW = W - (horizontalPadding * 2);
    const availableH = gameAreaH - (verticalPadding * 2);
    
    // Расчет оптимального размера карт с учетом промежутков
    const gapSize = Math.min(8, W * 0.01);
    const cardMaxW = (availableW - (level.cols - 1) * gapSize) / level.cols;
    const cardMaxH = (availableH - (level.rows - 1) * gapSize) / level.rows;
    
    // Сохраняем пропорции карт
    const aspectRatio = 0.7;
    let cardW, cardH;
    
    if (cardMaxW / cardMaxH > aspectRatio) {
        cardH = cardMaxH;
        cardW = cardH * aspectRatio;
    } else {
        cardW = cardMaxW;
        cardH = cardW / aspectRatio;
    }
    
    // Ограничения для читаемости на больших экранах
    const maxAbsoluteCardW = Math.min(150, W * 0.15);
    const maxAbsoluteCardH = Math.min(200, H * 0.2);
    
    cardW = Math.min(cardW, maxAbsoluteCardW);
    cardH = Math.min(cardH, maxAbsoluteCardH);
    
    // Округляем для четкости
    cardW = Math.floor(cardW);
    cardH = Math.floor(cardH);
    
    // Сохраняем размеры для последующих операций
    this.gameState.cardWidth = cardW;
    this.gameState.cardHeight = cardH;
    this.gameState.gapSize = gapSize;
    
    console.log('Adaptive card dimensions:', cardW, 'x', cardH, 'gap:', gapSize);
    
    // Центрируем сетку карт на весь экран
    const totalW = level.cols * cardW + (level.cols - 1) * gapSize;
    const totalH = level.rows * cardH + (level.rows - 1) * gapSize;
    
    // Точное центрирование без отступов
    const offsetX = (W - totalW) / 2;
    const offsetY = hudH + (gameAreaH - totalH) / 2;
    
    // Создаем контейнер для всех карт
    if (!this.cardsContainer) {
        this.cardsContainer = this.add.container(0, 0);
    }
    this.cardsContainer.removeAll(true);
    
    for (let row = 0; row < level.rows; row++) {
        for (let col = 0; col < level.cols; col++) {
            const index = row * level.cols + col;
            const key = deck[index];
            
            const x = offsetX + col * (cardW + gapSize) + cardW/2;
            const y = offsetY + row * (cardH + gapSize) + cardH/2;
            
            const card = this.add.image(x, y, key)
                .setData('key', key)
                .setData('opened', false)
                .setData('matched', false)
                .setData('index', index)
                .setInteractive({ useHandCursor: true })
                .on('pointerdown', () => this.onCardClick(card));
            
            // Используем улучшенный метод установки размера
            this.setCardSize(card, cardW, cardH);
            
            // Добавляем в контейнер для групповых операций
            this.cardsContainer.add(card);
            this.cards.push(card);
        }
    }
    
    // Масштабируем контейнер при необходимости
    if (totalW > W || totalH > gameAreaH) {
        const scaleX = W / totalW * 0.95;
        const scaleY = gameAreaH / totalH * 0.95;
        const scale = Math.min(scaleX, scaleY, 1);
        
        this.cardsContainer.setScale(scale);
        console.log('Container scaled to:', scale);
    }
  }

  // 5-секундный показ карт для запоминания
  showCardsForMemorization() {
    console.log('Showing cards for memorization (5 seconds)...');
    
    // Проверка активности сцены
    if (!this.scene || !this.scene.isActive('GameScene')) {
      console.warn('Scene not active, aborting memorization');
      return;
    }
    
    const { W, H } = this.getSceneWH();
    
    // Блокируем resize во время показа карт
    this.gameState.canResize = false;
    this.gameState.isMemorizationPhase = true;
    
    // Показываем все карты лицом
    this.cards.forEach(card => {
      this.setCardTexture(card, card.getData('key'));
      card.disableInteractive();
    });

    // Показываем уведомление
    const notification = this.add.text(W/2, H*0.15, 'Запомните карты!', {
      fontFamily: 'Arial, sans-serif',
      fontSize: this._pxByH(0.05, 24, 32) + 'px',
      color: '#FFD700',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(1000);

    // Обратный отсчёт
    let countdown = 5;
    const countdownText = this.add.text(W/2, H*0.22, countdown.toString(), {
      fontFamily: 'Arial, sans-serif',
      fontSize: this._pxByH(0.08, 36, 48) + 'px',
      color: '#FF4444',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(1000);

    // AbortController для безопасной отмены
    this.memorizeController = new AbortController();

    // Таймер обратного отсчёта
    this.memorizeTimer = this.time.addEvent({
      delay: 1000,
      repeat: 4,
      callback: () => {
        // Проверяем отмену и активность сцены
        if (!this.scene || this.memorizeController?.signal.aborted) {
          this.memorizeTimer?.remove();
          return;
        }
        
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

  // Переворот карт с правильным сохранением размеров
  flipAllCardsAndStartGame() {
    console.log('Flipping all cards and starting game...');
    
    // Проверка активности сцены
    if (!this.scene || !this.scene.isActive('GameScene')) {
      console.warn('Scene not active, aborting flip');
      return;
    }
    
    // Анимированное переворачивание карт с сохранением размеров
    this.cards.forEach((card, index) => {
      // Сохраняем данные о размерах перед анимацией
      const scaleX = card.getData('scaleX');
      const scaleY = card.getData('scaleY');
      
      this.tweens.add({
        targets: card,
        scaleX: 0,
        duration: 200,
        delay: index * 30,
        ease: 'Power2.easeIn',
        onComplete: () => {
          // Меняем текстуру на заднюю сторону
          this.setCardTexture(card, 'back');
          
          // Возвращаем анимацию
          this.tweens.add({
            targets: card,
            scaleX: scaleX,
            duration: 200,
            ease: 'Power2.easeOut'
          });
        }
      });
    });

    // Финальная настройка после переворота
    this.flipTimer = this.time.delayedCall(1000, () => {
      // Проверка активности сцены
      if (!this.scene || !this.scene.isActive('GameScene')) {
        return;
      }
      
      // Включаем интерактивность карт
      this.cards.forEach(card => {
        card.setInteractive({ useHandCursor: true });
        this.restoreCardSize(card);
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

  onCardClick(card) {
    // Проверка активности сцены
    if (!this.scene || !this.scene.isActive('GameScene')) {
      return;
    }
    
    if (event && event.preventDefault) {
      event.preventDefault();
      event.stopPropagation();
    }
    
    // Тройная защита от race conditions
    if (!this.canClick || this._processingCards) return;
    if (card.getData('opened') || card.getData('matched')) return;
    if (card.getData('isAnimating')) return;
    
    const now = Date.now();
    if (this._lastClickTime && now - this._lastClickTime < 300) {
      return;
    }
    
    // Помечаем карту как анимирующуюся
    card.setData('isAnimating', true);
    this._lastClickTime = now;
    this._processingCards = true;
    
    // Анимация переворота
    this.tweens.add({
      targets: card,
      scaleX: 0,
      duration: 150,
      onComplete: () => {
        this.setCardTexture(card, card.getData('key'));
        this.tweens.add({
          targets: card,
          scaleX: card.getData('scaleX') || 1,
          duration: 150,
          onComplete: () => {
            card.setData('isAnimating', false);
            card.setData('opened', true);
            this.opened.push(card);
            
            if (this.opened.length === 2) {
              this.checkPair();
            } else {
              this._processingCards = false;
            }
          }
        });
      }
    });
  }

  checkPair() {
    if (this.opened.length !== 2) return;
    
    const [card1, card2] = this.opened;
    this.gameMetrics.attempts++;
    
    // Блокируем новые клики во время проверки
    this.canClick = false;
    
    // Проверяем совпадение
    if (card1.getData('key') === card2.getData('key')) {
      // СОВПАДЕНИЕ
      console.log('Match found!');
      
      // Помечаем как найденные
      card1.setData('matched', true);
      card2.setData('matched', true);
      
      // Затемняем карты
      card1.setAlpha(window.THEME?.cardDimAlpha || 0.5).disableInteractive();
      card2.setAlpha(window.THEME?.cardDimAlpha || 0.5).disableInteractive();
      
      // Очищаем массив открытых
      this.opened = [];
      
      // Разблокируем клики
      this._processingCards = false;
      this.canClick = true;
      
      // Записываем время до первого совпадения
      if (!this.gameMetrics.timeToFirstMatch) {
        this.gameMetrics.timeToFirstMatch = Date.now() - this.gameMetrics.startTime;
      }
      this.gameMetrics.matchTimes.push(Date.now() - this.gameMetrics.startTime);
      
      // Проверяем победу
      const allMatched = this.cards.every(card => card.getData('matched'));
      if (allMatched) {
        this.showWin();
      }
      
    } else {
      // НЕ СОВПАДЕНИЕ
      console.log('No match');
      
      this.gameMetrics.errors++;
      this.mistakeCount++;
      
      // Обновляем счетчик ошибок
      if (this.mistakeText) {
        this.mistakeText.setText('Ошибок: ' + this.mistakeCount);
      }
      
      // Закрываем карты через 800ms
      this.time.delayedCall(800, () => {
        if (card1 && card1.scene) {
          this.tweens.add({
            targets: card1,
            scaleX: 0,
            duration: 150,
            onComplete: () => {
              this.setCardTexture(card1, 'back');
              this.tweens.add({
                targets: card1,
                scaleX: card1.getData('scaleX') || 1,
                duration: 150,
                onComplete: () => {
                  card1.setData('opened', false);
                }
              });
            }
          });
        }
        
        if (card2 && card2.scene) {
          this.tweens.add({
            targets: card2,
            scaleX: 0,
            duration: 150,
            onComplete: () => {
              this.setCardTexture(card2, 'back');
              this.tweens.add({
                targets: card2,
                scaleX: card2.getData('scaleX') || 1,
                duration: 150,
                onComplete: () => {
                  card2.setData('opened', false);
                }
              });
            }
          });
        }
        
        // Очищаем массив и разблокируем
        this.opened = [];
        this._processingCards = false;
        this.canClick = true;
      });
    }
  }

  // Экран победы с интеграцией ProgressSyncManager
  async showWin() {
    this.clearVictoryScreen();
    
    this.canClick = false;
    this.gameState.gameStarted = false;
    this.gameState.showingVictory = true;
    this.stopGameTimer();
    this.cards.forEach(c => c.disableInteractive());

    const gameTime = this.currentTimeSeconds;
    const accuracy = this.gameMetrics.attempts > 0 ? 
      Math.round((1 - this.gameMetrics.errors / this.gameMetrics.attempts) * 100) : 100;

    // Сохранение через ProgressSyncManager
    const progressResult = await this.saveProgressViaSyncManager(
      this.currentLevelIndex, 
      gameTime, 
      this.gameMetrics.attempts, 
      this.gameMetrics.errors,
      accuracy
    );

    // Проверка достижений через новую систему
    await this.checkAndUnlockAchievements(progressResult, gameTime, this.gameMetrics.errors);

    console.log('Game finished:', {
      time: gameTime,
      attempts: this.gameMetrics.attempts,
      errors: this.gameMetrics.errors,
      accuracy: accuracy,
      stars: progressResult.stars,
      improved: progressResult.improved
    });

    const { W, H } = this.getSceneWH();

    // Создаем контейнер для всех элементов экрана победы
    this.victoryContainer = this.add.container(0, 0);
    this.victoryContainer.setDepth(100);

    // Полупрозрачный фон
    const overlay = this.add.graphics();
    overlay.fillStyle(0x000000, 0.9);
    overlay.fillRect(0, 0, W, H);
    this.victoryContainer.add(overlay);

    // Красивое окно результатов
    const panelW = Math.min(500, W * 0.9);
    const panelH = Math.min(450, H * 0.8);
    const panelX = W/2;
    const panelY = H/2;

    const panel = this.add.graphics();
    panel.fillStyle(0x2C3E50, 0.95);
    panel.lineStyle(3, 0x3498DB, 0.8);
    panel.fillRoundedRect(panelX - panelW/2, panelY - panelH/2, panelW, panelH, 20);
    panel.strokeRoundedRect(panelX - panelW/2, panelY - panelH/2, panelW, panelH, 20);
    this.victoryContainer.add(panel);

    // Заголовок
    const title = this.add.text(panelX, panelY - panelH/2 + 50, 'ПОБЕДА!', {
      fontFamily: 'Arial, sans-serif', 
      fontSize: this._pxByH(0.06, 24, 42) + 'px', 
      color: '#F39C12', 
      fontStyle: 'bold'
    }).setOrigin(0.5);
    this.victoryContainer.add(title);

    // Отображение звёздочек
    this.showStarsAnimation(panelX, panelY - panelH/2 + 100, progressResult);

    // Детальная статистика
    const statsY = panelY - panelH/2 + 160;
    const lineHeight = 30;
    
    const timeText = this.add.text(panelX, statsY, `Время: ${this.formatTime(gameTime)}`, {
      fontFamily: 'Arial, sans-serif', fontSize: '18px', color: '#4ECDC4', fontStyle: 'bold'
    }).setOrigin(0.5);
    this.victoryContainer.add(timeText);

    const attemptsText = this.add.text(panelX, statsY + lineHeight, `Попыток: ${this.gameMetrics.attempts}`, {
      fontFamily: 'Arial, sans-serif', fontSize: '16px', color: '#E8E1C9', fontStyle: 'normal'
    }).setOrigin(0.5);
    this.victoryContainer.add(attemptsText);

    const errorsText = this.add.text(panelX, statsY + lineHeight * 2, `Ошибок: ${this.mistakeCount}`, {
      fontFamily: 'Arial, sans-serif', fontSize: '16px', color: '#E74C3C', fontStyle: 'normal'
    }).setOrigin(0.5);
    this.victoryContainer.add(errorsText);

    const accuracyText = this.add.text(panelX, statsY + lineHeight * 3, `Точность: ${accuracy}%`, {
      fontFamily: 'Arial, sans-serif', fontSize: '16px', color: '#2ECC71', fontStyle: 'normal'
    }).setOrigin(0.5);
    this.victoryContainer.add(accuracyText);

    // Показываем улучшение результата или статус синхронизации
    if (progressResult.improved) {
      const recordText = this.add.text(panelX, statsY + lineHeight * 4, 'Новый рекорд!', {
        fontFamily: 'Arial, sans-serif', fontSize: '18px', color: '#F39C12', fontStyle: 'bold'
      }).setOrigin(0.5);
      this.victoryContainer.add(recordText);
    }

    // Показываем статус синхронизации
    if (progressResult.synced) {
      const syncText = this.add.text(panelX, statsY + lineHeight * 5, '☁️ Синхронизировано', {
        fontFamily: 'Arial, sans-serif', fontSize: '14px', color: '#27AE60', fontStyle: 'normal'
      }).setOrigin(0.5);
      this.victoryContainer.add(syncText);
    } else if (progressResult.syncError) {
      const syncErrorText = this.add.text(panelX, statsY + lineHeight * 5, '⚠️ Ошибка синхронизации', {
        fontFamily: 'Arial, sans-serif', fontSize: '14px', color: '#E74C3C', fontStyle: 'normal'
      }).setOrigin(0.5);
      this.victoryContainer.add(syncErrorText);
    }

    // Кнопки
    const btnY = panelY + panelH/2 - 60;
    const btnW = Math.min(160, panelW * 0.35);
    const btnH = 45;

    // Кнопка "Ещё раз"
    const playAgainBtn = window.makeImageButton(
      this, panelX - btnW/2 - 10, btnY, btnW, btnH,
      'Ещё раз',
      () => this.restartLevel()
    );
    playAgainBtn.setDepth(102);

    // Кнопка "Меню"
    const menuBtn = window.makeImageButton(
      this, panelX + btnW/2 + 10, btnY, btnW, btnH,
      'Меню',
      () => {
        this.clearVictoryScreen();
        this.gameState.gameStarted = false;
        this.scene.start('MenuScene', { page: this.levelPage });
      }
    );
    menuBtn.setDepth(102);

    // Сохраняем ссылки на элементы для точной очистки
    this.victoryElements = [playAgainBtn, menuBtn];
  }

  // [ОСТАЛЬНЫЕ МЕТОДЫ БЕЗ ИЗМЕНЕНИЙ]
  // Сохранение прогресса через ProgressSyncManager
  async saveProgressViaSyncManager(levelIndex, gameTime, attempts, errors, accuracy) {
    // [код без изменений]
    let stars = 1;
    const errorRate = attempts > 0 ? errors / attempts : 0;
    
    if (errorRate === 0 && gameTime <= 60) stars = 3;
    else if (errorRate <= 0.2 && gameTime <= 90) stars = 2;
    
    const result = {
      stars,
      improved: false,
      synced: false,
      syncError: false,
      currentBest: null
    };

    try {
      if (this.syncManager) {
        const currentProgress = await this.syncManager.loadProgress();
        
        if (!currentProgress.levels) {
          currentProgress.levels = {};
        }
        
        const existingLevel = currentProgress.levels[levelIndex];
        const newLevel = {
          stars,
          bestTime: gameTime,
          bestAccuracy: accuracy,
          attempts,
          errors,
          accuracy,
          timestamp: Date.now(),
          completedAt: new Date().toISOString()
        };
        
        result.improved = !existingLevel || 
          stars > existingLevel.stars || 
          (stars === existingLevel.stars && gameTime < existingLevel.bestTime);
        
        if (result.improved) {
          currentProgress.levels[levelIndex] = newLevel;
          
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
          stats.totalTime += gameTime;
          stats.totalErrors += errors;
          stats.lastPlayed = Date.now();
          
          if (errors === 0) {
            stats.perfectGames++;
          }
          
          if (!stats.bestTime || gameTime < stats.bestTime) {
            stats.bestTime = gameTime;
          }
          
          stats.totalStars = Object.values(currentProgress.levels)
            .reduce((total, level) => total + (level.stars || 0), 0);
          
          await this.syncManager.saveProgress(currentProgress, true);
          
          result.synced = true;
          result.currentBest = newLevel;
          
          console.log('💾 Progress saved and synced via ProgressSyncManager:', {
            level: levelIndex,
            stars,
            time: gameTime,
            improved: result.improved
          });
        } else {
          result.currentBest = existingLevel;
        }
        
      } else {
        console.warn('ProgressSyncManager not available, using fallback');
        return this.saveProgressFallback(levelIndex, gameTime, attempts, errors, accuracy);
      }
      
    } catch (error) {
      console.error('❌ Failed to save progress via sync manager:', error);
      result.syncError = true;
      
      try {
        const fallbackResult = this.saveProgressFallback(levelIndex, gameTime, attempts, errors, accuracy);
        result.improved = fallbackResult.improved;
        result.currentBest = fallbackResult.currentBest;
      } catch (fallbackError) {
        console.error('❌ Fallback save also failed:', fallbackError);
      }
    }

    return result;
  }

  // [ОСТАЛЬНЫЕ МЕТОДЫ ОСТАЮТСЯ БЕЗ ИЗМЕНЕНИЙ - включая все методы достижений, анимаций и т.д.]
  
  // Перезапуск уровня с правильной очисткой
  restartLevel() {
    console.log('Restarting level...');
    
    // Очищаем экран победы перед перезапуском
    this.clearVictoryScreen();
    
    this.gameState.gameStarted = false;
    this.gameState.deck = null;
    this.gameState.cardWidth = null;
    this.gameState.cardHeight = null;
    this.gameSeed = this.generateSeed();
    
    // Небольшая задержка для корректной очистки
    this.time.delayedCall(100, () => {
      this.startGame(this.currentLevel);
    });
  }

  // [ВСЕ ОСТАЛЬНЫЕ МЕТОДЫ ОСТАЮТСЯ БЕЗ ИЗМЕНЕНИЙ]
  saveProgressFallback(levelIndex, gameTime, attempts, errors, accuracy) {
    try {
      const progress = this.getProgressFallback();
      
      let stars = 1;
      const errorRate = attempts > 0 ? errors / attempts : 0;
      
      if (errorRate === 0 && gameTime <= 60) stars = 3;
      else if (errorRate <= 0.2 && gameTime <= 90) stars = 2;
      
      const existingLevel = progress.levels[levelIndex];
      const newLevel = {
        stars,
        bestTime: gameTime,
        bestAccuracy: accuracy,
        attempts,
        errors,
        accuracy,
        timestamp: Date.now()
      };
