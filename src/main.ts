import { AUTO, Game, Scale } from 'phaser';
import { MAP_GEN_CONFIG } from './data/map';
import { GameScene } from './render/scenes/GameScene';
import { UiScene } from './render/scenes/UiScene';
import { takeRestartRequest } from './render/session';
import { parseSeed } from './sim/rng';

const params = new URLSearchParams(window.location.search);
const testMode = params.get('test') === '1';
const seed = parseSeed(params.get('seed'), MAP_GEN_CONFIG.defaultSeed);

// The fog of war can only be turned off in test mode.
const fog = !(testMode && params.get('fog') === '0');

// Likewise the computer opponent: ?ai=0 leaves the other side standing still.
const ai = !(testMode && params.get('ai') === '0');

// The start screen is skipped after "play again", and with ?start=0 in test mode.
const restarted = takeRestartRequest();
const startScreen = !restarted && !(testMode && params.get('start') === '0');

const gameScene = new GameScene({ testMode, seed, fog, ai, startScreen });

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
