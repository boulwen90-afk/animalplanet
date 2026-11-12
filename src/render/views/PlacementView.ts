import type { GameObjects, Scene } from 'phaser';
import { BUILDING_DEFS, type BuildingType } from '../../data/buildings';
import { tileToWorld, type TileSize } from '../../sim/map/iso';
import { PLACEMENT_COLORS } from './visuals';

/** Depth of the outline: on the ground, below everything standing on the map. */
const GROUND_MARK_DEPTH = -0.3;

/** Where a building is about to be placed, and whether it may stand there. */
export interface Placement {
  building: BuildingType;
  /** Tile of the footprint corner with the lowest x and y. */
  x: number;
  y: number;
  valid: boolean;
}

/** Draws the footprint of a building being placed: green where it may stand, red where not. */
export class PlacementView {
  private readonly graphics: GameObjects.Graphics;

  constructor(
    scene: Scene,
    private readonly size: TileSize,
  ) {
    this.graphics = scene.add.graphics().setDepth(GROUND_MARK_DEPTH);
  }

  update(placement: Placement | undefined): void {
    this.graphics.clear();
    if (!placement) return;
    const n = BUILDING_DEFS[placement.building].size;
    const color = placement.valid ? PLACEMENT_COLORS.valid : PLACEMENT_COLORS.invalid;
    const corners = [
      tileToWorld(placement.x, placement.y, this.size),
      tileToWorld(placement.x + n, placement.y, this.size),
      tileToWorld(placement.x + n, placement.y + n, this.size),
      tileToWorld(placement.x, placement.y + n, this.size),
    ];
    this.graphics.fillStyle(color, 0.45);
    this.graphics.fillPoints(corners, true);
    this.graphics.lineStyle(2, color, 1);
    this.graphics.strokePoints(corners, true);
  }
}
