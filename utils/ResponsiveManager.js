// utils/ResponsiveManager.js
window.ResponsiveManager = class ResponsiveManager {
  static instance = null;
  
  constructor() {
    if (ResponsiveManager.instance) {
      return ResponsiveManager.instance;
    }
    return this;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.isMobile = this.detectMobile();
    this.isTablet = this.detectTablet();
    this.orientation = this.getOrientation();
    this.safeArea = this.getSafeArea();
    
    ResponsiveManager.instance = this;
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
        mode: this.isMobile ? Phaser.Scale.RESIZE : Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: this.isMobile ? window.innerWidth : 1920,
        height: this.isMobile ? window.innerHeight : 1080
      },
      resolution: isLowEnd ? 1 : this.dpr,
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
    const vw = window.innerWidth / 100;
    const vh = window.innerHeight / 100;
    const vmin = Math.min(vw, vh);
    
    let size = baseSize;
    if (this.isMobile) {
      size = vmin * (baseSize / 10); // Адаптивный размер
    }
    
    return Math.round(Phaser.Math.Clamp(size, minSize, maxSize));
  }
  
  getCardDimensions(level, containerWidth, containerHeight) {
    const padding = this.isMobile ? 0.02 : 0.05;
    const gap = this.isMobile ? 4 : 8;
    const safeAreaOffset = this.isMobile ? this.safeArea.top + this.safeArea.bottom : 0;
    
    const availableW = containerWidth * (1 - padding * 2);
    const availableH = containerHeight * (1 - padding * 2) - safeAreaOffset;
    
    const cardW = (availableW - gap * (level.cols - 1)) / level.cols;
    const cardH = (availableH - gap * (level.rows - 1)) / level.rows;
    
    const aspectRatio = 0.68;
    let finalW, finalH;
    
    if (cardW / cardH > aspectRatio) {
      finalH = cardH;
      finalW = finalH * aspectRatio;
    } else {
      finalW = cardW;
      finalH = finalW / aspectRatio;
    }
    
    // Ограничения для больших экранов
    if (!this.isMobile) {
      finalW = Math.min(finalW, 180);
      finalH = Math.min(finalH, 240);
    }
    
    return {
      width: Math.floor(finalW),
      height: Math.floor(finalH),
      gap: gap,
      offsetX: padding * containerWidth,
      offsetY: padding * containerHeight + (this.isMobile ? this.safeArea.top : 0)
    };
  }
};
