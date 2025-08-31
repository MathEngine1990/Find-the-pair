// scenes/PreloadScene.js
window.PreloadScene = class PreloadScene extends Phaser.Scene {
  constructor(){ super('PreloadScene'); }
  preload(){
    this.load.image('back', 'assets/back_card02.png');
    ALL_CARD_KEYS.forEach(k => this.load.image(k, `assets/cards/${k}.png`));
    this.load.image('button01', 'assets/button01.png');

    // НОВОЕ: фоны
    this.load.image('bg_menu', 'assets/bg_menu.png');
    this.load.image('bg_game', 'assets/bg_game.png');
  }
  create(){

  const start = () => this.scene.start('MenuScene', { page: 0 });

  // Вариант А: webfontloader (надёжный кросс-браузер)

    if (window.WebFont) {
      WebFont.load({
        google: { families: ['Poppins:400,600,700,800'] },
        active: start,    // шрифты готовы — рисуем меню
        inactive: start   // офлайн/ошибка — всё равно идём дальше
      });
    } else if (document.fonts?.load) {
      Promise.race([
        Promise.all([
          document.fonts.load('normal 24px Poppins'),
          document.fonts.load('600 24px Poppins'),
          document.fonts.load('700 24px Poppins'),
          document.fonts.load('800 24px Poppins'),
        ]),
        new Promise(r => setTimeout(r, 1500)) // фолбэк, чтобы не зависнуть навсегда
      ]).finally(start);
    } else {
      start();
    }
  }


};
