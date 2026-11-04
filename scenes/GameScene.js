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
  if (window.history && history.pushState) {
    history.pushState({ scene: 'GameScene' }, '');
  }
} catch {}


    this._exitConfirmOpen = false;

    
    try {
      this.textManager = new TextManager(this);
      this._isInitializing = true;  // ← Флаг для блокировки cleanup
      
    // ⏳ Теперь ждем шрифты (но TextManager уже создан)
    if (document.fonts && document.fonts.ready) {
      try {
        console.log('⏳ Waiting for fonts...');
        await document.fonts.ready;
        this._fontsReady = true;
        console.log('✅ Fonts loaded');
      } catch (error) {
        console.warn('⚠️ Fonts API error:', error);
        await new Promise(resolve => setTimeout(resolve, 300));
        this._fontsReady = true;
      }
    }

        // 🔄 Обновляем размеры после загрузки шрифтов
    this.textManager.updateDimensions();
    
      
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

    // ===== Stars runtime (HUD) =====
this.starState = {
  base: true,      // 1-я звезда: за прохождение (всегда true, просто как "есть 1")
  timeOk: true,    // 2-я звезда: уложился по времени
  errorsOk: true   // 3-я звезда: уложился по ошибкам
};

this.starRules = {
  pairs: 0,
  timeLimitSec: 0,
  maxErrors: 0
};

// HUD элементы звёзд
this.starsContainer = null;
this.starIcons = []; // [text,text,text]

    
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
     this.drawHUD();
    
    // ===== 3. АСИНХРОННАЯ ИНИЦИАЛИЗАЦИЯ МЕНЕДЖЕРОВ =====
    
    // Инициализация синхронизации БЕЗ блокировки
      // 🔥 Неблокирующая параллельная инициализация
  const initPromises = [
    // Fonts с timeout
    Promise.race([
      document.fonts.ready,
      new Promise(resolve => setTimeout(resolve, 2000))
    ]).then(() => {
      this._fontsReady = true;
      this.textManager.updateDimensions();
    }),
    
    // Sync в фоне
    this.initializeSyncManager().catch(e => {
      console.warn('⚠️ Sync failed, using fallback:', e);
      this.syncManager = null;
    })
  ];

      // 🎯 НЕ ЖДЁМ Promise.all, продолжаем сразу!
  Promise.all(initPromises).then(() => {
    this._isInitializing = false;
    console.log('✅ Background init complete');
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
// === GameScene.js:193-219 - УПРОСТИТЬ ===

async initializeSyncManager() {
  // ✅ Получаем из registry
  this.syncManager = this.registry.get('progressSyncManager');
  
  if (!this.syncManager) {
    console.error('❌ ProgressSyncManager not found in registry!');
    
    // ✅ ИСПРАВЛЕННЫЙ fallback с User ID
    this.syncManager = {
      getProgress: async () => {
        try {
          const key =
  this.syncManager?.getUserStorageKey?.() ||
  `findpair_progress_guest`;

          const saved = localStorage.getItem(key);
          
          if (!saved) return { levels: {} };
          
          const parsed = JSON.parse(saved);
          return parsed;
        } catch (error) {
          console.warn('Fallback getProgress error:', error);
          return { levels: {} };
        }
      },
      loadProgress: async function() {
        return await this.getProgress();
      },
      saveProgress: (data) => {
        try {
          const key =
  this.syncManager?.getUserStorageKey?.() ||
  `findpair_progress_guest`;

          
          localStorage.setItem(key, JSON.stringify(data));
        } catch (e) {
          console.error('Fallback saveProgress error:', e);
        }
      },
      isVKAvailable: () => false
    };
  }
  
  // Загружаем прогресс асинхронно
  try {
  // ✅ Проверяем метод существует
  if (this.syncManager?.getProgress) {
    this.progressData = await this.syncManager.getProgress();
  } else if (this.syncManager?.loadProgress) {
    this.progressData = await this.syncManager.loadProgress();
  } else {
    console.warn('⚠️ No progress method available');
    this.progressData = { levels: {} };
  }
} catch (error) {
  console.error('Failed to load progress:', error);
  this.progressData = { levels: {} };
}
}

// НОВЫЙ МЕТОД: Правильная очистка с проверками
cleanup() {
  this._resultRun = null;
  if (this._adsInputRestore !== undefined && this.input) {
    this.input.enabled = this._adsInputRestore;
    this._adsInputRestore = undefined;
  }
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

  


  // НОВЫЙ МЕТОД: Универсальная функция для установки размера карты
  // GameScene.js:357 - ЗАМЕНИТЬ метод setCardSize
setCardSize(card, width, height) {
  if (!card || !card.scene || !card.texture) return;
  
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
  
  // ✅ FIX: Сохраняем КАК ДАННЫЕ, ТАК И В displayWidth/displayHeight
  card.setData('targetWidth', width);
  card.setData('targetHeight', height);
  card.setData('scaleX', scaleX);
  card.setData('scaleY', scaleY);
  card.setData('originalTextureWidth', originalWidth);   // ✅ НОВОЕ
  card.setData('originalTextureHeight', originalHeight); // ✅ НОВОЕ
  
  // ✅ НОВОЕ: Дублируем в displaySize для гарантии
  card.displayWidth = width;
  card.displayHeight = height;
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
  // GameScene.js:379 - ЗАМЕНИТЬ метод setCardTexture
// GameScene.js:379 - ЗАМЕНИТЬ setCardTexture
setCardTexture(card, textureKey) {
  // ✅ КРИТИЧНО: Тройная проверка существования
  if (!card || !card.scene || !card.active) {
    console.warn('⚠️ Attempt to change texture on destroyed card');
    return;
  }

  // ✅ НОВОЕ: Проверка существования текстуры
  if (!this.textures.exists(textureKey)) {
    console.error(`❌ Texture "${textureKey}" does not exist!`);
    return;
  }
  
  // Layout dimensions must survive the zero-width midpoint of a flip.
  const width = card.getData('targetWidth') || card.displayWidth;
  const height = card.getData('targetHeight') || card.displayHeight;
  card.setTexture(textureKey);
  this.setCardSize(card, width, height);
}

// One transition for every card, including textures with different source sizes.
flipCard(card, textureKey, onComplete, delay = 0) {
  if (!card?.scene || !card.active) return;
  card.setData('isAnimating', true);
  this.tweens.add({
    targets: card, scaleX: 0, duration: 130, delay,
    ease: 'Sine.easeIn',
    onComplete: () => {
      if (!card.scene || !card.active) return;
      this.setCardTexture(card, textureKey);
      const targetScaleX = card.scaleX;
      card.scaleX = 0;
      this.tweens.add({
        targets: card, scaleX: targetScaleX, duration: 170,
        ease: 'Sine.easeOut',
        onComplete: () => {
          if (!card.scene || !card.active) return;
          card.setData('isAnimating', false);
          if (onComplete) onComplete();
        }
      });
    }
  });
}



  // НОВЫЙ МЕТОД: Очистка экрана победы
  clearVictoryScreen() {
  console.log('Clearing victory screen...');
  
  // ⚠️ КРИТИЧНО: Удаляем ТОЛЬКО через контейнер
  if (this.victoryContainer && this.victoryContainer.scene) {
    this.victoryContainer.destroy(true); // ← destroyChildren = true
    this.victoryContainer = null;
  }

  // ✅ сбрасываем сохранённую позицию заголовка
this.victoryTitleY = null;
  
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







  // Форматирование времени
  formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `${secs}с`;
  }


createOrUpdateStarsHUD(maxRightXOverride, minLeftXOverride) {

  const { W, H } = this.getSceneWH();

  const rm = window.responsiveManager || { safeArea: { top: 0 } };
  const safeTop = rm.safeArea?.top || 0;

  const hudH = Math.min(70, Math.round(H * 0.085));

  // чистим старое
  if (this.starsContainer && this.starsContainer.scene) {
    this.starsContainer.destroy();
  }
  this.starsContainer = null;
  this.starIcons = [];

  const isMobile = rm.isMobile || W < 768 || H < 600;

let starSize = Math.round(hudH * (isMobile ? 0.38 : 0.5));
let spacing  = Math.round(starSize * 0.85);


  // ⭐ Позиция ВНУТРИ HUD
 // Размеры кнопок такие же, как в drawHUD()
const size = Math.round(hudH * 0.76);       // homeBtn size
const musicSize = Math.round(hudH * 0.70);  // music btn size

// Сколько места справа занято кнопками + зазоры
const rightOccupied =
  (size + 14) +           // домик + right margin
  (musicSize + 24) +      // музыка + gap
  8;                      // небольшой доп. буфер

const maxRightX = (typeof maxRightXOverride === 'number')
  ? maxRightXOverride
  : (W - Math.round(W * 0.20));

// 👈 дополнительный сдвиг звёзд влево
// было 0.10W — слишком агрессивно, звезды налезали на таймер
const starsShiftLeft = isMobile ? Math.round(W * 0.03) : Math.round(W * 0.02);


const minLeftX = (typeof minLeftXOverride === 'number') ? minLeftXOverride : null;

// базовая позиция (первой звезды)
let anchorX = maxRightX - spacing * 2 - starsShiftLeft;

// если задана левая граница (после таймера) — соблюдаем её
if (minLeftX !== null) {
  // если места между таймером и правой границей мало — ужимаем spacing (а значит и "ширину" блока звезд)
  const availableForStars = maxRightX - minLeftX;
  const neededForStars = spacing * 2;

  if (availableForStars < neededForStars) {
    const newSpacing = Math.max(10, Math.floor(availableForStars / 2));
    // аккуратно пересчитаем размеры под новый spacing
    spacing = newSpacing;
    starSize = Math.max(12, Math.floor(spacing / 0.85));
  }

  // финальный clamp: слева не залезаем на таймер, справа не залезаем на кнопки
  anchorX = Phaser.Math.Clamp(anchorX, minLeftX, maxRightX - spacing * 2);
} else {
  // если minLeftX не задан — просто держим в пределах справа
  anchorX = Math.min(anchorX, maxRightX - spacing * 2);
}



  const y = safeTop + hudH / 2;

  // ⭐ контейнер — тот же слой, что HUD
  this.starsContainer = this.add.container(0, 0).setDepth(6);

  for (let i = 0; i < 3; i++) {
    const icon = this.add.text(
      anchorX + i * spacing,
      y,
      '♣',
      {
        fontFamily: 'Arial, sans-serif',
        fontSize: `${starSize}px`,
        fontStyle: 'bold',
        color: '#F2DC9B'
      }
    ).setOrigin(0.5);

    this.starsContainer.add(icon);
    this.starIcons.push(icon);
  }

  this.updateStarsHUD();
}


updateStarsHUD() {
  if (!this.starIcons || this.starIcons.length !== 3) return;

  // 1-я звезда всегда есть
  const s1 = true;

  // 2-я: время
  const s2 = !!this.starState?.timeOk;

  // 3-я: ошибки
  const s3 = !!this.starState?.errorsOk;

  const states = [s1, s2, s3];

  for (let i = 0; i < 3; i++) {
    const ok = states[i];
    const icon = this.starIcons[i];
    if (!icon || !icon.scene) continue;

    icon.setText(ok ? '♣' : '♧');
    icon.setColor(ok ? '#F2DC9B' : '#BF3715');
    icon.setAlpha(ok ? 1 : 0.65);
  }
}


  // Обновление HUD с таймером
  // GameScene.js:623 - ЗАМЕНИТЬ МЕТОД drawHUD

// === GameScene.js:623-686 - ЗАМЕНИТЬ МЕТОД drawHUD ===

async drawHUD() {
  // ✅ FIX #2: КРИТИЧЕСКАЯ ПРОВЕРКА перед созданием текста
  if (!this.textManager) {
    console.error('❌ FATAL: TextManager not initialized!');
    // Экстренное создание
    this.textManager = new TextManager(this);
  }
  
  // ✅ FIX #2: Ждем шрифты если еще не загрузились
  if (document.fonts && !this._fontsReady) {
    try {
      console.log('⏳ HUD: Waiting for fonts...');
      await document.fonts.ready;
      this._fontsReady = true;
      console.log('✅ HUD: Fonts loaded');
    } catch (error) {
      console.warn('⚠️ HUD: Fonts API error:', error);
      await new Promise(resolve => setTimeout(resolve, 300));
      this._fontsReady = true;
    }
  }
  
  this.clearHUD();
  const { W, H } = this.getSceneWH();




  // ✅ Обновляем размеры TextManager
  this.textManager.updateDimensions();
    
  const hudH = Math.min(70, Math.round(H * 0.085));

  // Фон HUD
  const hud = this.add.graphics().setDepth(5);
  hud.fillStyle(0x000000, 0.85);
  hud.fillRoundedRect(0, 0, W, hudH, 0);
  this.hud = hud;

  // ✅ FIX #2: Безопасное создание текста с fallback
  try {
    // Счётчик ошибок
    this.mistakeText = this.textManager.createText(
      20, hudH/2, 
      'Ошибок: ' + this.mistakeCount, 
      'hudText'
    );
    this.mistakeText.setOrigin(0, 0.5).setDepth(6);
    this.mistakeText.setColor('#B6561A');

const rm = window.responsiveManager;
const isMobile = rm?.isMobile || W < 768 || H < 600;

// было 0.42 — на мобилке уезжал вправо и лез на звезды
const timerX = isMobile ? Math.round(W * 0.38) : Math.round(W * 0.50);


    // Таймер
this.timeText = this.textManager.createText(
  timerX, hudH/2,
  this.formatTime(this.currentTimeSeconds),
  'hudTimer'
);

    this.timeText.setOrigin(0.5, 0.5).setDepth(6);
    // ===== Stars HUD (right from timer) =====


    
  } catch (error) {
    console.error('❌ Failed to create HUD text:', error);
    
    // ✅ FALLBACK: Используем базовый Phaser.Text
    this.mistakeText = this.add.text(20, hudH/2, 'Ошибок: ' + this.mistakeCount, {
      fontFamily: 'Arial, sans-serif',
      fontSize: Math.min(20, Math.round(H * 0.035)) + 'px',
      color: '#FF6B6B'
    }).setOrigin(0, 0.5).setDepth(6);
    
    this.timeText = this.add.text(W/2, hudH/2, this.formatTime(this.currentTimeSeconds), {
      fontFamily: 'Arial, sans-serif',
      fontSize: Math.min(24, Math.round(H * 0.04)) + 'px',
      color: '#FFFFFF',
      fontStyle: 'bold'
    }).setOrigin(0.5, 0.5).setDepth(6);
  }

  // Кнопка домой справа
  const size = Math.round(hudH * 0.76);
const homeBtn = window.makeIconButton(
  this, W - (size/2 + 14), Math.round(hudH/2), size,
  '⌂',
  () => {
    this.requestExitToMenuConfirm('hud-home');
  }
);

  
  homeBtn.setDepth(7);
  this.exitBtn = homeBtn;

    // 🔊 Кнопка музыки рядом с домиком
  const musicSize = Math.round(hudH * 0.70);
  const musicIcon = this.game.registry.get('musicMuted') ? '🔇' : '🔊';

  // если раньше была — уничтожаем, чтобы не плодить при перерисовке
  if (this.musicButton && this.musicButton.destroy) {
    this.musicButton.destroy();
    this.musicButton = null;
  }

  this.musicButton = window.makeIconButton(
    this,
    W - (size + musicSize/2 + 24),          // левее кнопки "домой"
    Math.round(hudH / 2),
    musicSize,
    musicIcon,
    () => this.toggleMusic()
  );
  this.musicButton.setDepth(7);

  // ✅ после создания homeBtn и musicButton:
const musicBounds = this.musicButton?.getBounds?.();
const maxRightXForStars = musicBounds ? (musicBounds.left - 8) : (W - 20);

// 👇 левая граница для звёзд — правый край таймера + зазор
const timerBounds = this.timeText?.getBounds?.();
const minLeftXForStars = timerBounds ? (timerBounds.right + 12) : (Math.round(W * 0.38) + 60);

this.createOrUpdateStarsHUD(maxRightXForStars, minLeftXForStars);


  
  console.log('✅ HUD created successfully');
}

toggleMusic() {
  const registry = this.game.registry;
  const current = !!registry.get('musicMuted');
  const next = !current;

  // сохраняем состояние
  registry.set('musicMuted', next);
  localStorage.setItem('findpair_musicMuted', String(next));

  // глобальный mute для всего звука
  this.sound.mute = next;

  // обновляем иконку на кнопке, если она уже существует
  if (this.musicButton && this.musicButton.label) {
    this.musicButton.label.setText(next ? '🔇' : '🔊');
  }
}

// --- выход в меню с подтверждением ---

requestExitToMenuConfirm(source = 'unknown') {
  // анти-спам
  if (this._exitConfirmOpen) return;

  // если уже показываем победный экран — можно выходить без подтверждения
  if (this.gameState?.showingVictory) {
    this.stopGameTimer();
    this.scene.start('MenuScene', { page: this.levelPage });
    return;
  }

  this._exitConfirmOpen = true;

  // пауза таймера на время диалога
  const wasTimerRunning = !!this.gameTimer;
  this.stopGameTimer();

  const { W, H } = this.getSceneWH();

  const overlay = this.add.rectangle(W/2, H/2, W, H, 0x000000, 0.55).setDepth(2000);
  const modalW = Math.min(520, Math.round(W * 0.84));
  const modalH = Math.min(260, Math.round(H * 0.30));
  const modal = this.add.rectangle(W/2, H/2, modalW, modalH, 0x243540, 0.95).setDepth(2001);

  const title = this.add.text(W/2, H/2 - modalH*0.28, 'Выйти в меню?', {
    fontFamily: 'Arial, sans-serif',
    fontSize: Math.max(18, Math.round(H * 0.028)) + 'px',
    color: '#F2DC9B',
    fontStyle: 'bold'
  }).setOrigin(0.5).setDepth(2002);

  const text = this.add.text(W/2, H/2 - modalH*0.05,
    'Прогресс уровня не сохранится.\nТочно выйти?', {
    fontFamily: 'Arial, sans-serif',
    fontSize: Math.max(14, Math.round(H * 0.020)) + 'px',
    color: '#E8E8E8',
    align: 'center',
    lineSpacing: 6
  }).setOrigin(0.5).setDepth(2002);

  const cleanup = () => {
    [overlay, modal, title, text, yesBtn, noBtn].forEach(el => el?.destroy?.());
    this._exitConfirmOpen = false;

    // если пользователь отменил — возвращаем таймер, если он был
    if (wasTimerRunning && this.scene?.isActive()) {
      this.startGameTimer();
    }
  };

  const yesBtn = window.makeImageButton(
    this,
    W/2 - 90, H/2 + modalH*0.28,
    140, 46,
    'Выйти',
    () => {
      cleanup();
      this.stopGameTimer();
      this.scene.start('MenuScene', { page: this.levelPage });
    }
  );
  yesBtn.setDepth(2003);

  const noBtn = window.makeImageButton(
    this,
    W/2 + 90, H/2 + modalH*0.28,
    140, 46,
    'Отмена',
    () => cleanup()
  );
  noBtn.setDepth(2003);

  console.log('🚪 Exit confirm opened from:', source);
}

// будет вызываться из main.js по системной кнопке "назад"
onSystemBack() {
  this.requestExitToMenuConfirm('system-back');
}



clearHUD() {
  if (this.hud && this.hud.scene) this.hud.destroy();
  if (this.mistakeText && this.mistakeText.scene) this.mistakeText.destroy();
  if (this.timeText && this.timeText.scene) this.timeText.destroy();
  if (this.exitBtn && this.exitBtn.scene) this.exitBtn.destroy();

  // ✅ ВОТ ОНО: чистим звёзды HUD
  if (this.starsContainer && this.starsContainer.scene) {
    this.starsContainer.destroy();
  }
  this.starsContainer = null;
  this.starIcons = [];

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

  // ⭐ потеря 2-й звезды по времени (только в сторону false)
  if (this.starState && this.starState.timeOk) {
    if (this.currentTimeSeconds > (this.starRules?.timeLimitSec || 0)) {
      this.starState.timeOk = false;
      this.updateStarsHUD();
    }
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
    this._resultRun = {};
    this._winStarted = false;
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

    // ===== Star rules for this level =====
const pairs = this.gameMetrics.pairs;

// время: (pairs^2)*0.3 секунд
const timeLimitSec = Math.round((pairs * pairs) * 0.3);

// ошибки: меньше, чем 33% от кол-ва пар
// (чтобы было понятно и честно — сделаем порог целым: maxErrors = floor(pairs*0.33))
// условие будет: errors <= maxErrors
const maxErrors = Math.floor(pairs * 0.33);

this.starRules = { pairs, timeLimitSec, maxErrors };

// сброс состояния звёзд в начале уровня
this.starState = { base: true, timeOk: true, errorsOk: true };


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
  getCardDimensions: (level, W, availableH) => {
      const horizontalPadding = W * 0.01;
      const verticalPadding = availableH * 0.01;
      const availableW = W - (horizontalPadding * 2);
      const adjustedH = availableH - (verticalPadding * 2);
      
      const gapSize = Math.min(6, W * 0.008);
      const cardMaxW = (availableW - (level.cols - 1) * gapSize) / level.cols;
      const cardMaxH = (adjustedH - (level.rows - 1) * gapSize) / level.rows;
      
    const aspectRatio = window.CARD_ASPECT_RATIO || (2/3); // 0.666...

      let cardW, cardH;
      
      if (cardMaxW / cardMaxH > aspectRatio) {
        cardH = cardMaxH;
        cardW = cardH * aspectRatio;
      } else {
        cardW = cardMaxW;
        cardH = cardW / aspectRatio;
      }
      
      const isMobile = W < 768 || availableH < 600;
      if (!isMobile) {
        cardW = Math.min(cardW, W * 0.18);
        cardH = Math.min(cardH, availableH * 0.25);
      }
      
      return {
        cardW: Math.floor(cardW),
        cardH: Math.floor(cardH),
        gapSize: Math.floor(gapSize),
        offsetX: (W - (level.cols * cardW + (level.cols - 1) * gapSize)) / 2,
        offsetY: (availableH - (level.rows * cardH + (level.rows - 1) * gapSize)) / 2
      };
    }
  

  
    
    };
  
  // ✅ FIX #5: Защита от повторных вызовов
  if (this._isCreatingLayout) {
    console.warn('⚠️ createCardLayout already in progress, skipping');
    return;
  }
  this._isCreatingLayout = true;
  
  const { width: W, height: H } = this.scale;
  const hudH = rm.getAdaptiveFontSize(80, 60, 100);

  const availableH = H - hudH;
const dims = rm.getCardDimensions(this.currentLevel, W, availableH);

// ✅ Совместимо и с real ResponsiveManager, и с fallback из этой сцены
const w   = (dims.cardW ?? dims.width);
const h   = (dims.cardH ?? dims.height);
const gap = (dims.gapSize ?? dims.gap);

const cardParams = {
  cardW: Math.floor(w),
  cardH: Math.floor(h),
  gapSize: Math.floor(gap),
  offsetX: dims.offsetX,
  offsetY: dims.offsetY
};

// ✅ Жёсткая защита от NaN/undefined (иначе карты “исчезают”)
if (!cardParams.cardW || !cardParams.cardH) {
  console.error('❌ Invalid card params → cards will be invisible', { dims, cardParams });
  this._isCreatingLayout = false;
  return;
}


  

  
this.baseCardSize = { width: cardParams.cardW, height: cardParams.cardH };


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
      
      // Lightweight painted shadow adds depth without a per-frame blur filter.
      const shadow = this.add.graphics();
      const radius = Math.min(10, cardParams.cardW * 0.06);
      shadow.fillStyle(0x000000, 0.20);
      shadow.fillRoundedRect(
        x - cardParams.cardW / 2, y - cardParams.cardH / 2 + 3,
        cardParams.cardW, cardParams.cardH, radius
      );
      this.cardsContainer.add(shadow);

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

// === ЗАМЕНИТЬ ВЕСЬ БЛОК handleResize НА: ===

handleResize(gameSize) {
  // ✅ FIX #1: Проверка существования контейнера
  if (!this.gameState || !this.cardsContainer) {
    return;
  }
  
  console.log('Resize to:', gameSize.width, 'x', gameSize.height);
  
  // ✅ FIX #2: Обновляем размеры TextManager
  if (this.textManager) {
    this.textManager.updateDimensions();
    
    // Обновляем HUD тексты
    if (this.mistakeText) {
      this.textManager.updateText(this.mistakeText, 'hudText');
    }
    if (this.timeText) {
      this.textManager.updateText(this.timeText, 'hudTimer');
    }
  }
  
  // ✅ FIX #3: КРИТИЧНО - Пересчитываем Y-позицию контейнера!
  const { W, H } = this.getSceneWH();
  const rm = window.responsiveManager || {
    getAdaptiveFontSize: (base) => Math.floor(H * (base / 1000))
  };
  const currentHudH = rm.getAdaptiveFontSize(80, 60, 100);
  
  // ← КЛЮЧЕВАЯ СТРОКА: Синхронизируем позицию с текущим HUD
  this.cardsContainer.y = currentHudH;
  
  // ✅ FIX #4: Масштабируем контейнер вместо пересоздания layout
  if (this.gameState.gameStarted || this.gameState.isMemorizationPhase) {
    // Сохраняем aspect ratio контейнера
    const containerW = this.cardsContainer.getBounds().width;
    const containerH = this.cardsContainer.getBounds().height;
    const availableH = H - currentHudH;
    
    // Вычисляем scale (fit to screen)
    const scaleX = W / containerW;
    const scaleY = availableH / containerH;
    const scale = Math.min(scaleX, scaleY, 1); // Не увеличиваем больше 1
    
    this.cardsContainer.setScale(scale);
    
    // Центрируем по горизонтали
    const scaledW = containerW * scale;
    this.cardsContainer.x = (W - scaledW) / 2;
    
    console.log(`✅ Container repositioned: y=${currentHudH}, scale=${scale.toFixed(2)}`);
  } else {
    // Если игра ещё не началась - пересоздаём layout
    this.createCardLayout(this.gameState.deck);
  }
  
  // Перерисовываем фон
  this.ensureGradientBackground();
  
  // Перерисовываем HUD (если нужно)
  if (!this.gameState.gameStarted && !this.gameState.isMemorizationPhase) {
    this.clearHUD();
    this.drawHUD();
  }
}
  // 5-секундный показ карт для запоминания
  showCardsForMemorization() {
    console.log('Showing cards for memorization (5 seconds)...');
    
    const { W, H } = this.getSceneWH();

    // 🔹 Определяем мобильную версию
const isMobile = W <= 800 || H <= 600;

      // ✅ ДОБАВИТЬ: Обновляем размеры
  this.textManager.updateDimensions();
    
    // Блокируем resize во время показа карт
    this.gameState.canResize = false;
    this.gameState.isMemorizationPhase = true;
    
    // Показываем все карты лицом (они уже такие после createCardLayout)
    this.cards.forEach(card => {
      this.setCardTexture(card, card.getData('key'));
      card.disableInteractive(); // Отключаем клики на время запоминания
    });

// ✅ НОВЫЙ КОД: Уведомление
const baseNotificationSize = this.textManager.getSize('notification', { forceRecalc: true });

// пока оставляем одинаковый размер, как сейчас
const notificationSize = Math.round(
  baseNotificationSize * (isMobile ? 1.0 : 1.2)
);

const notification = this.textManager.createText(
  W / 2,
  H * 0.15,
  'Запомните карты!',
  'notification'
);
notification.setOrigin(0.5).setDepth(1000);

// задаём размер через отдельную ветку мобила/веб
if (notification.setFontSize) {
  notification.setFontSize(notificationSize);
}


  // ✅ НОВЫЙ КОД: Обратный отсчет
  let countdown = 5;
  const countdownText = this.textManager.createText(
    W/2, H*0.22,
    countdown.toString(),
    'countdown'
  );
  countdownText.setOrigin(0.5).setDepth(1000);

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
            duration: 100,
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
  // GameScene.js:1179 - ЗАМЕНИТЬ МЕТОД flipAllCardsAndStartGame

flipAllCardsAndStartGame() {
  console.log('Flipping all cards and starting game...');
  
  this.canClick = false;
  let remaining = this.cards.length;
  this.cards.forEach((card, index) => {
    this.flipCard(card, 'back', () => {
      if (--remaining !== 0) return;
      this.cards.forEach(item => item.setInteractive({ useHandCursor: true }));
      this.canClick = true;
      this.gameState.gameStarted = true;
      this.gameState.isMemorizationPhase = false;
      this.gameState.canResize = true;
      this.gameMetrics.startTime = Date.now();
      this.startGameTimer();
    }, index * Math.min(24, 240 / Math.max(1, this.cards.length - 1)));
  });
}

  // ✅ НОВЫЙ КОД:
// GameScene.js:1334 - ЗАМЕНИТЬ МЕТОД onCardClick
onCardClick(card, event) {
  // Предотвращаем стандартное поведение
  if (event) {
    if (event.preventDefault) event.preventDefault();
    if (event.stopPropagation) event.stopPropagation();
  }
  
  // Тройная защита от race conditions
  if (!this.canClick || this._processingCards) return;
  if (card.getData('opened') || card.getData('matched')) return;
  if (card.getData('isAnimating')) return;
  
  const now = Date.now();
  if (this._lastClickTime && now - this._lastClickTime < 50) return; // ← ИСПРАВЛЕНО: было 300
  
  // Помечаем карту как анимирующуюся
  card.setData('isAnimating', true);
  this._lastClickTime = now;
  this._processingCards = true;
  
  this.flipCard(card, card.getData('key'), () => {
    card.setData('opened', true);
    this.opened.push(card);
    this._processingCards = false;
    if (this.opened.length === 2) this.checkPair();
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
    card1.disableInteractive();
    card2.disableInteractive();
    this.tweens.add({
      targets: [card1, card2],
      alpha: window.THEME?.cardDimAlpha ?? 0.5,
      duration: 280,
      ease: 'Sine.easeOut'
    });
    
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

    // ⭐ потеря 3-й звезды по ошибкам (только в сторону false)
if (this.starState && this.starState.errorsOk) {
  const maxErrors = this.starRules?.maxErrors ?? 0;
  if (this.gameMetrics.errors > maxErrors) {
    this.starState.errorsOk = false;
    this.updateStarsHUD();
  }
}

    
    // Обновляем счетчик ошибок
    if (this.mistakeText) {
      this.mistakeText.setText('Ошибок: ' + this.mistakeCount);
    }

    // Keep input locked until BOTH cards have finished closing.
    this.time.delayedCall(400, () => {
      let remaining = 2;
      const closed = () => {
        if (--remaining !== 0) return;
        this.opened = [];
        this._processingCards = false;
        this.canClick = true;
      };
      [card1, card2].forEach(card => {
        this.flipCard(card, 'back', () => {
          card.setData('opened', false);
          closed();
        });
      });
    });
  }
}

// УЛУЧШЕННЫЙ МЕТОД: Экран победы с отдельным экраном достижений
async showWin() {
  if (this._winStarted) return;
  this._winStarted = true;
  const resultRun = this._resultRun;
  const isCurrent = () => this._resultRun === resultRun && this.scene.isActive();
// финальная фиксация условий перед сохранением
const pairs = this.starRules?.pairs ?? this.gameMetrics?.pairs ?? 0;
const timeLimitSec = this.starRules?.timeLimitSec ?? Math.round((pairs * pairs) * 0.3);
const maxErrors = this.starRules?.maxErrors ?? Math.floor(pairs * 0.33);

this.starState.timeOk = this.currentTimeSeconds <= timeLimitSec;
this.starState.errorsOk = (this.gameMetrics.errors ?? this.mistakeCount) <= maxErrors;
this.updateStarsHUD();


  this.clearVictoryScreen();
  this.canClick = false;
  this.gameState.gameStarted = false;
  this.gameState.showingVictory = true;
  this.stopGameTimer();
  this.cards.forEach(c => c.disableInteractive());

  const gameTime = this.currentTimeSeconds;
  const accuracy = this.gameMetrics.attempts > 0
    ? Math.round((1 - this.gameMetrics.errors / this.gameMetrics.attempts) * 100)
    : 100;

  let progressResult = {
    stars: 1,
    improved: false,
    synced: false,
    syncError: !this.syncManager,
    currentBest: null
  };

  let newAchievements = [];

  // 1) Сначала сохраняем прогресс и считаем ачивки
  if (this.syncManager) {
    try {
      const result = await this.saveProgressViaSyncManager(
        this.currentLevelIndex,
        gameTime,
        this.gameMetrics.attempts,
        this.gameMetrics.errors,
        accuracy
      );

      if (result && typeof result === 'object') {
        progressResult = { ...progressResult, ...result };
      }

      newAchievements = await this.checkAndUnlockAchievements(
        progressResult,
        gameTime,
        this.gameMetrics.errors
      ) || [];

    } catch (err) {
      console.warn('Background sync failed:', err);
      progressResult.syncError = true;
    }
  } else {
    console.warn('⚠️ showWin: syncManager is null, progress won’t be saved');
  }

  if (!isCurrent()) return;
  await this.showAdBeforeResults(isCurrent);
  if (!isCurrent()) return;

  const { W, H } = this.getSceneWH();
  this.textManager.updateDimensions();

  // 2) Внутренняя функция, которая рисует уже привычное окно "ПОБЕДА!"
  const renderVictoryUI = () => {
    if (!isCurrent()) return;
    this.victoryContainer = this.add.container(0, 0);
    this.victoryContainer.setDepth(100);

    // Полупрозрачный фон
    const overlay = this.add.graphics();
    overlay.fillStyle(0x000000, 0.9);
    overlay.fillRect(0, 0, W, H);
    this.victoryContainer.add(overlay);

    // Панель результатов
    const panelW = Math.min(500, W * 0.9);
    const panelH = Math.min(450, H * 0.8);
    const panelX = W / 2;
    const panelY = H / 2;

    const panel = this.add.graphics();
    panel.fillStyle(0x243540, 0.95);
    panel.lineStyle(3, 0x3A5939, 0.8);
    panel.fillRoundedRect(panelX - panelW / 2, panelY - panelH / 2, panelW, panelH, 20);
    panel.strokeRoundedRect(panelX - panelW / 2, panelY - panelH / 2, panelW, panelH, 20);
    this.victoryContainer.add(panel);

    // Заголовок "ПОБЕДА!"
    const title = this.textManager.createText(
      panelX, panelY - panelH / 2 + 50,
      'ПОБЕДА!',
      'titleLarge'
    );
    title.setOrigin(0.5);
    title.setColor('#F2DC9B');
    this.victoryContainer.add(title);
    this.victoryTitleY = title.y;

    // Звездочки
    this.showStarsAnimation(panelX, panelY - panelH / 2 + 100, progressResult);

    // Статистика
    const statsY = panelY - panelH / 2 + 180;
    const lineHeight = this.textManager.getSize('statLabel') * 1.8;

    const timeText = this.textManager.createText(
      panelX, statsY,
      `Время: ${this.formatTime(gameTime)}`,
      'statLabel'
    );
    timeText.setOrigin(0.5);
    timeText.setColor('#F2C791');
    this.victoryContainer.add(timeText);

    const attemptsText = this.textManager.createText(
      panelX, statsY + lineHeight,
      `Ходов: ${this.gameMetrics.attempts}`,
      'statValue'
    );
    attemptsText.setOrigin(0.5);
    attemptsText.setColor('#F2C791');
    this.victoryContainer.add(attemptsText);

    const errorsText = this.textManager.createText(
      panelX, statsY + lineHeight * 2,
      `Ошибок: ${this.mistakeCount}`,
      'statValue'
    );
    errorsText.setOrigin(0.5);
    errorsText.setColor('#BF3715');
    this.victoryContainer.add(errorsText);

    const accuracyText = this.textManager.createText(
      panelX, statsY + lineHeight * 3,
      `Точность: ${accuracy}%`,
      'statValue'
    );
    accuracyText.setOrigin(0.5);
    accuracyText.setColor('#F2C791');
    this.victoryContainer.add(accuracyText);

    if (progressResult.improved) {
      const recordText = this.textManager.createText(
        panelX, statsY + lineHeight * 4,
        'Новый рекорд!',
        'achievementTitle'
      );
      recordText.setOrigin(0.5);
      this.victoryContainer.add(recordText);
    }

    // if (progressResult.synced) {
    //   const syncText = this.textManager.createText(
    //     panelX, panelY + panelH / 2 - 110,
    //     'Прогресс сохранён',
    //     'smallLabel'
    //   );
    //   syncText.setOrigin(0.5);
    //   syncText.setColor('#02733E');
    //   this.victoryContainer.add(syncText);
    // } else if (progressResult.syncError) {
    //   const syncErrorText = this.textManager.createText(
    //     panelX, panelY + panelH / 2 - 110,
    //     'Не удалось синхронизировать прогресс',
    //     'smallLabel'
    //   );
    //   syncErrorText.setOrigin(0.5);
    //   syncErrorText.setColor('#BF3715');
    //   this.victoryContainer.add(syncErrorText);
    // }

const btnY = panelY + panelH / 2 - 60;
const btnW = Math.min(150, panelW * 0.30);
const btnH = 45;

const buttons = [];

// 🔁 Еще раз
buttons.push(
  window.makeImageButton(
    this,
    0, 0,
    btnW,
    btnH,
    'Еще раз',
    () => this.restartLevel(),
    { color: '#F2C791' }
  )
);

// 🏠 Меню
buttons.push(
  window.makeImageButton(
    this,
    0, 0,
    btnW,
    btnH,
    'Меню',
    () => {
      this.clearVictoryScreen();
      this.gameState.gameStarted = false;
      this.scene.start('MenuScene', { page: this.levelPage });
    },
    { color: '#F2C791' }
  )
);

// ➡️ Следующий уровень (ТОЛЬКО если он есть)
const nextLevelIndex = this.currentLevelIndex + 1;
const hasNextLevel = nextLevelIndex < window.LEVELS.length;

if (hasNextLevel) {
  buttons.push(
    window.makeImageButton(
      this,
      0, 0,
      btnW,
      btnH,
      'Далее',
      () => {
        this.clearVictoryScreen();
        this.scene.start('GameScene', {
          level: nextLevelIndex,
          page: Math.floor(nextLevelIndex / 9) // корректная страница меню
        });
      },
      { color: '#F2DC9B' }
    )
  );
}

// 📐 Раскладка кнопок по центру
const spacing = 16;
const totalW = buttons.length * btnW + (buttons.length - 1) * spacing;
let startX = panelX - totalW / 2 + btnW / 2;

buttons.forEach(btn => {
  btn.setPosition(startX, btnY);
  btn.setDepth(102);
  this.victoryContainer.add(btn);
  startX += btnW + spacing;
});

this.victoryElements = buttons;

  };

  // 3) Логика показа:
  //    если есть новые достижения — сначала экран достижений, потом окно победы;
  //    если нет — сразу окно победы.
  if (newAchievements && newAchievements.length > 0) {
    this.showAchievementsScreen(newAchievements, renderVictoryUI);
  } else {
    renderVictoryUI();
  }
}


  // The round timer and card input are already stopped by showWin.
  async showAdBeforeResults(isCurrent) {
    if (!window.adsManager) return;
    const inputWasEnabled = this.input.enabled;
    this._adsInputRestore = inputWasEnabled;
    const sound = this.sound;
    const wasMuted = sound?.mute;
    const { W, H } = this.getSceneWH();
    const status = this.add.text(W / 2, H / 2, 'Подготовка результатов…', {
      fontFamily: 'Arial', fontSize: '20px', color: '#FFFFFF',
      backgroundColor: '#243540', padding: { x: 20, y: 14 }
    }).setOrigin(0.5).setDepth(1000);
    this.input.enabled = false;
    try {
      await window.adsManager.beforeResults({
        isCurrent,
        onShow: () => { if (sound) sound.mute = true; },
        onFinish: () => {
          if (sound) sound.mute = !!wasMuted || document.hidden ||
            !!this.game.registry.get('musicMuted');
        }
      });
    } catch (error) {
      console.warn('[Ads] Results will be shown without advertising:', error);
    } finally {
      if (status.scene) status.destroy();
      if (isCurrent()) {
        this.input.enabled = inputWasEnabled;
        this._adsInputRestore = undefined;
      }
    }
  }

  // НОВЫЙ МЕТОД: Сохранение прогресса через ProgressSyncManager
// НОВЫЙ МЕТОД: Сохранение рекорда уровня через ProgressSyncManager
async saveProgressViaSyncManager(levelIndex, gameTime, attempts, errors, accuracy) {

// 1) Считаем звёзды по НОВЫМ правилам
let stars = 1;

const pairs = this.starRules?.pairs ?? this.gameMetrics?.pairs ?? 0;

// +1 за время меньше, чем (pairs^2)*0.3 секунд
const timeLimitSec = this.starRules?.timeLimitSec ?? Math.round((pairs * pairs) * 0.3);
if (gameTime <= timeLimitSec) stars++;

// +1 за ошибки меньше, чем 33% от кол-ва пар
const maxErrors = this.starRules?.maxErrors ?? Math.floor(pairs * 0.33);
if (errors <= maxErrors) stars++;


  const result = {
    stars,
    improved: false,   // стало ли лучше рекорд
    synced: false,
    syncError: false,
    currentBest: null
  };

  try {
    const currentProgress = this.syncManager?.loadFromLocal
  ? this.syncManager.loadFromLocal()
  : (await this.syncManager.loadProgress()) || {};


    if (!currentProgress.levels) currentProgress.levels = {};
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

    const levels = currentProgress.levels;
    const stats  = currentProgress.stats;

    const existing = levels[levelIndex];

    // 2) Базовая запись по уровню (то, что можно обновлять всегда)
    const updated = {
      ...(existing || {}),
      attempts,
      errors,
      // "последняя точность" — просто для доп. логики/достижений
      lastAccuracy: accuracy,
      timestamp: Date.now(),
      completedAt: new Date().toISOString()
    };

    // 3) Проверяем, улучшился ли рекорд
    const prevStars    = existing?.stars    ?? 0;
    const prevBestTime = existing?.bestTime ?? Infinity;

    const improved =
      !existing ||
      stars > prevStars ||
      (stars === prevStars && gameTime < prevBestTime);

    result.improved = improved;

    if (improved) {
      // Обновляем ИМЕННО рекорд:
      updated.stars        = stars;
      updated.bestTime     = gameTime;
      updated.bestAccuracy = accuracy;
      updated.accuracy     = accuracy; // историческое поле, чтобы MenuScene мог читать
    }

    // Сохраняем уровень
    levels[levelIndex] = updated;
    result.currentBest = updated;

    // 4) Обновляем глобальные stats
    stats.gamesPlayed++;
    stats.totalTime   += gameTime;
    stats.totalErrors += errors;
    stats.lastPlayed   = Date.now();

    if (errors === 0) {
      stats.perfectGames++;
    }

    if (!stats.bestTime || gameTime < stats.bestTime) {
      stats.bestTime = gameTime;
    }

    // Пересчитываем суммарные звёзды по всем уровням (рекордные)
    stats.totalStars = Object.values(levels)
      .reduce((sum, lvl) => sum + (lvl.stars || 0), 0);

// 5) Сохраняем прогресс (локально + VK, если умеет), но БЕЗ мгновенного VK-синка
await this.syncManager.saveProgress(currentProgress, false);
result.synced = true;


  } catch (e) {
    console.error('saveProgressViaSyncManager error:', e);
    result.syncError = true;
  }

  return result;
}



normalizeAchievementEntry(entry) {
  if (!entry) return null;

  // старая схема: просто true
  if (entry === true) {
    return {
      unlocked: true,
      unlockedAt: Date.now()
    };
  }

  // новая / ожидаемая схема
  if (typeof entry === 'object') {
    return {
      unlocked: entry.unlocked !== false,
      unlockedAt: entry.unlockedAt || Date.now()
    };
  }

  return null;
}

isAchievementUnlocked(achievements, id) {
  const entry = achievements?.[id];
  if (!entry) return false;
  if (entry === true) return true;
  if (typeof entry === 'object' && entry.unlocked) return true;
  return false;
}

calculateTotalStars(progress) {
  if (!progress?.levels) return 0;

  return Object.values(progress.levels)
    .reduce((sum, lvl) => sum + (lvl.stars || 0), 0);
}



// НОВЫЙ МЕТОД: Проверка достижений через ProgressSyncManager
async checkAndUnlockAchievements(progressResult, gameTime, errors) {

const progress = await this.syncManager.getProgress();

const totalStars = this.calculateTotalStars(progress);
progress.stats.totalStars = totalStars;

if (totalStars >= 30 && !progress.achievements.collector) {
  await this.syncManager.saveAchievement('collector');
  unlocked.push('collector');
}



  try {
    if (!this.syncManager) {
      console.warn('⚠️ No syncManager, skipping achievements update');
      return [];
    }

    const currentProgress = this.syncManager?.loadFromLocal
  ? this.syncManager.loadFromLocal()
  : (await this.syncManager.loadProgress()) || {};


    if (!currentProgress.achievements) currentProgress.achievements = {};
    if (!currentProgress.stats) currentProgress.stats = {};

    const achievements = currentProgress.achievements;
    const stats = currentProgress.stats;
    const newAchievements = [];

    // Хелпер: понять, считается ли ачивка уже открытой
    const isUnlocked = (entry) => {
      if (!entry) return false;
      if (entry === true) return true; // старый формат
      if (typeof entry === 'object' && entry.unlocked) return true;
      return false;
    };

    // Хелпер: аккуратное открытие ачивки с условием
    const unlock = (id, meta, condition = true) => {
      if (!condition) return;
      const existing = achievements[id];
      if (isUnlocked(existing)) return;

      achievements[id] = {
        unlocked: true,
        unlockedAt: Date.now(),
        ...meta
      };

      newAchievements.push(meta);
    };

    // Первая победа — без условий, просто если ещё не была
    unlock('first_win', {
      id: 'first_win',
      title: 'Первая победа!',
      description: 'Выиграли первую игру',
      icon: '🏆',
      points: 10
    });

    // Идеальная игра
    unlock(
      'perfect_game',
      {
        id: 'perfect_game',
        title: 'Идеальная память!',
        description: 'Завершили игру без ошибок',
        icon: '🧠',
        points: 50
      },
      errors === 0
    );

    // Скоростной бегун
    unlock(
      'speed_runner',
      {
        id: 'speed_runner',
        title: 'Скоростной бегун!',
        description: 'Завершили уровень за 30 секунд',
        icon: '⚡',
        points: 30
      },
      gameTime <= 30
    );

    // Эксперт памяти (сложный уровень)
    const level = this.currentLevel;
    const totalPairs = level ? (level.cols * level.rows) / 2 : 0;

    unlock(
      'expert',
      {
        id: 'expert',
        title: 'Эксперт памяти!',
        description: 'Прошли сложный уровень',
        icon: '🎓',
        points: 75
      },
      totalPairs >= 12
    );

    // Упорство (много игр)
    unlock(
      'persistent',
      {
        id: 'persistent',
        title: 'Упорство!',
        description: 'Сыграли 10 игр',
        icon: '🎯',
        points: 25
      },
      stats && stats.gamesPlayed >= 10
    );

    // Коллекционер звезд
    unlock(
      'collector',
      {
        id: 'collector',
        title: 'Коллекционер!',
        description: 'Собрали 30 звезд',
        icon: '📚',
        points: 40
      },
      stats && stats.totalStars >= 30
    );

    // Марафонец (много времени в игре)
    unlock(
      'marathoner',
      {
        id: 'marathoner',
        title: 'Марафонец!',
        description: 'Провели в игре больше часа',
        icon: '🏃',
        points: 100
      },
      stats && stats.totalTime >= 3600 // 1 час
    );

    // Сохраняем обновленные достижения, если они появились
    if (newAchievements.length > 0) {
      await this.syncManager.saveProgress(currentProgress, false);
    }

    // 👉 возвращаем список новых ачивок
    return newAchievements;

  } catch (error) {
    console.error('❌ Failed to check achievements:', error);
    return [];
  }
}

// ЭКРАН НОВЫХ ДОСТИЖЕНИЙ
showAchievementsScreen(newAchievements, onContinue) {
  if (!newAchievements || !newAchievements.length) {
    if (typeof onContinue === 'function') onContinue();
    return;
  }

  const { W, H } = this.getSceneWH();
  this.textManager.updateDimensions();

  const container = this.add.container(0, 0);
  container.setDepth(150);
  this.achievementsOverlay = container;

  // затемнение фона
  const overlay = this.add.graphics();
  overlay.fillStyle(0x000000, 0.8);
  overlay.fillRect(0, 0, W, H);
  overlay.setInteractive(new Phaser.Geom.Rectangle(0, 0, W, H), Phaser.Geom.Rectangle.Contains);
  container.add(overlay);

  // панель
  const panelW = Math.min(W * 0.85, 640);
  const panelH = Math.min(H * 0.7, 420);
  const panelX = W / 2;
  const panelY = H / 2;

  const panel = this.add.graphics();
  panel.fillStyle(0x243540, 0.96);
  panel.lineStyle(3, 0xF2DC9B, 0.9);
  panel.fillRoundedRect(panelX - panelW / 2, panelY - panelH / 2, panelW, panelH, 20);
  panel.strokeRoundedRect(panelX - panelW / 2, panelY - panelH / 2, panelW, panelH, 20);
  container.add(panel);

  // заголовок
  const title = this.textManager.createText(
    panelX,
    panelY - panelH / 2 + 40,
    'Новые достижения!',
    'titleMedium'
  );
  title.setOrigin(0.5);
  title.setColor('#F2DC9B');
  container.add(title);

  // список достижений
  const listTop = panelY - panelH / 2 + 90;
  const listBottom = panelY + panelH / 2 - 90;
  const listHeight = listBottom - listTop;
  const count = newAchievements.length;
  const itemGap = count > 1 ? listHeight / count : listHeight * 0.5;
  let y = listTop + itemGap / 2;

  newAchievements.forEach(ach => {
    const row = this.add.container(0, 0);

    // иконка
    const icon = this.add.text(
      panelX - panelW / 2 + 50,
      y,
      ach.icon || '🏆',
      { fontSize: '32px' }
    ).setOrigin(0.5);
    row.add(icon);

    // заголовок достижения
    const aTitle = this.textManager.createText(
      panelX - panelW / 2 + 90,
      y - 14,
      ach.title || '',
      'achievementTitle'
    );
    aTitle.setOrigin(0, 0.5);
    row.add(aTitle);

    // описание
    const desc = this.textManager.createText(
      panelX - panelW / 2 + 90,
      y + 14,
      ach.description || '',
      'achievementDesc'
    );
    desc.setOrigin(0, 0.5);

    const wrapWidth = panelW - 140;
    if (desc.setStyle) {
      desc.setStyle({
        wordWrap: { width: wrapWidth, useAdvancedWrap: true }
      });
    }
    row.add(desc);

    container.add(row);
    y += itemGap;
  });

  // кнопка "Далее"
  const btnY = panelY + panelH / 2 - 50;
  const btnW = Math.min(200, panelW * 0.6);
  const btnH = 48;

  const nextBtn = window.makeImageButton(
    this,
    panelX,
    btnY,
    btnW,
    btnH,
    'Далее',
    () => {
      container.destroy(true);
      this.achievementsOverlay = null;
      if (typeof onContinue === 'function') {
        onContinue();
      }
    },
    { color: '#F2C791' }
  );
  nextBtn.setDepth(151);
  container.add(nextBtn);
}



showNewAchievements(achievements) {
  const { W, H } = this.getSceneWH();

  // ✅ Обновляем размеры шрифтов
  this.textManager.updateDimensions();

  // ✅ Базовая точка по Y: стараемся рисовать НАД заголовком "ПОБЕДА!"
  // если victoryTitleY известна — берём чуть выше него,
  // иначе используем относительную позицию от высоты экрана
  const baseY =
    (this.victoryTitleY ? this.victoryTitleY - 70 : H * 0.18);
  const stepY = 90; // расстояние между тостами вверх

  achievements.forEach((achievement, index) => {
    setTimeout(() => {
      const y = baseY - index * stepY;

      // Создаем уведомление о достижении
      const notification = this.add.container(W / 2, y);

      // Фон уведомления
      const bg = this.add.graphics();
      bg.fillStyle(0x2C3E50, 0.95);
      bg.lineStyle(3, 0xF39C12, 1);
      bg.fillRoundedRect(-160, -40, 320, 80, 15);
      bg.strokeRoundedRect(-160, -40, 320, 80, 15);

      // Иконка
      const iconSize = this.textManager.getSize('achievementTitle') * 1.6;
      const icon = this.add.text(-130, 0, achievement.icon, {
        fontSize: iconSize + 'px'
      }).setOrigin(0.5);

      // Заголовок
      const title = this.textManager.createText(
        -90, -10,
        achievement.title,
        'achievementTitle'
      );
      title.setOrigin(0, 0.5);

      // Описание
      const description = this.textManager.createText(
        -90, 10,
        achievement.description,
        'achievementDesc'
      );
      description.setOrigin(0, 0.5);

      // Очки
      const pointsSize = this.textManager.getSize('achievementTitle');
      const points = this.add.text(140, 0, `+${achievement.points}`, {
        fontFamily: window.THEME.font,
        fontSize: pointsSize + 'px',
        color: '#27AE60',
        fontStyle: 'bold'
      }).setOrigin(1, 0.5);

      notification.add([bg, icon, title, description, points]);

      // оставляем большой depth, чтобы быть поверх фона/карт,
      // но ниже глобальных игровых уведомлений из main.js (у них 9999)
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

    }, index * 500); // задержка между достижениями
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
      const star = this.add.text(starX, y, filled ? '♣' : '♧', {
        fontSize: `${starSize}px`,
        color: filled ? '#F2DC9B' : '#BF3715' ,
        fontStyle: 'bold'
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
          scale: 1,
          duration: 400,
          delay: i * 140,
          ease: 'Back.easeOut',
          yoyo: false,
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
    const starsText = `${stars}/3 ♣`;
    const starsLabel = this.add.text(x, y + 35, starsText, {
      fontFamily: 'Arial, sans-serif',
      fontSize: '18px',
      color: '#F2DC9B',
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





  // Остальные методы
 // GameScene.js:1783 - ЗАМЕНИТЬ МЕТОД ensureGradientBackground

ensureGradientBackground() {
  const { W, H } = this.getSceneWH();
  
  // ✅ FIX #6: Проверяем кеш фоновых изображений
  if (this.textures.exists('bg_game')) {
    // Используем готовый фон из assets
    if (!this.bgImage || !this.bgImage.scene) {
      this.bgImage = this.add.image(W/2, H/2, 'bg_game')
        .setOrigin(0.5)
        .setDepth(-1000);
    }
    
    const src = this.textures.get('bg_game').getSourceImage();
    const scale = Math.max(W / src.width, H / src.height);
    this.bgImage.setDisplaySize(src.width * scale, src.height * scale);
    this.bgImage.setPosition(W/2, H/2);
    return;
  }

  // ✅ FIX #6: Кешируем градиенты по размеру экрана
  const cacheKey = `bg-grad-game-${W}x${H}`;
  
  // Проверяем существует ли градиент нужного размера
  if (this.textures.exists(cacheKey)) {
    console.log('📦 Using cached gradient:', cacheKey);
    
    if (!this.bgImage || !this.bgImage.scene) {
      this.bgImage = this.add.image(0, 0, cacheKey)
        .setOrigin(0, 0)
        .setDepth(-1000)
        .setDisplaySize(W, H);
    } else {
      // Переключаемся на кешированную текстуру
      this.bgImage.setTexture(cacheKey);
      this.bgImage.setDisplaySize(W, H);
      this.bgImage.setPosition(0, 0);
    }
    return;
  }
  
  // ✅ FIX #6: Создаём новый градиент ТОЛЬКО если нет в кеше
  console.log('🎨 Creating new gradient:', cacheKey);
  
  const DPR = this.getDPR();
  const texW = Math.max(2, Math.round(W * DPR));
  const texH = Math.max(2, Math.round(H * DPR));
  
  // Создаём canvas текстуру
  const tex = this.textures.createCanvas(cacheKey, texW, texH);
  const ctx = tex.getContext();
  
  // Применяем DPR scaling
  ctx.save();
  ctx.scale(DPR, DPR);
  
  // Рисуем градиент
  const gradient = ctx.createLinearGradient(0, 0, 0, H);
  gradient.addColorStop(0, window.THEME.bgTop || '#1a1a2e');
  gradient.addColorStop(0.6, window.THEME.bgMid || '#16213e');
  gradient.addColorStop(1, window.THEME.bgBottom || '#0f3460');
  
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
  
  // Обновляем текстуру
  tex.refresh();
  
  // Создаём/обновляем image
  if (!this.bgImage || !this.bgImage.scene) {
    this.bgImage = this.add.image(0, 0, cacheKey)
      .setOrigin(0, 0)
      .setDepth(-1000)
      .setDisplaySize(W, H);
  } else {
    this.bgImage.setTexture(cacheKey);
    this.bgImage.setDisplaySize(W, H);
  }
  
  console.log('✅ Gradient created and cached');
  
  // ✅ FIX #6: Очищаем старые кешированные градиенты
  this.cleanupOldGradients(cacheKey);
}

// ✅ НОВЫЙ МЕТОД: Добавить после ensureGradientBackground
cleanupOldGradients(currentKey) {
  // Оставляем только последние 3 градиента (текущий + 2 предыдущих)
  const maxGradients = 3;
  const gradientKeys = [];
  
  // Собираем все ключи градиентов
  this.textures.list.forEach((texture, key) => {
    if (key.startsWith('bg-grad-game-')) {
      gradientKeys.push(key);
    }
  });
  
  // Если градиентов больше лимита
  if (gradientKeys.length > maxGradients) {
    // Сортируем по времени создания (старые первыми)
    gradientKeys.sort();
    
    // Удаляем старые, кроме текущего
    const toRemove = gradientKeys.length - maxGradients;
    for (let i = 0; i < toRemove; i++) {
      const oldKey = gradientKeys[i];
      if (oldKey !== currentKey) {
        console.log('🗑️ Removing old gradient:', oldKey);
        this.textures.remove(oldKey);
      }
    }
  }
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
