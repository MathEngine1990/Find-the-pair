export default class BootScene extends Phaser.Scene {
    constructor() {
        super('BootScene');
    }
    preload() {
        this.load.image('bg', 'assets/bg.png');
        this.load.image('logo', 'assets/logo.png');
        this.load.image('back', 'assets/back_card02.png');

        // Загружаем все карты
        const cards = [
            'qd','qh','qs','qc',
            'kd','kh','ks','kc',
            'ad','ah','as','ac',
            'jd','jh','js','jc',
            '10h','10c'
        ];
        cards.forEach(key => this.load.image(key, `assets/cards/${key}.png`));
    }
    create() {
        this.scene.start('IntroScene');
    }
}
