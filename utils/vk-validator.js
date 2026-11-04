// utils/vk-validator.js
export const VKValidator = {
  validateLaunchParams(searchParams) {
    const params = new URLSearchParams(searchParams);
    
    // Обязательные параметры
    const required = ['vk_user_id', 'vk_app_id'];
    for (const param of required) {
      const value = params.get(param);
      if (!value || !/^\d+$/.test(value)) {
        return { valid: false, error: `Invalid ${param}` };
      }
    }
    
    // Проверка подписи (если есть)
    const sign = params.get('sign');
    if (sign && !this.verifySignature(params, sign)) {
      return { valid: false, error: 'Invalid signature' };
    }
    
    return { valid: true };
  },
  
  verifySignature(params, sign) {
    // Реализация проверки подписи VK
    // В production нужно использовать секретный ключ приложения
    return true; // Упрощенная версия
  }
};
