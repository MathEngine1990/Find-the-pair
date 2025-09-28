// game/Progress.js - новый файл для системы прогресса

window.ProgressManager = {
  // Ключ для localStorage
  STORAGE_KEY: 'findpair_progress',
  
  // Получить сохранённый прогресс
  getProgress() {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      console.warn('Error loading progress:', e);
      return {};
    }
  },
  
  // Сохранить прогресс уровня
  saveLevelResult(levelIndex, gameTime, attempts, errors) {
    const progress = this.getProgress();
    const accuracy = attempts > 0 ? (attempts - errors) / attempts : 0;
    
    // Расчёт звёздочек (1-3 звезды)
    let stars = 1; // минимум 1 звезда за прохождение
    
    if (accuracy >= 0.9 && gameTime <= 60) stars = 3;      // отлично
    else if (accuracy >= 0.8 && gameTime <= 90) stars = 2; // хорошо
    
    // Обновляем только если результат лучше
    const current = progress[levelIndex];
    if (!current || stars > current.stars || 
        (stars === current.stars && gameTime < current.bestTime)) {
      
      progress[levelIndex] = {
        stars,
        bestTime: gameTime,
        bestAccuracy: Math.round(accuracy * 100),
        attempts,
        errors,
        completedAt: Date.now()
      };
      
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(progress));
    }
    
    return { stars, improved: !current || stars > current.stars };
  },
  
  // Получить результат конкретного уровня
  getLevelResult(levelIndex) {
    const progress = this.getProgress();
    return progress[levelIndex] || null;
  },
  
  // Получить общую статистику
  getStats() {
    const progress = this.getProgress();
    const levels = Object.keys(progress);
    
    return {
      totalLevels: window.LEVELS.length,
      completedLevels: levels.length,
      totalStars: levels.reduce((sum, key) => sum + progress[key].stars, 0),
      maxStars: window.LEVELS.length * 3,
      averageStars: levels.length > 0 ? 
        levels.reduce((sum, key) => sum + progress[key].stars, 0) / levels.length : 0
    };
  }
};

// Интеграция в GameScene.js - добавить в showWin():
/*
showWin() {
  this.canClick = false;
  this.cards.forEach(c => c.disableInteractive());

  const gameTime = Math.round((Date.now() - this.gameMetrics.startTime) / 1000);
  const levelIndex = window.LEVELS.findIndex(l => l === this.currentLevel);
  
  // ДОБАВЛЕНО: Сохранение прогресса
  const result = window.ProgressManager.saveLevelResult(
    levelIndex, gameTime, this.gameMetrics.attempts, this.gameMetrics.errors
  );
  
  const { W, H } = this.getSceneWH();
  
  // Показ звёздочек
  const starsY = H * 0.28;
  const starSize = 40;
  const starSpacing = 60;
  
  for (let i = 1; i <= 3; i++) {
    const x = W/2 + (i - 2) * starSpacing;
    const filled = i <= result.stars;
    const star = this.add.text(x, starsY, filled ? '★' : '☆', {
      fontSize: `${starSize}px`,
      color: filled ? '#FFD700' : '#666666'
    }).setOrigin(0.5);
    
    if (filled && result.improved) {
      // Анимация новых звёздочек
      star.setScale(0);
      this.tweens.add({
        targets: star,
        scale: 1.2,
        duration: 300,
        delay: i * 150,
        ease: 'Back.easeOut',
        yoyo: true,
        repeat: 0
      });
    }
  }
  
  this.add.text(W/2, H*0.22, 'Победа!', {
    fontFamily: THEME.font, fontSize: this._pxByH(0.088, 22, 48) + 'px',
    color:'#FFFFFF', fontStyle:'800'
  }).setOrigin(0.5);

  this.add.text(W/2, H*0.36, 
    `Время: ${gameTime}с | Попыток: ${this.gameMetrics.attempts} | Ошибок: ${this.gameMetrics.errors}`, {
    fontFamily: THEME.font, fontSize: this._pxByH(0.044, 14, 24) + 'px',
    color:'#E8E1C9', fontStyle:'600'
  }).setOrigin(0.5);

  const btn = window.makeImageButton(
    this, W/2, H*0.50, Math.min(380, W*0.6), Math.min(80, H*0.12),
    '🔄  Сыграть ещё',
    () => this.scene.start('MenuScene', { page: this.levelPage })
  );
  btn.setDepth(10);
}
*/
