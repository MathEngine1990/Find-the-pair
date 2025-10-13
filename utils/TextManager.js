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
    scale: 0.06,        // 6% высоты экрана
    min: 24,
    max: 48,
    mobileScale: 1.2,   // На мобильных крупнее
    landscapeScale: 0.9,
    font: window.THEME?.fontTitle,
    color: '#FFFFFF',
    style: 'bold',
    autoStroke: true,
    autoShadow: true
  },

  titleMedium: {
    method: 'height',
    scale: 0.045,       // 4.5% высоты
    min: 20,
    max: 36,
    mobileScale: 1.15,
    font: window.THEME?.fontTitle,
    color: '#FFFFFF',
    style: 'bold',
    autoShadow: true
  },

  titleSmall: {
    method: 'height',
    scale: 0.035,       // 3.5% высоты
    min: 18,
    max: 28,
    mobileScale: 1.1,
    font: window.THEME?.fontTitle,
    color: '#FFFFFF',
    style: 'bold'
  },

  // === HUD ЭЛЕМЕНТЫ ===
  hudText: {
    method: 'height',
    scale: 0.025,       // 2.5% высоты
    min: 14,
    max: 20,
    mobileScale: 1.3,   // На мобильных читабельнее
    font: window.THEME?.font,
    color: '#FFFFFF',
    style: 'bold'
  },

  hudTimer: {
    method: 'height',
    scale: 0.028,       // Чуть крупнее обычного HUD
    min: 16,
    max: 22,
    mobileScale: 1.3,
    font: window.THEME?.font,
    color: '#4ECDC4',
    style: 'bold'
  },

  // === КНОПКИ ===
  buttonText: {
    method: 'viewport',  // От минимального измерения
    scale: 0.018,        // 1.8% от базового размера
    min: 14,
    max: 24,
    mobileScale: 1.4,
    font: window.THEME?.fontButton,
    color: window.THEME?.buttonTextColor || '#98d4a7',
    style: 'bold'
  },

  buttonIcon: {
    method: 'viewport',
    scale: 0.025,
    min: 20,
    max: 32,
    mobileScale: 1.3,
    font: window.THEME?.fontButton,
    style: 'bold'
  },

  // === СТАТИСТИКА ===
  statLabel: {
    method: 'height',
    scale: 0.022,
    min: 14,
    max: 18,
    mobileScale: 1.2,
    font: window.THEME?.font,
    color: '#E0E0E0'
  },

  statValue: {
    method: 'height',
    scale: 0.020,
    min: 12,
    max: 16,
    mobileScale: 1.2,
    font: window.THEME?.font,
    color: '#FFFFFF'
  },

  // === ДИАЛОГИ ===
  modalTitle: {
    method: 'height',
    scale: 0.04,
    min: 20,
    max: 32,
    mobileScale: 1.1,
    font: window.THEME?.fontTitle,
    color: '#FFFFFF',
    style: 'bold',
    autoStroke: true
  },

  modalText: {
    method: 'height',
    scale: 0.022,
    min: 14,
    max: 18,
    mobileScale: 1.1,
    font: window.THEME?.font,
    color: '#E8E8E8',
    wordWrap: { widthFactor: 0.85 }
  },

  // === ДОСТИЖЕНИЯ ===
  achievementTitle: {
    method: 'height',
    scale: 0.025,
    min: 16,
    max: 22,
    mobileScale: 1.15,
    font: window.THEME?.font,
    color: '#F39C12',
    style: 'bold'
  },

  achievementDesc: {
    method: 'height',
    scale: 0.018,
    min: 12,
    max: 16,
    mobileScale: 1.15,
    font: window.THEME?.font,
    color: '#FFFFFF'
  },

  // === УВЕДОМЛЕНИЯ ===
  notification: {
    method: 'height',
    scale: 0.03,
    min: 18,
    max: 28,
    mobileScale: 1.2,
    font: window.THEME?.font,
    color: '#FFD700',
    style: 'bold',
    autoShadow: true
  },

  countdown: {
    method: 'height',
    scale: 0.06,
    min: 32,
    max: 56,
    mobileScale: 1.1,
    font: window.THEME?.fontTitle,
    color: '#FF4444',
    style: 'bold',
    autoStroke: true
  },

  // === FALLBACK ===
  default: {
    method: 'height',
    scale: 0.025,
    min: 14,
    max: 20,
    font: window.THEME?.font,
    color: '#FFFFFF'
  }
};
