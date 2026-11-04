// utils/vk-safe.js - ИСПРАВЛЕННАЯ ВЕРСИЯ
export class VKSafe {
  static async send(method, params = {}) {
    if (!window.vkBridge) {
      throw new Error('VK Bridge not available');
    }
    
    // ПРОВЕРКА ПОДДЕРЖКИ МЕТОДА ПЕРЕД ВЫЗОВОМ
    if (!window.vkBridge.supports(method)) {
      console.warn(`⚠️ Method ${method} not supported on this platform`);
      throw new Error(`Method ${method} not supported`);
    }
    
    try {
      return await window.vkBridge.send(method, params);
    } catch (error) {
      // ДЕТАЛЬНАЯ ОБРАБОТКА ОШИБОК
      this.handleVKError(method, error);
      throw error;
    }
  }
  
  static handleVKError(method, error) {
    const { error_type, error_data } = error;
    
    switch (method) {
      case 'VKWebAppAllowNotifications':
        if (error_data?.error_code === 15) {
          console.warn('🔔 Notifications not available: app needs moderation approval');
        } else if (error_data?.error_code === 4) {
          console.warn('🔔 User denied notifications permission');
        }
        break;
        
      case 'VKWebAppGetUserInfo':
        if (error_data?.error_code === 15) {
          console.warn('👤 User info access denied');
        }
        break;
        
      default:
        console.warn(`VK Bridge error for ${method}:`, error);
    }
  }
  
  static isAvailable() {
    return window.vkBridge && window.vkBridge.supports;
  }
  
  // БЕЗОПАСНЫЙ ЗАПРОС УВЕДОМЛЕНИЙ
  static async requestNotifications() {
    if (!this.isAvailable()) {
      console.warn('VK Bridge not available');
      return { success: false, reason: 'no_bridge' };
    }
    
    if (!window.vkBridge.supports('VKWebAppAllowNotifications')) {
      console.warn('🔔 Notifications not supported on this platform');
      return { success: false, reason: 'not_supported' };
    }
    
    try {
      await this.send('VKWebAppAllowNotifications');
      console.log('✅ Notifications permission granted');
      return { success: true };
    } catch (error) {
      const reason = error.error_data?.error_code === 15 ? 'app_not_approved' : 
                    error.error_data?.error_code === 4 ? 'user_denied' : 'unknown';
      return { success: false, reason, error };
    }
  }
  
  // ПРОВЕРКА РАЗРЕШЕНИЙ ПЕРЕД ЗАПРОСОМ
  static async checkPermissions() {
    const permissions = {
      notifications: false,
      userInfo: false,
      storage: false
    };
    
    // Проверяем поддержку методов
    if (this.isAvailable()) {
      permissions.notifications = window.vkBridge.supports('VKWebAppAllowNotifications');
      permissions.userInfo = window.vkBridge.supports('VKWebAppGetUserInfo');
      permissions.storage = window.vkBridge.supports('VKWebAppStorageSet');
    }
    
    return permissions;
  }
}
