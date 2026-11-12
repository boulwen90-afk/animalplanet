import type { HudDisplay, ResourceBarDisplay } from '../render/scenes/UiScene';
import type { Command } from '../sim/commands';
import type { Point } from '../sim/map/iso';
import type { GameState } from '../sim/state';

/**
 * Test interface exposed as window.__TEST__ when the game runs with ?test=1.
 * Playwright tests read game state through this instead of inspecting pixels.
 */

export interface TestCameraInfo {
  /** World x of the left edge of the view. */
  x: number;
  /** World y of the top edge of the view. */
  y: number;
  /** View size in pixels. */
  width: number;
  height: number;
  /** Fractional tile coordinates of the point at the centre of the view. */
  centerTile: { x: number; y: number };
}

/** What the game scene provides to the test interface. */
export interface TestApiSource {
  getCamera(): TestCameraInfo;
  getElapsedMs(): number;
  getState(): GameState;
  advance(steps: number): void;
  command(command: Command): void;
  getSelection(): number[];
  getHud(): HudDisplay;
  getResourceBar(): ResourceBarDisplay;
  getOrderMarkerCount(): number;
  tileToScreen(tileX: number, tileY: number): Point;
  centerCameraOnTile(tileX: number, tileY: number): void;
}

export interface TestApi {
  /** True once the game scene has been created and is rendering. */
  ready: boolean;
  /** Current camera state. */
  readonly camera: TestCameraInfo;
  /**
   * Total frame time, in milliseconds, the game has processed so far. Long
   * frames are capped, so on a slow machine this runs slower than the wall
   * clock. Tests measure speeds against this instead of real time.
   */
  readonly elapsedMs: number;
  /** A copy of the complete game state. */
  getState(): GameState;
  /** Runs `steps` simulation steps immediately, on top of the real-time ones. */
  advance(steps: number): void;
  /** Sends a command to the simulation, exactly as player input and the AI do. */
  command(command: Command): void;
  /** Ids of the selected entities. */
  getSelection(): number[];
  /** What the selection panel shows right now. */
  getHud(): HudDisplay;
  /** The texts the resource bar shows right now. */
  getResourceBar(): ResourceBarDisplay;
  /** Number of order rings currently visible. */
  getOrderMarkerCount(): number;
  /**
   * Screen position of a point in tile coordinates. Whole numbers are tile
   * corners; add 0.5 for the centre of a tile. Unit positions can be passed as they are.
   */
  tileToScreen(tileX: number, tileY: number): Point;
  /** Centres the camera on a point in tile coordinates. */
  centerCameraOnTile(tileX: number, tileY: number): void;
}

declare global {
  interface Window {
    __TEST__?: TestApi;
  }
}

export function installTestApi(source: TestApiSource): TestApi {
  const api: TestApi = {
    ready: false,
    get camera() {
      return source.getCamera();
    },
    get elapsedMs() {
      return source.getElapsedMs();
    },
    getState: () => source.getState(),
    advance: (steps) => source.advance(steps),
    command: (command) => source.command(command),
    getSelection: () => source.getSelection(),
    getHud: () => source.getHud(),
    getResourceBar: () => source.getResourceBar(),
    getOrderMarkerCount: () => source.getOrderMarkerCount(),
    tileToScreen: (tileX, tileY) => source.tileToScreen(tileX, tileY),
    centerCameraOnTile: (tileX, tileY) => source.centerCameraOnTile(tileX, tileY),
  };
  window.__TEST__ = api;
  return api;
}
