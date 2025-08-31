// ui/Theme.js
window.THEME = {
  font: 'Roboto, Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
  buttonColor: '#f200ff',

  // НОВОЕ: отдельные настройки
  fontTitle:  'Geologica, Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
  fontButton: 'Geologica, Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
  titleStyle:  'bold',   // 'bold' / 'normal' (в Phaser нет числовых 600/800)
  buttonStyle: 'bold',
  titleColor:  '#E8E1C9',
  buttonTextColor: '#98d4a7',
  titleSizeFactor: 0.080,     // доля от высоты экрана
  btnFontFactor:   0.24,      // доля от высоты кнопки

  // фон/градиенты/прочее как было:
  bgTop:'#06120E', bgMid:'#1C2F27', bgBottom:'#495D53',
  gradA1:'#B88A2E', gradA2:'#3C4F45', gradB1:'#41584C', gradB2:'#C87420',
  strokeLight:'rgba(230,220,190,0.34)', strokeDark:'rgba(0,0,0,0.28)',
  hudFill:0x0a1410, hudText:'#E8E1C9',
  cardDimAlpha:0.40
};
