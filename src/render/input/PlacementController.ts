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
 * It must be created after the SelectionController, so that the click that
 * places the building reaches the selection logic while placement is still
 * active and is ignored there.
 */
export class PlacementController {
  private building: BuildingType | undefined;
  private placement: Placement | undefined;

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
    this.refresh();
  }

  cancel(): void {
    this.building = undefined;
    this.placement = undefined;
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
    const origin = this.originAt(building, pointer);
    this.placement = {
      building,
      x: origin.x,
      y: origin.y,
      valid: canPlaceBuilding(this.deps.getState(), building, origin.x, origin.y),
    };
    this.deps.view.update(this.placement);
  }

  /** The footprint corner that puts the middle of the building under the pointer. */
  private originAt(building: BuildingType, pointer: Input.Pointer): Point {
    const world = this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const tile = worldToTile(world.x, world.y, this.deps.tileSize);
    const offset = Math.floor(BUILDING_DEFS[building].size / 2);
    return { x: tile.x - offset, y: tile.y - offset };
  }

  private onPointerDown(pointer: Input.Pointer): void {
    const building = this.building;
    if (!building || pointer.wasTouch || this.deps.isOverHud(pointer.x, pointer.y)) return;
    if (pointer.rightButtonDown()) {
      this.cancel();
      return;
    }
    if (!pointer.leftButtonDown()) return;

    const origin = this.originAt(building, pointer);
    // On an invalid place a click does nothing; the outline is already red.
    if (!canPlaceBuilding(this.deps.getState(), building, origin.x, origin.y)) return;
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
