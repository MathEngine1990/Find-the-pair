import bridge from '@vkontakte/vk-bridge';

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

