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

// ИСПРАВЛЕНО: Получаем базовую конфигурацию из index.html и дополняем
const optimalSize = getOptimalGameSize();
console.log('Optimal game size:', optimalSize); // DEBUG

// Обновляем конфигурацию оптимальными размерами
if (window.gameConfig) {
  window.gameConfig.scale.width = optimalSize.width;
  window.gameConfig.scale.height = optimalSize.height;
  
  // ДОБАВЛЕНО: Дополнительные настройки производительности
  window.gameConfig.fps = {
    target: 60,
    forceSetTimeOut: false
  };
  
  window.gameConfig.dom = {
    createContainer: false
  };
  
  window.gameConfig.render.powerPreference = 'high-performance';
}

// Создаем игру с обновленной конфигурацией
const game = new Phaser.Game(window.gameConfig || {});

// ДОБАВЛЕНО: Сохраняем ссылку на игру глобально
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