// ui/Buttons.js
window.makeImageButton = function(scene, x, y, w, h, label, onClick){
  const img = scene.add.image(0, 0, 'button01').setOrigin(0.5);
  img.setDisplaySize(w, h);

  const txt = scene.add.text(0, 0, label, {
    fontFamily: THEME.font,
    fontSize: Math.round(h*0.22) + 'px',
    color:'#FFFFFF',
    fontStyle:'600',
    align:'center'
  }).setOrigin(0.5);

  const cont = scene.add.container(x, y, [img, txt]);
  cont.setSize(w, h);

  // интерактив через объект (прямоугольная область)
  cont.setInteractive({
    hitArea: new Phaser.Geom.Rectangle(-w/2, -h/2, w, h),
    hitAreaCallback: Phaser.Geom.Rectangle.Contains,
    useHandCursor: true
  });

  cont.on('pointerdown', () => onClick && onClick());
  cont.on('pointerover', () => scene.tweens.add({ targets: cont, scale: 1.03, duration: 110 }));
  cont.on('pointerout',  () => scene.tweens.add({ targets: cont, scale: 1.00, duration: 110 }));

  return cont;
};

window.makeIconButton = function(scene, x, y, size, iconText, onClick){
  const bg = scene.add.circle(0,0, size/2, 0x000000, 0); // прозрачный фон
  bg.setStrokeStyle(2, 0xFFFFFF, 0.5);

  const txt = scene.add.text(0,0,iconText,{
    fontFamily: THEME.font,
    fontSize: Math.round(size*0.34) + 'px',
    color:'#FFFFFF',
    fontStyle:'800'
  }).setOrigin(0.5);

  const cont = scene.add.container(x,y,[bg,txt]);
  cont.setSize(size,size);

  // круглая hitArea + курсор руки
  cont.setInteractive({
    hitArea: new Phaser.Geom.Circle(0, 0, size/2),
    hitAreaCallback: Phaser.Geom.Circle.Contains,
    useHandCursor: true
  });

  cont.on('pointerdown', () => onClick && onClick());
  cont.on('pointerover', () => scene.tweens.add({ targets: cont, scale: 1.05, duration: 110 }));
  cont.on('pointerout',  () => scene.tweens.add({ targets: cont, scale: 1.00, duration: 110 }));

  return cont;
};
