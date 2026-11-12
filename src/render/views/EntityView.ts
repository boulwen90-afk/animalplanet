import type { GameObjects, Scene } from 'phaser';
import { BUILDING_DEFS } from '../../data/buildings';
import { buildingCentre } from '../../sim/entities';
import { tileToWorld, type TileSize } from '../../sim/map/iso';
import type { Building, Entity, GameState, Unit } from '../../sim/state';
import {
  BUILDING_VISUALS,
  OUTLINE_COLOR,
  PLAYER_COLORS,
  SELECTION_COLOR,
  UNIT_VISUALS,
  unitVisualCentre,
} from './visuals';

/** Depth of marks drawn on the ground: above the ground tiles, below everything standing on them. */
const GROUND_MARK_DEPTH = -0.5;

interface EntitySprite {
  image: GameObjects.Image;
  label?: GameObjects.Text;
}

/**
 * Draws units and buildings, and the selection marks under the selected ones.
 * Units are drawn between their previous and current simulation positions,
 * so they move smoothly however often the simulation steps.
 */
export class EntityView {
  private readonly sprites = new Map<number, EntitySprite>();
  private readonly marks: GameObjects.Graphics;

  constructor(
    private readonly scene: Scene,
    private readonly size: TileSize,
  ) {
    this.marks = scene.add.graphics().setDepth(GROUND_MARK_DEPTH);
  }

  /**
   * @param alpha How far into the next simulation step the frame is, from 0 to 1.
   */
  update(state: GameState, alpha: number, selected: ReadonlySet<number>): void {
    this.marks.clear();
    this.marks.lineStyle(2, SELECTION_COLOR, 1);

    const seen = new Set<number>();
    for (const entity of state.entities) {
      seen.add(entity.id);
      let sprite = this.sprites.get(entity.id);
      if (!sprite) {
        sprite = this.createSprite(entity);
        this.sprites.set(entity.id, sprite);
      }
      if (entity.kind === 'unit') this.updateUnit(entity, sprite, alpha, selected.has(entity.id));
      else if (selected.has(entity.id)) this.markBuilding(entity);
    }

    for (const [id, sprite] of this.sprites) {
      if (seen.has(id)) continue;
      sprite.image.destroy();
      sprite.label?.destroy();
      this.sprites.delete(id);
    }
  }

  private updateUnit(unit: Unit, sprite: EntitySprite, alpha: number, selected: boolean): void {
    const tileX = unit.prevX + (unit.x - unit.prevX) * alpha;
    const tileY = unit.prevY + (unit.y - unit.prevY) * alpha;
    const ground = tileToWorld(tileX, tileY, this.size);
    const centre = unitVisualCentre(unit, tileX, tileY, this.size);
    sprite.image.setPosition(centre.x, centre.y).setDepth(ground.y);

    if (selected) {
      const radius = UNIT_VISUALS[unit.type].radius;
      this.marks.strokeEllipse(ground.x, ground.y, radius * 2 + 12, radius + 6);
    }
  }

  private markBuilding(building: Building): void {
    const n = BUILDING_DEFS[building.type].size;
    this.marks.strokePoints(
      [
        tileToWorld(building.x, building.y, this.size),
        tileToWorld(building.x + n, building.y, this.size),
        tileToWorld(building.x + n, building.y + n, this.size),
        tileToWorld(building.x, building.y + n, this.size),
      ],
      true,
    );
  }

  private createSprite(entity: Entity): EntitySprite {
    return entity.kind === 'unit'
      ? this.createUnitSprite(entity)
      : this.createBuildingSprite(entity);
  }

  private createUnitSprite(unit: Unit): EntitySprite {
    const key = `unit-${unit.type}-${unit.owner}`;
    if (!this.scene.textures.exists(key)) {
      const radius = UNIT_VISUALS[unit.type].radius;
      const side = radius * 2 + 4;
      const g = this.scene.make.graphics({}, false);
      g.fillStyle(PLAYER_COLORS[unit.owner], 1);
      g.fillCircle(side / 2, side / 2, radius);
      g.lineStyle(2, OUTLINE_COLOR, 1);
      g.strokeCircle(side / 2, side / 2, radius);
      g.generateTexture(key, side, side);
      g.destroy();
    }
    return { image: this.scene.add.image(0, 0, key) };
  }

  private createBuildingSprite(building: Building): EntitySprite {
    const n = BUILDING_DEFS[building.type].size;
    const { wallHeight, label } = BUILDING_VISUALS[building.type];
    const w = n * this.size.tileWidth;
    const h = n * this.size.tileHeight;

    const key = `building-${building.type}-${building.owner}`;
    if (!this.scene.textures.exists(key)) {
      const color = PLAYER_COLORS[building.owner];
      const g = this.scene.make.graphics({}, false);
      g.fillStyle(shade(color, 0.7), 1);
      g.fillPoints(
        [
          { x: 0, y: h / 2 },
          { x: w / 2, y: h },
          { x: w / 2, y: h + wallHeight },
          { x: 0, y: h / 2 + wallHeight },
        ],
        true,
      );
      g.fillStyle(shade(color, 0.5), 1);
      g.fillPoints(
        [
          { x: w / 2, y: h },
          { x: w, y: h / 2 },
          { x: w, y: h / 2 + wallHeight },
          { x: w / 2, y: h + wallHeight },
        ],
        true,
      );
      const roof = [
        { x: w / 2, y: 0 },
        { x: w, y: h / 2 },
        { x: w / 2, y: h },
        { x: 0, y: h / 2 },
      ];
      g.fillStyle(color, 1);
      g.fillPoints(roof, true);
      g.lineStyle(2, OUTLINE_COLOR, 1);
      g.strokePoints(roof, true);
      g.generateTexture(key, w, h + wallHeight);
      g.destroy();
    }

    // The roof is the footprint lifted by the wall height.
    const top = tileToWorld(building.x, building.y, this.size);
    const centre = buildingCentre(building);
    const depth = tileToWorld(centre.x, centre.y, this.size).y;
    const image = this.scene.add
      .image(top.x - w / 2, top.y - wallHeight, key)
      .setOrigin(0, 0)
      .setDepth(depth);
    const text = this.scene.add
      .text(top.x, top.y - wallHeight + h / 2, label, {
        fontFamily: 'sans-serif',
        fontSize: '32px',
        fontStyle: 'bold',
        color: '#ffffff',
      })
      .setOrigin(0.5)
      .setDepth(depth + 0.01);
    return { image, label: text };
  }
}

/** Darkens a colour; 1 leaves it unchanged, 0 gives black. */
function shade(color: number, factor: number): number {
  const r = Math.round(((color >> 16) & 0xff) * factor);
  const g = Math.round(((color >> 8) & 0xff) * factor);
  const b = Math.round((color & 0xff) * factor);
  return (r << 16) | (g << 8) | b;
}
