//---main.js - путь отдельного файла

(function () {
  // Определяем запуск во ВК (mini-app/iframe)
  const isVK = /(^|[?&])vk_(app_id|user_id|ts|aref|ref|platform)=/i.test(location.search);

  if (isVK) {
    const s = document.createElement('script');
    s.src = 'https://unpkg.com/@vkontakte/vk-bridge/dist/browser.min.js';
    s.onload = () => {
      try {
        if (window.vkBridge?.supports?.('VKWebAppInit')) vkBridge.send('VKWebAppInit');
        vkBridge.send('VKWebAppSetViewSettings', { status_bar_style: 'light', action_bar_color: '#1d2330' }).catch(()=>{});
        vkBridge.send('VKWebAppDisableSwipeBack').catch(()=>{});
      } catch(e){}
    };
    document.head.appendChild(s);
  }

  if (!window.Phaser) {
    console.error('Phaser не найден. Проверь /lib/phaser.min.js');
    return;
  }

  const DPR = Math.min(2, window.devicePixelRatio || 1);

  const config = {
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: '#000000',
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: 720,
      height: 1080
    },
    resolution: DPR,
    render: { antialias: true, pixelArt: false },
    scene: [ window.PreloadScene, window.MenuScene, window.GameScene ]
  };

  // Можно дождаться локальных шрифтов, чтобы избежать «прыжка»
  const start = () => new Phaser.Game(config);
  if (document.fonts && document.fonts.ready) {
    Promise.race([document.fonts.ready, new Promise(r=>setTimeout(r, 1000))]).finally(start);
  } else {
    start();
  }
})();
