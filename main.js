// ИСПРАВЛЕНО: Поддержка сверхвысокого разрешения

// Функция для определения оптимального разрешения игры
function getUltraHighResolution() {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const dpr = window.devicePixelRatio || 1;
  
  // Определяем тип устройства и подбираем соответствующее разрешение
  const isMobile = viewportWidth < 768;
  const isTablet = viewportWidth >= 768 && viewportWidth < 1024;
  const is4K = viewportWidth >= 3840 || viewportHeight >= 2160;
  
  let baseWidth, baseHeight;
  
  if (is4K) {
    // 4K дисплеи: максимальное разрешение
    baseWidth = 3840;
    baseHeight = 2160;
  } else if (!isMobile && !isTablet) {
    // Десктоп: очень высокое разрешение
    baseWidth = 2560;
    baseHeight = 1440;
  } else if (isTablet) {
    // Планшеты: высокое разрешение
    baseWidth = 2048;
    baseHeight = 1536;
  } else {
    // Мобильные: адаптивное высокое разрешение
    baseWidth = Math.max(viewportWidth * dpr, 1920);
    baseHeight = Math.max(viewportHeight * dpr, 1080);
  }
  
  return {
    width: Math.floor(baseWidth),
    height: Math.floor(baseHeight)
  };
}

// Проверяем и обновляем конфигурацию для ультра-разрешения
if (window.gameConfig) {
  const ultraRes = getUltraHighResolution();
  
  // Обновляем разрешение только если текущее меньше оптимального
  if (window.gameConfig.scale.width < ultraRes.width) {
    window.gameConfig.scale.width = ultraRes.width;
    window.gameConfig.scale.height = ultraRes.height;
    
    console.log(`Ultra resolution set: ${ultraRes.width}x${ultraRes.height}`);
  }
  
  // ДОБАВЛЕНО: Дополнительные настройки для ультра-качества
  window.gameConfig.render = {
    ...window.gameConfig.render,
    antialias: true,
    roundPixels: false,
    powerPreference: 'high-performance',
    premultipliedAlpha: true,
    failIfMajorPerformanceCaveat: false // Разрешаем даже если производительность может пострадать
  };
} else {
  console.error('Game config not found!');
}

// Создаем игру с ультра-конфигурацией
const game = new Phaser.Game(window.gameConfig || {});

// Сохраняем ссылку глобально
window.game = game;

// Сохраняем ссылку глобально
window.game = game;

// ИСПРАВЛЕНО: Обработчик изменения размеров с уникальным именем
let gameResizeTimer;
function handleGameResize() {
  if (!game || !game.scale) return;
  
  // FIT режим автоматически адаптируется
  game.scale.updateBounds();
  
  console.log('Game resized:', {
    gameSize: game.scale.gameSize,
    displaySize: game.scale.displaySize
  });
}

// Обработчики событий с дебаунсингом
window.addEventListener('resize', () => {
  clearTimeout(gameResizeTimer);
  gameResizeTimer = setTimeout(handleGameResize, 150);
});

window.addEventListener('orientationchange', () => {
  setTimeout(handleGameResize, 300);
});

// Обработчик готовности игры
game.events.once('ready', () => {
  console.log('Game ready with config:', {
    resolution: game.config.resolution,
    scaleMode: game.scale.scaleMode,
    gameSize: game.scale.gameSize,
    canvasSize: `${game.canvas.width}x${game.canvas.height}`
  });
  
  handleGameResize();
});

// Обработка загрузки
game.events.on('boot', () => {
  console.log('Game booted successfully');
});

// Предотвращаем зум и нежелательные touch действия
document.addEventListener('touchmove', (e) => {
  e.preventDefault();
}, { passive: false });

document.addEventListener('touchstart', (e) => {
  if (e.touches.length > 1) {
    e.preventDefault();
  }
}, { passive: false });

// Скрываем адресную строку на мобильных
if (window.innerHeight < window.innerWidth) {
  // Альбомная ориентация
  setTimeout(() => {
    window.scrollTo(0, 1);
  }, 100);
}