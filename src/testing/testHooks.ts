import type { UnitType } from '../data/units';
import type { TouchMode } from '../render/input/touchGesture';
import type {
  CommandPanelDisplay,
  HudButtonDisplay,
  HudDisplay,
  OutcomeDisplay,
  ResourceBarDisplay,
  DebugDisplay,
  LoadingDisplay,
  StartScreenDisplay,
} from '../render/scenes/UiScene';
import type { DamageInfo } from '../render/views/DamageView';
import type { BuildingSpriteInfo, UnitSpriteInfo } from '../render/views/EntityView';
import type { SceneryInfo } from '../render/views/MapView';
import type { Placement, PlacementPreviewInfo } from '../render/views/PlacementView';
import type { ProjectileInfo } from '../render/views/ProjectileView';
import type { Command, CommandResult } from '../sim/commands';
import type { Point } from '../sim/map/iso';
import type { GameState, PlayerId } from '../sim/state';

/** What the mouse pointer looks like right now. */
export interface PointerInfo {
  shown: 'default' | 'repair';
  /** The CSS cursor of the game's canvas. */
  css: string;
  /** The id of the building a right click would send the selected units to repair, or null. */
  repairTarget: number | null;
}

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
  setLife(id: number, life: number): void;
  getAlert(): string;
  getNotice(): string;
  getOutcome(): OutcomeDisplay;
  getStartScreen(): StartScreenDisplay;
  getDebug(): DebugDisplay;
  getHudButtons(): HudButtonDisplay[];
  getTouchMode(): TouchMode | 'none';
  getShakeCount(): number;
  getFrameCount(): number;
  getUnitSprite(id: number): UnitSpriteInfo | null;
  getBuildingSprite(id: number): BuildingSpriteInfo | null;
  getBuildingDamage(id: number): DamageInfo;
  getProjectiles(): ProjectileInfo;
  getRangeRings(): number[];
  getPointer(): PointerInfo;
  getScenery(tileX: number, tileY: number): SceneryInfo;
  getObjectCount(): number;
  command(command: Command): CommandResult;
  getSelection(): number[];
  getHud(): HudDisplay;
  getResourceBar(): ResourceBarDisplay;
  getFlashing(): string[];
  getCommandPanel(): CommandPanelDisplay;
  getPlacement(): Placement | null;
  getPlacementPreview(): PlacementPreviewInfo | null;
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
  getNotice(): string;
  /** The end-of-game screen: whether it shows, its title, and where its button is. */
  getOutcome(): OutcomeDisplay;
  /** The start screen: whether it shows, its title and text, and where its button is. */
  getStartScreen(): StartScreenDisplay;
  getDebug(): DebugDisplay;
  /** The buttons under the resource bar, with the screen position and size of each. */
  getHudButtons(): HudButtonDisplay[];
  /**
   * What the finger on the map is doing: 'pending' until it has moved or
   * rested long enough, then 'pan', 'held' or 'box'; 'none' without a finger.
   */
  getTouchMode(): TouchMode | 'none';
  /** How many times the screen has shaken because a building collapsed in view. */
  getShakeCount(): number;
  /** How many frames the game has drawn so far. With a clock it gives the frame rate. */
  getFrameCount(): number;
  /**
   * How a unit drawn as a character looks right now: its animation, the way
   * it faces, the name of the picture and the texture it comes from. Null for
   * units drawn as placeholder shapes and for units that are not drawn.
   */
  getUnitSprite(id: number): UnitSpriteInfo | null;
  getBuildingSprite(id: number): BuildingSpriteInfo | null;
  /**
   * Sets the life of a unit or building to a number above 0, as if it had
   * been struck or mended. Tests use it to get a building damaged without
   * playing a fight first.
   */
  setLife(id: number, life: number): void;
  /** The damage drawn on a building: whether it smokes or burns, and how many puffs and fires show. */
  getBuildingDamage(id: number): DamageInfo;
  /**
   * What is in the air as it is drawn: each projectile the player can see
   * with its place in world pixels and the way it points, and the bursts
   * where projectiles have landed.
   */
  getProjectiles(): ProjectileInfo;
  /** Ids of the buildings that have a ring drawn round them, showing how far they shoot: selected ones that shoot. */
  getRangeRings(): number[];
  /**
   * The mouse pointer: `repair` while it is the hammer shown over a damaged
   * building that the selected units would repair, the CSS cursor of the
   * game's canvas, and the id of that building.
   */
  getPointer(): PointerInfo;
  /**
   * What is drawn on a tile besides units and buildings: the picture of the
   * tree, bush or rock standing on it, the pictures lying on its ground (a
   * stump, a bare bush, the marks of a fishing place), and for a tile of
   * water the pictures of the water and its shore.
   */
  getScenery(tileX: number, tileY: number): SceneryInfo;
  /** How many trees, bushes and rocks are drawn on the map. */
  getObjectCount(): number;
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
  /**
   * The picture of the building being placed: its texture, and whether it
   * is shown in red. Null when no building is being placed or it has no pictures.
   */
  getPlacementPreview(): PlacementPreviewInfo | null;
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
    /** What the loading bar shows. Available in test mode from the start, before the game is built. */
    __TEST_LOADING__?: () => LoadingDisplay;
  }
}

/** Lets tests read the loading bar while the game's files are still coming in. */
export function installLoadingProbe(read: () => LoadingDisplay): void {
  window.__TEST_LOADING__ = read;
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
    getNotice: () => source.getNotice(),
    getOutcome: () => source.getOutcome(),
    getStartScreen: () => source.getStartScreen(),
    getDebug: () => source.getDebug(),
    getHudButtons: () => source.getHudButtons(),
    getTouchMode: () => source.getTouchMode(),
    getShakeCount: () => source.getShakeCount(),
    getFrameCount: () => source.getFrameCount(),
    getUnitSprite: (id) => source.getUnitSprite(id),
    getBuildingSprite: (id) => source.getBuildingSprite(id),
    getBuildingDamage: (id) => source.getBuildingDamage(id),
    getProjectiles: () => source.getProjectiles(),
    getRangeRings: () => source.getRangeRings(),
    setLife: (id, life) => source.setLife(id, life),
    getPointer: () => source.getPointer(),
    getScenery: (tileX, tileY) => source.getScenery(tileX, tileY),
    getObjectCount: () => source.getObjectCount(),
    command: (command) => source.command(command),
    getSelection: () => source.getSelection(),
    getHud: () => source.getHud(),
    getResourceBar: () => source.getResourceBar(),
    getFlashing: () => source.getFlashing(),
    getCommandPanel: () => source.getCommandPanel(),
    getPlacement: () => source.getPlacement(),
    getPlacementPreview: () => source.getPlacementPreview(),
    getOrderMarkerCount: () => source.getOrderMarkerCount(),
    tileToScreen: (tileX, tileY) => source.tileToScreen(tileX, tileY),
    centerCameraOnTile: (tileX, tileY) => source.centerCameraOnTile(tileX, tileY),
  };
  window.__TEST__ = api;
  return api;
}
