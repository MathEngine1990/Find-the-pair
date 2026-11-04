// Modern OK games use VK Bridge: vk_client=ok is the documented discriminator.
(function () {
  const params = new URLSearchParams(window.location.search);
  const isOK = params.get('vk_client') === 'ok';
  const appId = params.get('vk_app_id') || 'unknown';
  const userId = params.get('vk_user_id') || 'anonymous';
  const startedAt = Date.now();
  let active = !document.hidden;
  let bridgeActive = true;
  window.addEventListener('pagehide', () => { active = false; });
  window.addEventListener('pageshow', () => { active = !document.hidden; });
  document.addEventListener('visibilitychange', () => { active = !document.hidden; });
  window.GamePlatform = {
    isOK,
    name: isOK ? 'Одноклассники' : 'ВКонтакте',
    id: isOK ? 'ok' : 'vk',
    appId,
    // Prefix only OK keys: all existing VK saves keep their original names.
    storageIdentity: isOK ? `ok_${appId}_${userId}` : userId,
    localKey(key) { return isOK ? `${key}_ok_${appId}_${userId}` : key; },
    get isActive() { return active && bridgeActive && !document.hidden; },
    onBridgeEvent(event) {
      if (event.detail?.type === 'VKWebAppViewHide') bridgeActive = false;
      if (event.detail?.type === 'VKWebAppViewRestore') bridgeActive = true;
    },
    canRequestAd() {
      // More conservative than the installation rule: wait 30s on EVERY OK launch.
      return this.isActive && (!isOK || Date.now() - startedAt >= 30000);
    },
    publicURL() {
      if (isOK) {
        try {
          const url = new URL(window.OK_RELEASE_CONFIG?.publicGameURL);
          return url.protocol === 'https:' && url.hostname === 'ok.ru' && !url.search && !url.hash ? url.href : null;
        } catch { return null; }
      }
      return /^\d+$/.test(appId) ? `https://vk.com/app${appId}` : null;
    }
  };
})();
