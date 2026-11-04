const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const window = {};
vm.runInNewContext(fs.readFileSync(path.join(root, 'utils/OKReleaseConfig.js'), 'utf8'), { window });
const config = window.OK_RELEASE_CONFIG;
const errors = [];
for (const key of ['publicGameURL', 'communityURL']) {
  try { const url = new URL(config[key]);
    if (url.protocol !== 'https:' || url.hostname !== 'ok.ru' || url.search || url.hash) throw Error();
  } catch { errors.push(`Заполните ${key}: публичная HTTPS-ссылка на ok.ru без launch-параметров.`); }
}
if (config.supportEmail && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(config.supportEmail) || config.supportEmail.endsWith('.example'))) errors.push('Исправьте supportEmail или оставьте пустым для поддержки через группу.');
if (!config.developerName.trim()) errors.push('Укажите developerName — владельца игры.');
for (const file of ['privacy-policy.html', 'user-agreement.html']) {
  const content = fs.readFileSync(path.join(root, file), 'utf8');
  if (/\.example|vk\.com\/findpair_game/.test(content)) errors.push(`${file}: замените демонстрационные контакты и проверьте текст документа.`);
}
if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
else console.log('Автоматические проверки заполнения пройдены. Это не юридическая проверка: выполните OK-PUBLISHING.md.');
