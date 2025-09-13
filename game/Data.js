//---game/Data.js - РАСШИРЕННАЯ версия для VK Mini Apps

// Увеличенный набор карт для больших уровней
window.ALL_CARD_KEYS = [
  // Классические игральные карты
  'qd','qh','qs','qc','kd','kh','ks','kc','ad','ah','as','ac',
  'jd','jh','js','jc','10h','10c','9h','9c','8h','8c','7h','7c',
  '6h','6c','5h','5c','4h','4c','3h','3c','2h','2c',
  
  // Дополнительные символы для разнообразия
  'star','heart','diamond','club','spade','crown','gem','coin',
  'sun','moon','fire','water','earth','wind','light','dark',
  'key','shield','sword','bow','magic','potion','scroll','book'
];

// Расширенные уровни для соответствия требованию 10+ минут игры
window.LEVELS = [
  // ЛЕГКИЙ УРОВЕНЬ (для новичков)
  { label: '3 пары',   cols: 3, rows: 2, difficulty: 'easy', timeLimit: 60 },
  { label: '4 пары',   cols: 4, rows: 2, difficulty: 'easy', timeLimit: 90 },
  { label: '6 пар',    cols: 4, rows: 3, difficulty: 'easy', timeLimit: 120 },
  
  // СРЕДНИЙ УРОВЕНЬ
  { label: '8 пар',    cols: 4, rows: 4, difficulty: 'medium', timeLimit: 180 },
  { label: '10 пар',   cols: 5, rows: 4, difficulty: 'medium', timeLimit: 240 },
  { label: '12 пар',   cols: 6, rows: 4, difficulty: 'medium', timeLimit: 300 },
  { label: '15 пар',   cols: 6, rows: 5, difficulty: 'medium', timeLimit: 360 },
  
  // СЛОЖНЫЙ УРОВЕНЬ
  { label: '18 пар',   cols: 6, rows: 6, difficulty: 'hard', timeLimit: 420 },
  { label: '20 пар',   cols: 8, rows: 5, difficulty: 'hard', timeLimit: 480 },
  { label: '24 пары',  cols: 8, rows: 6, difficulty: 'hard', timeLimit: 540 },
  { label: '28 пар',   cols: 8, rows: 7, difficulty: 'hard', timeLimit: 600 },
  
  // ЭКСТРЕМАЛЬНЫЙ УРОВЕНЬ (для экспертов)
  { label: '32 пары',  cols: 8, rows: 8, difficulty: 'extreme', timeLimit: 720 },
  { label: '36 пар',   cols: 9, rows: 8, difficulty: 'extreme', timeLimit: 840 },
  { label: '40 пар',   cols: 10, rows: 8, difficulty: 'extreme', timeLimit: 960 },
  { label: '45 пар',   cols: 10, rows: 9, difficulty: 'extreme', timeLimit: 1080 },
  
  // МАРАФОН (для максимального времени игры)
  { label: '50 пар',   cols: 10, rows: 10, difficulty: 'marathon', timeLimit: 1200 },
  { label: '60 пар',   cols: 12, rows: 10, difficulty: 'marathon', timeLimit: 1500 }
];

// Конфигурация сложности
window.DIFFICULTY_CONFIG = {
  easy: {
    name: 'Легкий',
    color: '#4CAF50',
    showTime: 5000,    // 5 секунд показа
    flipDelay: 600     // задержка при неверной паре
  },
  medium: {
    name: 'Средний', 
    color: '#FF9800',
    showTime: 4000,    // 4 секунды показа
    flipDelay: 500
  },
  hard: {
    name: 'Сложный',
    color: '#F44336', 
    showTime: 3000,    // 3 секунды показа
    flipDelay: 400
  },
  extreme: {
    name: 'Экстрим',
    color: '#9C27B0',
    showTime: 2000,    // 2 секунды показа
    flipDelay: 300
  },
  marathon: {
    name: 'Марафон',
    color: '#E91E63',
    showTime: 1500,    // 1.5 секунды показа
    flipDelay: 200
  }
};

// Система достижений
window.ACHIEVEMENTS = {
  firstWin: {
    id: 'first_win',
    name: 'Первая победа!',
    description: 'Выиграйте первую игру',
    icon: '🏆',
    points: 10
  },
  perfectGame: {
    id: 'perfect_game', 
    name: 'Идеальная память',
    description: 'Завершите игру без ошибок',
    icon: '🧠',
    points: 50
  },
  speedRunner: {
    id: 'speed_runner',
    name: 'Скоростной бегун',
    description: 'Завершите уровень за 30 секунд',
    icon: '⚡',
    points: 30
  },
  persistent: {
    id: 'persistent',
    name: 'Упорство',
    description: 'Сыграйте 10 игр подряд',
    icon: '🎯',
    points: 25
  },
  expert: {
    id: 'expert',
    name: 'Эксперт памяти',
    description: 'Пройдите сложный уровень',
    icon: '🎓',
    points: 75
  },
  marathoner: {
    id: 'marathoner',
    name: 'Марафонец',
    description: 'Завершите марафонский уровень',
    icon: '🏃',
    points: 100
  },
  collector: {
    id: 'collector',
    name: 'Коллекционер',
    description: 'Найдите все типы карт',
    icon: '📚',
    points: 40
  },
  timeAttack: {
    id: 'time_attack',
    name: 'Гонка со временем',
    description: 'Завершите 5 уровней подряд',
    icon: '⏱️',
    points: 60
  }
};

// Настройки игры для VK Mini Apps
window.GAME_CONFIG = {
  // Минимальное время игры для соответствия требованиям VK (10+ минут)
  minGameplayTime: 600, // 10 минут в секундах
  
  // Показывать подсказки для новых игроков
  showTutorial: true,
  
  // Поддержка возрастных ограничений
  ageRating: '0+',
  
  // Языковые настройки
  defaultLanguage: 'ru',
  supportedLanguages: ['ru', 'en'],
  
  // Настройки аналитики
  trackGameplay: true,
  trackAchievements: true,
  
  // VK интеграция
  vkIntegration: {
    shareOnWin: true,
    saveToCloud: true,
    showAchievements: true
  },
  
  // Звуковые эффекты
  sounds: {
    cardFlip: true,
    match: true,
    error: true,
    win: true,
    backgroundMusic: false // выключено по умолчанию
  }
};

// Функции для работы с прогрессом игрока
window.GAME_PROGRESS = {
  // Сохранение прогресса (с поддержкой VK Cloud)
  save: function(data) {
    const saveData = {
      ...data,
      timestamp: Date.now(),
      version: '1.0'
    };
    
    if (window.VK_UTILS) {
      window.VK_UTILS.saveToCloud('game_progress', saveData);
    } else {
      localStorage.setItem('findpair_progress', JSON.stringify(saveData));
    }
  },
  
  // Загрузка прогресса
  load: function() {
    if (window.VK_UTILS) {
      return window.VK_UTILS.loadFromCloud('game_progress');
    } else {
      const data = localStorage.getItem('findpair_progress');
      return Promise.resolve(data ? JSON.parse(data) : null);
    }
  },
  
  // Получение статистики для отображения
  getStats: function(progress) {
    if (!progress) return null;
    
    return {
      gamesPlayed: progress.gamesPlayed || 0,
      totalTime: progress.totalTime || 0,
      bestTime: progress.bestTime || null,
      totalErrors: progress.totalErrors || 0,
      accuracy: progress.gamesPlayed > 0 ? 
        ((progress.gamesPlayed - progress.totalErrors) / progress.gamesPlayed * 100).toFixed(1) : 0,
      achievementsCount: Object.keys(progress.achievements || {}).length,
      highestLevel: progress.highestLevel || 0
    };
  }
};
