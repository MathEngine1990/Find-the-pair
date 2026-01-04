window.ALL_CARD_KEYS = [
  'qd','qh','qs','qc','kd','kh','ks','kc','ad','ah','as','ac','jd','jh','js','jc','10h','10c'
];

/**
 * Важно: порядок и label уровней НЕ меняем (чтобы прогресс/индексы не поехали).
 * Меняем только раскладку (cols/rows) для mobile vs desktop.
 *
 * pairs = количество пар в уровне
 * desktop/mobile = разные cols/rows для одного и того же pairs
 */
window.LEVELS_BASE = [
  { label: '- 3 -',  pairs: 3,  desktop: { cols: 3, rows: 2 }, mobile: { cols: 2, rows: 3 } },
  { label: '- 4 -',  pairs: 4,  desktop: { cols: 4, rows: 2 }, mobile: { cols: 2, rows: 4 } },
  { label: '- 5 -',  pairs: 5,  desktop: { cols: 5, rows: 2 }, mobile: { cols: 2, rows: 5 } },

  { label: '- 6 -',  pairs: 6,  desktop: { cols: 4, rows: 3 }, mobile: { cols: 3, rows: 4 } },
  { label: '- 8 -',  pairs: 8,  desktop: { cols: 4, rows: 4 }, mobile: { cols: 4, rows: 4 } },

  // Часто на мобиле удобнее "вертикальнее"
  { label: '- 9 -',  pairs: 9,  desktop: { cols: 6, rows: 3 }, mobile: { cols: 3, rows: 6 } },
  { label: '- 10 -', pairs: 10, desktop: { cols: 5, rows: 4 }, mobile: { cols: 4, rows: 5 } },

  { label: '- 12 -', pairs: 12, desktop: { cols: 6, rows: 4 }, mobile: { cols: 4, rows: 6 } },
  { label: '- 14 -', pairs: 14, desktop: { cols: 7, rows: 4 }, mobile: { cols: 4, rows: 7 } },
  { label: '- 15 -', pairs: 15, desktop: { cols: 6, rows: 5 }, mobile: { cols: 5, rows: 6 } },
  { label: '- 18 -', pairs: 18, desktop: { cols: 9, rows: 4 }, mobile: { cols: 6, rows: 6 } }
];

// детект устройства максимально безопасно (VK Mini Apps / обычный web)
window.isMobileDevice = function () {
  try {
    if (window.VKHelpers && typeof window.VKHelpers.isMobileDevice === 'function') {
      return !!window.VKHelpers.isMobileDevice();
    }
  } catch {}
  return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
};

window.getLevelsForDevice = function () {
  const isMobile = window.isMobileDevice();
  return window.LEVELS_BASE.map(l => ({
    label: l.label,
    cols: (isMobile ? l.mobile.cols : l.desktop.cols),
    rows: (isMobile ? l.mobile.rows : l.desktop.rows)
  }));
};

// Оставляем window.LEVELS как “дефолт” для старого кода,
// но лучше в сценах перейти на getLevelsForDevice().
window.LEVELS = window.getLevelsForDevice();
