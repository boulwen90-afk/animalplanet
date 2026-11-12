import { Scene } from 'phaser';
import { CAMERA_CONFIG } from '../../data/camera';
import { MAP_CONFIG } from '../../data/map';
import { SIM_CONFIG, TICK_MS } from '../../data/sim';
import { consumeSteps, createStepClock } from '../../sim/clock';
import { createGame } from '../../sim/game';
import { tileToWorld, worldToTileExact } from '../../sim/map/iso';
import type { GameState } from '../../sim/state';
import { advance } from '../../sim/tick';
import { installTestApi, type TestApi } from '../../testing/testHooks';
import { CameraController } from '../input/CameraController';
import { MapView } from '../views/MapView';

export interface GameSceneOptions {
  /** Expose window.__TEST__ (enabled with ?test=1). */
  testMode: boolean;
  /** Seed for all randomness in the game (set with ?seed=N). */
  seed: number;
}

export class GameScene extends Scene {
  private state!: GameState;
  private readonly stepClock = createStepClock();
  private cameraController!: CameraController;
  private testApi: TestApi | undefined;
  /** Timestamp of the previous frame, in milliseconds. */
  private lastFrameTime: number | undefined;
  /** Sum of all (capped) frame times processed so far, in milliseconds. */
  private elapsedTotal = 0;

  constructor(private readonly options: GameSceneOptions) {
    super('Game');
  }

  create(): void {
    this.state = createGame(this.options.seed);
    new MapView(this, this.state.map, MAP_CONFIG);

    this.cameraController = new CameraController(this, MAP_CONFIG, MAP_CONFIG);
    const mapCentre = tileToWorld(MAP_CONFIG.width / 2, MAP_CONFIG.height / 2, MAP_CONFIG);
    this.cameraController.centerOn(mapCentre.x, mapCentre.y);

    if (this.options.testMode) {
      const camera = this.cameras.main;
      this.testApi = installTestApi({
        getElapsedMs: () => this.elapsedTotal,
        getState: () => structuredClone(this.state),
        advance: (steps) => advance(this.state, steps),
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

  override update(time: number): void {
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
    advance(
      this.state,
      consumeSteps(this.stepClock, elapsed, TICK_MS, SIM_CONFIG.maxTicksPerFrame),
    );

    this.cameraController.update(elapsed);
    // Ready once the first frame has been simulated with the scene fully built.
    if (this.testApi) this.testApi.ready = true;
  }
}
