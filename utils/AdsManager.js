(function () {
  'use strict';

  class AdsManager {
    constructor(options = {}) {
      this.getConfig = options.getConfig || (() => window.ADS_CONFIG || {});
      this.getBridge = options.getBridge || (() => window.vkBridge);
      this.isVK = options.isVK || (() => window.VK_BRIDGE_READY &&
        /(?:^|[?&])vk_app_id=/.test(window.location.search));
      this.now = options.now || (() => Date.now());
      this.storage = options.storage;
      if (this.storage === undefined) {
        try { this.storage = window.sessionStorage; } catch { this.storage = null; }
      }
      this.storageKey = 'findpair_ads_session_v1';
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

        onShow();
        didShow = true;
        this.showing = true;
        this.state.requests++;
        this.persist();
        showPending = true;
        // Never use VKSafe's short generic timeout for a full-length ad.
        const show = Promise.resolve().then(() => bridge.send('VKWebAppShowNativeAds', {
          ad_format: 'interstitial'
        })).finally(() => {
          showPending = false;
          finish();
        });
        const response = await this.bounded(show, Math.max(100, Number(config.showTimeoutMs) || 120000));
        return { reason: response?.result === true ? 'shown' : 'not_shown' };
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
