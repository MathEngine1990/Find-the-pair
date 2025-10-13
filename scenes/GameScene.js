//---scenes/GameScene.js - ПОЛНАЯ ВЕРСИЯ С ИНТЕГРАЦИЕЙ ProgressSyncManager
window.GameScene = class GameScene extends Phaser.Scene {

  destroy() {
  console.log('GameScene cleanup started');
  
  // Массив всех возможных таймеров
  const timers = [
    'memorizeTimer', 'flipTimer', 'gameTimer',
    'checkTimer', 'hideTimer', 'revealTimer'
  ];
  
  // Безопасная очистка каждого таймера
  timers.forEach(timerName => {
    if (this[timerName]) {
      if (typeof this[timerName].destroy === 'function') {
        this[timerName].destroy();
      } else if (typeof this[timerName].remove === 'function') {
        this[timerName].remove();
      }
      this[timerName] = null;
    }
  });
  
  // Очистка time events
  if (this.time) {
    this.time.removeAllEvents();
  }
  
  // Очистка tweens
  if (this.tweens) {
    this.tweens.killAll();
  }
  
  // Очистка слушателей

  
  // Очистка ввода
  this.input.off('pointerdown');
  this.input.off('pointerup');
  
  super.destroy();
}
  
  constructor() { 
    super('GameScene'); 
  }

  init(data) {
  // ✅ КРИТИЧНО: Обработка случая, когда передан индекс вместо объекта
  if (typeof data?.level === 'number') {
    console.warn('⚠️ Received level index instead of object, auto-converting');
    this.currentLevelIndex = data.level;
    this.currentLevel = window.LEVELS[data.level];
  } else if (data?.level && typeof data.level === 'object') {
    this.currentLevel = data.level;
    this.currentLevelIndex = data?.levelIndex ?? 0;
  } else {
    // Fallback: пытаемся взять первый уровень
    console.error('❌ No valid level provided!');
    this.currentLevel = window.LEVELS[0];
    this.currentLevelIndex = 0;
  }
  
  this.levelPage = data?.page || 0;
    
    // VK данные из PreloadScene
    this.vkUserData = data?.userData || window.VK_USER_DATA;
    this.isVKEnvironment = data?.isVK || !!window.VK_LAUNCH_PARAMS;
    
    // ДОБАВЛЕНО: Инициализация синхронизации
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
      // ИСПРАВЛЕНО: Фиксированные размеры карт
      cardWidth: null,
      cardHeight: null
    };
    
    // Ссылки на элементы экрана победы для точной очистки
    this.victoryElements = null;
    this.victoryContainer = null;
    
    // Seed для детерминированной генерации
    this.gameSeed = this.generateSeed();
    this.gameState.currentSeed = this.gameSeed;

    // ДОБАВЛЕНО: Метрики для синхронизации
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
    await document.fonts.ready;
    console.log('✅ Fonts ready');
  } catch (error) {
    console.warn('⚠️ Fonts API not available:', error);
    // Fallback: простая задержка
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  try {
    // ===== 1. ИНИЦИАЛИЗАЦИЯ БАЗОВЫХ ПЕРЕМЕННЫХ =====
    if (this.scale && this.scale.updateBounds) {
      this.scale.updateBounds();
    }
    
    // Базовые коллекции
    this.levelButtons = [];
    this.cards = [];

    // ✅ КРИТИЧНО: Уничтожаем контейнер перед созданием нового
    if (this.cardsContainer) {
      this.cardsContainer.destroy(true);
      this.cardsContainer = null;
    }
    
    this.opened = [];
    
    // ✅ КРИТИЧНО: Инициализируем флаги блокировки
    this.canClick = false;
    this._processingCards = false; // ← ДОБАВЛЕНО: Явная инициализация
    this._lastClickTime = 0; // ← ДОБАВЛЕНО: Защита от двойного клика
    
    // Счётчики
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
    this.memorizeController = null; // ← ДОБАВЛЕНО: AbortController

    // Обработчики событий
    this._resizeHandler = null;
    this._wheelHandler = null;
    
    // Флаги для предотвращения повторных инициализаций
    this._fontsReady = false;
    this._lastTapTime = 0;
    
    // ===== 2. ОЖИДАНИЕ ЗАГРУЗКИ КРИТИЧЕСКИХ РЕСУРСОВ =====

    // ✅ ДОБАВЛЕНО: Детектор long tasks (первые 5 секунд)
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
        console.log('ℹ️ PerformanceObserver not supported');
      }
    }
    
    // ✅ КРИТИЧНО: Ждём загрузку шрифтов ДО любой отрисовки текста
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
  console.error('Data received:', this.currentLevel);
  console.error('Available levels:', window.LEVELS?.length || 0);
  
  // ✅ Пытаемся восстановиться
  if (this.currentLevelIndex >= 0 && window.LEVELS[this.currentLevelIndex]) {
    console.log('🔧 Attempting recovery with levelIndex:', this.currentLevelIndex);
    this.currentLevel = window.LEVELS[this.currentLevelIndex];
  } else {
    console.error('❌ Cannot recover, returning to menu');
    this.scene.start('MenuScene', { page: this.levelPage || 0 });
    return;
  }
}
    
    // ===== 6. ✅ КРИТИЧНО: ЕДИНЫЙ RESIZE HANDLER С DEBOUNCE =====
    
    // Удаляем старые подписки ПЕРЕД добавлением новой
    this.scale.off('resize');

    // Создаём debounced handler (200ms задержка)
    let resizeTimeout = null;

    this._resizeHandler = () => {
      // Очищаем предыдущий таймер
      if (resizeTimeout) {
        clearTimeout(resizeTimeout);
        resizeTimeout = null;
      }
      
      // Устанавливаем новый таймер
      resizeTimeout = setTimeout(() => {
        // Проверяем, можно ли делать resize
        if (!this.gameState || !this.gameState.canResize) {
          console.log('⚠️ Resize blocked during critical phase');
          return;
        }
        
        console.log('🔍 Resize executing after debounce');
        
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
        
        resizeTimeout = null;
      }, 200); // 200ms debounce
    };

    // Подписываемся ОДИН раз
    this.scale.on('resize', this._resizeHandler, this);
    
    // ===== 7. ОБРАБОТЧИКИ ОЧИСТКИ =====
    
    // Регистрируем обработчики очистки
    this.events.once('shutdown', () => {
      console.log('🧹 Scene shutdown - cleaning up');
      
      // ✅ ДОБАВЛЕНО: Отменяем асинхронные операции
      if (this.memorizeController) {
        this.memorizeController.abort();
        this.memorizeController = null;
      }
      
      // ✅ ДОБАВЛЕНО: Очищаем resize timeout если есть
      if (resizeTimeout) {
        clearTimeout(resizeTimeout);
        resizeTimeout = null;
      }
      
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
    
    if (isVK) {
      
      // В VK - создаём менеджер с синхронизацией
      if (window.ProgressSyncManager) {
  this.syncManager = new window.ProgressSyncManager();
} else {
  // fallback
}
      this.syncManager = new ProgressSyncManager();
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

// НОВЫЙ МЕТОД: Правильная очистка с проверками
cleanup() {
  console.log('🧹 GameScene cleanup started');
  
  // ===== 1. ОЧИСТКА ТАЙМЕРОВ =====
  if (this.memorizeTimer) {
    clearTimeout(this.memorizeTimer);
    this.memorizeTimer = null;
  }
  
  const timers = [
    'memorizeTimer', 'flipTimer', 'gameTimer',
    'revealTimer', 'checkTimer', 'hideTimer'
  ];
  
  timers.forEach(timerName => {
    if (this[timerName]) {
      if (typeof this[timerName].destroy === 'function') {
        this[timerName].destroy();
      } else if (typeof this[timerName].remove === 'function') {
        this[timerName].remove();
      } else if (typeof this[timerName] === 'number') {
        clearTimeout(this[timerName]);
      }
      this[timerName] = null;
    }
  });
  
  // ===== 2. ОЧИСТКА TIME EVENTS =====
  if (this.time) {
    this.time.removeAllEvents();
  }
  
  // ===== 3. ОЧИСТКА TWEENS =====
  if (this.tweens) {
    this.tweens.killAll();
  }
  
  // ===== 4. ⚠️ КРИТИЧНО: СБРОС ФЛАГОВ БЛОКИРОВКИ =====
  this.canClick = false;
  this._processingCards = false; // ← 🔧 FIX #1: ДОБАВИТЬ ЭТУ СТРОКУ!
  this.gameStarted = false;
  this.isMemorizationPhase = false;
  
  // ===== 5. ОЧИСТКА СЛУШАТЕЛЕЙ =====
  if (this._wheelHandler && this.input) {
    this.input.off('wheel', this._wheelHandler);
    this._wheelHandler = null;
  }
  
  if (this.input) {
    this.input.off('pointerdown');
    this.input.off('pointerup');
    this.input.off('pointermove');
  }
  
  // ===== 6. ⚠️ КРИТИЧНО: ОЧИСТКА КАРТ + СНЯТИЕ isAnimating =====
  if (this.cards && Array.isArray(this.cards)) {
    this.cards.forEach(card => {
      if (card && card.scene) {
        card.setData('isAnimating', false); // ← 🔧 FIX #4: ДОБАВИТЬ ЭТУ СТРОКУ!
        card.removeAllListeners();
        card.destroy();
      }
    });
    this.cards = [];
  }
  
  // ===== 7. ⚠️ КРИТИЧНО: УНИЧТОЖЕНИЕ КОНТЕЙНЕРА =====
  if (this.cardsContainer && this.cardsContainer.scene) { // ← 🔧 FIX #5: Проверка scene
    this.cardsContainer.destroy(true);
    this.cardsContainer = null;
  }
  
  // ===== 8. ОЧИСТКА UI =====
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
  
  // ===== 9. ОЧИСТКА МАССИВОВ =====
  this.opened = [];
  this.levelButtons = [];
  
  // ===== 10. СБРОС СОСТОЯНИЯ =====
  if (this.gameState) {
    this.gameState.canResize = true;
    this.gameState.gameStarted = false;
    this.gameState.isMemorizationPhase = false;
  }
  
  // ===== 11. ОТПИСКА ОТ RESIZE =====
  if (this._resizeHandler) { // ← 🔧 FIX #3: Проверка handler
    this.scale.off('resize', this._resizeHandler);
    this._resizeHandler = null;
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

  // НОВЫЙ МЕТОД: Универсальная функция для установки размера карты
  setCardSize(card, width, height) {
  if (!card || !card.scene || !card.texture) return;
  
  // ИСПРАВЛЕНО: Безопасное получение размеров текстуры
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

  // НОВЫЙ МЕТОД: Восстановление размера карты
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

  // УЛУЧШЕННЫЙ МЕТОД: Смена текстуры карты с сохранением размера
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



  // НОВЫЙ МЕТОД: Очистка экрана победы
  clearVictoryScreen() {
  console.log('Clearing victory screen...');
  
  // ⚠️ КРИТИЧНО: Удаляем ТОЛЬКО через контейнер
  if (this.victoryContainer && this.victoryContainer.scene) {
    this.victoryContainer.destroy(true); // ← destroyChildren = true
    this.victoryContainer = null;
  }
  
  // ⚠️ FALLBACK: Удаляем orphan элементы с высоким depth
  const toDestroy = [];
  if (this.children && this.children.list) {
    this.children.list.forEach(child => {
      if (child && child.depth >= 100 && child !== this.victoryContainer) {
        toDestroy.push(child);
      }
    });
  }
  
  toDestroy.forEach(child => {
    if (child && child.scene && typeof child.destroy === 'function') {
      try {
        child.destroy();
      } catch (e) {
        console.warn('Error destroying orphan element:', e);
      }
    }
  });
  
  // Сбрасываем флаг
  if (this.gameState) {
    this.gameState.showingVictory = false;
  }
  
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
      levelIndex: this.currentLevelIndex, // ДОБАВЛЕНО
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

  // ИСПРАВЛЕНО: Создание layout карт с улучшенной системой размеров
// GameScene.js:980 - ЗАМЕНИТЬ ВСЮ ФУНКЦИЮ createCardLayout

createCardLayout(deck) {
  // ✅ FIX #1: Создаём fallback responsiveManager
  const rm = window.responsiveManager || {
    getAdaptiveFontSize: (base, min, max) => {
      const { H } = this.getSceneWH();
      const size = Math.floor(H * (base / 1000)); // base в промилле от высоты
      return Math.min(max, Math.max(min, size));
    },
    // ResponsiveManager.js:95
    // ✅ ВАРИАНТ 1: Уменьшить высоту HUD (больше места для карт)
if (!this.cachedCardParams || 
    this.cachedCardParams.containerW !== W || 
    this.cachedCardParams.containerH !== H - hudH) {
  
  this.cachedCardParams = rm.getCardDimensions(
    this.currentLevel,
    W,
    H - hudH
  );
  this.cachedCardParams.containerW = W;
  this.cachedCardParams.containerH = H - hudH;
}

const cardParams = this.cachedCardParams;
    //////////////////////////////////////////////////////////
  };
  
  // ✅ FIX #5: Защита от повторных вызовов
  if (this._isCreatingLayout) {
    console.warn('⚠️ createCardLayout already in progress, skipping');
    return;
  }
  this._isCreatingLayout = true;
  
  const { width: W, height: H } = this.scale;
  const hudH = rm.getAdaptiveFontSize(80, 60, 100);
  
  const cardParams = rm.getCardDimensions(
    this.currentLevel,
    W,
    H - hudH
  );
  
  // Кешируем размеры
  this.cachedCardParams = cardParams;
  
  // Удаляем старый контейнер только если он есть
  if (this.cardsContainer) {
    this.cardsContainer.destroy(true);
  }
  
  this.cardsContainer = this.add.container(0, hudH);
  this.cards = []; // ← ДОБАВИТЬ: Очистка массива карт
  
  // Создаём карты
  for (let row = 0; row < this.currentLevel.rows; row++) {
    for (let col = 0; col < this.currentLevel.cols; col++) {
      const index = row * this.currentLevel.cols + col;
      const key = deck[index];
      
      const x = cardParams.offsetX + col * (cardParams.cardW + cardParams.gapSize) + cardParams.cardW / 2;
      const y = cardParams.offsetY + row * (cardParams.cardH + cardParams.gapSize) + cardParams.cardH / 2;
      
      const card = this.add.image(x, y, key)
        .setData('key', key)
        .setData('opened', false)
        .setData('matched', false)
        .setData('index', index)
        .setInteractive({ useHandCursor: true })
        .off('pointerdown') // Удаляем старые подписки
        .on('pointerdown', (pointer, localX, localY, event) => {
          this.onCardClick(card, event); // ← Передаём event
        });
      
      this.setCardSize(card, cardParams.cardW, cardParams.cardH);
      this.cardsContainer.add(card);
      this.cards.push(card);
    }
  }
  
  // Сохраняем размеры для последующих операций
  this.gameState.cardWidth = cardParams.cardW;
  this.gameState.cardHeight = cardParams.cardH;
  this.gameState.gapSize = cardParams.gapSize;
  
  this._isCreatingLayout = false; // ← Освобождаем мьютекс
}

  // НОВЫЙ МЕТОД: Получение реальных размеров viewport
getSceneWH() {
    // КРИТИЧНО: Используем scale вместо game.config
    const { width, height } = this.scale;
    return { W: width, H: height };
}

// УЛУЧШЕННЫЙ МЕТОД: Обработка resize
handleResize(gameSize) {
  // Добавьте проверку:
  if (!this.gameState || !this.cardsContainer) {
    return;
  }
    console.log('Resize to:', gameSize.width, 'x', gameSize.height);
    
    // Пересчитываем layout только если игра не активна
    if (!this.gameState.gameStarted && !this.gameState.isMemorizationPhase) {
        this.createCardLayout(this.gameState.deck);
    } else if (this.cardsContainer) {
        // ОПТИМИЗАЦИЯ: Просто масштабируем контейнер при активной игре
        const { width: W, height: H } = gameSize;
        const hudH = Math.min(80, Math.round(H * 0.1));
        const gameAreaH = H - hudH - 10;
        
        const totalW = this.gameState.cardWidth * this.currentLevel.cols + 
                       this.gameState.gapSize * (this.currentLevel.cols - 1);
        const totalH = this.gameState.cardHeight * this.currentLevel.rows + 
                       this.gameState.gapSize * (this.currentLevel.rows - 1);
        
        const scaleX = W / totalW * 0.95;
        const scaleY = gameAreaH / totalH * 0.95;
        const scale = Math.min(scaleX, scaleY, 1);
        
        this.cardsContainer.setScale(scale);
        
        // Центрируем контейнер
        this.cardsContainer.x = (W - totalW * scale) / 2;
        this.cardsContainer.y = hudH + (gameAreaH - totalH * scale) / 2;
    }
}

  // 5-секундный показ карт для запоминания
  showCardsForMemorization() {
    console.log('Showing cards for memorization (5 seconds)...');
    
    const { W, H } = this.getSceneWH();
    
    // Блокируем resize во время показа карт
    this.gameState.canResize = false;
    this.gameState.isMemorizationPhase = true;
    
    // Показываем все карты лицом (они уже такие после createCardLayout)
    this.cards.forEach(card => {
      this.setCardTexture(card, card.getData('key'));
      card.disableInteractive(); // Отключаем клики на время запоминания
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
        if (this.memorizeController.signal.aborted) {
        this.memorizeTimer.remove();
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

  // ИСПРАВЛЕНО: Переворот карт с правильным сохранением размеров
  flipAllCardsAndStartGame() {
    console.log('Flipping all cards and starting game...');
    
    // Анимированное переворачивание карт с сохранением размеров
    this.cards.forEach((card, index) => {
      // Сохраняем данные о размерах перед анимацией
      const targetWidth = card.getData('targetWidth');
      const targetHeight = card.getData('targetHeight');
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
            scaleX: scaleX, // Восстанавливаем оригинальный масштаб
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
        // ИСПРАВЛЕНО: Убеждаемся что размеры правильные
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

  // ✅ НОВЫЙ КОД:
onCardClick(card, event) { // ← Добавить event в параметры
  // Предотвращаем стандартное поведение
  if (event) {
    if (event.preventDefault) event.preventDefault();
    if (event.stopPropagation) event.stopPropagation();
  }
  
  // ТРОЙНАЯ ЗАЩИТА от race conditions
  if (!this.canClick || this._processingCards) {
    console.log('⚠️ Click ignored: canClick =', this.canClick, ', processing =', this._processingCards);
    return;
  }
  if (card.getData('opened') || card.getData('matched')) {
    console.log('⚠️ Click ignored: card already opened/matched');
    return;
  }
  if (card.getData('isAnimating')) {
    console.log('⚠️ Click ignored: card is animating');
    return;
  }
  // ИСПРАВЛЕНО: Тройная защита от race conditions
  if (!this.canClick || this._processingCards) return;
  if (card.getData('opened') || card.getData('matched')) return;
  if (card.getData('isAnimating')) return; // Новая проверка
  
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
    // ✅ СОВПАДЕНИЕ
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
    // ❌ НЕ СОВПАДЕНИЕ
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

  // УЛУЧШЕННЫЙ МЕТОД: Экран победы с интеграцией ProgressSyncManager
  async showWin() {
      this.clearVictoryScreen(); // ← Убираем старые серые фоны
    
    this.canClick = false;
    this.gameState.gameStarted = false;
    this.gameState.showingVictory = true;
    this.stopGameTimer();
    this.cards.forEach(c => c.disableInteractive());

    const gameTime = this.currentTimeSeconds;
    const accuracy = this.gameMetrics.attempts > 0 ? 
      Math.round((1 - this.gameMetrics.errors / this.gameMetrics.attempts) * 100) : 100;

    // ОБНОВЛЕНО: Сохранение через ProgressSyncManager
    const progressResult = await this.saveProgressViaSyncManager(
      this.currentLevelIndex, 
      gameTime, 
      this.gameMetrics.attempts, 
      this.gameMetrics.errors,
      accuracy
    );

    // ОБНОВЛЕНО: Проверка достижений через новую систему
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
overlay.fillStyle(0x000000, 0.9); // ← Увеличить прозрачность до 0.9
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

    // ДОБАВЛЕНО: Показываем статус синхронизации
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

  // НОВЫЙ МЕТОД: Сохранение прогресса через ProgressSyncManager
  async saveProgressViaSyncManager(levelIndex, gameTime, attempts, errors, accuracy) {
    // Расчёт звёздочек (1-3 звезды)
    let stars = 1; // минимум 1 звезда за прохождение
    
    const errorRate = attempts > 0 ? errors / attempts : 0;
    
    if (errorRate === 0 && gameTime <= 60) stars = 3;      // отлично
    else if (errorRate <= 0.2 && gameTime <= 90) stars = 2; // хорошо
    
    const result = {
      stars,
      improved: false,
      synced: false,
      syncError: false,
      currentBest: null
    };

    try {
      if (this.syncManager) {
        // Используем ProgressSyncManager
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
        
        // Проверяем, лучше ли новый результат
        result.improved = !existingLevel || 
          stars > existingLevel.stars || 
          (stars === existingLevel.stars && gameTime < existingLevel.bestTime);
        
        if (result.improved) {
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
          stats.totalTime += gameTime;
          stats.totalErrors += errors;
          stats.lastPlayed = Date.now();
          
          if (errors === 0) {
            stats.perfectGames++;
          }
          
          if (!stats.bestTime || gameTime < stats.bestTime) {
            stats.bestTime = gameTime;
          }
          
          // Пересчитываем общее количество звезд
          stats.totalStars = Object.values(currentProgress.levels)
            .reduce((total, level) => total + (level.stars || 0), 0);
          
          // Сохраняем через синхронизатор (принудительная синхронизация)
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
        // Fallback к старой системе
        console.warn('ProgressSyncManager not available, using fallback');
        result = this.saveProgressFallback(levelIndex, gameTime, attempts, errors, accuracy);
      }
      
    } catch (error) {
      console.error('❌ Failed to save progress via sync manager:', error);
      result.syncError = true;
      
      // Пытаемся fallback сохранение
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

  // ОБНОВЛЕННЫЙ МЕТОД: Fallback сохранение прогресса
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
      
      const improved = !existingLevel || 
        stars > existingLevel.stars || 
        (stars === existingLevel.stars && gameTime < existingLevel.bestTime);
      
      if (improved) {
        progress.levels[levelIndex] = newLevel;
        localStorage.setItem('findpair_progress', JSON.stringify(progress));
        
        // Также пытаемся синхронизировать с VK если доступно
        if (this.isVKEnvironment && window.VKHelpers) {
          window.VKHelpers.setStorageData('findpair_progress', progress)
            .catch(err => console.warn('VK sync failed:', err));
        }
      }
      
      return {
        stars,
        improved,
        synced: false,
        syncError: false,
        currentBest: progress.levels[levelIndex]
      };
      
    } catch (error) {
      console.error('❌ Fallback save failed:', error);
      return {
        stars: 1,
        improved: false,
        synced: false,
        syncError: true,
        currentBest: null
      };
    }
  }

  // НОВЫЙ МЕТОД: Проверка достижений через ProgressSyncManager
  async checkAndUnlockAchievements(progressResult, gameTime, errors) {
    try {
      if (!this.syncManager) {
        // Fallback к старой системе
        return this.checkAchievements(gameTime, errors, this.currentLevel);
      }

      const currentProgress = await this.syncManager.loadProgress();
      
      if (!currentProgress.achievements) {
        currentProgress.achievements = {};
      }
      
      const achievements = currentProgress.achievements;
      const stats = currentProgress.stats;
      const newAchievements = [];
      
      // Первая победа
      if (!achievements.first_win) {
        achievements.first_win = true;
        newAchievements.push({
          id: 'first_win',
          title: 'Первая победа!',
          description: 'Выиграли первую игру',
          icon: '🏆',
          points: 10
        });
      }
      
      // Идеальная игра
      if (errors === 0 && !achievements.perfect_game) {
        achievements.perfect_game = true;
        newAchievements.push({
          id: 'perfect_game',
          title: 'Идеальная память!',
          description: 'Завершили игру без ошибок',
          icon: '🧠',
          points: 50
        });
      }
      
      // Скоростной бегун
      if (gameTime <= 30 && !achievements.speed_runner) {
        achievements.speed_runner = true;
        newAchievements.push({
          id: 'speed_runner',
          title: 'Скоростной бегун!',
          description: 'Завершили уровень за 30 секунд',
          icon: '⚡',
          points: 30
        });
      }
      
      // Эксперт памяти (сложный уровень)
      const level = this.currentLevel;
      const totalPairs = level ? (level.cols * level.rows) / 2 : 0;
      if (totalPairs >= 12 && !achievements.expert) {
        achievements.expert = true;
        newAchievements.push({
          id: 'expert',
          title: 'Эксперт памяти!',
          description: 'Прошли сложный уровень',
          icon: '🎓',
          points: 75
        });
      }
      
      // Упорство (много игр)
      if (stats && stats.gamesPlayed >= 10 && !achievements.persistent) {
        achievements.persistent = true;
        newAchievements.push({
          id: 'persistent',
          title: 'Упорство!',
          description: 'Сыграли 10 игр',
          icon: '🎯',
          points: 25
        });
      }
      
      // Коллекционер звезд
      if (stats && stats.totalStars >= 30 && !achievements.collector) {
        achievements.collector = true;
        newAchievements.push({
          id: 'collector',
          title: 'Коллекционер!',
          description: 'Собрали 30 звезд',
          icon: '📚',
          points: 40
        });
      }
      
      // Марафонец (много времени в игре)
      if (stats && stats.totalTime >= 3600 && !achievements.marathoner) { // 1 час
        achievements.marathoner = true;
        newAchievements.push({
          id: 'marathoner',
          title: 'Марафонец!',
          description: 'Провели в игре больше часа',
          icon: '🏃',
          points: 100
        });
      }
      
      // Сохраняем обновленные достижения
      if (newAchievements.length > 0) {
        await this.syncManager.saveProgress(currentProgress, true);
        
        // Показываем уведомления о новых достижениях
        this.showNewAchievements(newAchievements);
        
        // Отправляем во VK (если доступно)
        await this.shareAchievementsToVK(newAchievements);
      }
      
    } catch (error) {
      console.error('❌ Failed to check achievements:', error);
      // Fallback к старой системе
      this.checkAchievements(gameTime, errors, this.currentLevel);
    }
  }

  // НОВЫЙ МЕТОД: Показ новых достижений
  showNewAchievements(achievements) {
    const { W, H } = this.getSceneWH();
    
    achievements.forEach((achievement, index) => {
      setTimeout(() => {
        // Создаем уведомление о достижении
        const notification = this.add.container(W / 2, 150 + index * 120);
        
        // Фон уведомления
        const bg = this.add.graphics();
        bg.fillStyle(0x2C3E50, 0.95);
        bg.lineStyle(3, 0xF39C12, 1);
        bg.fillRoundedRect(-160, -40, 320, 80, 15);
        bg.strokeRoundedRect(-160, -40, 320, 80, 15);
        
        // Иконка достижения
        const icon = this.add.text(-130, 0, achievement.icon, {
          fontSize: '32px'
        }).setOrigin(0.5);
        
        // Текст достижения
        const title = this.add.text(-90, -10, achievement.title, {
          fontFamily: 'Arial, sans-serif',
          fontSize: '18px',
          color: '#F39C12',
          fontStyle: 'bold'
        }).setOrigin(0, 0.5);
        
        const description = this.add.text(-90, 10, achievement.description, {
          fontFamily: 'Arial, sans-serif',
          fontSize: '14px',
          color: '#FFFFFF'
        }).setOrigin(0, 0.5);
        
        // Очки
        const points = this.add.text(140, 0, `+${achievement.points}`, {
          fontFamily: 'Arial, sans-serif',
          fontSize: '16px',
          color: '#27AE60',
          fontStyle: 'bold'
        }).setOrigin(1, 0.5);
        
        notification.add([bg, icon, title, description, points]);
        notification.setDepth(1000);
        
        // Анимация появления
        notification.setAlpha(0);
        notification.setScale(0.8);
        
        this.tweens.add({
          targets: notification,
          alpha: 1,
          scaleX: 1,
          scaleY: 1,
          duration: 500,
          ease: 'Back.easeOut'
        });
        
        // Автоматическое скрытие через 4 секунды
        setTimeout(() => {
          this.tweens.add({
            targets: notification,
            alpha: 0,
            scaleX: 0.8,
            scaleY: 0.8,
            duration: 300,
            ease: 'Power2.easeIn',
            onComplete: () => {
              notification.destroy();
            }
          });
        }, 4000);
        
      }, index * 500); // Задержка между достижениями
    });
  }

  // НОВЫЙ МЕТОД: Шаринг достижений во VK
  async shareAchievementsToVK(achievements) {
    try {
      if (!window.VKHelpers || !window.VK_BRIDGE_READY) {
        return;
      }
      
      for (const achievement of achievements) {
        // Делимся достижением во VK
        try {
          await window.VKHelpers.shareResult(
            `🏆 Получено достижение "${achievement.title}"!\n${achievement.description}\n\n#ИграПамять #FindThePair`,
            this.currentLevelIndex
          );
          
          console.log('✅ Achievement shared to VK:', achievement.title);
          
        } catch (error) {
          console.log('VK sharing cancelled or not available');
        }
      }
      
    } catch (error) {
      console.error('❌ Failed to share achievements:', error);
    }
  }

  // Анимация звёздочек
  showStarsAnimation(x, y, progressResult) {
    const { stars, improved } = progressResult;
    const starSize = 40;
    const starSpacing = 60;
    
    for (let i = 1; i <= 3; i++) {
      const starX = x + (i - 2) * starSpacing;
      const filled = i <= stars;
      const star = this.add.text(starX, y, filled ? '★' : '☆', {
        fontSize: `${starSize}px`,
        color: filled ? '#FFD700' : '#666666'
      }).setOrigin(0.5)
        .setDepth(102); // ← ДОБАВИТЬ depth
      
      // Добавляем звезду в контейнер если он существует
      if (this.victoryContainer) {
        this.victoryContainer.add(star);
      }
      
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
    const starsLabel = this.add.text(x, y + 50, starsText, {
      fontFamily: 'Arial, sans-serif',
      fontSize: '18px',
      color: '#F39C12',
      fontStyle: 'bold'
    }).setOrigin(0.5)
      .setDepth(102); // ← ДОБАВИТЬ depth
    
    if (this.victoryContainer) {
      this.victoryContainer.add(starsLabel);
    }
  }

  // Эффект блеска звёзд
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

  // ОБНОВЛЕННЫЙ МЕТОД: Перезапуск уровня с правильной очисткой
  restartLevel() {
    console.log('Restarting level...');

     // ✅ ДОБАВИТЬ ПОЛНУЮ ОЧИСТКУ:
  this.cleanup();
    
    // Очищаем экран победы перед перезапуском
    this.clearVictoryScreen();
    
    this.gameState.gameStarted = false;
    this.gameState.deck = null; // Очищаем сохраненную колоду для новой генерации
    this.gameState.cardWidth = null; // Сбрасываем фиксированные размеры
    this.gameState.cardHeight = null;
    this.gameSeed = this.generateSeed(); // Новый seed
    
    // Небольшая задержка для корректной очистки
    this.time.delayedCall(100, () => {
      this.startGame(this.currentLevel);
    });
  }

  // ОБНОВЛЕННЫЙ МЕТОД: Проверка достижений (fallback)
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
    
    
    
    // Сохраняем достижения
    if (newAchievements.length > 0) {
      await this.saveAchievements();
      
      // Показываем уведомления о достижениях
      this.showAchievements(newAchievements);
    }
  }

  // СТАРЫЙ МЕТОД: Показ достижений (fallback)
  showAchievements(achievements) {
    const { W, H } = this.getSceneWH();
    
    achievements.forEach((achievement, index) => {
      // Создаем уведомление о достижении
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
        fontFamily: 'Arial, sans-serif',
        fontSize: '18px',
        color: '#F39C12',
        fontStyle: 'bold'
      }).setOrigin(0, 0.5).setDepth(201);
      
      // Описание достижения
      const achievementDesc = this.add.text(x - bgWidth/2 + 60, y + 15, achievement.description, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '14px',
        color: '#E8E1C9',
        fontStyle: 'normal'
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
        ease: 'Back.easeOut'
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
      g.addColorStop(0, window.THEME.bgTop); g.addColorStop(0.6, window.THEME.bgMid); g.addColorStop(1, window.THEME.bgBottom);
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
