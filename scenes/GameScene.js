// --- START PATCH: уровни + универсальная генерация поля и карт ---

// 1) Конфиг из 11 уровней (строки × колонки)
const LEVELS = [
  { rows: 2, cols: 3, name: "2×3" },
  { rows: 2, cols: 4, name: "2×4" },
  { rows: 2, cols: 5, name: "2×5" },
  { rows: 3, cols: 4, name: "3×4" },
  { rows: 4, cols: 4, name: "4×4" },
  { rows: 3, cols: 6, name: "3×6" },
  { rows: 4, cols: 5, name: "4×5" },
  { rows: 4, cols: 6, name: "4×6" },
  { rows: 4, cols: 7, name: "4×7" },
  { rows: 5, cols: 6, name: "5×6" },
  { rows: 6, cols: 6, name: "6×6" },
];

// 2) Текущий уровень (можешь менять извне из меню)
let currentLevelIndex = 0;

// 3) Вспомогалки
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Верни список ключей текстур/фреймов для карт.
// Подстрой под твои ассеты: здесь просто пример.
function getAllCardKeys(scene) {
  // Если у тебя атлас/спрайтшит, собери ключи отсюда.
  // Например: return scene.textures.get('cards').getFrameNames();
  // Или если отдельные изображения: перечисли/сгенерируй ключи:
  const keys = [];
  for (let i = 1; i <= 50; i++) keys.push(`card_${i}`); // пример
  return keys;
}

// 4) Создание колоды под нужное количество пар
function buildDeck(scene, pairsCount) {
  const keys = getAllCardKeys(scene);
  if (keys.length === 0) {
    console.warn("Нет ключей карт — проверь ассеты!");
    return [];
  }
  // Если ассетов меньше, чем нужно пар — безопасно переиспользуем
  const base = [];
  for (let i = 0; i < pairsCount; i++) {
    base.push(keys[i % keys.length]);
  }
  const deck = shuffle(base.flatMap(k => [k, k]));
  return deck;
}

// 5) Расчёт размеров ячейки и отступов так, чтобы всё красиво влезло
function computeLayout(scene, rows, cols, opts = {}) {
  const padding = opts.padding ?? 16;      // внешние поля
  const gap = opts.gap ?? 12;              // расстояние между карточками
  const maxW = scene.scale.width - padding * 2;
  const maxH = scene.scale.height - padding * 2;

  // Размер клетки с учётом зазоров
  const cellW = (maxW - (cols - 1) * gap) / cols;
  const cellH = (maxH - (rows - 1) * gap) / rows;
  const cell = Math.floor(Math.min(cellW, cellH)); // квадратные карточки

  // Итоговые реальные размеры сетки (для центровки)
  const boardW = cell * cols + gap * (cols - 1);
  const boardH = cell * rows + gap * (rows - 1);

  const left = (scene.scale.width - boardW) / 2;
  const top  = (scene.scale.height - boardH) / 2;

  return { cell, gap, left, top, boardW, boardH };
}

// 6) Создание поля: размещаем карты по сетке
function createBoard(scene, levelIdx) {
  const { rows, cols } = LEVELS[levelIdx];
  const pairsCount = (rows * cols) / 2;

  // Проверка на чётность (у нас все уровни чётные, но оставим защиту)
  if ((rows * cols) % 2 !== 0) {
    throw new Error(`Сетка ${rows}×${cols} содержит нечётное число ячеек`);
  }

  const deck = buildDeck(scene, pairsCount);
  const L = computeLayout(scene, rows, cols);

  const cards = [];
  let idx = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = L.left + c * (L.cell + L.gap) + L.cell / 2;
      const y = L.top  + r * (L.cell + L.gap) + L.cell / 2;

      // Создай спрайт карты; подстрой под свои ключи «рубашки»/фронта
      const faceKey = deck[idx++];
      const card = createCardSprite(scene, x, y, L.cell, faceKey);
      cards.push(card);
    }
  }

  // Верни массив карточек, если дальше где-то нужен
  return cards;
}

// 7) Универсальное создание карточки + логика переворота/совпадения.
// Подстрой под твою игру: названия текстур, анимации, звуки и т.д.
function createCardSprite(scene, x, y, size, faceKey) {
  // Допустим, у тебя есть текстура "back" для рубашки:
  const back = scene.add.image(x, y, "back").setDisplaySize(size, size).setInteractive({ useHandCursor: true });
  const face = scene.add.image(x, y, faceKey).setDisplaySize(size, size).setVisible(false);

  // Сохраним состояние на объекте "back"
  back.__faceKey = faceKey;
  back.__isOpen = false;
  back.__pairRef = face;

  back.on("pointerup", () => {
    // Здесь вызови свой обработчик логики матча:
    flipCard(scene, back);
  });

  return back;
}

// 8) Пример переворота (замени на свою реализацию, если уже есть)
let openBuffer = []; // 0..2 открытых карты

function flipCard(scene, backSprite) {
  if (backSprite.__isOpen) return;

  backSprite.__isOpen = true;
  backSprite.setVisible(false);
  backSprite.__pairRef.setVisible(true);

  openBuffer.push(backSprite);

  if (openBuffer.length === 2) {
    const [a, b] = openBuffer;
    const isMatch = a.__faceKey === b.__faceKey;

    scene.time.delayedCall(400, () => {
      if (isMatch) {
        // Убрать карты/сыграть анимацию
        a.__pairRef.setAlpha(0.2);
        b.__pairRef.setAlpha(0.2);
        a.disableInteractive();
        b.disableInteractive();
      } else {
        // Закрыть обратно
        a.__isOpen = false;
        b.__isOpen = false;
        a.setVisible(true);
        b.setVisible(true);
        a.__pairRef.setVisible(false);
        b.__pairRef.setVisible(false);
      }
      openBuffer = [];
      // здесь можно проверять «все пары открыты» -> переход к след. уровню
    });
  }
}

// 9) Точки входа из твоей сцены
// В create() сцены вместо «сложностей» делай так:
function startLevel(scene, levelIndex) {
  currentLevelIndex = levelIndex;
  // почисти предыдущее поле, если надо:
  // scene.children.removeAll(); // осторожно, если есть UI/фон
  createBoard(scene, currentLevelIndex);
}

// 10) Пример мини-UI выбора уровня (опционально):
function addLevelUI(scene) {
  const txt = scene.add.text(16, 16, `Level: ${LEVELS[currentLevelIndex].name}`, { fontSize: "20px", color: "#fff" });
  const prev = scene.add.text(16, 44, "← Prev", { fontSize: "18px", color: "#fff" }).setInteractive({ useHandCursor: true });
  const next = scene.add.text(100, 44, "Next →", { fontSize: "18px", color: "#fff" }).setInteractive({ useHandCursor: true });

  prev.on("pointerup", () => {
    currentLevelIndex = (currentLevelIndex - 1 + LEVELS.length) % LEVELS.length;
    scene.scene.restart({ level: currentLevelIndex });
  });
  next.on("pointerup", () => {
    currentLevelIndex = (currentLevelIndex + 1) % LEVELS.length;
    scene.scene.restart({ level: currentLevelIndex });
  });

  scene.events.on("transitioncomplete", () => {
    txt.setText(`Level: ${LEVELS[currentLevelIndex].name}`);
  });
}

// 11) Если ты используешь init/data:
function init(data) {
  if (typeof data?.level === "number") currentLevelIndex = data.level;
}
function create() {
  addLevelUI(this);       // опционально
  startLevel(this, currentLevelIndex);
}

// --- END PATCH ---
