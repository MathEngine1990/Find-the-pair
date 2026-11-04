//---scenes/MenuScene.js - ПОЛНОСТЬЮ ИСПРАВЛЕННАЯ ВЕРСИЯ

window.MenuScene = class MenuScene extends Phaser.Scene {
  constructor(){ 
    super('MenuScene'); 
  }

  init(data){ 
    this.levelPage = data?.page || 0; 
    
    // ✅ КРИТИЧНО: Инициализация коллекций UI
    this.levelButtons = [];
    this.syncButton = null;
    this._resizeDebounce = false;
    this._wheelHandler = null;
    this._syncInitiated = false; // ← ✅ НОВОЕ: Флаг для sync

    this.greetingTextObject = null; // ← ссылка на "Привет, ..." в меню

    
    // Получаем VK данные если есть
    this.vkUserData = data?.userData || window.VK_USER_DATA;
    this.isVKEnvironment = data?.isVK || !!window.VK_LAUNCH_PARAMS;
    
    // Инициализация синхронизации
    this.syncManager = null;
    this.progress = {};
    this.isSyncing = false;
}

// === MenuScene.js:48-56 - ЗАМЕНИТЬ ===

// === MenuScene.js:48-87 - ЗАМЕНИТЬ async create() ===

async create() {
  console.log('MenuScene.create() started');
  
  // 0. Базовая инициализация
  this.textManager = new TextManager(this);
  this._isInitializing = true;
  this._isDrawing = false;

  this.input.setTopOnly(true);

  // ✅ Если в localStorage выбран несуществующий пак — исправляем и перезагружаем ассеты
if (await this.ensureValidThemeConfig()) {
  console.warn('[Theme] Invalid theme fixed → restarting PreloadScene to reload textures');
  this.scene.start('PreloadScene', { isVK: this.isVKEnvironment, userData: this.vkUserData, page: 0 });
  return;
}


  // Базовая структура прогресса (на случай, если ничего не загрузится)
  this.progress = {
    levels: {},
    achievements: {},
    stats: {}
  };

  // Фон + музыка сразу
  this.ensureGradientBackground();
  this.initMusic();

  this.events.once('wake', () => {
  const muted = !!this.game.registry.get('musicMuted');
  if (this.musicButton?.label) {
    this.musicButton.label.setText(muted ? '🔇' : '🔊');
  }
});


  // 1️⃣ Инициализация syncManager (быстрая, локальная)
  try {
    await this.initializeSyncManager();
    console.log('✅ SyncManager initialized');
  } catch (e) {
    console.error('❌ Sync init failed:', e);
  }

  // 2️⃣ Быстрый локальный прогресс (НЕ сеть, НЕ VK)
  if (this.syncManager && typeof this.syncManager.loadFromLocal === 'function') {
    try {
      const localProgress = this.syncManager.loadFromLocal();
      if (localProgress && localProgress.levels) {
        this.progress = localProgress;
        console.log(
          '✅ Fast local progress loaded:',
          Object.keys(this.progress.levels || {}).length,
          'levels'
        );
      } else {
        console.log('ℹ️ No local progress yet, using empty object');
      }
    } catch (err) {
      console.warn('⚠️ loadFromLocal failed, keeping empty progress:', err);
      // this.progress оставляем как есть
    }
  }

  // 3️⃣ Рисуем меню — УЖЕ с локальным progress
  try {
    await this.drawMenu(this.levelPage);
  } catch (e) {
    console.error('❌ drawMenu error:', e);
  }

  // 4️⃣ МЯГКО ждём шрифты, но недолго
  if (document.fonts && document.fonts.ready) {
    try {
      await Promise.race([
        document.fonts.ready,
        new Promise(resolve => setTimeout(resolve, 300))
      ]);
      console.log('✅ Fonts soft-ready');
    } catch (e) {
      console.warn('⚠️ Fonts soft wait error:', e);
    }

    // Когда шрифты полностью догрузятся – аккуратно обновим текст
    document.fonts.ready
      .then(() => {
        if (this.scene.isActive()) {
          console.log('🔁 Fonts fully ready, refreshing UI');
          this.refreshUI();
        }
      })
      .catch(() => {});
  }

  // 5️⃣ Обновление прогресса из syncManager В ФОНЕ (VK / сервер / что угодно)
  if (this.syncManager?.getProgress) {
    this.syncManager.getProgress()
      .then(progress => {
        if (progress) {
          this.progress = progress;
          console.log(
            '✅ Remote/actual progress loaded:',
            Object.keys(this.progress.levels || {}).length,
            'levels'
          );
          if (this.scene.isActive()) {
            this.refreshUI();
          }
        }
      })
      .catch(err => {
        console.warn('⚠️ Initial getProgress failed, keeping local progress:', err);
      });
  }

  // 6️⃣ Фоновая синхронизация VK один раз (как у тебя было)
  if (this.syncManager?.isVKAvailable?.() && !this._syncInitiated) {
    console.log('🔄 Triggering initial background sync');
    this._syncInitiated = true;

    this.syncManager.performSync()
      .then((synced) => {
        if (synced) {
          console.log('✅ Background sync completed');
          if (this.scene.isActive() && this.syncManager?.getProgress) {
            this.syncManager.getProgress()
              .then(progress => {
                this.progress = progress;
                this.refreshUI();
              })
              .catch(err => {
                console.warn('⚠️ getProgress after sync failed:', err);
              });
          }
        }
      })
      .catch(err => {
        console.warn('⚠️ Background sync failed:', err);
      });
  }

  // 7️⃣ Разблокируем resize и подписки
  this._isInitializing = false;
  this.game.events.on('debounced-resize', this.handleResize, this);
  this.events.once('shutdown', this.cleanup, this);
}




// ✅ НОВЫЙ МЕТОД
// === MenuScene.js:90-103 - ЗАМЕНИТЬ handleResize ===

async handleResize() {
  // ✅ FIX #5: Блокируем resize во время инициализации
  if (this._isInitializing) {
    console.log('⏸️ Resize blocked: scene initializing');
    return;
  }
  
  if (!this.scene.isActive()) {
    console.log('⏸️ Resize blocked: scene inactive');
    return;
  }
  
  // ✅ Проверка TextManager
  if (!this.textManager) {
    console.warn('⚠️ TextManager missing during resize, recreating');
    this.textManager = new TextManager(this);
  }
  
  // 1️⃣ Обновляем размеры в TextManager
  this.textManager.updateDimensions();
  
  // 2️⃣ Перерисовываем UI
  this.ensureGradientBackground();
  await this.drawMenu(this.levelPage);
}

initMusic() {
  const registry = this.game.registry;

  // 1) читаем сохранённый mute (один раз за игру)
  let musicMuted = registry.get('musicMuted');
  if (musicMuted === undefined) {
    musicMuted = localStorage.getItem('findpair_musicMuted') === 'true';
    registry.set('musicMuted', musicMuted);
  }

  // 2) создаём / запускаем музыку один раз за игру
  let bgMusic = registry.get('bgMusic');

if (!bgMusic) {
  if (this.cache.audio.exists('bg_music')) {
    bgMusic = this.sound.add('bg_music', {
      loop: true,
      volume: 0.4
    });
    this.game.registry.set('bgMusic', bgMusic);
  }
}

  // 3) применяем mute к глобальному sound менеджеру
  this.sound.mute = !!musicMuted;
}


toggleMusic() {
  const registry = this.game.registry;
  const current = !!registry.get('musicMuted');
  const next = !current;

  // Обновляем глобальный флаг
  registry.set('musicMuted', next);
  localStorage.setItem('findpair_musicMuted', String(next));

  // Обновляем глобальный mute
  this.sound.mute = next;

  // Обновляем иконку на кнопке
  if (this.musicButton && this.musicButton.label) {
    this.musicButton.label.setText(next ? '🔇' : '🔊');
  }

  // Если выключили звук — на этом всё
  if (next) {
    console.log('[MenuScene] Music turned OFF via toggleMusic');
    return;
  }

  // Если включаем звук (next === false) — гарантируем, что музыка реально играет
  try {
    // 1) Будим аудиоконтекст (если браузер его засуспендил)
    const sound = this.sound;
    const ctx = sound.context || sound.audioContext || sound.ctx;
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(err => {
        console.warn('[MenuScene] AudioContext resume failed in toggleMusic:', err);
      });
    }

    // 2) Находим или создаём фоновую музыку
    let bgMusic = registry.get('bgMusic');

    if (!bgMusic) {
      if (this.cache.audio.exists('bg_music')) {
        bgMusic = this.sound.add('bg_music', {
          loop: true,
          volume: 0.4
        });
        registry.set('bgMusic', bgMusic);
        console.log('[MenuScene] bgMusic created in toggleMusic()');
      } else {
        console.warn('[MenuScene] bg_music not found in cache in toggleMusic()');
      }
    }

    // 3) Если музыка есть и не играет — запускаем
    if (bgMusic) {
      if (!bgMusic.isPlaying) {
        bgMusic.play({ loop: true });
        console.log('[MenuScene] bgMusic.play() from toggleMusic()');
      }
    }
  } catch (e) {
    console.warn('[MenuScene] toggleMusic playback error:', e);
  }
}





  // Инициализация менеджера синхронизации
// Инициализация менеджера синхронизации
async initializeSyncManager() {
  this.syncManager = this.registry.get('progressSyncManager');
  
  if (!this.syncManager) {
    console.error('❌ ProgressSyncManager not found in registry!');
    console.warn('⚠️ Using fallback syncManager (localStorage only)');
    
    // ✅ ИСПРАВЛЕННЫЙ fallback
    this.syncManager = {
      // Метод загрузки прогресса
      loadProgress: async () => {
        try {
          const key = `findpair_progress_${(window.GamePlatform?.isOK ? window.GamePlatform.storageIdentity : window.VK_USER_DATA?.id) || 'guest'}`;
          const saved = localStorage.getItem(key);
          if (!saved) return { levels: {} };
          
          const parsed = JSON.parse(saved);
          return parsed;
        } catch (e) {
          console.warn('Fallback loadProgress error:', e);
          return { levels: {} };
        }
      },
      
      // ✅ ИСПРАВЛЕНО: независимая реализация
      getProgress: async () => {
        try {
          const key = `findpair_progress_${(window.GamePlatform?.isOK ? window.GamePlatform.storageIdentity : window.VK_USER_DATA?.id) || 'guest'}`;
          const saved = localStorage.getItem(key);
          if (!saved) return { levels: {} };
          
          const parsed = JSON.parse(saved);
          return parsed;
        } catch (e) {
          console.warn('Fallback getProgress error:', e);
          return { levels: {} };
        }
      },
      
      saveProgress: (data) => {
        try {
          const key = `findpair_progress_${(window.GamePlatform?.isOK ? window.GamePlatform.storageIdentity : window.VK_USER_DATA?.id) || 'guest'}`;
          localStorage.setItem(key, JSON.stringify(data));
        } catch (e) {
          console.error('💾 Fallback save error:', e);
        }
      },
      
      isVKAvailable: () => false,
      
      getSyncStatus: () => ({ 
        isVKAvailable: false, 
        lastSyncTime: 0,
        isSyncing: false,
        queueLength: 0,
        timeSinceLastSync: 0,
        isInitialized: true
      }),
      
      forceSync: async () => {
        console.warn('⚠️ Fallback: VK not available');
        return false;
      },
      
      setCurrentLevel: () => {},
      getCurrentLevel: () => 0,
      
      // ✅ Пустые обработчики
      onSyncStart: null,
      onSyncComplete: null,
      onSyncError: null
    };
  }
  
  // ⬇️ КРИТИЧНО: Подписка на события (только если методы существуют)
  if (this.syncManager.onSyncStart !== undefined) {
    const originalOnSyncStart = this.syncManager.onSyncStart;
    this.syncManager.onSyncStart = () => {
      if (originalOnSyncStart) originalOnSyncStart();
      this.isSyncing = true;
    };
  }
  
  if (this.syncManager.onSyncComplete !== undefined) {
    const originalOnSyncComplete = this.syncManager.onSyncComplete;
    this.syncManager.onSyncComplete = (data) => {
      if (originalOnSyncComplete) originalOnSyncComplete(data);
      this.isSyncing = false;
      this.progress = data;
      if (this.scene.isActive()) {
        this.refreshUI();
      }
    };
  }
  
  if (this.syncManager.onSyncError !== undefined) {
    const originalOnSyncError = this.syncManager.onSyncError;
    this.syncManager.onSyncError = (error) => {
      if (originalOnSyncError) originalOnSyncError(error);
      this.isSyncing = false;
      if (this.scene.isActive()) {
        this.showToast('⚠️ Ошибка синхронизации', '#E74C3C');
      }
    };
  }
}

  cleanup() {
    console.log('MenuScene cleanup started');

// ✅ ДОБАВИТЬ: Удаление resize handler
    if (this._resizeHandler) {
        this.scale.off('resize', this._resizeHandler, this);
        this._resizeHandler = null;
    }
    
    if (this._wheelHandler) {
      this.input.off('wheel', this._wheelHandler);
      this._wheelHandler = null;
    }

    if (this.levelButtons) {
      this.levelButtons.forEach(btn => {
        if (btn && btn.zone && btn.zone.removeAllListeners) {
          btn.zone.removeAllListeners();
        }
      });
      this.levelButtons = [];
    }

        if (this.musicButton) {
      this.musicButton.destroy();
      this.musicButton = null;
    }


    console.log('MenuScene cleanup completed');
  }

async getProgress() {
  try {
    // ✅ Проверяем наличие метода перед вызовом
    if (!this.syncManager?.getProgress) {
      console.warn('⚠️ syncManager.getProgress not available');
      return {};
    }
    
    const progress = await this.syncManager.getProgress();
    return progress?.levels || {};
  } catch (e) {
    console.warn('Error loading progress:', e);
    return {};
  }
}



getStats() {
  // Прогресс уровней берем из уже загруженного this.progress
  const progressLevels = (this.progress && this.progress.levels) || {};
  const levelKeys = Object.keys(progressLevels);

  const totalLevels = window.LEVELS.length;
  const completedLevels = levelKeys.length;
  const totalStars = levelKeys.reduce((sum, key) => {
    const lvl = progressLevels[key] || {};
    return sum + (lvl.stars || 0);
  }, 0);

  const stats = {
    totalLevels,
    completedLevels,
    totalStars,
    maxStars: totalLevels * 3,
    averageStars: completedLevels > 0
      ? totalStars / completedLevels
      : 0
  };

  // Глобальная статистика — тоже из this.progress
  const globalStats = (this.progress && this.progress.stats) || {};
  stats.gamesPlayed  = globalStats.gamesPlayed  || 0;
  stats.totalTime    = globalStats.totalTime    || 0;
  stats.bestTime     = globalStats.bestTime     || null;
  stats.perfectGames = globalStats.perfectGames || 0;
  stats.totalErrors  = globalStats.totalErrors  || 0;

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

  // === MenuScene.js:211-229 - ЗАМЕНИТЬ clearMenu ===

clearMenu() {
    if (this._wheelHandler) { 
        this.input.off('wheel', this._wheelHandler); 
        this._wheelHandler = null; 
    }

   // ✅ ДОБАВИТЬ: Сброс debounce флага
    this._resizeDebounce = false;
  
    
    if (this.levelButtons) {
        this.levelButtons.forEach(btn => {
            if (btn && typeof btn.destroy === 'function') {

               // ✅ КРИТИЧНО: Проверка наличия контейнеров перед destroy
                if (btn.starsContainer && !btn.starsContainer.scene) {
                    // Уже уничтожен родителем
                    btn.starsContainer = null;
                } else if (btn.starsContainer) {
                    btn.starsContainer.destroy();
                    btn.starsContainer = null;
                }
                
                if (btn.statsContainer && !btn.statsContainer.scene) {
                    btn.statsContainer = null;
                } else if (btn.statsContainer) {
                    btn.statsContainer.destroy();
                    btn.statsContainer = null;
                }
                
                if (btn.zone && btn.zone.removeAllListeners) {
                    btn.zone.removeAllListeners();
                }
                
                btn.destroy();
            }
        });
        this.levelButtons = [];
    }
        // Сбрасываем ссылку на приветствие
    this.greetingTextObject = null;

}



getThemeConfig() {
  const defaults = { back: 1, bg: 1, button: 1, cards: 1 };
  try {
    const raw = localStorage.getItem('findpair_theme_v1');
    if (!raw) return defaults;
    const p = JSON.parse(raw);
    return {
      back: Number(p.back) || 1,
      bg: Number(p.bg) || 1,
      button: Number(p.button) || 1,
      cards: Number(p.cards) || 1
    };
  } catch {
    return defaults;
  }
}

setThemeConfig(next) {
  localStorage.setItem('findpair_theme_v1', JSON.stringify(next));
}


async ensureValidThemeConfig() {
  const current = this.getThemeConfig();
  const packs = await this.detectThemePacks();

  let changed = false;
  const keys = ['back', 'bg', 'button', 'cards'];

  for (const k of keys) {
    const available = packs[k] || [];
    if (!available.length) continue; // нет вариантов — не трогаем
    if (!available.includes(current[k])) {
      current[k] = available[0];     // берём первый доступный
      changed = true;
    }
  }

  if (changed) {
    this.setThemeConfig(current);
    try { this.game.registry.set('theme', current); } catch {}
  }

  return changed;
}



async fileExists(url) {
  try {
    const r = await fetch(url, { method: 'HEAD', cache: 'force-cache' });

    if (!r.ok) return false;

    const ct = (r.headers.get('content-type') || '').toLowerCase();
    // ожидаем картинку
    if (!ct.startsWith('image/')) return false;

    return true;
  } catch {
    return false;
  }
}


async detectThemePacks() {
  // Кэш, чтобы не долбить сеть каждый заход в меню
  const cacheKey = 'findpair_theme_packs_cache_v1';
  try {
    const cached = JSON.parse(localStorage.getItem(cacheKey) || 'null');
if (cached && cached.ts && (Date.now() - cached.ts) < 30 * 1000) {
  return cached.data;
}

  } catch {}

  const useHD = !!this.game.registry.get('useHDTextures');
  const firstCardKey = (window.ALL_CARD_KEYS && window.ALL_CARD_KEYS[0]) ? window.ALL_CARD_KEYS[0] : 'card01';

  // Проверяем пакеты 1..10 (можешь увеличить)
  const MAX = 10;

  const packs = { back: [], bg: [], button: [], cards: [] };

  for (let n = 1; n <= MAX; n++) {
    const backTest = useHD
      ? `assets/back_card/${n}/back_card02@2x.png`
      : `assets/back_card/${n}/back_card02.png`;

    const bgTest = useHD
      ? `assets/bg/${n}/bg_menu@2x.png`
      : `assets/bg/${n}/bg_menu.png`;

    const btnTest = useHD
      ? `assets/button/${n}/button01@2x.png`
      : `assets/button/${n}/button01.png`;

    const cardsTest = useHD
      ? `assets/cards/${n}/${firstCardKey}@2x.png`
      : `assets/cards/${n}/${firstCardKey}.png`;

    // Параллельно
    const [okBack, okBg, okBtn, okCards] = await Promise.all([
      this.fileExists(backTest),
      this.fileExists(bgTest),
      this.fileExists(btnTest),
      this.fileExists(cardsTest)
    ]);

    if (okBack)  packs.back.push(n);
    if (okBg)    packs.bg.push(n);
    if (okBtn)   packs.button.push(n);
    if (okCards) packs.cards.push(n);
  }

  // если вдруг ничего не найдено — хотя бы 1
// Никаких fallback: показываем только реально найденные паки.
// Если список пуст — просто не будет кнопок.


  try {
    localStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), data: packs }));
  } catch {}

  return packs;
}


async showThemeSelector(selectedOverride = null) {
  const { W, H } = this.getSceneWH();
  const current = this.getThemeConfig();

    // ✅ локально для этого окна (не зависит от drawMenu)
  const isMobile =
    W < 768 || H < 600 ||
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);


//try { localStorage.removeItem('findpair_theme_packs_cache_v1'); } catch {}


  const packs = await this.detectThemePacks();

  const requiredKeys = ['back', 'bg', 'cards', 'button'];
const hasAll = requiredKeys.every(k => (packs[k] && packs[k].length > 0));


  let selected = selectedOverride ? { ...selectedOverride } : { ...current };

  const overlay = this.add.graphics()
    .fillStyle(0x000000, 0.85)
    .fillRect(0, 0, W, H)
    .setDepth(3000)
    .setInteractive();

    // ✅ Ловим клики, чтобы не прокликивалось меню под модалкой
const clickBlocker = this.add.zone(W / 2, H / 2, W, H)
  .setOrigin(0.5)
  .setScrollFactor(0)
  .setDepth(overlay.depth + 1)      // или просто 2999, главное — выше меню
  .setInteractive({ useHandCursor: false });

clickBlocker.on('pointerdown', () => {
  // ничего не делаем — просто блокируем "сквозной" клик
});


const modalW = Math.min(W * 0.9, 520);
const modalH = Math.min(H * 0.85, 620);

// overlay должен быть НИЖЕ фоновой картинки модалки
overlay.setDepth(2998);

const bgPreviewImage = this.add.image(W / 2, H / 2, 'bg_menu')
  .setDepth(2999)
  .setDisplaySize(modalW, modalH)
  .setOrigin(0.5);




  const rowButtons = {}; // key -> array of buttons


const modal = this.add.graphics()
  .fillStyle(0x2C3E50, 0.05)
  .fillRect(W/2 - modalW/2, H/2 - modalH/2, modalW, modalH)
  .lineStyle(3, 0xF2DC9B, 0.9)
  .strokeRect(W/2 - modalW/2, H/2 - modalH/2, modalW, modalH)
  .setDepth(3001);


  const title = this.add.text(W/2, H/2 - modalH/2 + 26, '🎨 Оформление', {
    fontFamily: 'BoldPixels, Arial',
    fontSize: '20px',
    color: '#F2DC9B',
    fontStyle: 'bold'
  }).setOrigin(0.5).setDepth(3002);

  const content = this.add.container(W/2, H/2).setDepth(3002);

// ✅ Колонки окна (авто-раскладка, чтобы всё помещалось)
const leftColX = -modalW/2 + 40; // подписи слева

// размеры кнопок опций
const optW  = isMobile ? 42 : 46;
const optH  = isMobile ? 42 : 34;
const stepX = isMobile ? 52 : 60;

// ширина "колонки" под подписи + отступ до кнопок
const labelColW = isMobile ? 135 : 165;

// X старта кнопок (центры кнопок)
const rowsBtnX = -modalW/2 + labelColW;

// сколько кнопок максимум в ряду
const maxOptions = Math.max(
  ...(['back','bg','cards','button'].map(k => (packs[k] || []).length)),
  1
);

// правая граница модалки (в координатах content, т.е. относительно центра модалки)
const modalRight = (modalW / 2);
const modalLeft  = -(modalW / 2);

// где заканчиваются кнопки опций (ПРАВАЯ граница последней кнопки)
const buttonsRightEdge = rowsBtnX + (maxOptions - 1) * stepX + optW / 2;

// отступ между кнопками и превью + отступ от правого края модалки
const gapToPreview   = isMobile ? 14 : 18;
const rightPadding   = isMobile ? 16 : 20;

// желаемый размер превью, но будем зажимать по месту
const desiredPreviewW = isMobile ? 210 : 240;
const desiredPreviewH = isMobile ? 320 : 360;

// доступная ширина под превью между кнопками и правым краем
const availablePreviewW = (modalRight - rightPadding) - (buttonsRightEdge + gapToPreview);

// финальная ширина превью (не меньше 140, но не больше доступного/желаемого)
const previewW = Math.max(140, Math.min(desiredPreviewW, availablePreviewW));
const previewH = desiredPreviewH;

// X превью: сразу после кнопок, но НЕ вылезаем за правый край
let rightColX = buttonsRightEdge + gapToPreview + previewW / 2;
rightColX = Math.min(rightColX, modalRight - rightPadding - previewW / 2);

// Y превью: центрируем между заголовком и нижними кнопками
const topSafe    = -modalH/2 + (isMobile ? 120 : 115);
const bottomSafe =  modalH/2 - (isMobile ? 165 : 160);
const previewTopY = (topSafe + bottomSafe) / 2;



// контейнер превью
const previewBox = this.add.container(rightColX, previewTopY);
content.add(previewBox);

// рамка (по желанию — можно убрать, но полезно для понимания границ)
const frame = this.add.rectangle(0, 0, previewW, previewH);
frame.setStrokeStyle(2, 0xF2DC9B, 0.35);
previewBox.add(frame);


// ✅ GeometryMask работает в мировых координатах,
// поэтому маску надо создавать в world-позиции previewBox
const previewWorldX = (W / 2) + rightColX;
const previewWorldY = (H / 2) + previewTopY;

const maskGfx = this.make.graphics({ x: previewWorldX, y: previewWorldY, add: false });
maskGfx.fillStyle(0xffffff, 1);
maskGfx.fillRect(-previewW / 2, -previewH / 2, previewW, previewH);

const previewMask = maskGfx.createGeometryMask();

content.__themeMaskGfx = maskGfx;
content.__themePreviewMask = previewMask;





// ✅ Preview texture loader (batch, no multiple load.start)
const useHD = !!this.game.registry.get('useHDTextures');
const suffix = useHD ? '@2x' : '';
const hdTag  = useHD ? '_hd' : '';

const buildPreviewKey = (type, num, fileBase, extra = '') =>
  `preview_${type}_${num}${hdTag}${extra ? '_' + extra : ''}`;

const buildUrl = (type, num, fileBase) =>
  `assets/${type}/${num}/${fileBase}${suffix}.png`;

// 🔒 сериализуем загрузку превью, чтобы не было гонок внутри loader
let previewLoadChain = Promise.resolve();

/**
 * Загружает пачку текстур одним this.load.start()
 * items: [{ key, url }]
 */
const loadPreviewBatch = (items) => {
  // оставляем только отсутствующие
  const missing = items.filter(it => it && it.key && it.url && !this.textures.exists(it.key));
  if (!missing.length) return Promise.resolve();

  // Важно: Phaser loader один на сцену — делаем очередь
  previewLoadChain = previewLoadChain.then(() => new Promise((resolve) => {
    // добавляем только missing
    missing.forEach(({ key, url }) => {
      // на всякий случай: если уже добавлен/есть — пропускаем
      if (!this.textures.exists(key)) this.load.image(key, url);
    });

    // Ждём завершения всей пачки (успех/ошибка — всё равно завершаем)
    const onComplete = () => {
      this.load.off('complete', onComplete);
      this.load.off('loaderror', onError);
      resolve();
    };

    const onError = () => {
      // ошибки отдельных файлов не должны ломать промис
      // просто дождёмся 'complete'
    };

    this.load.once('complete', onComplete);
    this.load.on('loaderror', onError);

    this.load.start();
  }));

  return previewLoadChain;
};


// ✅ Preview area (right side or center depending on mobile)
const preview = {
  bg: null,
  button: null,
  back: null,
  card: null
};






// ✅ Превью справа: рубашка + лицевая карта (крупно, вертикально)
const cardW = isMobile ? 95 : 120;
const cardH = isMobile ? 130 : 165;

const rightCenterY = 0;            // центр previewBox
const gap = isMobile ? 12 : 16;

preview.back = this.add.image(0, rightCenterY - (cardH/2 + gap/2), 'back')
  .setDisplaySize(cardW, cardH)
  .setOrigin(0.5)
  .setMask(previewMask);
previewBox.add(preview.back);

const anyCardKey = (window.ALL_CARD_KEYS && window.ALL_CARD_KEYS[0]) ? window.ALL_CARD_KEYS[0] : null;
const cardFallbackKey = (anyCardKey && this.textures.exists(anyCardKey)) ? anyCardKey : 'back';

preview.card = this.add.image(0, rightCenterY + (cardH/2 + gap/2), cardFallbackKey)
  .setDisplaySize(cardW, cardH)
  .setOrigin(0.5)
  .setMask(previewMask);
previewBox.add(preview.card);


let previewUpdateToken = 0;

let applyBtn = null;
let cancelBtn = null;

const applyButtonSkinToAllOptionButtons = async () => {
  const btnKey  = buildPreviewKey('button', selected.button, 'button01');
  await loadPreviewBatch([{ key: btnKey, url: buildUrl('button', selected.button, 'button01') }]);

  // все кнопки во всех рядах получают один и тот же skin кнопки
  Object.keys(rowButtons).forEach((k) => {
    (rowButtons[k] || []).forEach((b) => {
if (b?.bg && this.textures.exists(btnKey)) {
  b.bg.setTexture(btnKey);
  b.bg.setDisplaySize(optW, optH);     // ✅ ключевой фикс масштаба
  b.bg.clearTint?.();
}

    });
  });
};



const updatePreview = async () => {
  const myToken = ++previewUpdateToken;

  // Собираем keys/urls для всех превью разом
  const bgKey   = buildPreviewKey('bg', selected.bg, 'bg_menu');
  const btnKey  = buildPreviewKey('button', selected.button, 'button01');
  const backKey = buildPreviewKey('back_card', selected.back, 'back_card02');

  // карта-превью: берём первую карту из ALL_CARD_KEYS
  const firstCard = (window.ALL_CARD_KEYS && window.ALL_CARD_KEYS[0]) ? window.ALL_CARD_KEYS[0] : null;
  const cardKey = firstCard ? buildPreviewKey('cards', selected.cards, firstCard, firstCard) : null;

  const batch = [
    { key: bgKey,   url: buildUrl('bg',        selected.bg,   'bg_menu') },
    { key: btnKey,  url: buildUrl('button',    selected.button,'button01') },
    { key: backKey, url: buildUrl('back_card', selected.back, 'back_card02') },
    firstCard ? { key: cardKey, url: buildUrl('cards', selected.cards, firstCard) } : null
  ].filter(Boolean);

  await loadPreviewBatch(batch);

  // 🔒 защита от устаревших async-обновлений
  if (myToken !== previewUpdateToken) return;

  // ✅ Применяем выбранный стиль кнопки к нижним кнопкам
if (this.textures.exists(btnKey)) {
if (applyBtn?.bg) {
  applyBtn.bg.setTexture(btnKey);
  applyBtn.bg.setDisplaySize(130, 44);   // ✅ фикс размеров
  applyBtn.bg.clearTint?.();
}
if (cancelBtn?.bg) {
  cancelBtn.bg.setTexture(btnKey);
  cancelBtn.bg.setDisplaySize(130, 44);  // ✅ фикс размеров
  cancelBtn.bg.clearTint?.();
}

}

// ✅ Применяем стиль кнопок ко всем кнопкам выбора
await applyButtonSkinToAllOptionButtons();
if (myToken !== previewUpdateToken) return;

  if (bgPreviewImage && this.textures.exists(bgKey)) {
  bgPreviewImage.setTexture(bgKey);
  bgPreviewImage.setDisplaySize(modalW, modalH);
}




if (preview.back && this.textures.exists(backKey)) {
  preview.back.setTexture(backKey);
  preview.back.setMask(previewMask);
}

if (preview.card && cardKey && this.textures.exists(cardKey)) {
  preview.card.setTexture(cardKey);
  preview.card.setMask(previewMask);
}

};



const makeRow = (label, key, y) => {
  const COLOR_NORMAL = '#243540';
const COLOR_HOVER  = '#FFFFFF';
const COLOR_ACTIVE = '#F2DC9B';

  const t = this.add.text(leftColX, y, label, {
    fontFamily: 'Arial',
    fontSize: '14px',
    color: '#E8E8E8'
  }).setOrigin(0, 0.5);

  content.add(t);

  const options = packs[key] || [];
const startX = rowsBtnX;





rowButtons[key] = [];


  // ✅ Если нет ни одной папки/пака — показываем "нет"
  if (!options.length) {
    const none = this.add.text(startX, y, 'нет вариантов', {
      fontFamily: 'Arial',
      fontSize: '14px',
      color: '#95A5A6'
    }).setOrigin(0, 0.5);
    content.add(none);
    return;
  }

  // ✅ Если текущий selected[key] не существует — ставим первый доступный
  if (!options.includes(selected[key])) {
    selected[key] = options[0];
  }

  const refreshRowActive = () => {
  const arr = rowButtons[key] || [];
  arr.forEach((b) => {
    const active = (b.__num === selected[key]);

    // если makeImageButton поддерживает setColors — используем
    if (typeof b.setColors === 'function') {
      b.setColors(active ? '#243540' : '#F2DC9B');
    }

if (b.bg) {
  if (b.bg.clearTint) b.bg.clearTint();
  b.bg.setAlpha(active ? 1 : 0.9);
}
if (b.label && b.label.setColor) {
  b.label.setColor(active ? COLOR_ACTIVE : COLOR_NORMAL);
}



    // если есть label — подправим цвет (не обязательно)
    if (b.label && typeof b.label.setColor === 'function') {
      b.label.setColor(active ? '#F2DC9B' : '#243540');
    }
  });
};


  options.forEach((num, idx) => {
    const isActive = selected[key] === num;

    const btn = window.makeImageButton(
       this,
  startX + idx * stepX,
  y,
  optW, optH,
  String(num),
      () => {
  selected[key] = num;

  //overlay.destroy(); modal.destroy(); title.destroy(); content.destroy();
  //applyBtn.destroy(); cancelBtn.destroy();
  //this.showThemeSelector(selected); // ✅ сохраняем выбор при перерисовке

refreshRowActive(); // ✅ мгновенная подсветка кнопок ряда
  updatePreview();    // ✅ мгновенное обновление превью

},

      { color: isActive ? '#243540' : '#F2DC9B' }
    );

const firstCard = (window.ALL_CARD_KEYS && window.ALL_CARD_KEYS[0]) ? window.ALL_CARD_KEYS[0] : null;

let type, fileBase, extra;
if (key === 'bg') {
  type = 'bg'; fileBase = 'bg_menu';
} else if (key === 'button') {
  type = 'button'; fileBase = 'button01';
} else if (key === 'back') {
  type = 'back_card'; fileBase = 'back_card02';
} else if (key === 'cards') {
  type = 'cards'; fileBase = firstCard || 'qd';
  extra = fileBase; // чтобы ключи карт не конфликтовали
}

const previewKey = buildPreviewKey(type, num, fileBase, extra);

// loadPreviewBatch([{ key: previewKey, url: buildUrl(type, num, fileBase) }]).then(() => {
//   if (btn.bg && this.textures.exists(previewKey)) {
//     btn.bg.setTexture(previewKey);
//     // важно: НЕ tint'ить текстуры
//     if (btn.bg.clearTint) btn.bg.clearTint();
//   }
// });



    btn.__num = num;               // запоминаем номер варианта
rowButtons[key].push(btn);     // складываем в ряд

// --- Hover подсветка цифр ---
if (btn.zone && btn.label) {
  btn.zone.on('pointerover', () => {
    // если кнопка НЕ активная — подсвечиваем hover-цветом
    if (btn.__num !== selected[key]) {
      btn.label.setColor(COLOR_HOVER);
    }
  });

  btn.zone.on('pointerout', () => {
    // возвращаем цвет в зависимости от active / normal
    btn.label.setColor(
      btn.__num === selected[key]
        ? COLOR_ACTIVE
        : COLOR_NORMAL
    );
  });
}


    btn.setDepth(3003);
    content.add(btn);

    





  });
    refreshRowActive();
  applyButtonSkinToAllOptionButtons(); 
};


 // 4 строки
// 4 строки — всегда стартуем ниже превью, иначе оно залезает на кнопки
const rowsStartY = -modalH/2 + (isMobile ? 165 : 160);
const rowsGap    = isMobile ? 66 : 56;




makeRow('Рубашка', 'back',   rowsStartY + rowsGap * 0);
makeRow('Фон',     'bg',     rowsStartY + rowsGap * 1);
makeRow('Карты',   'cards',  rowsStartY + rowsGap * 2);
makeRow('Кнопка',  'button', rowsStartY + rowsGap * 3);



  updatePreview();


  // Кнопки внизу
  applyBtn = window.makeImageButton(
    this,
    W/2 - 70,
    H/2 + modalH/2 - 50,
    130, 44,
    'Применить',
    () => {
      this.setThemeConfig(selected);

      try { content.__themeMaskGfx?.destroy?.(); } catch {}


      // Самый надежный способ: перезапуск прелоада (перегрузит текстуры)
      clickBlocker.destroy();
      overlay.destroy(); modal.destroy(); title.destroy(); content.destroy();
      bgPreviewImage.destroy();
      applyBtn.destroy(); cancelBtn.destroy();

      this.scene.start('PreloadScene');
    }
  );
  applyBtn.setDepth(3003);

 cancelBtn = window.makeImageButton(
    this,
    W/2 + 70,
    H/2 + modalH/2 - 50,
    130, 44,
    'Закрыть',
    () => {
      try { content.__themeMaskGfx?.destroy?.(); } catch {}
      clickBlocker.destroy();
      overlay.destroy(); modal.destroy(); title.destroy(); content.destroy();
      bgPreviewImage.destroy();
      applyBtn.destroy(); cancelBtn.destroy();
    }
  );
  cancelBtn.setDepth(3003);
}

    showInstructions() {
  const { W, H } = this.getSceneWH();

  // Затемнение
  const overlay = this.add.graphics()
    .fillStyle(0x000000, 0.85)
    .fillRect(0, 0, W, H)
    .setDepth(2500)
    .setInteractive();

  const modalW = Math.min(W * 0.9, 520);
  const modalH = Math.min(H * 0.85, 600);

  const modal = this.add.graphics()
    .fillStyle(0x2C3E50, 0.96)
    .fillRoundedRect(
      W / 2 - modalW / 2,
      H / 2 - modalH / 2,
      modalW,
      modalH,
      16
    )
    .lineStyle(3, 0xF2DC9B, 0.9)
    .strokeRoundedRect(
      W / 2 - modalW / 2,
      H / 2 - modalH / 2,
      modalW,
      modalH,
      16
    )
    .setDepth(2501);

  const title = this.add.text(
    W / 2,
    H / 2 - modalH / 2 + 28,
    '📘 Как играть',
    {
      fontFamily: 'BoldPixels, Arial',
      fontSize: '20px',
      color: '#F2DC9B',
      fontStyle: 'bold'
    }
  ).setOrigin(0.5).setDepth(2502);

  const text = this.add.text(
    W / 2,
    H / 2 - 20,
    [
      '• Запомни расположение карт за 5 сек',
      '• Через 5 сек карты перевернуться',
      '• Открывай по две карты',
      '• Если они совпали — пара найдена',
      
      '• Пройди уровень быстрее и с меньшим числом ошибок',
      '',
      '♣️ - звёзды',
      'Чем лучше результат — тем больше звёзд'
    ].join('\n'),
    {
      fontFamily: 'Arial',
      fontSize: '14px',
      color: '#E8E8E8',
      align: 'left',
      lineSpacing: 6,
      wordWrap: { width: modalW - 60 }
    }
  ).setOrigin(0.5).setDepth(2502);

  const closeBtn = window.makeImageButton(
    this,
    W / 2,
    H / 2 + modalH / 2 - 50,
    160,
    44,
    'Закрыть',
    () => {
     //clickBlocker.destroy();
      overlay.destroy();
      modal.destroy();
      title.destroy();
      text.destroy();
      closeBtn.destroy();
    }
  );
  closeBtn.setDepth(2503);
}



getSafeAreaInsets() {
  try {
    const style = getComputedStyle(document.body);
    return {
      top: parseInt(style.paddingTop) || 0,
      bottom: parseInt(style.paddingBottom) || 0,
      left: parseInt(style.paddingLeft) || 0,
      right: parseInt(style.paddingRight) || 0
    };
  } catch (e) {
    return { top: 0, bottom: 0, left: 0, right: 0 };
  }
}

async drawMenu(page = 0) {
  // Защита от параллельных перерисовок
  if (this._isDrawing) {
    console.log('⏸️ drawMenu skipped: drawing already in progress');
    return;
  }

  this._isDrawing = true;
  console.log('Drawing menu, page:', page);

    // 🔄 Перед отрисовкой меню подтягиваем соглашение из VK Storage (если доступно)
  if (!this._agreementSyncedFromVK) {
    try {
      await this.syncAgreementFromVKIfPossible();
      this._agreementSyncedFromVK = true;
    } catch (e) {
      console.warn('[MenuScene] Failed to sync agreement from VK Storage:', e);
    }
  }


  try {
    this.clearMenu();
    const { W, H } = this.getSceneWH();
    console.log('Scene dimensions:', W, H);

    // Обновляем размеры текстов
    if (this.textManager) {
      this.textManager.updateDimensions();
    }

    // Определяем мобильное устройство
    const isMobile = W < 768 || H < 600 ||
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      const safeArea = this.getSafeAreaInsets();

      // ✅ Mobile-only layout constants
const mobileLayout = {
  // зона контента (приветствие/заголовок/статы) — вверх и левее
  contentX: Math.round(W * 0.44),          // потом подвинем ещё левее
  topStartY: safeArea.top + 78,            // вверх (раньше было ~110)
  lineGap: 8,

  // вертикальная колонка кнопок справа
  btnX: W - (safeArea.right + 30),
  btnYTop: safeArea.top + 34,
  btnSize: 42,
  btnGap: 46
};

if (this.musicButton?.destroy) { this.musicButton.destroy(); this.musicButton = null; }
if (this.themeButton?.destroy) { this.themeButton.destroy(); this.themeButton = null; }
if (this.infoButton?.destroy)  { this.infoButton.destroy();  this.infoButton  = null; }



    const scaleFactor = isMobile ? 1.8 : 1.0;

     const musicIcon = this.game.registry.get('musicMuted') ? '🔇' : '🔊';

if (isMobile) {
  const x = mobileLayout.btnX;
  const y0 = mobileLayout.btnYTop;
  const s = mobileLayout.btnSize;

  // ℹ
  this.infoButton = window.makeIconButton(
    this, x, y0 + mobileLayout.btnGap * 0, s, 'ℹ',
    () => this.showInstructions(),
    { color:'#F2DC9B', hoverColor:'#FFFFFF', bgColor:0x000000, bgAlpha:0.45, borderColor:0xF2DC9B, borderAlpha:0.9, borderWidth:2 }
  );
  this.infoButton.setDepth(500);
  this.infoButton.setScrollFactor(0);
  this.levelButtons.push(this.infoButton);

  // 🎨
  this.themeButton = window.makeIconButton(
    this, x, y0 + mobileLayout.btnGap * 1, s, '🎨',
    () => this.showThemeSelector(),
    { color:'#F2DC9B', hoverColor:'#FFFFFF', bgColor:0x000000, bgAlpha:0.45, borderColor:0xF2DC9B, borderAlpha:0.9, borderWidth:2 }
  );
  this.themeButton.setDepth(500);
  this.themeButton.setScrollFactor(0);
  this.levelButtons.push(this.themeButton);

  // 🔊
  this.musicButton = window.makeIconButton(
    this, x, y0 + mobileLayout.btnGap * 2, s, musicIcon,
    () => this.toggleMusic(),
    { color:'#F2DC9B', hoverColor:'#FFFFFF', bgColor:0x000000, bgAlpha:0.45, borderColor:0xF2DC9B, borderAlpha:0.9, borderWidth:2 }
  );
  this.musicButton.setDepth(500);
  this.musicButton.setScrollFactor(0);
  // musicButton в levelButtons не обязательно, но можно:
  this.levelButtons.push(this.musicButton);

} else {
  // ✅ Десктоп — оставь ТВОЙ текущий код (горизонтально справа сверху)
  const musicX = W - 40;
  const musicY = 40;

  this.musicButton = window.makeIconButton(
    this, musicX, musicY, 48, musicIcon, () => this.toggleMusic(),
    { color:'#F2DC9B', hoverColor:'#FFFFFF', bgColor:0x000000, bgAlpha:0.45, borderColor:0xF2DC9B, borderAlpha:0.9, borderWidth:2 }
  );
  this.musicButton.setDepth(500);
  this.musicButton.setScrollFactor(0);

  this.levelButtons.push(this.musicButton);


  const themeX = musicX - 54;
  const themeY = musicY;

  this.themeButton = window.makeIconButton(
    this, themeX, themeY, 48, '🎨', () => this.showThemeSelector(),
    { color:'#F2DC9B', hoverColor:'#FFFFFF', bgColor:0x000000, bgAlpha:0.45, borderColor:0xF2DC9B, borderAlpha:0.9, borderWidth:2 }
  );
  this.themeButton.setDepth(500);
  this.themeButton.setScrollFactor(0);
  this.levelButtons.push(this.themeButton);

  const infoX = themeX - 54;
  const infoY = musicY;

  this.infoButton = window.makeIconButton(
    this, infoX, infoY, 48, 'ℹ', () => this.showInstructions(),
    { color:'#F2DC9B', hoverColor:'#FFFFFF', bgColor:0x000000, bgAlpha:0.45, borderColor:0xF2DC9B, borderAlpha:0.9, borderWidth:2 }
  );
  this.infoButton.setDepth(500);
  this.infoButton.setScrollFactor(0);
  this.levelButtons.push(this.infoButton);
}



    // Корректный номер страницы
    const PER_PAGE = 9; // 3×3
    const maxPage = Math.max(0, Math.ceil(window.LEVELS.length / PER_PAGE) - 1);
    this.levelPage = Math.max(0, Math.min(page, maxPage));

    // Проверяем принятие соглашения
    const acceptedAgreement = localStorage.getItem(window.GamePlatform?.localKey('acceptedAgreement') || 'acceptedAgreement');
    const agreementVersion  = localStorage.getItem(window.GamePlatform?.localKey('agreementVersion') || 'agreementVersion');
    const CURRENT_VERSION   = '2026-11-04';

    if (!acceptedAgreement && window.VK_DEBUG) {
      console.log('Auto-accepting agreement for debugging');
      localStorage.setItem(window.GamePlatform?.localKey('acceptedAgreement') || 'acceptedAgreement', 'true');
      localStorage.setItem(window.GamePlatform?.localKey('agreementVersion') || 'agreementVersion', CURRENT_VERSION);
    }

    if (!localStorage.getItem(window.GamePlatform?.localKey('acceptedAgreement') || 'acceptedAgreement') ||
        localStorage.getItem(window.GamePlatform?.localKey('agreementVersion') || 'agreementVersion') !== CURRENT_VERSION) {
      console.log('Showing user agreement');
      this.showUserAgreement();
      return;
    }

    console.log('Creating menu content...');

    // Адаптивная сетка
    const COLS = 3;
    const ROWS = 3;
    const PAGES = Math.max(1, Math.ceil(window.LEVELS.length / PER_PAGE));




// ===================
// HEADER (greeting/title/stats) layout
// ===================
const headerGap = 8;

// дефолт (десктоп)
let headerX = W / 2;
let currentY = safeArea.top + 10;

// мобильная привязка: текст слева от вертикальных кнопок
if (isMobile) {
  // X — чуть левее колонки кнопок
  headerX = mobileLayout.btnX - (mobileLayout.btnSize / 2) - 18;

  // Y — ровно по центрам 3-х кнопок (как ты и просишь)
  // 0: приветствие на уровне верхней кнопки (ℹ)
  // 1: "Сколько пар играть?" на уровне второй (🎨)
  // 2: статистика на уровне третьей (🔊)
  currentY = mobileLayout.btnYTop; // базовая Y первой кнопки
}

// --- Приветствие (в мобиле — строка #1, в веб — обычный поток) ---
let greetingText = '';
if (this.vkUserData && this.vkUserData.first_name) {
  greetingText = `Привет, ${this.vkUserData.first_name}!`;
}

const greeting = this.textManager.createText(
  headerX,
  isMobile ? (currentY + mobileLayout.btnGap * 0) : currentY,
  greetingText,
  'titleMedium'
);

// важное: чтобы не “наезжало” друг на друга — на мобиле держим по центру строки, на десктопе по верхнему краю
if (isMobile) {
  greeting.setOrigin(1, 0.5);  // справа-налево, центр по Y
} else {
  greeting.setOrigin(0.5, 0);  // сверху, как ты уже делал
}

greeting.setColor('#243540');
if (!this.vkUserData || !this.vkUserData.first_name) greeting.setAlpha(0);

this.levelButtons.push(greeting);
this.greetingTextObject = greeting;

// --- Заголовок ---
const titleText = 'Сколько пар играть?';
const title = this.textManager.createText(
  headerX,
  isMobile ? (currentY + mobileLayout.btnGap * 1) : (currentY + greeting.getBounds().height + headerGap),
  titleText,
  isMobile ? 'titleLarge_mobile' : 'titleLarge_desktop'
);

if (isMobile) {
  title.setOrigin(1, 0.5);
} else {
  // ✅ FIX: делаем верхнее выравнивание, чтобы он не залезал на приветствие
  title.setOrigin(0.5, 0);
}

this.levelButtons.push(title);

// --- Статистика ---
const stats = this.getStats();
if (stats.completedLevels > 0) {
  const statsText =
    `Пройдено: ${stats.completedLevels}/${stats.totalLevels} ` +
    `| Звезд: ${stats.totalStars}/${stats.maxStars}`;

  const statsDisplay = this.textManager.createText(
    headerX,
    isMobile
      ? (currentY + mobileLayout.btnGap * 2)
      : (title.y + title.getBounds().height + headerGap),
    statsText,
    'statLabel'
  );

  if (isMobile) {
    statsDisplay.setOrigin(1, 0.5);
  } else {
    // ✅ FIX: тоже сверху, чтобы поток был честный
    statsDisplay.setOrigin(0.5, 0);
  }

  this.levelButtons.push(statsDisplay);
}





    // Область для кнопок уровней
    const topY    = H * (isMobile ? 0.20 : 0.16);
    const bottomY = H * (isMobile ? 0.75 : 0.79);
    const areaH   = bottomY - topY;
    const areaW   = Math.min(
      W * (isMobile ? 0.98 : 0.90),
      isMobile ? W : 1080
    );

    const cellH   = areaH / ROWS;
    const cellW   = areaW / COLS;
    const gridLeft = (W - areaW) / 2;
    const gridTop  = topY;

    const startIdx    = this.levelPage * PER_PAGE;
    const endIdx      = Math.min(startIdx + PER_PAGE, window.LEVELS.length);
    const pageLevels  = window.LEVELS.slice(startIdx, endIdx);
    const progressLevels = (this.progress && this.progress.levels) || {};

    console.log('Creating level buttons:', pageLevels.length, 'Mobile:', isMobile);

pageLevels.forEach((lvl, i) => {
  const levelIndex = startIdx + i;
  const r = Math.floor(i / COLS);
  const c = i % COLS;

  const x = gridLeft + c * cellW + cellW / 2;
  let   y = gridTop  + r * cellH + cellH / 2;

  const btnW = Math.min(
    isMobile ? cellW * 0.92 : 320,
    cellW * 0.9
  );

  // исходная высота, как была раньше
  let btnH = Math.min(
    isMobile ? cellH * 0.88 : 200,
    cellH * 0.86
  );

  // 🔽 только для мобилы уменьшаем высоту и поднимаем низ
  if (isMobile) {
    const oldH = btnH;
    const newH = cellH * 0.70; // поэкспериментируй: 0.65 / 0.60 если ещё тесно

    btnH = newH;

    // поднимаем центр на половину разницы, чтобы верхняя граница осталась на месте
    const diff = oldH - newH;
    y -= diff / 2;
  }

  this.createLevelButton(
    x, y,
    btnW, btnH,
    lvl, levelIndex,
    scaleFactor,
    progressLevels
  );
});


    // Навигация по страницам
    const yNav = isMobile ? H * 0.83 : H * 0.86;
    const navYOffset = isMobile ? 0 : 20;   // на десктопе оставляем прежнее смещение вниз



    const navSize = Math.max(
      isMobile ? 60 : 52,
      Math.round(H * 0.07 * scaleFactor)
    );

    const prevActive = this.levelPage > 0;
    const nextActive = this.levelPage < PAGES - 1;

    const arrowStyle = {
      color: '#F2DC9B',
      hoverColor: '#C4451A',
      bgColor: '#243540',
      bgAlpha: 0.8,
      borderColor: '#243540',
      borderAlpha: 1.0,
      borderWidth: 3
    };

    // Кнопка "Назад"
const prevBtn = window.makeIconButton(
  this,
  W * 0.25,
  yNav + navYOffset,
  navSize,
  '‹',
  async () => {
    if (!prevActive) return;
    if (this._isDrawing || this._isInitializing) return;

    await this.drawMenu(this.levelPage - 1);
  },
  arrowStyle
);
prevBtn.setAlpha(prevActive ? 1 : 0.45);
this.levelButtons.push(prevBtn);


    // Текст страницы
const pageTxt = this.textManager.createText(
  W * 0.5, 
  yNav + navYOffset,
  `${this.levelPage + 1} / ${PAGES}`,
  'buttonText'
);
pageTxt.setOrigin(0.5);
this.levelButtons.push(pageTxt);


    // Кнопка "Вперед"
const nextBtn = window.makeIconButton(
  this,
  W * 0.75,
  yNav + navYOffset,
  navSize,
  '›',
  async () => {
    if (!nextActive) return;
    if (this._isDrawing || this._isInitializing) return;

    await this.drawMenu(this.levelPage + 1);
  },
  arrowStyle
);
nextBtn.setAlpha(nextActive ? 1 : 0.45);
this.levelButtons.push(nextBtn);

// Кнопка "Достижения"
// Кнопка "Достижения"
const achBtn = window.makeImageButton(
  this,
  W / 2,
  H * 0.95,
  180, 42,
  'Достижения',
  () => this.scene.start('AchievementsScene', { fromPage: this.levelPage }),
  {
    color: '#F2C791'      // базовый цвет текста
    // hoverColor здесь не используется в makeImageButton, так что можно не указывать
  }
);
achBtn.setDepth(200);
achBtn.label.setFontSize(14); // любой размер
this.levelButtons.push(achBtn);




    // Колесо мыши (для десктопа)
    if (!isMobile) {
  this._wheelHandler = async (_p, _objs, _dx, dy) => {
    if (this._isDrawing || this._isInitializing) return;

    if (dy > 0 && nextActive) {
      await this.drawMenu(this.levelPage + 1);
    } else if (dy < 0 && prevActive) {
      await this.drawMenu(this.levelPage - 1);
    }
  };
  this.input.on('wheel', this._wheelHandler);
}


    console.log('Menu drawn, total buttons:', this.levelButtons.length);
  } catch (e) {
    console.error('❌ drawMenu fatal error:', e);
  } finally {
    this._isDrawing = false;
  }




}





  showFullText() {
    const { W, H } = this.getSceneWH();
    
    // Создаём полноэкранное модальное окно
    const overlay = this.add.graphics()
        .fillStyle(0x000000, 0.95)
        .fillRect(0, 0, W, H)
        .setDepth(2000)
        .setInteractive();

    const container = this.add.container(W/2, H/2).setDepth(2001);
    
    // Контент соглашения
    const content = this.add.text(0, -H*0.3, 
        'ПОЛЬЗОВАТЕЛЬСКОЕ СОГЛАШЕНИЕ\n\n' +
        '1. Общие положения\n' +
        'Данное соглашение регулирует использование игры "Память: Найди пару".\n\n' +
        '2. Сбор данных\n' +
        'Приложение собирает: ID пользователя, игровую статистику.\n\n' +
        '3. Возрастные ограничения\n' +
        'Возрастное ограничение: 0+\n\n' +
        '4. Контакты\n' +
        'По вопросам: mr.kinder@mail.ru', 
        {
            fontFamily: 'Loreley Antiqua, sans-serif',
            fontSize: Math.max(16, Math.round(H * 0.025)) + 'px',
            color: '#FFFFFF',
            wordWrap: { width: Math.min(W * 0.8, 800) },
            align: 'left'
        }
    ).setOrigin(0.5, 0);
    
    // Кнопка закрытия
    const closeBtn = window.makeImageButton(
        this, 0, H*0.35, 200, 50, 'Закрыть',
        () => {
            container.destroy();
            overlay.destroy();
        }
    );
    
    container.add([content, closeBtn]);
}
  
  refreshUI() {
    if (!this.scene.isActive()) return;
    if (this._isDrawing) return; // чтобы не ковырять UI во время полной перерисовки
    if (!this.levelButtons || this.levelButtons.length === 0) return;
    
    console.log('🔄 Refreshing MenuScene UI');

    // 1️⃣ Обновляем локальный vkUserData, если глобальные данные уже есть
    if (!this.vkUserData && window.VK_USER_DATA) {
      this.vkUserData = window.VK_USER_DATA;
    }

    // 2️⃣ Обновляем приветствие, если объект создан
    if (this.greetingTextObject) {
      if (this.vkUserData && this.vkUserData.first_name) {
        this.greetingTextObject.setText(`Привет, ${this.vkUserData.first_name}!`);
        this.greetingTextObject.setAlpha(1); // делаем видимым
      } else {
        // Имени по-прежнему нет — оставляем текст пустым и невидимым,
        // но вертикальное место уже зарезервировано drawMenu()
      }
    }

    // 3️⃣ Остальное как было
    this.updateLevelButtons();
    this.updateStatsDisplay();
  }


updateLevelButtons() {
  const progressLevels = (this.progress && this.progress.levels) || {};

  this.levelButtons.forEach(btn => {
    if (btn.levelIndex !== undefined) {
      this.updateSingleLevelButton(btn, btn.levelIndex, progressLevels);
    }
  });
}


 updateStatsDisplay() {
  const statsElement = this.levelButtons.find(btn =>
    btn.type === 'Text' && btn.text && btn.text.includes('Пройдено:')
  );

  if (!statsElement) return;

  const stats = this.getStats();
  if (stats.completedLevels > 0) {
    const statsText =
      `Пройдено: ${stats.completedLevels}/${stats.totalLevels} ` +
      `| Звезд: ${stats.totalStars}/${stats.maxStars}`;
    statsElement.setText(statsText);
  }
}




// ИСПРАВЛЕНИЕ: Обновляем кнопку уровня по актуальному рекорду
updateSingleLevelButton(button, levelIndex, progressLevels) {
  const levelProgress = progressLevels[levelIndex];
  const stars = levelProgress ? (levelProgress.stars || 0) : 0;

  // ⭐ Обновляем существующие звёзды
  if (button.starsContainer && button.starsContainer.list) {
    button.starsContainer.list.forEach((starText, index) => {
      const filled = (index + 1) <= stars;

      // символ
      starText.setText(filled ? '♣' : '♧');

      // цвета как в createLevelButton
      starText.setColor(filled ? '#243540' : '#F2DC9B');

      // тень только у заполненных
      if (filled) {
        starText.setShadow(0, 2, 'rgba(255, 215, 0, 0.6)', 4, false, true);
      } else {
        starText.setShadow(0, 0, '#000000', 0);
      }
    });
  }

  // 📊 Обновляем рекордную статистику под кнопкой (BEST, а не последнюю)
  if (button.statsContainer && button.statsContainer.list && button.statsContainer.list[0]) {
    if (levelProgress && levelProgress.bestTime) {
      const accuracy =
        levelProgress.bestAccuracy ??   // приоритет — рекордная точность
        levelProgress.accuracy ??       // запасной старый формат
        100;

      const statsText = `${this.formatTime(levelProgress.bestTime)} | ${accuracy}%`;
      button.statsContainer.list[0].setText(statsText);
      button.statsContainer.setVisible(true);
    } else {
      // если рекорда ещё нет — не показываем строку
      button.statsContainer.setVisible(false);
    }
  }
}



  showToast(message, color = '#3498DB', duration = 2000) {
    const { W, H } = this.getSceneWH();
    
    const toast = this.add.container(W / 2, H - 100);
    
    const bg = this.add.graphics();
    bg.fillStyle(parseInt(color.replace('#', '0x')), 0.9);
    bg.fillRoundedRect(-100, -15, 200, 30, 15);
    
    const text = this.add.text(0, 0, message, {
      fontFamily: 'Loreley Antiqua, sans-serif',
      fontSize: '14px',
      color: '#FFFFFF',
      fontStyle: 'bold'
    }).setOrigin(0.5);
    
    toast.add([bg, text]);
    toast.setDepth(2000);
    
    toast.setAlpha(0);
    this.tweens.add({
      targets: toast,
      alpha: 1,
      duration: 300,
      ease: 'Power2.easeOut'
    });
    
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

  showUserAgreement() {
    const { W, H } = this.getSceneWH();
    
    const overlay = this.add.graphics()
      .fillStyle(0x000000, 0.85)
      .fillRect(0, 0, W, H)
      .setDepth(1000)
      .setInteractive();

    const modalW = Math.min(W * 0.9, 500);
    const modalH = Math.min(H * 0.85, 600);
    const modal = this.add.graphics()
      .fillStyle(0x2C3E50, 0.95)
      .fillRoundedRect(W/2 - modalW/2, H/2 - modalH/2, modalW, modalH, 15)
      .lineStyle(3, 0x3498DB, 0.8)
      .strokeRoundedRect(W/2 - modalW/2, H/2 - modalH/2, modalW, modalH, 15)
      .setDepth(1001);

    const title = this.add.text(W/2, H/2 - modalH/2 + 50, 'Пользовательское соглашение', {
      fontFamily: 'Loreley Antiqua',
      fontSize: '24px',
      color: '#FFFFFF',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(1002);
    title.setStroke('#000000', 2);

    const agreementText = `Игра "Память: Найди пару"

• Сбор данных: ID пользователя, игровая статистика
• Возрастное ограничение: 0+ (безопасно для всех)
• Данные используются только для работы игры
• Может показываться реклама платформы

Нажимая "Принимаю", вы соглашаетесь
с условиями использования приложения.

Версия: 04-11-2026`;

    const text = this.add.text(W/2, H/2 - 50, agreementText, {
      fontFamily: 'Arial',
      fontSize: '14px',
      color: '#E8E8E8',
      align: 'center',
      lineSpacing: 8,
      wordWrap: { width: modalW - 40 }
    }).setOrigin(0.5).setDepth(1002);

const acceptBtn = window.makeImageButton(
  this, W/2 - 70, H/2 + modalH/2 - 60, 
  120, 45, 'Принимаю', 
  async () => {
      // ✅ снимаем “вечную” блокировку, если она была
  try { localStorage.removeItem(window.GamePlatform?.localKey('findpair_agreement_declined') || 'findpair_agreement_declined'); } catch {}
  window.__AGREEMENT_DECLINED__ = false;

    const acceptedAt = new Date().toISOString();

    // 1) Локальное сохранение (как было)
    try {
      localStorage.setItem(window.GamePlatform?.localKey('acceptedAgreement') || 'acceptedAgreement', 'true');
      localStorage.setItem(window.GamePlatform?.localKey('agreementVersion') || 'agreementVersion', '2026-11-04');
      localStorage.setItem(window.GamePlatform?.localKey('agreementAcceptedAt') || 'agreementAcceptedAt', acceptedAt);
      localStorage.setItem(window.GamePlatform?.localKey('vk_agreement_shown') || 'vk_agreement_shown', '1');
    } catch (e) {
      console.warn('Failed to save agreement to localStorage', e);
    }

    // 2) Синхронизация в VK Storage (единый ключ для всех устройств VK)
    try {
      if (window.VKHelpers && typeof window.VKHelpers.setStorageData === 'function') {
        await window.VKHelpers.setStorageData('findpair_agreement_v1', {
          accepted: true,
          version: '2026-11-04',
          acceptedAt
        });
        console.log('☁️ VK Storage: agreement stored (findpair_agreement_v1)');
      } else {
        console.log('VKHelpers.setStorageData not available, VK agreement stored only locally');
      }
    } catch (e) {
      console.warn('VK Storage agreement save error:', e);
    }

    this.cleanupAgreementDialog([
      overlay, modal, title, text, acceptBtn, declineBtn
    ]);

    await this.drawMenu(this.levelPage);
  }
);

    
    acceptBtn.setDepth(1003);

    const declineBtn = window.makeImageButton(
      this, W/2 + 70, H/2 + modalH/2 - 60, 
      120, 45, 'Отклонить', 
      () => {
        this.showExitConfirmation([
      overlay, modal, title, text, acceptBtn, declineBtn
    ]);
      }
    );
    declineBtn.setDepth(1003);
  }

  

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

    /**
   * 🔄 Подтягивает статус пользовательского соглашения из VK Storage
   * и синхронизирует его с localStorage.
   *
   * Используется при первом входе в MenuScene, чтобы
   * веб / мобильная версия видели единый статус.
   */
  async syncAgreementFromVKIfPossible() {
    try {
      if (!window.VKHelpers || typeof window.VKHelpers.getStorageData !== 'function') {
        // VK Storage недоступен — просто выходим
        return;
      }

      const response = await window.VKHelpers.getStorageData(['findpair_agreement_v1']);
      if (!response || !Array.isArray(response.keys)) {
        return;
      }

      const item = response.keys.find(k => k.key === 'findpair_agreement_v1');
      if (!item || !item.value) {
        // В VK Storage ничего нет — не трогаем локальный статус
        return;
      }

      let data;
      try {
        data = typeof item.value === 'string' ? JSON.parse(item.value) : item.value;
      } catch (e) {
        console.warn('[MenuScene] Failed to parse VK agreement value:', e);
        return;
      }

      if (!data) return;

      if (data.accepted) {
        // ✅ Соглашение принято на другом устройстве / в другой версии
        try {
          localStorage.setItem(window.GamePlatform?.localKey('acceptedAgreement') || 'acceptedAgreement', 'true');
          if (data.version) {
            localStorage.setItem(window.GamePlatform?.localKey('agreementVersion') || 'agreementVersion', data.version);
          }
          if (data.acceptedAt) {
            localStorage.setItem(window.GamePlatform?.localKey('agreementAcceptedAt') || 'agreementAcceptedAt', data.acceptedAt);
          }
          // Помечаем, что диалог уже показывался через VK
          localStorage.setItem(window.GamePlatform?.localKey('vk_agreement_shown') || 'vk_agreement_shown', '1');
        } catch (e) {
          console.warn('[MenuScene] Failed to write agreement to localStorage:', e);
        }
      } else {
        // ❌ В VK Storage хранится "не принято" — очищаем локальный статус
        try {
          localStorage.removeItem(window.GamePlatform?.localKey('acceptedAgreement') || 'acceptedAgreement');
          localStorage.removeItem(window.GamePlatform?.localKey('agreementVersion') || 'agreementVersion');
          localStorage.removeItem(window.GamePlatform?.localKey('agreementAcceptedAt') || 'agreementAcceptedAt');
          localStorage.removeItem(window.GamePlatform?.localKey('vk_agreement_shown') || 'vk_agreement_shown');
        } catch (e) {
          console.warn('[MenuScene] Failed to clear agreement from localStorage:', e);
        }
      }
    } catch (e) {
      console.warn('[MenuScene] syncAgreementFromVKIfPossible error:', e);
    }
  }


  // === MenuScene.js:958+ - ДОБАВИТЬ НОВЫЙ МЕТОД ===

showExitConfirmation(previousDialogElements) {
  const { W, H } = this.getSceneWH();
  
  // Затемнение (более темное для второго слоя)
  const confirmOverlay = this.add.graphics()
    .fillStyle(0x000000, 0.95)
    .fillRect(0, 0, W, H)
    .setDepth(2000)
    .setInteractive();

  const confirmW = Math.min(W * 0.8, 400);
  const confirmH = 200;
  
  // Модалка подтверждения
  const confirmModal = this.add.graphics()
    .fillStyle(0x2C3E50, 0.98)
    .fillRoundedRect(W/2 - confirmW/2, H/2 - confirmH/2, confirmW, confirmH, 15)
    .lineStyle(3, 0xE74C3C, 0.9)
    .strokeRoundedRect(W/2 - confirmW/2, H/2 - confirmH/2, confirmW, confirmH, 15)
    .setDepth(2001);

  const confirmTitle = this.add.text(W/2, H/2 - 50, '⚠️ Подтверждение выхода', {
    fontFamily: 'BoldPixels, Arial',
    fontSize: '20px',
    color: '#E74C3C',
    fontStyle: 'bold'
  }).setOrigin(0.5).setDepth(2002);

  const confirmText = this.add.text(W/2, H/2, 
    'Без принятия соглашения\nигра недоступна.\n\nВы уверены, что хотите выйти?', {
    fontFamily: 'Arial',
    fontSize: '14px',
    color: '#E8E8E8',
    align: 'center',
    lineSpacing: 4
  }).setOrigin(0.5).setDepth(2002);

  // Кнопка "Да, выйти"
  const yesBtn = window.makeImageButton(
    this, W/2 - 60, H/2 + 60, 
    100, 40, 'Выйти', 
() => {
  // Закрываем все диалоги
  [confirmOverlay, confirmModal, confirmTitle, confirmText, yesBtn, noBtn].forEach(el => el?.destroy?.());
  previousDialogElements?.forEach(el => el?.destroy?.());

  // ✅ Жёстко закрываем игру (единая логика в main.js)
  if (window.forceCloseDueToAgreementDecline) {
    window.forceCloseDueToAgreementDecline();
    return;
  }

  // Fallback (на случай если main.js ещё не обновили)
  try {
    localStorage.setItem(window.GamePlatform?.localKey('findpair_agreement_declined') || 'findpair_agreement_declined', '1');
    window.__AGREEMENT_DECLINED__ = true;
  } catch {}
  window.location.href = window.GamePlatform?.isOK ? "https://ok.ru" : "https://vk.com";
}

  );
  yesBtn.setDepth(2003);

  // Кнопка "Отмена"
  const noBtn = window.makeImageButton(
    this, W/2 + 60, H/2 + 60, 
    100, 40, 'Отмена', 
    () => {
      // Просто закрываем диалог подтверждения
      confirmOverlay.destroy();
      confirmModal.destroy();
      confirmTitle.destroy();
      confirmText.destroy();
      yesBtn.destroy();
      noBtn.destroy();
    }
  );
  noBtn.setDepth(2003);
}

  // === MenuScene.js:444-472 - ЗАМЕНИТЬ createLevelButton ===

createLevelButton(
  x,
  y,
  w,
  h,
  lvl,
  levelIndex,
  scaleFactor = 1.0,
  progressLevels = null
) {
  // Создаём кнопку без onClick — повесим его ниже, уже на btn.onClick
  const btn = window.makeImageButton(this, x, y, w, h, '', null);

  // --- определяем, мобильный ли девайс (используем дальше и для текстов) ---
  const { W, H } = this.getSceneWH();
  const isMobile = W < 768 || H < 600 ||
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  // --- Номер уровня ---
  const levelBaseSize = this.textManager.getSize('levelNumber');
  const levelOverrides = isMobile
    ? { fontSize: Math.round(levelBaseSize * 0.8) + 'px' } // чуть меньше на мобиле
    : {};

  const levelText = this.textManager.createText(
    0,
    h * 0.03,
    lvl.label,
    'levelNumber',
    levelOverrides
  );
  levelText.setOrigin(0.5);
  btn.add(levelText);

    // индекс уровня и ссылка на текст-лейбл
  btn.levelIndex = levelIndex;
  btn.levelLabel = levelText;

    // Универсальный обработчик нажатия, завязанный на btn.levelIndex
  btn.onClick = () => {
    const index = btn.levelIndex ?? levelIndex;
    if (this.syncManager?.setCurrentLevel) {
      this.syncManager.setCurrentLevel(index);
    }
    this.scene.start('GameScene', { level: index });
  };

  // --- Прогресс уровня ---
  const levelsData = progressLevels || (this.progress?.levels || {});
  const levelProgress = levelsData[levelIndex];

  // --- ЗВЁЗДЫ ---
  const starSize = this.textManager.getSize('stars');
  const starsOffsetY = isMobile ? h * 0.60 : h * 0.52;
  btn.starsContainer = this.add.container(x, y + starsOffsetY).setDepth(btn.depth + 1);

  const starSpacing = starSize + 4;
  const stars = levelProgress ? (levelProgress.stars || 0) : 0;

  for (let star = 1; star <= 3; star++) {
    const starX = (star - 2) * starSpacing;
    const filled = star <= stars;

    const starText = this.add.text(starX, 0, filled ? '♣' : '♧', {
      fontSize: `${starSize}px`,
      color: filled ? '#243540' : '#F2DC9B',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    if (filled) {
      starText.setShadow(0, 2, 'rgba(255,215,0,0.6)', 4, false, true);
    }

    btn.starsContainer.add(starText);
  }

  // --- Статистика ---
const statsOffsetY = isMobile ? h * 0.78 : h * 0.65;
btn.statsContainer = this.add.container(x, y + statsOffsetY).setDepth(btn.depth + 1);

if (levelProgress && levelProgress.bestTime) {
  const accuracy =
    levelProgress.bestAccuracy ??
    levelProgress.accuracy ??
    100;

  const statsText = `${this.formatTime(levelProgress.bestTime)} | ${accuracy}%`;

  const statBaseSize = this.textManager.getSize('statValue');
  const statOverrides = isMobile
    ? { fontSize: Math.round(statBaseSize * 0.8) + 'px' }
    : {};

  const statsDisplay = this.textManager.createText(
    0,
    0,
    statsText,
    'statValue',
    statOverrides
  ).setOrigin(0.5);

  btn.statsContainer.add(statsDisplay);
} else {
  btn.statsContainer.setVisible(false);
}


  this.levelButtons.push(btn);
  return btn;
}







  formatTime(seconds) {
    if (!seconds) return '0с';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `${secs}с`;
  }
};
