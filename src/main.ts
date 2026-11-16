import { AUTO, Game, Scale } from 'phaser';
import { DEFAULT_DIFFICULTY } from './data/ai';
import { MAP_GEN_CONFIG } from './data/map';
import { GameScene } from './render/scenes/GameScene';
import { UiScene } from './render/scenes/UiScene';
import { rememberedLevel, takeRestartRequest, toDifficulty } from './render/session';
import { parseSeed } from './sim/rng';
import { DEFAULT_STRESS_MODE, STRESS_MODES } from './sim/stress';
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

// How hard the computer plays: what the player chose last in this tab, and
// what the start screen offers first. ?level=easy, medium or hard sets it in
// test mode.
const difficulty =
  (testMode ? toDifficulty(params.get('level')) : undefined) ??
  rememberedLevel() ??
  DEFAULT_DIFFICULTY;

// The start screen is skipped after "play again", and with ?start=0 in test mode.
const restarted = takeRestartRequest();
const startScreen = !restarted && !(testMode && params.get('start') === '0');

// ?debug=1 shows how many frames a second the game draws and how long a
// simulation step takes.
// ?stress=N starts the match with N extra units, half to each side, and no
// computer player, to measure how the game runs with many units; it turns
// the counter on as well. ?stressmode= says what they do: still, gather
// (when nothing is said) or fight.
const stress = Math.min(STRESS_MAX, Math.max(0, Math.floor(Number(params.get('stress')) || 0)));
const stressMode =
  STRESS_MODES.find((mode) => mode === params.get('stressmode')) ?? DEFAULT_STRESS_MODE;
const debug = params.get('debug') === '1' || stress > 0;

const gameScene = new GameScene({
  testMode,
  seed,
  fog,
  ai: ai && stress === 0,
  difficulty,
  startScreen,
  stress,
  stressMode,
});
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
