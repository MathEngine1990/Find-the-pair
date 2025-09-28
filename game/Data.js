//---game/Data.js - путь отдельного файла

window.ALL_CARD_KEYS = [
  'qd','qh','qs','qc','kd','kh','ks','kc','ad','ah','as','ac','jd','jh','js','jc','10h','10c'
];

window.LEVELS = [
  { label: '.3.',  cols: 3, rows: 2 },
  { label: '.4.',  cols: 4, rows: 2 },
  { label: '.5.',  cols: 5, rows: 2 },
  { label: '.6.',  cols: 4, rows: 3 },
  { label: '.8.',  cols: 4, rows: 4 },
  { label: '.9.',  cols: 6, rows: 3 },
  { label: '.10.', cols: 5, rows: 4 },
  { label: '.12.', cols: 6, rows: 4 },
  { label: '.14.', cols: 7, rows: 4 },
  { label: '.15.', cols: 6, rows: 5 },
  { label: '.18.', cols: 6, rows: 6 }
];


// Добавить в game/Data.js
window.STORAGE_KEYS = {
  PROGRESS: 'findpair_progress_v2',
  ACHIEVEMENTS: 'findpair_achievements_v2', 
  SETTINGS: 'findpair_settings_v2',
  STATS: 'findpair_stats_v2'
};

// Миграция старых ключей
window.migrateOldStorage = function() {
  const migrations = [
    { old: 'findpair_progress', new: window.STORAGE_KEYS.PROGRESS },
    { old: 'findpair_achievements', new: window.STORAGE_KEYS.ACHIEVEMENTS }
  ];
  
  migrations.forEach(({ old, new: newKey }) => {
    const oldData = localStorage.getItem(old);
    if (oldData && !localStorage.getItem(newKey)) {
      localStorage.setItem(newKey, oldData);
      localStorage.removeItem(old);
    }
  });
};
