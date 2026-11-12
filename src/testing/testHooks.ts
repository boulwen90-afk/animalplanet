import type { UnitType } from '../data/units';
import type {
  CommandPanelDisplay,
  HudDisplay,
  OutcomeDisplay,
  ResourceBarDisplay,
} from '../render/scenes/UiScene';
import type { Placement } from '../render/views/PlacementView';
import type { Command, CommandResult } from '../sim/commands';
import type { Point } from '../sim/map/iso';
import type { GameState, PlayerId } from '../sim/state';

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
  spawnUnit(type: UnitType, owner: PlayerId, tileX: number, tileY: number): number;
  getAlert(): string;
  getOutcome(): OutcomeDisplay;
  getShakeCount(): number;
  command(command: Command): CommandResult;
  getSelection(): number[];
  getHud(): HudDisplay;
  getResourceBar(): ResourceBarDisplay;
  getFlashing(): string[];
  getCommandPanel(): CommandPanelDisplay;
  getPlacement(): Placement | null;
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
  /**
   * Puts a new unit on a tile and returns its id. A shortcut for tests that
   * need an army without training one; the game itself never does this.
   */
  spawnUnit(type: UnitType, owner: PlayerId, tileX: number, tileY: number): number;
  /** The warning shown at the top of the screen; empty when there is none. */
  getAlert(): string;
  /** The end-of-game screen: whether it shows, its title, and where its button is. */
  getOutcome(): OutcomeDisplay;
  /** How many times the screen has shaken because a building collapsed in view. */
  getShakeCount(): number;
  /** Sends a command to the simulation, exactly as player input and the AI do, and returns its result. */
  command(command: Command): CommandResult;
  /** Ids of the selected entities. */
  getSelection(): number[];
  /** What the selection panel shows right now. */
  getHud(): HudDisplay;
  /** The texts the resource bar shows right now. */
  getResourceBar(): ResourceBarDisplay;
  /** The resource bar texts flashing red right now: 'food', 'wood' or 'population'. */
  getFlashing(): string[];
  /** What the command panel shows right now, with the screen position of each button's centre. */
  getCommandPanel(): CommandPanelDisplay;
  /** The building being placed and where its outline is, or null when no building is being placed. */
  getPlacement(): Placement | null;
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
    spawnUnit: (type, owner, tileX, tileY) => source.spawnUnit(type, owner, tileX, tileY),
    getAlert: () => source.getAlert(),
    getOutcome: () => source.getOutcome(),
    getShakeCount: () => source.getShakeCount(),
    command: (command) => source.command(command),
    getSelection: () => source.getSelection(),
    getHud: () => source.getHud(),
    getResourceBar: () => source.getResourceBar(),
    getFlashing: () => source.getFlashing(),
    getCommandPanel: () => source.getCommandPanel(),
    getPlacement: () => source.getPlacement(),
    getOrderMarkerCount: () => source.getOrderMarkerCount(),
    tileToScreen: (tileX, tileY) => source.tileToScreen(tileX, tileY),
    centerCameraOnTile: (tileX, tileY) => source.centerCameraOnTile(tileX, tileY),
  };
  window.__TEST__ = api;
  return api;
}
