//---ui/Button.js - ИСПРАВЛЕННАЯ ВЕРСИЯ
// ✅ Добавлена поддержка кастомных цветов фона/границы для makeIconButton
// ✅ Цвета можно передавать через opts.bgColor и opts.borderColor

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
  
  const children = [img, txt, zone];
const cont = scene.add.container(Math.round(x), Math.round(y), children);

cont.setSize(w, h);

// ⚡ Сохраняем колбэк на самом контейнере, чтобы его можно было менять позже
cont.onClick = onClick;

zone.on('pointerdown', () => cont.onClick && cont.onClick());

zone.on('pointerout',  () => { 
  txt.setColor(color);      
  scene.tweens.add({ targets: cont, scale: 1.00, duration: 110 }); 
});

cont.label = txt; 
cont.bg = img; 
cont.zone = zone;
return cont;

};

// 🔥 НОВОЕ: Поддержка кастомных цветов фона и границы
window.makeIconButton = function(scene, x, y, size, iconText, onClick, opts = {}){
  const color       = opts.color       || (window.THEME?.buttonTextColor || '#B6561A');
  const hoverColor  = opts.hoverColor  || color;
  const bgColor     = opts.bgColor     || 0x000000;  // 🔥 НОВОЕ: цвет фона (hex number)
  const borderColor = opts.borderColor || 0xFFFFFF;  // 🔥 НОВОЕ: цвет границы (hex number)
  const bgAlpha     = opts.bgAlpha     || 0;         // 🔥 НОВОЕ: прозрачность фона (0-1)
  const borderAlpha = opts.borderAlpha || 0.5;       // 🔥 НОВОЕ: прозрачность границы (0-1)
  const borderWidth = opts.borderWidth || 2;         // 🔥 НОВОЕ: толщина границы
  
  const fontFamily = (window.THEME?.fontButton || window.THEME?.font || 'sans-serif');
  const ts         = Math.round(size * (opts.fontFactor ?? 0.34));
  
  // ✅ Используем переданные цвета вместо хардкода
  const bg  = scene.add.circle(0, 0, size/2, bgColor, bgAlpha).setScrollFactor(0);
  bg.setStrokeStyle(borderWidth, borderColor, borderAlpha);
  
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
  cont.bg = bg;  // 🔥 НОВОЕ: сохраняем ссылку на фон
  cont.zone = zone;
  return cont;
};
