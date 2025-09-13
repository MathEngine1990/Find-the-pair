// ИСПРАВЛЕНО: Адаптивная инициализация игры с правильным масштабированием

// Функция для определения оптимальных размеров игры
function getOptimalGameSize() {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  
  // Определяем тип устройства
  const isMobile = viewportWidth < 768;
  const isTablet = viewportWidth >= 768 && viewportWidth < 1024;
  const isDesktop = viewportWidth >= 1024;
  
  let gameWidth, gameHeight;
  
  if (isMobile) {
    // Мобильные: используем полный экран с минимальными ограничениями
    gameWidth = Math.max(viewportWidth, 360);
    gameHeight = Math.max(viewportHeight, 640);
  } else if (isTablet) {
    // Планшеты: ограничиваем максимальные размеры
    gameWidth = Math.min(viewportWidth, 1024);
    gameHeight = Math.min(viewportHeight, 768);
  } else {
    // Десктоп: используем оптимальное соотношение сторон
    const aspectRatio = 16 / 9;
    if (viewportWidth / viewportHeight > aspectRatio) {
      gameHeight = Math.min(viewportHeight, 1080);
      gameWidth = gameHeight * aspectRatio;
    } else {
      gameWidth = Math.min(viewportWidth, 1920);
      gameHeight = gameWidth / aspectRatio;
    }
  }
  
  return {
    width: Math.floor(gameWidth),
    height: Math.floor(gameHeight)
  };
}

// ИСПРАВЛЕНО: Инициализация с адаптивными размерами
const gameSize = getOptimalGameSize();
console.log('Game size:', gameSize); // DEBUG

// ИСПРАВЛЕНО: Определяем DPR с учетом производительности
const DPR = Math.min(
  window.devicePixelRatio || 1,
  2 // Ограничиваем максимальный DPR для производительности
);

const config = {
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#1d2330',
  scale: {
    // КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: RESIZE вместо FIT
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    
    // ИСПРАВЛЕНО: Адаптивные размеры вместо фиксированных
    width: gameSize.width,
    height: gameSize.height,
    
    // ДОБАВЛЕНО: Минимальные и максимальные размеры
    min: {
      width: 360,
      height: 640
    },
    max: {
      width: 1920,
      height: 1080
    }
  },
  resolution: DPR,
  render: { 
    antialias: true, 
    pixelArt: false,
    roundPixels: true, // Четкость на всех экранах
    powerPreference: 'high-performance' // Для лучшей производительности
  },
  scene: [ window.PreloadScene, window.MenuScene, window.GameScene ],
  
  // ОПТИМИЗАЦИЯ: Отключаем неиспользуемые системы
  physics: {
    default: false // Memory game не нуждается в физике
  },
  
  // ДОБАВЛЕНО: Улучшенная обработка input
  input: {
    activePointers: 1, // Только один активный указатель
    smoothFactor: 0,   // Отключаем сглаживание для быстрого отклика
    windowEvents: false // Не обрабатываем события окна
  },
  
  // ДОБАВЛЕНО: Настройки производительности
  fps: {
    target: 60,
    forceSetTimeOut: false
  },
  
  // ИСПРАВЛЕНО: Настройки DOM
  dom: {
    createContainer: false // Не создаем DOM контейнер
  }
};

// Создаем игру
const game = new Phaser.Game(config);

// ДОБАВЛЕНО: Сохраняем ссылку на игру глобально для доступа из обработчиков
window.game = game;

// КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Обработчик изменения размеров
function handleResize() {
  if (!game || !game.scale) return;
  
  const newSize = getOptimalGameSize();
  
  // Проверяем, нужно ли изменять размеры
  if (Math.abs(game.scale.gameSize.width - newSize.width) > 10 ||
      Math.abs(game.scale.gameSize.height - newSize.height) > 10) {
    
    console.log('Resizing game to:', newSize); // DEBUG
    game.scale.resize(newSize.width, newSize.height);
  }
}

// ИСПРАВЛЕНО: Обработчики событий изменения размеров
let resizeTimeout;
window.addEventListener('resize', () => {
  // Дебаунсинг для производительности
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(handleResize, 100);
});

// ДОБАВЛЕНО: Обработчик изменения ориентации (для мобильных)
window.addEventListener('orientationchange', () => {
  setTimeout(() => {
    handleResize();
  }, 200); // Задержка для корректного определения новых размеров
});

// ДОБАВЛЕНО: Обработчик события загрузки игры
game.events.once('ready', () => {
  console.log('Game initialized with size:', game.scale.gameSize); // DEBUG
  
  // ИСПРАВЛЕНО: Убеждаемся что размеры корректны
  handleResize();
});

// ДОБАВЛЕНО: Обработка ошибок
game.events.on('boot', () => {
  console.log('Game booted successfully');
});

window.addEventListener('error', (e) => {
  console.error('Game error:', e);
});

// ДОБАВЛЕНО: Предотвращаем случайные action на мобильных
document.addEventListener('touchmove', (e) => {
  e.preventDefault();
}, { passive: false });

document.addEventListener('touchstart', (e) => {
  // Разрешаем только single touch
  if (e.touches.length > 1) {
    e.preventDefault();
  }
}, { passive: false });

// ДОБАВЛЕНО: Скрываем адресную строку на мобильных (iOS/Android)
setTimeout(() => {
  window.scrollTo(0, 1);
}, 100);
