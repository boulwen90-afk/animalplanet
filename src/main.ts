import { AUTO, Game, Scale } from 'phaser';
import { MAP_GEN_CONFIG } from './data/map';
import { GameScene } from './render/scenes/GameScene';
import { UiScene } from './render/scenes/UiScene';
import { parseSeed } from './sim/rng';

const params = new URLSearchParams(window.location.search);
const testMode = params.get('test') === '1';
const seed = parseSeed(params.get('seed'), MAP_GEN_CONFIG.defaultSeed);

const gameScene = new GameScene({ testMode, seed });

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
  scene: [gameScene, new UiScene(gameScene)],
});
