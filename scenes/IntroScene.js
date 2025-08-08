export default class IntroScene extends Phaser.Scene {
    constructor() {
        super('IntroScene');
    }
    create() {
        const w = this.sys.game.config.width;
        const h = this.sys.game.config.height;

        this.add.image(w/2, h/2, 'bg').setDepth(0);
        this.add.image(w/2, h/2 - 100, 'logo');

        this.add.text(w/2, h - 150, 'Нажмите для начала', {
            fontSize: '40px',
            color: '#fff'
        }).setOrigin(0.5);

        this.input.once('pointerdown', () => {
            this.scene.start('MainMenuScene');
        });
    }
}
