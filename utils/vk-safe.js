// utils/vk-safe.js
export class VKSafe {
  static async send(method, params = {}) {
    if (!window.vkBridge) {
      throw new Error('VK Bridge not available');
    }
    
    try {
      return await window.vkBridge.send(method, params);
    } catch (error) {
      console.warn(`VK Bridge error for ${method}:`, error);
      throw error;
    }
  }
  
  static isAvailable() {
    return window.vkBridge && window.vkBridge.supports;
  }
}
