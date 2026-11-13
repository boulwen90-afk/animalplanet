import type { Input, Scene } from 'phaser';
import { BUILDING_DEFS, type BuildingType } from '../../data/buildings';
import type { Command, CommandResult } from '../../sim/commands';
import { worldToTile, type Point, type TileSize } from '../../sim/map/iso';
import type { GameState, PlayerId } from '../../sim/state';
import { canPlaceBuilding } from '../../sim/systems/construction';
import type { Placement, PlacementView } from '../views/PlacementView';

export interface PlacementControllerDeps {
  getState(): GameState;
  /** Sends a command to the simulation. */
  issue(command: Command): CommandResult;
  /** Called when a placement click was refused, so the interface can show why. */
  onRefused(result: CommandResult): void;
  /** True if a screen position is covered by the interface rather than the map. */
  isOverHud(screenX: number, screenY: number): boolean;
  /** Ids of the selected units that can build the given type. */
  getBuilderIds(type: BuildingType): number[];
  player: PlayerId;
  tileSize: TileSize;
  view: PlacementView;
}

/**
 * Choosing where to put a building. While active, an outline of the
 * building follows the mouse: green where it may stand, red where not.
 * Left click places it there if the place is valid; right click or Esc cancels.
 *
 * A finger cannot hover, so on a touch screen the outline starts in the
 * middle of the view and stays where it is put: a tap elsewhere moves it
 * there, and a tap on the outline itself places the building.
 *
 * It must be created after the SelectionController, so that the click that
 * places the building reaches the selection logic while placement is still
 * active and is ignored there.
 */
export class PlacementController {
  private building: BuildingType | undefined;
  private placement: Placement | undefined;
  /** Where a finger has put the outline; undefined while the mouse leads it. */
  private touchOrigin: Point | undefined;

  constructor(
    private readonly scene: Scene,
    private readonly deps: PlacementControllerDeps,
  ) {
    scene.input.on('pointerdown', this.onPointerDown, this);
    scene.input.keyboard?.on('keydown-ESC', () => this.cancel());
  }

  /** True while a building is being placed. */
  get active(): boolean {
    return this.building !== undefined;
  }

  /** Where the building would be placed right now, or undefined when not placing. */
  get current(): Placement | undefined {
    return this.placement;
  }

  /** Starts placing a building of the given type. */
  start(building: BuildingType): void {
    this.building = building;
    this.touchOrigin = undefined;
    this.refresh();
  }

  cancel(): void {
    this.building = undefined;
    this.placement = undefined;
    this.touchOrigin = undefined;
    this.deps.view.update(undefined);
  }

  /** Moves the outline to the mouse. Call once per frame. */
  update(): void {
    // Without anyone selected who can build it, there is nothing to place.
    if (this.building && this.deps.getBuilderIds(this.building).length === 0) this.cancel();
    this.refresh();
  }

  private refresh(): void {
    const building = this.building;
    if (!building) return;
    const pointer = this.scene.input.activePointer;
    let origin: Point;
    if (pointer.wasTouch) {
      const camera = this.scene.cameras.main;
      this.touchOrigin ??= this.originAt(building, camera.width / 2, camera.height / 2);
      origin = this.touchOrigin;
    } else {
      this.touchOrigin = undefined;
      origin = this.originAt(building, pointer.x, pointer.y);
    }
    this.placement = {
      building,
      x: origin.x,
      y: origin.y,
      valid: canPlaceBuilding(this.deps.getState(), building, origin.x, origin.y, this.deps.player),
    };
    this.deps.view.update(this.placement);
  }

  /** The footprint corner that puts the middle of the building at a screen position. */
  private originAt(building: BuildingType, screenX: number, screenY: number): Point {
    const tile = this.tileAt(screenX, screenY);
    const offset = Math.floor(BUILDING_DEFS[building].size / 2);
    return { x: tile.x - offset, y: tile.y - offset };
  }

  private tileAt(screenX: number, screenY: number): Point {
    const world = this.scene.cameras.main.getWorldPoint(screenX, screenY);
    return worldToTile(world.x, world.y, this.deps.tileSize);
  }

  /**
   * A tap on the map while placing: on the outline it places the building,
   * if the place is valid; anywhere else it moves the outline there.
   */
  tapAt(screenX: number, screenY: number): void {
    const building = this.building;
    if (!building) return;
    const tile = this.tileAt(screenX, screenY);
    const origin = this.touchOrigin;
    const size = BUILDING_DEFS[building].size;
    const onOutline =
      origin !== undefined &&
      tile.x >= origin.x &&
      tile.x < origin.x + size &&
      tile.y >= origin.y &&
      tile.y < origin.y + size;
    if (onOutline) {
      this.place(building, origin);
    } else {
      this.touchOrigin = this.originAt(building, screenX, screenY);
      this.refresh();
    }
  }

  private onPointerDown(pointer: Input.Pointer): void {
    const building = this.building;
    if (!building || pointer.wasTouch || this.deps.isOverHud(pointer.x, pointer.y)) return;
    if (pointer.rightButtonDown()) {
      this.cancel();
      return;
    }
    if (!pointer.leftButtonDown()) return;
    this.place(building, this.originAt(building, pointer.x, pointer.y));
  }

  /** Orders the building at a footprint corner, if it may stand there. */
  private place(building: BuildingType, origin: Point): void {
    // On an invalid place a click does nothing; the outline is already red.
    if (!canPlaceBuilding(this.deps.getState(), building, origin.x, origin.y, this.deps.player))
      return;
    const result = this.deps.issue({
      type: 'build',
      player: this.deps.player,
      unitIds: this.deps.getBuilderIds(building),
      building,
      x: origin.x,
      y: origin.y,
    });
    if (!result.ok) this.deps.onRefused(result);
    this.cancel();
  }
}
