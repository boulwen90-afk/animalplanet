import { Scene } from 'phaser';
import { CAMERA_CONFIG } from '../../data/camera';
import { MAP_CONFIG } from '../../data/map';
import { tileToWorld, worldToTileExact } from '../../sim/map/iso';
import { installTestApi, type TestApi } from '../../testing/testHooks';
import { CameraController } from '../input/CameraController';
import { MapView } from '../views/MapView';

export interface GameSceneOptions {
  /** Expose window.__TEST__ (enabled with ?test=1). */
  testMode: boolean;
}

export class GameScene extends Scene {
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
    new MapView(this, MAP_CONFIG, MAP_CONFIG);

    this.cameraController = new CameraController(this, MAP_CONFIG, MAP_CONFIG);
    const mapCentre = tileToWorld(MAP_CONFIG.width / 2, MAP_CONFIG.height / 2, MAP_CONFIG);
    this.cameraController.centerOn(mapCentre.x, mapCentre.y);

    if (this.options.testMode) {
      const camera = this.cameras.main;
      this.testApi = installTestApi({
        getElapsedMs: () => this.elapsedTotal,
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
    // up or lacks focus, which would slow the camera down at low frame rates.
    // Measure real elapsed time instead.
    const elapsed =
      this.lastFrameTime === undefined
        ? 0
        : Math.min(time - this.lastFrameTime, CAMERA_CONFIG.maxFrameMs);
    this.lastFrameTime = time;
    this.elapsedTotal += elapsed;

    this.cameraController.update(elapsed);
    // Ready once the first frame has been simulated with the scene fully built.
    if (this.testApi) this.testApi.ready = true;
  }
}
