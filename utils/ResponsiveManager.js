// utils/ResponsiveManager.js - ПОЛНОСТЬЮ ПЕРЕРАБОТАННАЯ ВЕРСИЯ
window.ResponsiveManager = class ResponsiveManager {
  static instance = null;
  
  constructor() {
    if (ResponsiveManager.instance) {
      return ResponsiveManager.instance;
    }
    
    // ✅ Эти значения будут переданы из main.js
    this.deviceClass = null;
    this.cachedDPR = null;
    
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.isMobile = this.detectMobile();
    this.isTablet = this.detectTablet();
    this.orientation = this.getOrientation();
    this.safeArea = this.getSafeArea();
    
    ResponsiveManager.instance = this;
    return this;
  }
  
  detectMobile() {
    const ua = navigator.userAgent;
    const width = window.innerWidth;
    return /Mobile|Android|iPhone/i.test(ua) || width < 768;
  }
  
  detectTablet() {
    const width = window.innerWidth;
    return width >= 768 && width < 1024;
  }
  
  getOrientation() {
    return window.innerHeight > window.innerWidth ? 'portrait' : 'landscape';
  }
  
  getSafeArea() {
    const styles = getComputedStyle(document.documentElement);
    return {
      top: parseInt(styles.getPropertyValue('--sat')) || 0,
      bottom: parseInt(styles.getPropertyValue('--sab')) || 0,
      left: parseInt(styles.getPropertyValue('--sal')) || 0,
      right: parseInt(styles.getPropertyValue('--sar')) || 0
    };
  }
  
  getOptimalGameConfig() {
    // ✅ FIX #1: Используем переданные параметры
    const deviceClass = this.deviceClass || { isLowEnd: false, isHighEnd: false };
    const DPR = this.cachedDPR || window._cachedDPR || this.dpr;
    
    console.log('🎮 ResponsiveManager config:', {
      isMobile: this.isMobile,
      isLowEnd: deviceClass.isLowEnd,
      DPR: DPR,
      orientation: this.orientation
    });
    
    return {
      type: Phaser.AUTO,
      parent: 'game',
      backgroundColor: '#1d2330',
      scale: {
        // ✅ FIX #3: FIT для мобильных (стабильный canvas)
        mode: this.isMobile ? Phaser.Scale.FIT : Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: this.isMobile ? 1280 : window.innerWidth,  
        height: this.isMobile ? 720 : window.innerHeight 
      },
      // ✅ FIX #1: Используем оптимальный DPR из main.js
      resolution: DPR,
      render: {
        // ✅ FIX #2: Всегда включаем antialias для гладкой графики
        antialias: true,
        pixelArt: false,
        // ✅ FIX #2: КРИТИЧНО для резкости текста/UI
        roundPixels: true,
        preserveDrawingBuffer: false,
        // ✅ FIX #4: Отключаем premultipliedAlpha для стабильности
        premultipliedAlpha: false,
        powerPreference: deviceClass.isLowEnd ? 'low-power' : 'high-performance',
        // ✅ FIX #3: Адаптивный batchSize
        batchSize: deviceClass.isLowEnd ? 1024 : (this.isMobile ? 2048 : 4096),
        maxTextures: this.isMobile ? 8 : 16
      },
      fps: {
        target: deviceClass.isLowEnd ? 30 : 60,
        forceSetTimeOut: this.isMobile
      }
    };
  }
  
  getAdaptiveFontSize(baseSize, minSize, maxSize) {
    if (!this.isMobile) return baseSize;
    
    // Фиксированные размеры для читаемости
    const mobileSizes = {
      small: 14,
      medium: 18,
      large: 24,
      xlarge: 32
    };
    
    // Выбираем размер по baseSize
    if (baseSize <= 16) return mobileSizes.small;
    if (baseSize <= 20) return mobileSizes.medium;
    if (baseSize <= 28) return mobileSizes.large;
    return mobileSizes.xlarge;
  }
  
  getCardDimensions(level, containerWidth, containerHeight) {
    const padding = this.isMobile ? 0.01 : 0.04;
    const gap = (() => {
      if (!this.isMobile) return 8;
      const totalCards = level.cols * level.rows;
      if (totalCards <= 12) return 6;
      if (totalCards <= 20) return 4;
      return 3;
    })();
    
    const safeAreaOffset = this.isMobile 
      ? (this.safeArea.top + this.safeArea.bottom) 
      : 0;
    
    const availableW = containerWidth * (1 - padding * 2);
    const availableH = containerHeight * (1 - padding * 2) - safeAreaOffset;
    
    const cardW = (availableW - gap * (level.cols - 1)) / level.cols;
    const cardH = (availableH - gap * (level.rows - 1)) / level.rows;
    
    const aspectRatio = this.orientation === 'portrait' ? 0.68 : 0.80;
    let finalW, finalH;
    
    if (cardW / cardH > aspectRatio) {
      finalH = cardH;
      finalW = finalH * aspectRatio;
    } else {
      finalW = cardW;
      finalH = finalW / aspectRatio;
    }
    
    const maxCardW = this.isMobile ? 220 : 250;
    const maxCardH = this.isMobile ? 300 : 320;
    
    finalW = Math.min(finalW, maxCardW);
    finalH = Math.min(finalH, maxCardH);
    
    return {
      width: Math.floor(finalW),
      height: Math.floor(finalH),
      gap: gap,
      offsetX: padding * containerWidth,
      offsetY: padding * containerHeight + (this.isMobile ? this.safeArea.top : 0)
    };
  }
};
