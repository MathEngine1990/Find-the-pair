//---ui/Button.js - путь отдельного файл
// Без инлайна. Зона клика = zone, визуал = img + text.
// Никаких числовых '700' в fontStyle (только 'bold', 'italic' и т.п.)

window.makeImageButton = function(scene, x, y, w, h, label, onClick, opts = {}){
  const color      = opts.color      || (window.THEME?.buttonTextColor || '#FFFFFF');
  const hoverColor = opts.hoverColor || color;
  const fontFamily = (window.THEME?.fontButton || window.THEME?.font || 'sans-serif');
  const fs         = Math.round(h * (window.THEME?.btnFontFactor ?? 0.34));
  
  const img = scene.add.image(0, 0, 'button01')
    .setOrigin(0.5)
    .setDisplaySize(w, h)
    .setScrollFactor(0);
    
  const txt = scene.add.text(0, 0, label, {
    fontFamily,
    fontSize: `${fs}px`,
    fontStyle: (window.THEME?.buttonStyle || 'bold'),
    color,
        stroke: '#000000',
        strokeThickness: 2
  }).setOrigin(0.5).setScrollFactor(0);
  
  const zone = scene.add.zone(0, 0, w, h)
    .setOrigin(0.5)
    .setInteractive({ useHandCursor: true })
    .setScrollFactor(0);
  
  // ВАЖНО: Объявление children должно быть ПОСЛЕ создания img, txt, zone
  const children = [img, txt, zone];
  const cont = scene.add.container(Math.round(x), Math.round(y), children);
  
  cont.setSize(w, h);
  
  zone.on('pointerdown', () => onClick && onClick());
  
  zone.on('pointerout',  () => { 
    txt.setColor(color);      
    scene.tweens.add({ targets: cont, scale: 1.00, duration: 110 }); 
  });
  
  cont.label = txt; 
  cont.bg = img; 
  cont.zone = zone;
  return cont;
};

window.makeIconButton = function(scene, x, y, size, iconText, onClick, opts = {}){
  const color      = opts.color      || (window.THEME?.buttonTextColor || '#FFFFFF');
  const hoverColor = opts.hoverColor || color;
  const fontFamily = (window.THEME?.fontButton || window.THEME?.font || 'sans-serif');
  const ts         = Math.round(size * (opts.fontFactor ?? 0.34));
  
  const bg  = scene.add.circle(0, 0, size/2, 0x000000, 0).setScrollFactor(0);
  bg.setStrokeStyle(2, 0xFFFFFF, 0.5);
  
  const txt = scene.add.text(0, 0, iconText, {
    fontFamily, 
    fontSize: `${ts}px`, 
    fontStyle: (window.THEME?.buttonStyle || 'bold'), 
    color
  }).setOrigin(0.5).setScrollFactor(0);
  
  const zone = scene.add.zone(0, 0, size, size)
    .setOrigin(0.5)
    .setInteractive({ useHandCursor: true })
    .setScrollFactor(0);
  
  const cont = scene.add.container(Math.round(x), Math.round(y), [bg, txt, zone]);
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
  cont.zone = zone;
  return cont;
};
