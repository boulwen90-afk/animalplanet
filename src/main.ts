import { AUTO, Game, Scale } from 'phaser';
import { MAP_GEN_CONFIG } from './data/map';
import { GameScene } from './render/scenes/GameScene';
import { UiScene } from './render/scenes/UiScene';
import { takeRestartRequest } from './render/session';
import { parseSeed } from './sim/rng';
import { installLoadingProbe } from './testing/testHooks';

/** The most extra units ?stress=N gives. */
const STRESS_MAX = 500;

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

// ?debug=1 shows how many frames a second the game draws.
// ?stress=N starts the match with N extra Samlare, to measure how the game
// runs with many units; it turns the frame counter on as well.
const stress = Math.min(STRESS_MAX, Math.max(0, Math.floor(Number(params.get('stress')) || 0)));
const debug = params.get('debug') === '1' || stress > 0;

const gameScene = new GameScene({ testMode, seed, fog, ai, startScreen, stress });
const uiScene = new UiScene(gameScene, { debug });
if (testMode) installLoadingProbe(() => uiScene.getLoadingDisplay());

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
  scene: [gameScene, uiScene],
});

// The page's own "loading" text has done its job once the game has taken over.
document.getElementById('boot')?.remove();
