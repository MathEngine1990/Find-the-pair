import bridge from '@vkontakte/vk-bridge';
import { initVKBridge } from './vkBridgeInit';
import Phaser from 'phaser';
import { preload, create, update } from './game'; // твои сцены/ф-ции

// Небольшой хелпер: мы внутри VK WebView/iframe?
function isInsideVK(): boolean {
  const url = new URL(window.location.href);
  // В проде ВК всегда прокидывает vk_* параметры
  return url.searchParams.has('vk_platform') || window.self !== window.top;
}

export async function initVKBridge() {
  // Подписка на события Бриджа (тема, конфиг, пр.)
  bridge.subscribe(({ detail: { type, data } }) => {
    if (type === 'VKWebAppUpdateConfig' && data?.scheme) {
      // Пример: авто-подхват темы приложения
      document.body.setAttribute('data-scheme', data.scheme);
    }
    // Можно логировать другие события:
    // console.debug('[bridge event]', type, data);
  });

  if (!isInsideVK()) {
    // Локальная разработка вне VK — просто выходим без ошибок
    return { insideVK: false };
  }

  // Обязательная инициализация
  await bridge.send('VKWebAppInit');

  // Часто полезно получить launch params (id пользователя, язык, платформа и т.п.)
  const launchParams = await bridge.send('VKWebAppGetLaunchParams');

  // Если нужно — можно запросить тему сразу
  // const appearance = await bridge.send('VKWebAppGetConfig');

  return { insideVK: true, launchParams /*, appearance*/ };
}



async function boot() {
  const vk = await initVKBridge();

  // Проброс параметров в игру (если нужно)
  const gameConfig: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    parent: 'game-container',
    width: 900,
    height: 900,
    backgroundColor: '#1d2330',
    scene: { preload, create, update }
  };

  // Пример: поменять тему бэкграунда, если темная схема
  if (vk.insideVK) {
    const scheme = document.body.getAttribute('data-scheme');
    if (scheme && scheme.includes('dark')) {
      (gameConfig as any).backgroundColor = '#0f1117';
    }
  }

  new Phaser.Game(gameConfig);
}

boot();
