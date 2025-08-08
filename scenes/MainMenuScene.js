import { showLevelSelect } from '../utils/gameLogic.js';

export default class MainMenuScene extends Phaser.Scene {
    constructor() {
        super('MainMenuScene');
    }
    create() {
        const w = this.sys.game.config.width;
        const h = this.sys.game.config.height;

        this.add.text(w/2, 50, 'Игра на память', {
            fontSize: '52px',
            color: '#fff',
            fontFamily: 'Arial'
        }).setOrigin(0.5);

        showLevelSelect(this);
    }
}
