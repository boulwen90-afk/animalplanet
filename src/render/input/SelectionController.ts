import type { Input, Scene } from 'phaser';
import { UI_CONFIG } from '../../data/ui';
import type { Command } from '../../sim/commands';
import { buildingCentre } from '../../sim/entities';
import {
  isInsideMap,
  tileCenterToWorld,
  tileToWorld,
  worldToTile,
  type Point,
  type TileSize,
} from '../../sim/map/iso';
import type { Entity, GameState, PlayerId } from '../../sim/state';
import { isAttackable } from '../../sim/systems/combat';
import type { SelectionView } from '../views/SelectionView';
import { ATTACK_COLOR } from '../views/visuals';
import { pickEntity, pickResourceTile, rectFromPoints, unitsInRect } from './picking';
import {
  attackerUnitIds,
  builderUnitIds,
  commandableUnitIds,
  gathererUnitIds,
  pruneSelection,
  selectByBox,
  selectByClick,
} from './selection';

export interface SelectionControllerDeps {
  getState(): GameState;
  /** The units and buildings the player can see right now. Only these can be clicked or selected. */
  getVisibleEntities(): Entity[];
  /** True if the player has seen a tile at some point. */
  isExplored(tileX: number, tileY: number): boolean;
  /** Sends a command to the simulation. */
  issue(command: Command): void;
  /** True if a screen position is covered by the interface rather than the map. */
  isOverHud(screenX: number, screenY: number): boolean;
  /** True while the player is choosing where to put a building; the mouse then belongs to that. */
  isPlacing(): boolean;
  player: PlayerId;
  tileSize: TileSize;
  view: SelectionView;
}

interface Drag {
  startScreen: Point;
  startWorld: Point;
  /** False until the pointer has moved far enough for the press to count as a drag. */
  active: boolean;
}

/**
 * Mouse and keyboard selection and orders:
 * left click selects, left drag draws a selection box, Shift adds to the
 * selection, Esc clears it, and right click gives the selected units an
 * order that depends on what is under the pointer.
 * A finger does the same through `tapAt` and `selectBox`, called by the
 * TouchController.
 */
export class SelectionController {
  private selected = new Set<number>();
  private drag: Drag | undefined;

  constructor(
    private readonly scene: Scene,
    private readonly deps: SelectionControllerDeps,
  ) {
    // Right click gives orders, so the browser's context menu must stay away.
    scene.input.mouse?.disableContextMenu();
    scene.input.on('pointerdown', this.onPointerDown, this);
    scene.input.on('pointermove', this.onPointerMove, this);
    scene.input.on('pointerup', this.onPointerUp, this);
    scene.input.on('pointerupoutside', this.onPointerUp, this);
    scene.input.keyboard?.on('keydown-ESC', () => {
      // While placing a building, Esc cancels the placement instead.
      if (!this.deps.isPlacing()) this.clear();
    });
  }

  /** Ids of the selected entities. */
  get selection(): ReadonlySet<number> {
    return this.selected;
  }

  clear(): void {
    this.selected = new Set();
  }

  /** Drops selected entities that no longer exist. Call once per frame. */
  update(): void {
    // An enemy that slips into the fog is deselected, like one that is gone.
    this.selected = pruneSelection(this.selected, this.deps.getVisibleEntities());
  }

  /**
   * A tap on the map. With units selected it gives them an order for what
   * was tapped, exactly as a right click does. A tap on one of the player's
   * own units or buildings selects it instead, except an unfinished building
   * when someone who can build it is selected. With no units selected a tap
   * works as a left click.
   */
  tapAt(screenX: number, screenY: number): void {
    const state = this.deps.getState();
    const { player, tileSize } = this.deps;
    const world = this.worldAt(screenX, screenY);
    const entities = this.deps.getVisibleEntities();
    const hit = pickEntity(entities, world, tileSize);

    if (commandableUnitIds(this.selected, state.entities, player).length > 0) {
      const own = hit?.owner === player;
      const toBuild =
        hit?.kind === 'building' &&
        own &&
        !hit.complete &&
        builderUnitIds(this.selected, state.entities, player, hit.type).length > 0;
      if (!own || toBuild) {
        this.giveOrder(world);
        return;
      }
    }
    this.selected = selectByClick(this.selected, entities, hit, false, player);
  }

  /** Selects the player's units inside a box between two world positions. */
  selectBox(startWorld: Point, endWorld: Point, add = false): void {
    const entities = this.deps.getVisibleEntities();
    const { player, tileSize } = this.deps;
    const rect = rectFromPoints(startWorld, endWorld);
    const boxed = unitsInRect(entities, rect, player, tileSize).map((unit) => unit.id);
    this.selected = selectByBox(this.selected, entities, boxed, add, player);
  }

  private worldPoint(pointer: Input.Pointer): Point {
    return this.worldAt(pointer.x, pointer.y);
  }

  private worldAt(screenX: number, screenY: number): Point {
    const point = this.scene.cameras.main.getWorldPoint(screenX, screenY);
    return { x: point.x, y: point.y };
  }

  private onPointerDown(pointer: Input.Pointer): void {
    if (pointer.wasTouch || this.deps.isOverHud(pointer.x, pointer.y)) return;
    if (this.deps.isPlacing()) return;
    if (pointer.rightButtonDown()) {
      this.giveOrder(this.worldPoint(pointer));
    } else if (pointer.leftButtonDown() && !this.drag) {
      this.drag = {
        startScreen: { x: pointer.x, y: pointer.y },
        startWorld: this.worldPoint(pointer),
        active: false,
      };
    }
  }

  private onPointerMove(pointer: Input.Pointer): void {
    const drag = this.drag;
    if (!drag || pointer.wasTouch || !pointer.leftButtonDown()) return;
    const moved = Math.hypot(pointer.x - drag.startScreen.x, pointer.y - drag.startScreen.y);
    if (!drag.active && moved >= UI_CONFIG.dragThresholdPx) drag.active = true;
    // The box is anchored in the world, so it stays put if the camera pans meanwhile.
    if (drag.active) {
      this.deps.view.setDragBox(rectFromPoints(drag.startWorld, this.worldPoint(pointer)));
    }
  }

  private onPointerUp(pointer: Input.Pointer): void {
    const drag = this.drag;
    if (!drag || pointer.wasTouch || !pointer.leftButtonReleased()) return;
    this.drag = undefined;
    this.deps.view.setDragBox(undefined);

    const entities = this.deps.getVisibleEntities();
    const { player, tileSize } = this.deps;
    const shift = (pointer.event as MouseEvent | undefined)?.shiftKey === true;
    const world = this.worldPoint(pointer);

    if (drag.active) {
      this.selectBox(drag.startWorld, world, shift);
    } else {
      const hit = pickEntity(entities, world, tileSize);
      this.selected = selectByClick(this.selected, entities, hit, shift, player);
    }
  }

  /**
   * Gives the selected units of the player an order for what is at a world
   * position: attack an enemy, help build an unfinished building, gather from
   * a resource source, or otherwise walk to the tile.
   */
  private giveOrder(world: Point): void {
    const state = this.deps.getState();
    const { player, tileSize } = this.deps;
    const unitIds = commandableUnitIds(this.selected, state.entities, player);
    if (unitIds.length === 0) return;

    const hit = pickEntity(this.deps.getVisibleEntities(), world, tileSize);

    // An enemy unit or building: attack it.
    if (hit && isAttackable(state, hit, player)) {
      const attackers = attackerUnitIds(this.selected, state.entities, player);
      if (attackers.length > 0) {
        this.deps.issue({ type: 'attack', player, unitIds: attackers, targetId: hit.id });
        const at = hit.kind === 'building' ? buildingCentre(hit) : { x: hit.x, y: hit.y };
        const mark = tileToWorld(at.x, at.y, tileSize);
        this.deps.view.addOrderMarker(mark.x, mark.y, ATTACK_COLOR);
        return;
      }
    }

    // An unfinished building of the player's own: help build it.
    if (hit?.kind === 'building' && hit.owner === player && !hit.complete) {
      const builders = builderUnitIds(this.selected, state.entities, player, hit.type);
      if (builders.length > 0) {
        this.deps.issue({ type: 'construct', player, unitIds: builders, buildingId: hit.id });
        const centre = buildingCentre(hit);
        const world = tileToWorld(centre.x, centre.y, tileSize);
        this.deps.view.addOrderMarker(world.x, world.y);
        return;
      }
    }

    // A source the player has never seen is not drawn and cannot be picked.
    const source = pickResourceTile(state.map, world, tileSize);
    const gatherers = gathererUnitIds(this.selected, state.entities, player);
    if (source && gatherers.length > 0 && this.deps.isExplored(source.x, source.y)) {
      this.deps.issue({ type: 'gather', player, unitIds: gatherers, x: source.x, y: source.y });
      this.markOrder(source);
      return;
    }

    const tile = worldToTile(world.x, world.y, tileSize);
    if (!isInsideMap(tile.x, tile.y, state.map)) return;
    this.deps.issue({ type: 'move', player, unitIds, x: tile.x, y: tile.y });
    this.markOrder(tile);
  }

  /** Shows an order ring on a tile. */
  private markOrder(tile: Point): void {
    const centre = tileCenterToWorld(tile.x, tile.y, this.deps.tileSize);
    this.deps.view.addOrderMarker(centre.x, centre.y);
  }
}
