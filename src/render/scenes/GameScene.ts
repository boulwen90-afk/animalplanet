import { Scene } from 'phaser';
import { CAMERA_CONFIG } from '../../data/camera';
import { MAP_CONFIG } from '../../data/map';
import { SIM_CONFIG, TICK_MS } from '../../data/sim';
import { consumeSteps, createStepClock } from '../../sim/clock';
import { applyCommand } from '../../sim/commands';
import { createGame } from '../../sim/game';
import { tileToWorld, worldToTileExact } from '../../sim/map/iso';
import type { GameState, PlayerId } from '../../sim/state';
import { advance } from '../../sim/tick';
import { installTestApi, type TestApi } from '../../testing/testHooks';
import { CameraController } from '../input/CameraController';
import { SelectionController } from '../input/SelectionController';
import { rectContains, selectionPanelRect } from '../ui/layout';
import { describeSelection, type SelectionInfo } from '../ui/selectionInfo';
import { EntityView } from '../views/EntityView';
import { MapView } from '../views/MapView';
import { SelectionView } from '../views/SelectionView';
import type { HudSource, UiScene } from './UiScene';

export interface GameSceneOptions {
  /** Expose window.__TEST__ (enabled with ?test=1). */
  testMode: boolean;
  /** Seed for all randomness in the game (set with ?seed=N). */
  seed: number;
}

/** The side the person at the screen plays. */
const LOCAL_PLAYER: PlayerId = 0;

export class GameScene extends Scene implements HudSource {
  private state: GameState | undefined;
  private readonly stepClock = createStepClock();
  private cameraController!: CameraController;
  private selectionController!: SelectionController;
  private entityView!: EntityView;
  private selectionView!: SelectionView;
  private testApi: TestApi | undefined;
  /** Timestamp of the previous frame, in milliseconds. */
  private lastFrameTime: number | undefined;
  /** Sum of all (capped) frame times processed so far, in milliseconds. */
  private elapsedTotal = 0;

  constructor(private readonly options: GameSceneOptions) {
    super('Game');
  }

  create(): void {
    const state = createGame(this.options.seed);
    this.state = state;

    new MapView(this, state.map, MAP_CONFIG);
    this.entityView = new EntityView(this, MAP_CONFIG);
    this.selectionView = new SelectionView(this);

    this.cameraController = new CameraController(this, MAP_CONFIG, MAP_CONFIG);
    this.centerCameraOnTile(...this.playerStartTile(state));

    this.selectionController = new SelectionController(this, {
      getState: () => state,
      issue: (command) => applyCommand(state, command),
      isOverHud: (x, y) => this.isOverHud(x, y),
      player: LOCAL_PLAYER,
      tileSize: MAP_CONFIG,
      view: this.selectionView,
    });

    if (this.options.testMode) this.installTestApi(state);
  }

  override update(time: number): void {
    const state = this.state;
    if (!state) return;

    // Phaser's own delta is smoothed and capped at 1/60 s while the game warms
    // up or lacks focus, which would slow the game down at low frame rates.
    // Measure real elapsed time instead.
    const elapsed =
      this.lastFrameTime === undefined
        ? 0
        : Math.min(time - this.lastFrameTime, CAMERA_CONFIG.maxFrameMs);
    this.lastFrameTime = time;
    this.elapsedTotal += elapsed;

    // The simulation runs in fixed steps, however long the frame took.
    advance(state, consumeSteps(this.stepClock, elapsed, TICK_MS, SIM_CONFIG.maxTicksPerFrame));

    this.cameraController.update(elapsed);
    this.selectionController.update();

    // Draw units part-way into the next step, so movement looks smooth.
    const alpha = Math.min(this.stepClock.accumulatorMs / TICK_MS, 1);
    this.entityView.update(state, alpha, this.selectionController.selection);
    this.selectionView.update(elapsed);

    // Ready once the first frame has been simulated with the scene fully built.
    if (this.testApi) this.testApi.ready = true;
  }

  getSelectionInfo(): SelectionInfo | undefined {
    if (!this.state) return undefined;
    return describeSelection(this.state.entities, this.selectionController.selection, LOCAL_PLAYER);
  }

  /** Centre of the tile the player's main building is centred on. */
  private playerStartTile(state: GameState): [number, number] {
    const start = state.map.startPositions[LOCAL_PLAYER];
    return start ? [start.x + 0.5, start.y + 0.5] : [MAP_CONFIG.width / 2, MAP_CONFIG.height / 2];
  }

  /** Centres the view on a position in (possibly fractional) tile coordinates. */
  private centerCameraOnTile(tileX: number, tileY: number): void {
    const world = tileToWorld(tileX, tileY, MAP_CONFIG);
    this.cameraController.centerOn(world.x, world.y);
  }

  /** True if a screen position is on the selection panel while it is showing. */
  private isOverHud(x: number, y: number): boolean {
    if (this.selectionController.selection.size === 0) return false;
    return rectContains(selectionPanelRect(this.scale.width, this.scale.height), x, y);
  }

  private installTestApi(state: GameState): void {
    const camera = this.cameras.main;
    this.testApi = installTestApi({
      getElapsedMs: () => this.elapsedTotal,
      getState: () => structuredClone(state),
      advance: (steps) => advance(state, steps),
      command: (command) => applyCommand(state, command),
      getSelection: () => [...this.selectionController.selection],
      getHud: () => (this.scene.get('Ui') as UiScene).getDisplay(),
      getOrderMarkerCount: () => this.selectionView.orderMarkerCount,
      tileToScreen: (tileX, tileY) => {
        const world = tileToWorld(tileX, tileY, MAP_CONFIG);
        return { x: world.x - camera.scrollX, y: world.y - camera.scrollY };
      },
      centerCameraOnTile: (tileX, tileY) => this.centerCameraOnTile(tileX, tileY),
      getCamera: () => ({
        x: camera.scrollX,
        y: camera.scrollY,
        width: camera.width,
        height: camera.height,
        centerTile: worldToTileExact(
          camera.scrollX + camera.width / 2,
          camera.scrollY + camera.height / 2,
          MAP_CONFIG,
        ),
      }),
    });
  }
}
