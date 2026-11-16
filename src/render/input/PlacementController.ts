import type { Input, Scene } from 'phaser';
import { BUILDING_DEFS, type BuildingType } from '../../data/buildings';
import type { Command, CommandResult } from '../../sim/commands';
import { worldToTile, type Point, type TileSize } from '../../sim/map/iso';
import type { GameState, PlayerId } from '../../sim/state';
import { STRINGS } from '../../data/strings';
import { unitTile } from '../../sim/entities';
import {
  footprintProblem,
  lineCost,
  placeablePieces,
  placementProblem,
  planLine,
} from '../../sim/systems/construction';
import { plannedWorkTiles } from '../../sim/systems/gathering';
import { wallVariant } from '../buildings/stage';
import { formatCost } from '../ui/commandPanel';
import type { LineTile, Placement, PlacementView } from '../views/PlacementView';

/** How often the work places of the building being placed are worked out again, in milliseconds. */
const PLACES_REFRESH_MS = 500;

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
 * building follows the mouse: green where it may stand, red where not, and
 * there with a few words that say why not.
 * Left click places it there if the place is valid; right click or Esc cancels.
 *
 * A finger cannot hover, so on a touch screen the outline starts in the
 * middle of the view and stays where it is put: a tap elsewhere moves it
 * there, and a tap on the outline itself places the building.
 *
 * A wall is drawn out in a line. With the mouse: press where it starts,
 * drag, and let go where it ends; a click places a single piece. On a
 * touch screen: a tap where it starts, a tap where it ends (and another to
 * move the end), and a tap on the line itself to build it.
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
  /**
   * For a wall: the tile it starts on. With the mouse, where the button
   * went down; on a touch screen, the first tile tapped.
   */
  private lineFrom: Point | undefined;
  /** For a wall on a touch screen: the tile it ends on, once one has been tapped. */
  private lineTo: Point | undefined;
  /** The work places last worked out, and for which outline and when. */
  private places:
    { building: BuildingType; x: number; y: number; at: number; tiles: Point[] } | undefined;

  constructor(
    private readonly scene: Scene,
    private readonly deps: PlacementControllerDeps,
  ) {
    scene.input.on('pointerdown', this.onPointerDown, this);
    scene.input.on('pointerup', this.onPointerUp, this);
    scene.input.on('pointerupoutside', this.onPointerUp, this);
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
    this.lineFrom = undefined;
    this.lineTo = undefined;
    this.refresh();
  }

  cancel(): void {
    this.building = undefined;
    this.placement = undefined;
    this.touchOrigin = undefined;
    this.lineFrom = undefined;
    this.lineTo = undefined;
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
    if (BUILDING_DEFS[building].wall === 'segment') {
      this.refreshLine(building, pointer);
      return;
    }
    let origin: Point;
    if (pointer.wasTouch) {
      const camera = this.scene.cameras.main;
      this.touchOrigin ??= this.originAt(building, camera.width / 2, camera.height / 2);
      origin = this.touchOrigin;
    } else {
      this.touchOrigin = undefined;
      origin = this.originAt(building, pointer.x, pointer.y);
    }
    // A building that is worked from the shore shows where, and how many
    // get a place. With no place for anyone it may not stand there.
    const ground = footprintProblem(
      this.deps.getState(),
      building,
      origin.x,
      origin.y,
      this.deps.player,
    );
    const found = ground ? undefined : this.placesAt(building, origin);
    const problem = ground ?? (found?.length === 0 ? 'noWorkPlace' : undefined);
    const places = problem ? undefined : found;
    this.placement = {
      building,
      x: origin.x,
      y: origin.y,
      valid: problem === undefined,
      // Where it may not stand, a few words say why.
      ...(problem ? { problem, note: STRINGS.hud.placement[problem] } : {}),
      ...(places ? { places, note: STRINGS.hud.placement.workPlaces(places.length) } : {}),
      // A gate turns with the wall it is put into.
      ...(BUILDING_DEFS[building].wall === 'gate'
        ? { variant: this.variantAt('gate', origin, []) }
        : {}),
    };
    this.deps.view.update(this.placement);
  }

  /**
   * The outline of a wall: the line from where it starts to where the mouse
   * is, or to the tile last tapped, with what stands in its way and what
   * its pieces cost together. Before it has a start it is a single piece
   * under the mouse; on a touch screen there is nothing until the first tap.
   */
  private refreshLine(building: BuildingType, pointer: Input.Pointer): void {
    const hover = this.tileAt(pointer.x, pointer.y);
    const from = this.lineFrom ?? (pointer.wasTouch ? undefined : hover);
    if (!from) {
      const camera = this.scene.cameras.main;
      const middle = this.tileAt(camera.width / 2, camera.height / 2);
      this.placement = {
        building,
        x: middle.x,
        y: middle.y,
        valid: false,
        note: STRINGS.hud.placement.lineStart,
        line: [],
      };
      this.deps.view.update(this.placement);
      return;
    }
    const to = pointer.wasTouch ? (this.lineTo ?? from) : hover;
    const plan = planLine(this.deps.getState(), building, from, to, this.deps.player);
    const taken = plan.filter((piece) => !piece.problem);
    const line: LineTile[] = plan.map((piece) => ({
      x: piece.x,
      y: piece.y,
      state: piece.standing ? 'standing' : piece.problem ? 'blocked' : 'place',
      ...(piece.problem ? {} : { variant: this.variantAt('segment', piece, taken) }),
    }));
    const pieces = placeablePieces(plan).length;
    const problem = pieces === 0 ? plan.find((piece) => piece.problem)?.problem : undefined;
    const end = plan.at(-1) ?? to;
    this.placement = {
      building,
      x: end.x,
      y: end.y,
      valid: pieces > 0,
      line,
      ...(pieces > 0
        ? { note: STRINGS.hud.wallLine(pieces, formatCost(lineCost(building, pieces))) }
        : problem
          ? { problem, note: STRINGS.hud.placement[problem] }
          : {}),
    };
    this.deps.view.update(this.placement);
  }

  /**
   * The look a piece of wall would have on a tile: by the pieces of the
   * player's own wall that stand beside it, and those about to be placed
   * there (`planned`).
   */
  private variantAt(kind: 'segment' | 'gate', tile: Point, planned: readonly Point[]): string {
    const state = this.deps.getState();
    const wallAt = (x: number, y: number) =>
      planned.some((piece) => piece.x === x && piece.y === y) ||
      state.entities.some(
        (entity) =>
          entity.kind === 'building' &&
          entity.owner === this.deps.player &&
          BUILDING_DEFS[entity.type].wall !== undefined &&
          entity.x === x &&
          entity.y === y,
      );
    return wallVariant(
      kind,
      wallAt(tile.x - 1, tile.y) || wallAt(tile.x + 1, tile.y),
      wallAt(tile.x, tile.y - 1) || wallAt(tile.x, tile.y + 1),
    );
  }

  /**
   * What stops the building from standing with its footprint's corner on a
   * tile, if anything: by the rules the simulation itself uses when it is ordered.
   */
  private problemAt(building: BuildingType, origin: Point) {
    const state = this.deps.getState();
    const [builderId] = this.deps.getBuilderIds(building);
    const builder = state.entities.find((entity) => entity.id === builderId);
    return placementProblem(
      state,
      building,
      origin.x,
      origin.y,
      this.deps.player,
      builder?.kind === 'unit' ? unitTile(builder) : undefined,
    );
  }

  /**
   * Where the workers of the building would stand around it, for a building
   * that is worked from the shore; undefined for other buildings. It is
   * worked out again only when the outline moves, or after half a second.
   */
  private placesAt(building: BuildingType, origin: Point): Point[] | undefined {
    if (BUILDING_DEFS[building].work?.places !== 'shore') return undefined;
    const now = this.scene.time.now;
    const cached = this.places;
    if (
      cached &&
      cached.building === building &&
      cached.x === origin.x &&
      cached.y === origin.y &&
      now - cached.at < PLACES_REFRESH_MS
    ) {
      return cached.tiles;
    }
    const state = this.deps.getState();
    const [builderId] = this.deps.getBuilderIds(building);
    const builder = state.entities.find((entity) => entity.id === builderId);
    const tiles =
      builder?.kind === 'unit' ? plannedWorkTiles(state, building, origin, unitTile(builder)) : [];
    this.places = { building, x: origin.x, y: origin.y, at: now, tiles };
    return tiles;
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
    if (BUILDING_DEFS[building].wall === 'segment') {
      // The first tap is where the wall starts; a tap on the line builds
      // it; a tap anywhere else is where it ends.
      const onLine = (this.placement?.line ?? []).some((t) => t.x === tile.x && t.y === tile.y);
      if (!this.lineFrom) this.lineFrom = tile;
      else if (onLine) return this.placeLine(building, this.lineFrom, this.lineTo ?? this.lineFrom);
      else this.lineTo = tile;
      this.refresh();
      return;
    }
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
    if (BUILDING_DEFS[building].wall === 'segment') {
      // A wall starts where the button goes down and is placed where it comes up.
      this.lineFrom = this.tileAt(pointer.x, pointer.y);
      this.refresh();
      return;
    }
    this.place(building, this.originAt(building, pointer.x, pointer.y));
  }

  /** The mouse button comes up: a wall that was being drawn out is placed. */
  private onPointerUp(pointer: Input.Pointer): void {
    const building = this.building;
    const from = this.lineFrom;
    if (!building || !from || pointer.wasTouch) return;
    if (BUILDING_DEFS[building].wall !== 'segment') return;
    // Let go over the interface: the line is taken back, and the wall can be started again.
    if (this.deps.isOverHud(pointer.x, pointer.y)) {
      this.lineFrom = undefined;
      this.refresh();
      return;
    }
    this.placeLine(building, from, this.tileAt(pointer.x, pointer.y));
  }

  /** Orders a wall from one tile to another, if any piece of it can be placed. */
  private placeLine(building: BuildingType, from: Point, to: Point): void {
    const state = this.deps.getState();
    const pieces = placeablePieces(planLine(state, building, from, to, this.deps.player));
    // With nowhere to stand it does nothing; the outline is already red.
    if (pieces.length === 0) {
      this.lineFrom = undefined;
      this.lineTo = undefined;
      this.refresh();
      return;
    }
    const result = this.deps.issue({
      type: 'buildLine',
      player: this.deps.player,
      unitIds: this.deps.getBuilderIds(building),
      building,
      fromX: from.x,
      fromY: from.y,
      toX: to.x,
      toY: to.y,
    });
    if (!result.ok) this.deps.onRefused(result);
    this.cancel();
  }

  /** Orders the building at a footprint corner, if it may stand there. */
  private place(building: BuildingType, origin: Point): void {
    // On an invalid place a click does nothing; the outline is already red.
    if (this.problemAt(building, origin)) return;
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
