// ui/Buttons.js
window.makeImageButton = function(scene, x, y, w, h, label, onClick, opts = {}){
  const color      = opts.color      || (window.THEME?.buttonTextColor || '#FFFFFF');
  const hoverColor = opts.hoverColor || color;
  const fontFamily = (window.THEME?.fontButton || window.THEME?.font || 'sans-serif');
  const fs         = Math.round(h * (window.THEME?.btnFontFactor ?? 0.24));

  // Видимая часть
  const img = scene.add.image(0, 0, 'button01').setOrigin(0.5).setDisplaySize(w, h);

  const txt = scene.add.text(0, 0, label, {
    fontFamily: 'Geologica',
    fontSize: `${fs}px`,
    fontStyle: '700' || (window.THEME?.buttonStyle || 'bold'),
    color
  }).setOrigin(0.5);
  txt.setStroke('rgba(0,0,0,0.35)', Math.max(1, Math.round(fs * 0.08)));
  txt.setShadow(0, Math.max(1, Math.round(fs * 0.12)), 'rgba(0,0,0,0.4)', Math.round(fs * 0.20), false, true);



  // Невидимая кликабельная зона по центру
  const zone = scene.add.zone(0, 0, w, h).setOrigin(0.5).setInteractive({ useHandCursor: true });

  const cont = scene.add.container(x, y, children: [img, txt, zone]);
  cont.setSize(w, h);

  // Слушаем именно ZONE
  zone.on('pointerdown', () => onClick && onClick());
  zone.on('pointerover', () => {
    txt.setColor(hoverColor);
    scene.tweens.add({ targets: cont, scale: 1.03, duration: 110 });
  });
  zone.on('pointerout',  () => {
    txt.setColor(color);
    scene.tweens.add({ targets: cont, scale: 1.00, duration: 110 });
  });

  cont.label = txt;
  cont.bg    = img;
  cont.zone  = zone;

  return cont;
};


// ПОЛНАЯ ЗАМЕНА
window.makeIconButton = function(scene, x, y, size, iconText, onClick, opts = {}){
  const color      = opts.color      || (window.THEME?.buttonTextColor || '#FFFFFF');
  const hoverColor = opts.hoverColor || color;
  const fontFamily = (window.THEME?.fontButton || window.THEME?.font || 'sans-serif');
  const ts         = Math.round(size * (opts.fontFactor ?? 0.34));

  // Видимая часть (можно заменить на image, если есть спрайт круга)
  const bg = scene.add.circle(0, 0, size/2, 0x000000, 0);
  bg.setStrokeStyle(2, 0xFFFFFF, 0.5);

  const txt = scene.add.text(0, 0, iconText, {
    fontFamily,
    fontSize: `${ts}px`,
    fontStyle: (window.THEME?.buttonStyle || 'bold'),
    color
  }).setOrigin(0.5);
  txt.setShadow(0, Math.max(1, Math.round(ts*0.10)), 'rgba(0,0,0,0.45)', Math.round(ts*0.18), false, true);

  // Невидимая зона по центру
  const zone = scene.add.zone(0, 0, size, size).setOrigin(0.5).setInteractive({ useHandCursor: true });

  const cont = scene.add.container(x, y, [bg, txt, zone]);
  cont.setSize(size, size);

  zone.on('pointerdown', () => onClick && onClick());
  zone.on('pointerover', () => {
    txt.setColor(hoverColor);
    scene.tweens.add({ targets: cont, scale: 1.05, duration: 110 });
  });
  zone.on('pointerout',  () => {
    txt.setColor(color);
    scene.tweens.add({ targets: cont, scale: 1.00, duration: 110 });
  });

  cont.label = txt;
  cont.zone  = zone;
  return cont;
};
