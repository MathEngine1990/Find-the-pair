// utils/TextManager.js - Единая система управления текстом
window.TextManager = class TextManager {
  constructor(scene) {
    this.scene = scene;
    this.cache = new Map();
    this.updateDimensions();
  }

updateDimensions() {
  const scale = this.scene.scale;
  const newW = scale.width;
  const newH = scale.height;

  // ⚡ Если размеры не поменялись — ничего не пересчитываем и не чистим кэш
  if (this.W === newW && this.H === newH && this.baseSize) {
    return;
  }

  this.W = newW;
  this.H = newH;
  this.DPR = Math.min(window.devicePixelRatio || 1, 2);
  this.isMobile = this.W < 768 || this.H < 600;
  this.isPortrait = this.H > this.W;
  this.baseSize = Math.min(this.W, this.H);

  // Очистка кэша только когда реально изменился размер
  this.cache.clear();
}


  /**
   * Универсальный расчет размера шрифта
   * @param {string} type - Тип текста (hudText, title, button, stat, etc.)
   * @param {object} options - Дополнительные параметры
   * @returns {number} - Размер шрифта в пикселях
   */
  getSize(type, options = {}) {
    // ✅ FIX #3: Проверка инициализации размеров
  if (!this.W || !this.H || !this.baseSize) {
    console.warn('⚠️ TextManager dimensions not initialized, using fallback');
    this.updateDimensions();
  }
    
    const cacheKey = `${type}_${this.W}_${this.H}`;
    if (this.cache.has(cacheKey) && !options.forceRecalc) {
      return this.cache.get(cacheKey);
    }

    const config = TEXT_PRESETS[type] || TEXT_PRESETS.default;

      // ✅ FIX #3: Защита от undefined
  if (!config) {
    console.error(`❌ No preset for type: ${type}`);
    return 16; // Минимальный fallback
  }
    
    // Базовый расчет
    let size;
    if (config.method === 'viewport') {
      // Относительно viewport (лучше для заголовков)
      size = this.baseSize * config.scale;
    } else if (config.method === 'height') {
      // Относительно высоты (лучше для HUD)
      size = this.H * config.scale;
    } else {
      // Относительно ширины (лучше для кнопок)
      size = this.W * config.scale;
    }

    // Мобильные коррекции
    if (this.isMobile && config.mobileScale) {
      size *= config.mobileScale;
    }

    // Коррекция для альбомной ориентации
    if (!this.isPortrait && config.landscapeScale) {
      size *= config.landscapeScale;
    }

    // Применяем границы
    const min = config.min || 10;
    const max = config.max || 100;
    size = Phaser.Math.Clamp(Math.round(size), min, max);

    // Кэшируем результат
    this.cache.set(cacheKey, size);
    return size;
  }

  /**
   * Получить полный стиль текста
   */
  getStyle(type, overrides = {}) {
    const preset = TEXT_PRESETS[type] || TEXT_PRESETS.default;
    
    return {
      fontFamily:   preset.font || window.THEME?.font || 'Loreley Antiqua',
      fontSize: this.getSize(type) + 'px',
      color: preset.color || '#C4451A',
      fontStyle: preset.style || 'normal',
      stroke: preset.stroke || null,
      strokeThickness: preset.strokeThickness || 0,
      shadow: preset.shadow || null,
      align: preset.align || 'center',
      wordWrap: preset.wordWrap ? { 
        width: this.W * (preset.wordWrap.widthFactor || 0.9) 
      } : null,
      ...overrides
    };
  }

  getStyle2(type, overrides = {}) {
    const preset = TEXT_PRESETS[type] || TEXT_PRESETS.default;
    
    return {
      fontFamily:   preset.font || window.THEME?.font || 'Loreley Antiqua',
      fontSize: this.getSize(type) + 'px',
      color: preset.color || '#C4451A',
      fontStyle: preset.style || 'normal',
      stroke: preset.stroke || null,
      strokeThickness: preset.strokeThickness || 0,
      shadow: preset.shadow || null,
      align: preset.align || 'center',
      wordWrap: preset.wordWrap ? { 
        width: this.W * (preset.wordWrap.widthFactor || 0.9) 
      } : null,
      ...overrides
    };
  }



  /**
   * Создать адаптивный текст
   */
  createText(x, y, content, type, overrides = {}) {
    const style = this.isMobile ? this.getStyle(type, overrides) : this.getStyle2(type, overrides) ;
    const text = this.scene.add.text(x, y, content, style);
    
    const preset = TEXT_PRESETS[type] || TEXT_PRESETS.default;
  
  // 🔥 НОВОЕ: Автоматическая тень с кастомными параметрами
  if (preset.autoShadow) {
    const shadowCfg = preset.shadowConfig || THEME.shadows?.text || {};
    const shadowSize = shadowCfg.offsetX || Math.max(2, Math.round(this.getSize(type) * 0.05));
    const shadowBlur = shadowCfg.blur || 8;
    
    text.setShadow(
      shadowCfg.offsetX || shadowSize,
      shadowCfg.offsetY || shadowSize,
      shadowCfg.color || '#000000',
      shadowBlur,
      false,
      true
    );
  }

  // 🔥 НОВОЕ: Автоматическая обводка с кастомными параметрами
  if (preset.autoStroke) {
    const strokeCfg = preset.stroke || THEME.strokes?.titleThick || {};
    const strokeSize = strokeCfg.thickness || Math.max(2, Math.round(this.getSize(type) * 0.08));
    
    text.setStroke(
      strokeCfg.color,
      strokeSize
    );
  }

    if (preset.autoStroke2) {
    const strokeCfg = preset.stroke || THEME.strokes?.titleThick2 || {};
    const strokeSize = strokeCfg.thickness || Math.max(2, Math.round(this.getSize(type) * 0.08));
    
    text.setStroke(
      strokeCfg.color,
      strokeSize
    );
  }

    if (preset.autoStroke3) {
    const strokeCfg = preset.stroke || THEME.strokes?.titleThick3 || {};
    const strokeSize = strokeCfg.thickness || Math.max(2, Math.round(this.getSize(type) * 0.08));
    
    text.setStroke(
      strokeCfg.color,
      strokeSize
    );
  }

    return text;
  }

  /**
   * Обновить существующий текст при resize
   */
  updateText(textObject, type) {
    if (!textObject || !textObject.scene) return;
    
    const newSize = this.getSize(type);
    textObject.setFontSize(newSize);
    
    // Обновляем stroke/shadow пропорционально
    if (TEXT_PRESETS[type]?.autoStroke) {
      const strokeSize = Math.max(2, Math.round(newSize * 0.08));
      textObject.setStroke('#000000', strokeSize);
    }
  }
};

// ============================================
// ПРЕСЕТЫ ТЕКСТА - ЕДИНЫЙ ИСТОЧНИК ПРАВДЫ
// ============================================
window.TEXT_PRESETS = {

  
  // === ЗАГОЛОВКИ ===
  titleLarge: {
    method: 'height',
    scale: 0.055,        // ⬇️ Уменьшено с 0.06 (было слишком крупно)
    min: 22,
    max: 42,
    mobileScale: 1.15,   // ⬇️ Уменьшено с 1.2
    landscapeScale: 0.9,
    get font() { return window.THEME?.fontNot || 'Loreley Antiqua'; },  // ✅ Геттер
    color: window.THEME?.colors?.titlePrimary || '#F2DC9B',
    style: 'bold',
    autoStroke: true,
    autoShadow: true,
    // 🔥 НОВОЕ: Настройки тени и обводки
    shadowConfig: window.THEME?.shadows?.title,
    strokeConfig: window.THEME?.strokes?.titleThick
  },

  // 🔥 НОВОЕ: МОБИЛЬНЫЙ ПРЕСЕТ (переопределяет titleLarge)
  titleLarge_mobile: {
    method: 'height',
    scale: 0.035,        // ← Больше базовый размер
    min: 28,             // ← Больше минимум
    max: 48,             // ← Больше максимум
    mobileScale: 0.5,    // ← Не нужен множитель
    landscapeScale: 0.85,
    get font() { return window.THEME?.fontNot || 'Loreley Antiqua'; },  // ✅ Геттер
    color: window.THEME?.colors?.titlePrimary || '#F2DC9B',
    style: 'bold',
    autoStroke2: true,
    autoShadow: true,
    shadowConfig: window.THEME?.shadows?.title,
    strokeConfig: window.THEME?.strokes?.titleThick
  },

  // 🔥 НОВОЕ: ДЕСКТОПНЫЙ ПРЕСЕТ
  titleLarge_desktop: {
    method: 'height',
    scale: 0.050,        // ← Меньше для десктопа
    min: 32,
    max: 56,
    get font() { return window.THEME?.fontNot || 'Loreley Antiqua'; },  // ✅ Геттер
    color: window.THEME?.colors?.titlePrimary || '#F2DC9B',
    style: 'bold',
    autoStroke2: true,
    autoShadow: true
  },

  titleMedium: {
    method: 'height',
    scale: 0.040,        // ⬇️ Уменьшено с 0.045
    min: 16,
    max: 24,
    mobileScale: 1.1,
    get font() { return window.THEME?.font || 'Loreley Antiqua'; },  // ✅ Геттер
    color: window.THEME?.colors?.titleSecondary || '#012615',
    style: 'bold',
    autoShadow: true,
    //autoStroke2: true,
    shadowConfig: window.THEME?.shadows?.text
  },

  titleSmall: {
    method: 'height',
    scale: 0.030,        // ⬇️ Уменьшено с 0.035
    min: 16,
    max: 24,
    mobileScale: 1.1,
    font: 'Loreley Antiqua',//window.THEME?.fontTitle,
    color: window.THEME?.colors?.textPrimary || '#FFFFFF',
    style: 'bold'
  },

  // === HUD ЭЛЕМЕНТЫ ===
  hudText: {
    method: 'height',
    scale: 0.024,        // ⬇️ Уменьшено с 0.025
    min: 14,
    max: 19,            // ⬇️ Уменьшено с 20
    mobileScale: 1.25,  // ⬇️ Уменьшено с 1.3
    get font() { return window.THEME?.fontNot || 'Loreley Antiqua'; },  // ✅ Геттер
    color: window.THEME?.colors?.textPrimary || '#FFFFFF',
    style: 'bold'
  },

  hudTimer: {
    method: 'height',
    scale: 0.026,        // ⬇️ Уменьшено с 0.028
    min: 15,
    max: 20,            // ⬇️ Уменьшено с 22
    mobileScale: 1.25,
    get font() { return window.THEME?.fontNot || 'Loreley Antiqua'; },  // ✅ Геттер
    color: window.THEME?.colors?.hudTimer || '#FFEBB4',
    style: 'bold'
  },

  // === КНОПКИ ===
  buttonText: {
    method: 'viewport',
    scale: 0.016,        // ⬇️ Уменьшено с 0.018
    min: 14,
    max: 22,            // ⬇️ Уменьшено с 24
    mobileScale: 1.3,
    font: 'Loreley Antiqua',//window.THEME?.fontButton || 'Loreley Antiqua',
    color: '#F2C791',
    style: 'bold'
  },

  buttonIcon: {
    method: 'viewport',
    scale: 0.022,        // ⬇️ Уменьшено с 0.025
    min: 18,
    max: 28,            // ⬇️ Уменьшено с 32
    mobileScale: 1.25,
    font: 'Loreley Antiqua',// window.THEME?.fontButton,
    style: 'bold'
  },

  // 🔥 НОВОЕ: Номера уровней на кнопках
  levelNumber: {
    method: 'viewport',
    scale: 0.045,        // 🎯 Оптимальный размер для читабельности
    min: 32,
    max: 64,
    mobileScale: 1.1,
    landscapeScale: 0.95,
    get font() { return window.THEME?.fontNot || 'Loreley Antiqua'; },  // ✅ Геттер
    color: window.THEME?.colors?.levelNumber || '#F2C791',
    style: 'bold',
    autoStroke2: true,
    autoShadow: true//,
    // 🔥 Белая обводка для контраста с оранжевым фоном
   // strokeConfig: window.THEME?.strokes?.levelNumber || '#4ECDC4',
   // shadowConfig: window.THEME?.shadows?.levelNumber
  },

  // === СТАТИСТИКА ===
  statLabel: {
    method: 'height',
    scale: 0.018,        // ⬇️ Уменьшено с 0.022
    min: 11,            // ⬇️ Уменьшено с 14
    max: 15,            // ⬇️ Уменьшено с 18
    mobileScale: 1.15,
    get font() { return window.THEME?.font || 'Loreley Antiqua'; },  // ✅ Геттер
    color: window.THEME?.colors?.textSecondary || '#243540'
  },

  statValue: {
    method: 'height',
    scale: 0.018,        // ⬇️ Уменьшено с 0.020
    min: 11,            // ⬇️ Уменьшено с 12
    max: 15,            // ⬇️ Уменьшено с 16
    mobileScale: 1.15,
    get font() { return window.THEME?.font || 'Loreley Antiqua'; },  // ✅ Геттер
    color: window.THEME?.colors?.statsAccuracy || '#243540'//'#3A5939'
  },

  // 🔥 НОВОЕ: Статистика под кнопками уровней
  levelStats: {
    method: 'viewport',
    scale: 0.016,        // 🎯 Мелкий, но читабельный
    min: 13,
    max: 18,
    mobileScale: 1.3,
    font: 'Loreley Antiqua',//window.THEME?.font,
    color: window.THEME?.colors?.statsAccuracy || '#243540',
    style: 'normal'
  },

  // === ЗВЁЗДЫ ===
  stars: {
    method: 'viewport',
    scale: 0.018,        // 🎯 Пропорционально кнопкам
    min: 16,
    max: 26,
    mobileScale: 1.15,
    get font() { return window.THEME?.font || 'Loreley Antiqua'; },  // ✅ Геттер
    style: 'bold'
  },

  // === ДИАЛОГИ ===
  modalTitle: {
    method: 'height',
    scale: 0.038,        // ⬇️ Уменьшено с 0.04
    min: 19,
    max: 30,
    mobileScale: 1.1,
    get font() { return window.THEME?.fontTitle || 'Loreley Antiqua'; },  // ✅ Геттер
    color: window.THEME?.colors?.textPrimary || '#FFFFFF',
    style: 'bold',
    autoStroke: true,
    strokeConfig: window.THEME?.strokes?.titleThin
  },

  modalText: {
    method: 'height',
    scale: 0.020,        // ⬇️ Уменьшено с 0.022
    min: 13,
    max: 17,
    mobileScale: 1.1,
    get font() { return window.THEME?.font || 'Loreley Antiqua'; },  // ✅ Геттер
    color: window.THEME?.colors?.notificationDesc || '#E8E8E8',
    wordWrap: { widthFactor: 0.85 }
  },

  // === ДОСТИЖЕНИЯ ===
  achievementTitle: {
    method: 'height',
    scale: 0.023,        // ⬇️ Уменьшено с 0.025
    min: 15,
    max: 20,
    mobileScale: 1.15,
    get font() { return window.THEME?.fontNot || 'Loreley Antiqua'; },  // ✅ Геттер
    color: window.THEME?.colors?.accent || '#FF6B35',
    style: 'bold'
  },

    achievementDesc: {
    method: 'height',
    scale: 0.017,
    min: 11,
    max: 15,
    mobileScale: 1.15,
    get font() { return window.THEME?.fontNot || 'Loreley Antiqua'; },
    color: window.THEME?.colors?.notificationDesc || '#E8E8E8'
  },

  achievementDescArial: {
    method: 'height',
    scale: 0.017,
    min: 11,
    max: 15,
    mobileScale: 1.15,
    font: 'Arial, sans-serif',
    color: window.THEME?.colors?.notificationDesc || '#E8E8E8'
  },

  // === УВЕДОМЛЕНИЯ ===
  notification: {
    method: 'height',
    scale: 0.028,        // ⬇️ Уменьшено с 0.03
    min: 17,
    max: 26,
    mobileScale: 1.2,
    get font() { return window.THEME?.fontNot || 'Loreley Antiqua'; },  // ✅ Геттер
    color: window.THEME?.colors?.notificationText || '#FFEBB4',
    style: 'bold',
    autoStroke: true,
    autoShadow: true,
    shadowConfig: window.THEME?.shadows?.title
  },

  countdown: {
    method: 'height',
    scale: 0.055,        // ⬇️ Уменьшено с 0.06
    min: 30,
    max: 52,
    mobileScale: 1.1,
    get font() { return window.THEME?.fontNot || 'Loreley Antiqua'; },  // ✅ Геттер
    color: window.THEME?.colors?.error || '#CE8535',
    style: 'bold',
    autoStroke: true,
    strokeConfig: window.THEME?.strokes?.titleThick
  },

  // === FALLBACK ===
  default: {
    method: 'height',
    scale: 0.023,
    min: 13,
    max: 19,
    get font() { return window.THEME?.font || 'Loreley Antiqua'; },  // ✅ Геттер
    color: window.THEME?.colors?.textPrimary || '#FFFFFF'
  }
};
