// utils/TextManager.js - Единая система управления текстом
window.TextManager = class TextManager {
  constructor(scene) {
    this.scene = scene;
    this.cache = new Map();
    this.updateDimensions();
  }

  updateDimensions() {
    const scale = this.scene.scale;
    this.W = scale.width;
    this.H = scale.height;
    this.DPR = Math.min(window.devicePixelRatio || 1, 2);
    this.isMobile = this.W < 768 || this.H < 600;
    this.isPortrait = this.H > this.W;
    this.baseSize = Math.min(this.W, this.H);
    
    // Очищаем кэш при изменении размеров
    this.cache.clear();
  }

  /**
   * Универсальный расчет размера шрифта
   * @param {string} type - Тип текста (hudText, title, button, stat, etc.)
   * @param {object} options - Дополнительные параметры
   * @returns {number} - Размер шрифта в пикселях
   */
  getSize(type, options = {}) {
    const cacheKey = `${type}_${this.W}_${this.H}`;
    if (this.cache.has(cacheKey) && !options.forceRecalc) {
      return this.cache.get(cacheKey);
    }

    const config = TEXT_PRESETS[type] || TEXT_PRESETS.default;
    
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
      fontFamily: preset.font || window.THEME.font,
      fontSize: this.getSize(type) + 'px',
      color: preset.color || '#FFFFFF',
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
    const style = this.getStyle(type, overrides);
    const text = this.scene.add.text(x, y, content, style);
    
    // Автоматическая тень для заголовков
    if (TEXT_PRESETS[type]?.autoShadow) {
      const shadowSize = Math.max(2, Math.round(this.getSize(type) * 0.05));
      text.setShadow(shadowSize, shadowSize, '#000000', 8, false, true);
    }

    // Автоматический stroke для больших текстов
    if (TEXT_PRESETS[type]?.autoStroke) {
      const strokeSize = Math.max(2, Math.round(this.getSize(type) * 0.08));
      text.setStroke('#000000', strokeSize);
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
    font: window.THEME?.fontTitle,
    color: window.THEME?.colors?.titlePrimary || '#FFE066',
    style: 'bold',
    autoStroke: true,
    autoShadow: true,
    // 🔥 НОВОЕ: Настройки тени и обводки
    shadowConfig: window.THEME?.shadows?.title,
    strokeConfig: window.THEME?.strokes?.titleThick
  },

  titleMedium: {
    method: 'height',
    scale: 0.040,        // ⬇️ Уменьшено с 0.045
    min: 18,
    max: 32,
    mobileScale: 1.1,
    font: window.THEME?.fontTitle,
    color: window.THEME?.colors?.titleSecondary || '#4ECDC4',
    style: 'bold',
    autoShadow: true,
    shadowConfig: window.THEME?.shadows?.text
  },

  titleSmall: {
    method: 'height',
    scale: 0.030,        // ⬇️ Уменьшено с 0.035
    min: 16,
    max: 24,
    mobileScale: 1.1,
    font: window.THEME?.fontTitle,
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
    font: window.THEME?.font,
    color: window.THEME?.colors?.textPrimary || '#FFFFFF',
    style: 'bold'
  },

  hudTimer: {
    method: 'height',
    scale: 0.026,        // ⬇️ Уменьшено с 0.028
    min: 15,
    max: 20,            // ⬇️ Уменьшено с 22
    mobileScale: 1.25,
    font: window.THEME?.font,
    color: window.THEME?.colors?.hudTimer || '#4ECDC4',
    style: 'bold'
  },

  // === КНОПКИ ===
  buttonText: {
    method: 'viewport',
    scale: 0.016,        // ⬇️ Уменьшено с 0.018
    min: 14,
    max: 22,            // ⬇️ Уменьшено с 24
    mobileScale: 1.3,
    font: window.THEME?.fontButton,
    color: window.THEME?.colors?.textPrimary || '#FFFFFF',
    style: 'bold'
  },

  buttonIcon: {
    method: 'viewport',
    scale: 0.022,        // ⬇️ Уменьшено с 0.025
    min: 18,
    max: 28,            // ⬇️ Уменьшено с 32
    mobileScale: 1.25,
    font: window.THEME?.fontButton,
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
    font: window.THEME?.fontButton,
    color: window.THEME?.colors?.levelNumber || '#1A1A2E',
    style: 'bold',
    autoStroke: true,
    autoShadow: true,
    // 🔥 Белая обводка для контраста с оранжевым фоном
    strokeConfig: window.THEME?.strokes?.levelNumber,
    shadowConfig: window.THEME?.shadows?.levelNumber
  },

  // === СТАТИСТИКА ===
  statLabel: {
    method: 'height',
    scale: 0.020,        // ⬇️ Уменьшено с 0.022
    min: 13,            // ⬇️ Уменьшено с 14
    max: 17,            // ⬇️ Уменьшено с 18
    mobileScale: 1.15,
    font: window.THEME?.font,
    color: window.THEME?.colors?.textSecondary || '#B8C5D6'
  },

  statValue: {
    method: 'height',
    scale: 0.018,        // ⬇️ Уменьшено с 0.020
    min: 11,            // ⬇️ Уменьшено с 12
    max: 15,            // ⬇️ Уменьшено с 16
    mobileScale: 1.15,
    font: window.THEME?.font,
    color: window.THEME?.colors?.statsAccuracy || '#A8DADC'
  },

  // 🔥 НОВОЕ: Статистика под кнопками уровней
  levelStats: {
    method: 'viewport',
    scale: 0.012,        // 🎯 Мелкий, но читабельный
    min: 10,
    max: 14,
    mobileScale: 1.2,
    font: window.THEME?.font,
    color: window.THEME?.colors?.statsAccuracy || '#A8DADC',
    style: 'normal'
  },

  // === ЗВЁЗДЫ ===
  stars: {
    method: 'viewport',
    scale: 0.018,        // 🎯 Пропорционально кнопкам
    min: 16,
    max: 26,
    mobileScale: 1.15,
    font: window.THEME?.font,
    style: 'bold'
  },

  // === ДИАЛОГИ ===
  modalTitle: {
    method: 'height',
    scale: 0.038,        // ⬇️ Уменьшено с 0.04
    min: 19,
    max: 30,
    mobileScale: 1.1,
    font: window.THEME?.fontTitle,
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
    font: window.THEME?.font,
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
    font: window.THEME?.font,
    color: window.THEME?.colors?.accent || '#FF6B35',
    style: 'bold'
  },

  achievementDesc: {
    method: 'height',
    scale: 0.017,        // ⬇️ Уменьшено с 0.018
    min: 11,
    max: 15,
    mobileScale: 1.15,
    font: window.THEME?.font,
    color: window.THEME?.colors?.notificationDesc || '#E8E8E8'
  },

  // === УВЕДОМЛЕНИЯ ===
  notification: {
    method: 'height',
    scale: 0.028,        // ⬇️ Уменьшено с 0.03
    min: 17,
    max: 26,
    mobileScale: 1.2,
    font: window.THEME?.font,
    color: window.THEME?.colors?.notificationText || '#FFE066',
    style: 'bold',
    autoShadow: true,
    shadowConfig: window.THEME?.shadows?.title
  },

  countdown: {
    method: 'height',
    scale: 0.055,        // ⬇️ Уменьшено с 0.06
    min: 30,
    max: 52,
    mobileScale: 1.1,
    font: window.THEME?.fontTitle,
    color: window.THEME?.colors?.error || '#E74C3C',
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
    font: window.THEME?.font,
    color: window.THEME?.colors?.textPrimary || '#FFFFFF'
  }
};
