(function () {
  'use strict';

  class AdsManager {
    constructor(options = {}) {
      this.getConfig = options.getConfig || (() => window.ADS_CONFIG || {});
      this.getBridge = options.getBridge || (() => window.vkBridge);
      this.isVK = options.isVK || (() => window.VK_BRIDGE_READY &&
        /(?:^|[?&])vk_app_id=/.test(window.location.search));
      this.now = options.now || (() => Date.now());
      this.requestIOSStart = options.requestIOSStart || ((start, isCurrent) => this.promptIOSStart(start, isCurrent));
      this.storage = options.storage;
      if (this.storage === undefined) {
        try { this.storage = window.sessionStorage; } catch { this.storage = null; }
      }
      this.storageKey = window.GamePlatform?.localKey('findpair_ads_session_v1') || 'findpair_ads_session_v1';
      this.state = { rounds: 0, requests: 0, lastFinishedAt: 0 };
      try {
        const saved = JSON.parse(this.storage?.getItem(this.storageKey) || 'null');
        for (const key of Object.keys(this.state)) {
          if (Number.isFinite(saved?.[key]) && saved[key] >= 0) this.state[key] = saved[key];
        }
      } catch { /* Storage is optional; gameplay never depends on it. */ }
      this.busy = false;
      this.showing = false;
    }

    persist() {
      try { this.storage?.setItem(this.storageKey, JSON.stringify(this.state)); } catch {}
    }

    isIOSDevice() {
      const navigator = window.navigator || {};
      const userAgent = navigator.userAgent || '';
      // iPadOS desktop mode identifies as a Mac. Launch params also cover
      // embedded clients whose user agent does not expose the device model.
      return /iPhone|iPad|iPod/i.test(userAgent) ||
        (/Mac/i.test(navigator.platform || userAgent) && navigator.maxTouchPoints > 1) ||
        /(?:^|[?&])vk_platform=[^&]*(?:ios|iphone|ipad)/i.test(window.location.search);
    }

    promptIOSStart(start, isCurrent) {
      const document = window.document;
      if (!document?.body) return Promise.resolve({ reason: 'gesture_unavailable' });
      // Use a DOM click, not Phaser's next frame or a timer: send must execute
      // in the trusted user event. This cannot control playback in a host iframe.
      return new Promise((resolve, reject) => {
        const panel = document.createElement('div');
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-modal', 'true');
        panel.setAttribute('aria-label', 'Партия завершена');
        panel.style.cssText = 'position:fixed;inset:0;z-index:2147483647;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px;padding:24px;background:rgba(17,26,39,.97);color:white;font:18px Arial;text-align:center;box-sizing:border-box;';
        const title = document.createElement('strong');
        title.textContent = 'Партия завершена';
        const text = document.createElement('p');
        text.textContent = 'Перед результатами может быть показана реклама.';
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = 'Продолжить';
        button.style.cssText = 'padding:16px 28px;border:0;border-radius:12px;background:#4ecdc4;color:#10232b;font:bold 20px Arial;cursor:pointer;touch-action:manipulation;';
        panel.append(title, text, button);
        const previousFocus = document.activeElement;
        let done = false;
        let timer;
        const cleanup = () => {
          done = true;
          clearTimeout(timer);
          panel.remove();
          if (previousFocus?.isConnected) previousFocus.focus?.({ preventScroll: true });
        };
        const canStart = () => isCurrent() && (!window.GamePlatform || window.GamePlatform.canRequestAd());
        button.onclick = () => {
          if (done) return;
          const valid = canStart();
          cleanup();
          if (!valid) { resolve({ reason: 'gesture_cancelled' }); return; }
          try {
            // Deliberately no await, setTimeout or Promise.then before start().
            resolve(start());
          } catch (error) { reject(error); }
        };
        const deadline = this.now() + 30000;
        const poll = () => {
          if (done) return;
          if (!canStart() || this.now() >= deadline) {
            cleanup();
            resolve({ reason: 'gesture_cancelled' });
          } else timer = setTimeout(poll, 250);
        };
        document.body.append(panel);
        button.focus();
        timer = setTimeout(poll, 250);
      });
    }

    async bounded(promise, milliseconds) {
      let timer;
      try {
        return await Promise.race([
          promise,
          new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error('ad_timeout')), milliseconds);
          })
        ]);
      } finally { clearTimeout(timer); }
    }

    async beforeResults({ isCurrent = () => true, onShow = () => {}, onFinish = () => {} } = {}) {
      const config = this.getConfig();
      if (!config.enabled || !this.isVK()) return { reason: 'disabled_or_standalone' };
      // Emergency switch remains available if device testing finds a host bug.
      if (this.isIOSDevice() && config.allowIOSAds !== true) return { reason: 'ios_ads_disabled' };
      if (window.GamePlatform && !window.GamePlatform.canRequestAd()) return { reason: 'platform_limit' };
      if (this.busy) return { reason: 'busy' };
      this.state.rounds++;
      this.persist();
      const skip = Math.max(0, Math.floor(Number(config.skipFirstRounds) || 0));
      const every = Math.max(1, Math.floor(Number(config.everyNthRound) || 1));
      const interval = Math.max(0, Number(config.minIntervalSeconds) || 0) * 1000;
      const max = Math.max(0, Math.floor(Number(config.maxShowsPerSession) || 0));
      if (this.state.rounds <= skip || (this.state.rounds - skip) % every !== 0 ||
          (max > 0 && this.state.requests >= max) ||
          (this.state.lastFinishedAt > 0 && this.now() - this.state.lastFinishedAt < interval)) {
        return { reason: 'frequency_limit' };
      }

      this.busy = true;
      let showPending = false;
      let didShow = false;
      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        if (didShow) {
          this.state.lastFinishedAt = this.now();
          this.persist();
        }
        this.showing = false;
        this.busy = false;
        if (didShow) onFinish();
      };
      try {
        const bridge = this.getBridge();
        if (!bridge?.send) return { reason: 'unsupported' };
        const checkMs = Math.max(100, Number(config.availabilityTimeoutMs) || 4000);
        const available = await this.bounded((async () => {
          for (const method of ['VKWebAppCheckNativeAds', 'VKWebAppShowNativeAds']) {
            const supported = bridge.supportsAsync
              ? await bridge.supportsAsync(method) : bridge.supports?.(method);
            if (!supported) return false;
          }
          return (await bridge.send('VKWebAppCheckNativeAds', { ad_format: 'interstitial' }))?.result === true;
        })(), checkMs);
        if (!available) return { reason: 'unavailable' };
        if (!isCurrent()) return { reason: 'scene_changed' };
        if (window.GamePlatform && !window.GamePlatform.canRequestAd()) return { reason: 'platform_limit' };

        let invoked = false;
        const startShow = () => {
          if (invoked) return Promise.resolve({ reason: 'already_requested' });
          if (!isCurrent()) return Promise.resolve({ reason: 'scene_changed' });
          if (window.GamePlatform && !window.GamePlatform.canRequestAd()) return Promise.resolve({ reason: 'platform_limit' });
          invoked = true;
          didShow = true;
          this.showing = true;
          onShow();
          this.state.requests++;
          this.persist();
          let response;
          // Keep the SDK call synchronous with the iOS click handler.
          response = bridge.send('VKWebAppShowNativeAds', { ad_format: 'interstitial' });
          showPending = true;
          const show = Promise.resolve(response).finally(() => {
            showPending = false;
            finish();
          });
          return this.bounded(show, Math.max(100, Number(config.showTimeoutMs) || 120000))
            .then(result => ({ reason: result?.result === true ? 'shown' : 'not_shown' }));
        };
        return this.isIOSDevice()
          ? await this.requestIOSStart(startShow, isCurrent)
          : await startShow();
      } catch (error) {
        console.warn('[Ads] Request skipped or failed:', error?.message || 'bridge_error');
        return { reason: error?.message === 'ad_timeout' ? 'timeout' : 'error' };
      } finally {
        // A timed-out Show cannot be cancelled by Bridge. Keep the global lock
        // until its actual reply, so a late ad cannot overlap a second request.
        if (!showPending) finish();
      }
    }
  }

  window.AdsManager = AdsManager;
  window.adsManager = new AdsManager();
})();
