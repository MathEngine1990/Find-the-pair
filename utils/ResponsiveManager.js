// utils/ResponsiveManager.js
window.ResponsiveManager = class ResponsiveManager {
  static instance = null;
  
  constructor() {
    if (ResponsiveManager.instance) {
      return ResponsiveManager.instance;
    }
    
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
    const screenArea = window.screen.width * window.screen.height;
    const isLowEnd = screenArea < 500000 || this.dpr > 2;
    
    return {
      type: Phaser.AUTO,
      parent: 'game',
      backgroundColor: '#1d2330',
      scale: {
  mode: Phaser.Scale.RESIZE, // ← Игра подстраивается под размер окна
  autoCenter: Phaser.Scale.CENTER_BOTH,
  width: window.innerWidth,  // ← Динамическая ширина
  height: window.innerHeight // ← Динамическая высота
},
      resolution: (() => {
  if (isLowEnd) return 1;                              // Слабые: DPR=1
  if (navigator.hardwareConcurrency >= 6) return 2;    // Мощные: DPR=2
  return 1.5;                                          // Средние: DPR=1.5
})(),
      render: {
        antialias: !isLowEnd,
        pixelArt: false,
        preserveDrawingBuffer: false, // КРИТИЧНО!
        powerPreference: isLowEnd ? 'low-power' : 'high-performance',
        batchSize: isLowEnd ? 2048 : 4096,
        maxTextures: isLowEnd ? 8 : 16
      },
      fps: {
        target: isLowEnd ? 30 : 60,
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
  
  // ResponsiveManager.js:95
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
