export const allCardKeys = [
    'qd','qh','qs','qc',
    'kd','kh','ks','kc',
    'ad','ah','as','ac',
    'jd','jh','js','jc',
    '10h','10c'
];

export const levelSettings = [
    {label: '3x4 (6 пар)', cols: 4, rows: 3},
    {label: '4x4 (8 пар)', cols: 4, rows: 4},
    {label: '6x6 (18 пар)', cols: 6, rows: 6}
];

export function clearLevelButtons(buttons) {
    buttons.forEach(btn => btn.destroy());
    buttons.length = 0;
}

// Game logic functions (startGame, openCard, showWin) ниже

let mistakeCount = 0;
let mistakeText = null;
let exitBtn = null;
let hudBg = null;

let cards = [];
let openedCards = [];
let canClick = false;
let currentLevel = null;

export function startGame(scene, level) {
    // Удаляем HUD если был
    if (hudBg) { hudBg.destroy(); hudBg = null; }
    if (mistakeText) { mistakeText.destroy(); mistakeText = null; }
    if (exitBtn) { exitBtn.destroy(); exitBtn = null; }

    // HUD фон
    hudBg = scene.add.graphics();
    hudBg.fillStyle(0x222333, 1);
    hudBg.fillRect(0, 0, 900, 90);
    hudBg.setDepth(50);

    // Ошибки
    mistakeCount = 0;
    mistakeText = scene.add.text(30, 30, 'Ошибок: 0', { fontSize: '32px', color: '#fff' });
    mistakeText.setDepth(100);

    // Кнопка "В меню"
    exitBtn = scene.add.text(900 - 180, 30, 'В меню', {
        fontSize: '32px', backgroundColor: '#333', color: '#fff', padding: 8
    }).setInteractive().setPadding(8);
    exitBtn.setDepth(100);

    exitBtn.on('pointerdown', () => {
        scene.children.removeAll();
        cards = [];
        openedCards = [];
        canClick = false;
        currentLevel = null;
        showLevelSelect(scene);
    });
    exitBtn.on('pointerover', () => exitBtn.setStyle({ backgroundColor: '#555' }));
    exitBtn.on('pointerout', () => exitBtn.setStyle({ backgroundColor: '#333' }));

    // Удаляем карты
    cards.forEach(c => c.destroy());
    cards = [];
    openedCards = [];
    canClick = false;
    currentLevel = level;

    const totalCards = level.cols * level.rows;
    const pairCount = totalCards / 2;

    let chosenKeys = Phaser.Utils.Array.Shuffle(allCardKeys).slice(0, pairCount);
    let pairKeys = chosenKeys.concat(chosenKeys);
    Phaser.Utils.Array.Shuffle(pairKeys);

    const cardOriginalW = 500;
    const cardOriginalH = 1300;
    const minPadding = 10;

    const scaleX = (900 - minPadding * (level.cols + 1)) / (cardOriginalW * level.cols);
    const scaleY = (900 - 90 - minPadding * (level.rows + 1)) / (cardOriginalH * level.rows);
    const cardScale = Math.min(scaleX, scaleY, 1);
    const cardW = cardOriginalW * cardScale;
    const cardH = cardOriginalH * cardScale;
    const spacingX = (900 - (cardW * level.cols)) / (level.cols + 1);
    const spacingY = (900 - 90 - (cardH * level.rows)) / (level.rows + 1);
    const startX = spacingX + cardW / 2;
    const startY = 90 + spacingY + cardH / 2;

    let i = 0;
    for (let row = 0; row < level.rows; row++) {
        for (let col = 0; col < level.cols; col++) {
            const key = pairKeys[i];
            const x = startX + col * (cardW + spacingX);
            const y = startY + row * (cardH + spacingY);

            const card = scene.add.image(x, y, key).setInteractive();
            card.setScale(cardScale);
            card.setDepth(200);
            card.setData('key', key);
            card.setData('opened', false);
            card.setData('matched', false);

            card.on('pointerdown', () => {
                if (!canClick) return;
                if (card.getData('opened') || card.getData('matched')) return;
                openCard(card, scene);
            });

            cards.push(card);
            i++;
        }
    }

    // Показать все карты 5 секунд, потом перевернуть и разрешить кликать
    canClick = false;
    scene.time.delayedCall(5000, () => {
        cards.forEach(card => card.setTexture('back'));
        canClick = true;
    });
}

function openCard(card, scene) {
    card.setTexture(card.getData('key'));
    card.setData('opened', true);
    openedCards.push(card);

    if (openedCards.length === 2) {
        canClick = false;
        scene.time.delayedCall(700, () => {
            const [a, b] = openedCards;
            if (a.getData('key') === b.getData('key')) {
                a.setData('matched', true);
                b.setData('matched', true);
            } else {
                mistakeCount++;
                if (mistakeText) mistakeText.setText('Ошибок: ' + mistakeCount);
                a.setTexture('back');
                b.setTexture('back');
                a.setData('opened', false);
                b.setData('opened', false);
            }
            openedCards = [];
            canClick = true;

            if (cards.every(c => c.getData('matched'))) {
                showWin(scene);
            }
        });
    }
}

function showWin(scene) {
    if (mistakeText) { mistakeText.destroy(); mistakeText = null; }
    if (exitBtn) { exitBtn.destroy(); exitBtn = null; }
    if (hudBg) { hudBg.destroy(); hudBg = null; }

    scene.add.text(900/2 - 100, 50, 'Победа!', { fontSize: '56px', color: '#fff' });

    const restartBtn = scene.add.text(900/2 - 110, 150, 'Сыграть ещё', {
        fontSize: '40px', backgroundColor: '#333', color: '#fff', padding: 12
    }).setInteractive().setPadding(10);

    restartBtn.on('pointerdown', () => {
        scene.children.removeAll();
        cards = [];
        openedCards = [];
        canClick = false;
        currentLevel = null;
        showLevelSelect(scene);
    });

    restartBtn.on('pointerover', () => restartBtn.setStyle({ backgroundColor: '#555' }));
    restartBtn.on('pointerout', () => restartBtn.setStyle({ backgroundColor: '#333' }));
}

let levelButtons = [];
export function showLevelSelect(scene) {
    clearLevelButtons(levelButtons);
    const startX = 50;
    const startY = 200;
    const gapY = 90;

    levelSettings.forEach((lvl, i) => {
        const btn = scene.add.text(startX, startY + i * gapY, lvl.label, {
            fontSize: '40px',
            backgroundColor: '#333',
            color: '#fff',
            padding: 12,
        }).setInteractive().setPadding(10);

        btn.on('pointerdown', () => {
            clearLevelButtons(levelButtons);
            startGame(scene, lvl);
        });
        btn.on('pointerover', () => btn.setStyle({ backgroundColor: '#555' }));
        btn.on('pointerout', () => btn.setStyle({ backgroundColor: '#333' }));

        levelButtons.push(btn);
    });
}
