// ИСПРАВЛЕНО: Чистая инициализация игры без конфликтов переменных

// Функция для определения оптимальных размеров игры
function getOptimalGameSize() {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  
  // Определяем тип устройства
  const isMobile = viewportWidth < 768;
  const isTablet = viewportWidth >= 768 && viewportWidth < 1024;
  
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

// Проверяем, что конфигурация готова
if (!window.gameConfig) {
  console.error('Game config not found!');
  window.gameConfig = {
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: '#1d2330',
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: 1080,
      height: 720
    },
    resolution: Math.min(3, window.devicePixelRatio || 1),
    render: { antialias: true, pixelArt: false },
    scene: [ window.PreloadScene, window.MenuScene, window.GameScene ],
    physics: { default: false }
  };
}

// Создаем игру с базовой конфигурацией
const game = new Phaser.Game(window.gameConfig);

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