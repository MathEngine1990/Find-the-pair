// 2. Безопасный вызов уведомлений (utils/vk-safe.js)
static async requestNotifications() {
  if (!this.isAvailable() || !window.vkBridge.supports('VKWebAppAllowNotifications')) {
    console.warn('VKWebAppAllowNotifications not supported');
    return false;
  }
  
  try {
    await this.send('VKWebAppAllowNotifications');
    return true;
  } catch (error) {
    if (error.error_data?.error_code === 15) {
      console.warn('Notifications permission denied - app not approved');
    }
    return false;
  }
}
