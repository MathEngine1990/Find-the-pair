window.THEME = {
  // === ШРИФТЫ ===
  font: 'BoldPixels',//,system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
  fontTitle: 'BoldPixels',//, system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
  fontButton: 'BoldPixels',//,system-ui, -apple-system, Segoe UI, Roboto, sans-serif',

//<link rel="preload" href="fonts/YourFont-Regular.woff2" as="font" type="font/woff2" crossorigin>
//<link rel="preload" href="fonts/YourFont-Bold.woff2" as="font" type="font/woff2" crossorigin>
  
  titleStyle: 'bold',
  buttonStyle: 'bold',
  
  // === ЦВЕТА ТЕКСТА ===
  // 🔥 КРИТИЧНО: Высококонтрастные цвета для читабельности
  colors: {
    // Заголовки
    titlePrimary: '#FFE066',    // Жёлто-золотой (яркий, но не режущий)
    titleSecondary: '#C4451A',  // Бирюзовый (для приветствия VK)
    
    // Основной текст
    textPrimary: '#FFFFFF',     // Белый (основной)
    textSecondary: '#C4451A',   // Светло-серый (статистика)
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
    statsAccuracy: '#A8DADC',   // Светло-бирюзовый (точность)
    
    // Кнопки уровней
    levelNumber: '#1A1A2E00',     // Почти чёрный (контраст с оранжевым фоном)
    levelNumberShadow: 'rgba(255, 107, 53, 0.8)', // Оранжевая тень
    
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
      color: '#000000',
      thickness: 4
    },
    titleThick3: {
      color: '##8000ff',
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
