import type { GameObjects, Scene } from 'phaser';
import { BUILDING_DEFS } from '../../data/buildings';
import { UI_CONFIG } from '../../data/ui';
import { UNIT_DEFS } from '../../data/units';
import { buildingCentre, hasSurrendered } from '../../sim/entities';
import { tileToWorld, type Point, type TileSize } from '../../sim/map/iso';
import type { Building, Entity, GameState, Unit } from '../../sim/state';
import { buildFraction } from '../../sim/systems/construction';
import {
  BUILDING_VISUALS,
  CONSTRUCTION_START_ALPHA,
  LIFE_BAR,
  LIFE_BAR_COLORS,
  OUTLINE_COLOR,
  PLAYER_COLORS,
  RESOURCE_COLORS,
  SELECTION_COLOR,
  UNIT_VISUALS,
  unitVisualCentre,
} from './visuals';

/** Depth of marks drawn on the ground: above the ground tiles, below everything standing on them. */
const GROUND_MARK_DEPTH = -0.5;
/** Depth of marks drawn on top of units: in front of everything in the world. */
const OVERLAY_DEPTH = 900_000;
/** Side of the square shown on a unit that carries a resource, in pixels. */
const CARRY_MARK_SIZE = 7;

interface EntitySprite {
  image: GameObjects.Image;
  label?: GameObjects.Text;
  kind: Entity['kind'];
  /** Whether the image is currently drawn all white because it was just struck. */
  flashing: boolean;
}

interface Lunge {
  /** Frame time when the lunge ends. */
  until: number;
  /** Unit vector from the attacker towards its target, on screen. */
  dx: number;
  dy: number;
}

/**
 * Draws units and buildings with their selection marks, life bars and combat
 * effects. Units are drawn between their previous and current simulation
 * positions, so they move smoothly however often the simulation steps.
 */
export class EntityView {
  private readonly sprites = new Map<number, EntitySprite>();
  /** Images of units that have left the map, fading away. */
  private fading: { image: GameObjects.Image; since: number }[] = [];
  private readonly flashUntil = new Map<number, number>();
  private readonly lunges = new Map<number, Lunge>();
  private readonly marks: GameObjects.Graphics;
  private readonly overlay: GameObjects.Graphics;
  /** Frame time of the latest update, in milliseconds. */
  private now = 0;

  constructor(
    private readonly scene: Scene,
    private readonly size: TileSize,
  ) {
    this.marks = scene.add.graphics().setDepth(GROUND_MARK_DEPTH);
    this.overlay = scene.add.graphics().setDepth(OVERLAY_DEPTH);
  }

  /**
   * Shows a strike: the target turns white for a moment and the attacker
   * lunges a few pixels towards it.
   */
  showHit(state: GameState, attackerId: number, targetId: number): void {
    this.flashUntil.set(targetId, this.now + UI_CONFIG.hitFlashMs);
    const attacker = state.entities.find((entity) => entity.id === attackerId);
    const target = state.entities.find((entity) => entity.id === targetId);
    if (!attacker || !target) return;
    const from = this.groundPoint(attacker);
    const to = this.groundPoint(target);
    const length = Math.hypot(to.x - from.x, to.y - from.y);
    if (length === 0) return;
    this.lunges.set(attackerId, {
      until: this.now + UI_CONFIG.lungeMs,
      dx: (to.x - from.x) / length,
      dy: (to.y - from.y) / length,
    });
  }

  /**
   * @param alpha How far into the next simulation step the frame is, from 0 to 1.
   * @param now Frame time in milliseconds, for effects that last a set time.
   */
  update(state: GameState, alpha: number, selected: ReadonlySet<number>, now: number): void {
    this.now = now;
    this.marks.clear();
    this.marks.lineStyle(2, SELECTION_COLOR, 1);
    this.overlay.clear();

    const seen = new Set<number>();
    for (const entity of state.entities) {
      seen.add(entity.id);
      let sprite = this.sprites.get(entity.id);
      if (!sprite) {
        sprite = this.createSprite(entity);
        this.sprites.set(entity.id, sprite);
      }
      this.updateFlash(entity.id, sprite);
      if (entity.kind === 'unit') {
        this.updateUnit(entity, sprite, alpha, selected.has(entity.id));
      } else {
        this.updateBuilding(entity, sprite, selected.has(entity.id));
      }
    }

    for (const [id, sprite] of this.sprites) {
      if (seen.has(id)) continue;
      this.sprites.delete(id);
      this.flashUntil.delete(id);
      this.lunges.delete(id);
      sprite.label?.destroy();
      if (sprite.kind === 'unit') {
        // A unit that went into a cave or vanished fades away where it stood.
        sprite.image.clearTint();
        this.fading.push({ image: sprite.image, since: now });
      } else {
        sprite.image.destroy();
      }
    }

    this.fading = this.fading.filter((fade) => {
      const t = (now - fade.since) / UI_CONFIG.fadeOutMs;
      if (t >= 1) {
        fade.image.destroy();
        return false;
      }
      fade.image.setAlpha(1 - t);
      return true;
    });
  }

  /** World position of the ground point an entity stands on. */
  private groundPoint(entity: Entity): Point {
    const at = entity.kind === 'unit' ? { x: entity.x, y: entity.y } : buildingCentre(entity);
    return tileToWorld(at.x, at.y, this.size);
  }

  private updateFlash(id: number, sprite: EntitySprite): void {
    const flashing = this.now < (this.flashUntil.get(id) ?? 0);
    if (flashing === sprite.flashing) return;
    sprite.flashing = flashing;
    if (flashing) sprite.image.setTintFill(0xffffff);
    else sprite.image.clearTint();
  }

  private updateUnit(unit: Unit, sprite: EntitySprite, alpha: number, selected: boolean): void {
    const tileX = unit.prevX + (unit.x - unit.prevX) * alpha;
    const tileY = unit.prevY + (unit.y - unit.prevY) * alpha;
    const ground = tileToWorld(tileX, tileY, this.size);
    const centre = unitVisualCentre(unit, tileX, tileY, this.size);

    const lunge = this.lunges.get(unit.id);
    const reach = lunge && this.now < lunge.until ? UI_CONFIG.lungePx : 0;
    sprite.image
      .setPosition(centre.x + (lunge?.dx ?? 0) * reach, centre.y + (lunge?.dy ?? 0) * reach)
      .setDepth(ground.y);

    const radius = UNIT_VISUALS[unit.type].radius;
    if (selected) {
      this.marks.strokeEllipse(ground.x, ground.y, radius * 2 + 12, radius + 6);
    }

    if (hasSurrendered(unit)) {
      // A white flag on a pole above the unit.
      const top = centre.y - radius - 14;
      this.overlay.lineStyle(2, OUTLINE_COLOR, 1);
      this.overlay.lineBetween(centre.x, centre.y - radius, centre.x, top);
      this.overlay.fillStyle(0xffffff, 1);
      this.overlay.fillRect(centre.x, top, 10, 7);
      this.overlay.lineStyle(1, OUTLINE_COLOR, 1);
      this.overlay.strokeRect(centre.x, top, 10, 7);
      return;
    }

    this.drawLifeBar(
      centre.x,
      centre.y - radius - 7,
      LIFE_BAR.unitWidth,
      unit.hp,
      UNIT_DEFS[unit.type].hp,
    );

    // A small square in the resource's colour shows that the unit carries something.
    if (unit.carryAmount > 0 && unit.carryType) {
      const x = centre.x + radius - CARRY_MARK_SIZE / 2;
      const y = centre.y - radius - CARRY_MARK_SIZE / 2;
      this.overlay.fillStyle(RESOURCE_COLORS[unit.carryType], 1);
      this.overlay.fillRect(x, y, CARRY_MARK_SIZE, CARRY_MARK_SIZE);
      this.overlay.lineStyle(1, OUTLINE_COLOR, 1);
      this.overlay.strokeRect(x, y, CARRY_MARK_SIZE, CARRY_MARK_SIZE);
    }
  }

  private updateBuilding(building: Building, sprite: EntitySprite, selected: boolean): void {
    // A building under construction is see-through and turns solid as it is built.
    const solidity =
      CONSTRUCTION_START_ALPHA + (1 - CONSTRUCTION_START_ALPHA) * buildFraction(building);
    sprite.image.setAlpha(solidity);
    sprite.label?.setAlpha(solidity);
    if (selected) this.markBuilding(building);

    // While it is being built its life grows by itself; the bar is for damage.
    if (building.complete) {
      const n = BUILDING_DEFS[building.type].size;
      const top = tileToWorld(building.x, building.y, this.size);
      const roofMiddle =
        top.y - BUILDING_VISUALS[building.type].wallHeight + (n * this.size.tileHeight) / 2;
      this.drawLifeBar(
        top.x,
        roofMiddle - 26,
        LIFE_BAR.buildingWidth,
        building.hp,
        BUILDING_DEFS[building.type].hp,
      );
    }
  }

  /** Draws a life bar centred on x, unless life is full. */
  private drawLifeBar(x: number, y: number, width: number, life: number, max: number): void {
    if (life >= max) return;
    const fraction = Math.max(0, life / max);
    const color =
      fraction > 0.5
        ? LIFE_BAR_COLORS.high
        : fraction > 0.25
          ? LIFE_BAR_COLORS.medium
          : LIFE_BAR_COLORS.low;
    this.overlay.fillStyle(OUTLINE_COLOR, 1);
    this.overlay.fillRect(x - width / 2 - 1, y - 1, width + 2, LIFE_BAR.height + 2);
    this.overlay.fillStyle(color, 1);
    this.overlay.fillRect(x - width / 2, y, width * fraction, LIFE_BAR.height);
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
      const { radius, shape } = UNIT_VISUALS[unit.type];
      const side = radius * 2 + 4;
      const g = this.scene.make.graphics({}, false);
      g.fillStyle(PLAYER_COLORS[unit.owner], 1);
      g.lineStyle(2, OUTLINE_COLOR, 1);
      if (shape === 'square') {
        g.fillRect(2, 2, radius * 2, radius * 2);
        g.strokeRect(2, 2, radius * 2, radius * 2);
      } else {
        g.fillCircle(side / 2, side / 2, radius);
        g.strokeCircle(side / 2, side / 2, radius);
      }
      g.generateTexture(key, side, side);
      g.destroy();
    }
    return { image: this.scene.add.image(0, 0, key), kind: 'unit', flashing: false };
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
    return { image, label: text, kind: 'building', flashing: false };
  }
}

/** Darkens a colour; 1 leaves it unchanged, 0 gives black. */
function shade(color: number, factor: number): number {
  const r = Math.round(((color >> 16) & 0xff) * factor);
  const g = Math.round(((color >> 8) & 0xff) * factor);
  const b = Math.round((color & 0xff) * factor);
  return (r << 16) | (g << 8) | b;
}
