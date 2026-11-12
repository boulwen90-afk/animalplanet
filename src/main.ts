import { AUTO, Game, Scale } from 'phaser';
import { GameScene } from './render/scenes/GameScene';

const params = new URLSearchParams(window.location.search);
const testMode = params.get('test') === '1';

new Game({
  type: AUTO,
  parent: 'game',
  backgroundColor: '#10141a',
  scale: {
    mode: Scale.RESIZE,
    width: '100%',
    height: '100%',
  },
  banner: false,
  audio: { noAudio: true },
  scene: [new GameScene({ testMode })],
});
