window.THEME = {
  // === ШРИФТЫ ===
  font: 'Arial',//,system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
  fontTitle: 'Arial',//, system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
  fontButton: 'Arial',//,system-ui, -apple-system, Segoe UI, Roboto, sans-serif',

  fontNot: 'Loreley Antiqua',

//<link rel="preload" href="fonts/YourFont-Regular.woff2" as="font" type="font/woff2" crossorigin>
//<link rel="preload" href="fonts/YourFont-Bold.woff2" as="font" type="font/woff2" crossorigin>
  
  titleStyle: 'bold',
  buttonStyle: 'bold',
  
  // === ЦВЕТА ТЕКСТА ===
  // 🔥 КРИТИЧНО: Высококонтрастные цвета для читабельности
  colors: {
    // Заголовки
    titlePrimary:  '#FFE066',    // Жёлто-золотой (яркий, но не режущий)
    titleSecondary: '#F2C791',  // Бирюзовый (для приветствия VK)
    
    // Основной текст
    textPrimary: '#FFFFFF',     // Белый (основной)
    textSecondary: '#BF3715',   // Светло-серый (статистика)
    textMuted: '#8A9BAE',       // Приглушённый (неактивные элементы)
    
    // Акцентные цвета
    accent: '#FF6B35',          // Оранжевый (важные элементы)
    success: '#2ECC71',         // Зелёный (успех, синхронизация)
    warning: '#F39C12',         // Янтарный (предупреждения)
    error: '#E74C3C',           // Красный (ошибки)
    
    // Статистика и значки
    stars: '#FFD36E',           // Золотой (заполненные звёзды)
    starsEmpty: '#4A5568',      // Тёмно-серый (пустые звёзды)
    statsTime: '#4ECDC4',       // Бирюзовый (время)
    statsAccuracy: '#243540',   // Светло-бирюзовый (точность)
    
    // Кнопки уровней
    levelNumber: '#3A5939',     // Почти чёрный (контраст с оранжевым фоном)
    levelNumberShadow: 'rgba(255, 107, 53, 0.8)', // Оранжевая тень

    titleThick: '#BF3715', // Оранжевая тень
    
    // HUD
    hudTimer: '#4ECDC4',        // Бирюзовый (таймер)
    hudErrors: '#FF6B6B',       // Коралловый (ошибки)
    
    // Уведомления
    notificationBg: 'rgba(26, 26, 46, 0.95)', // Тёмный полупрозрачный
    notificationText: '#FFE066',              // Жёлтый
    notificationDesc: '#E8E8E8'               // Светло-серый
  },
  
  // === ТЕНИ ===
  shadows: {
    title: {
      color: 'rgba(0, 0, 0, 0.7)',
      blur: 12,
      offsetX: 0,
      offsetY: 3
    },
    levelNumber: {
      color: 'rgba(78, 205, 196, 0.8)',
      blur: 5,
      offsetX: 0,
      offsetY: 3
    },
    text: {
      color: 'rgba(0, 0, 0, 0.5)',
      blur: 6,
      offsetX: 0,
      offsetY: 2
    }
  },
  
  // === ОБВОДКА ===
  strokes: {
    titleThick: {
      color: '#3A5939',
      thickness: 4
    },
        titleThick2: {
      color: '#BF3715',
      thickness: 2
    },
    titleThick3: {
      color: '#012615',
      thickness: 4
    },
    titleThin: {
      color: 'rgba(0, 0, 0, 0.8)',
      thickness: 2
    },
    levelNumber: {
      color: '#4ECDC4',
      thickness: 1
    }
  },
  
  // Старые параметры (для обратной совместимости)
  titleColor: '#FFE066',
  buttonTextColor: '#FFFFFF',
  titleSizeFactor: 0.070,    // Уменьшено с 0.080
  btnFontFactor: 0.22,       // Уменьшено с 0.24
  
  // Фон и градиенты
  bgTop: '#06120E',
  bgMid: '#1C2F27',
  bgBottom: '#495D53',
  gradA1: '#B88A2E',
  gradA2: '#3C4F45',
  gradB1: '#41584C',
  gradB2: '#C87420',
  strokeLight: 'rgba(230,220,190,0.34)',
  strokeDark: 'rgba(0,0,0,0.28)',
  hudFill: 0x0a1410,
  hudText: '#E8E1C9',
  cardDimAlpha: 0.40
};
