import type { GameObjects, Scene } from 'phaser';
import { BUILDING_DEFS } from '../../data/buildings';
import type { ResourceType } from '../../data/resources';
import { UI_CONFIG } from '../../data/ui';
import { UNIT_DEFS } from '../../data/units';
import { buildingCentre, hasSurrendered } from '../../sim/entities';
import { tileToWorld, type Point, type TileSize } from '../../sim/map/iso';
import type { Building, Entity, GameState, Unit } from '../../sim/state';
import { strikeTicks } from '../../sim/systems/combat';
import { buildFraction } from '../../sim/systems/construction';
import { ticksPerUnit } from '../../sim/systems/gathering';
import {
  DIRECTIONS,
  activityOf,
  animationFor,
  attackFrame,
  facingOf,
  frameAt,
  frameName,
  progressFrame,
  travelFrame,
  type CharacterAnimation,
} from '../characters/animation';
import type { CharacterLibrary, CharacterSheet } from '../characters/CharacterLibrary';
import {
  BUILDING_VISUALS,
  CHARACTER_SHADOW,
  CHARACTER_VISUALS,
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
/** Depth of the shadows under characters: on the ground, above the selection marks. */
const SHADOW_DEPTH = -0.45;
const SHADOW_TEXTURE = 'character-shadow';
/** Side of the square shown on a unit that carries a resource, in pixels. */
const CARRY_MARK_SIZE = 7;

interface EntitySprite {
  image: GameObjects.Image;
  label?: GameObjects.Text;
  kind: Entity['kind'];
  /** Whether the image is currently drawn all white because it was just struck. */
  flashing: boolean;
  /** Set for a unit that is drawn as a character instead of a placeholder shape. */
  character?: CharacterDrawing;
  /** The shadow on the ground under a character. */
  shadow?: GameObjects.Image;
}

/** What is remembered about a character between frames. */
interface CharacterDrawing {
  sheet: CharacterSheet;
  /** The way the unit faces, as an index into DIRECTIONS. It keeps facing that way when it stops. */
  direction: number;
  animation: CharacterAnimation;
  /** Name of the picture shown now. */
  frame: string;
  /** Whether the unit had surrendered at the last frame. */
  fleeing: boolean;
  /** How far the unit has moved since it was first drawn, in tiles. It drives the walk animation. */
  travelled: number;
  /** Where the unit was at the last frame, in tiles. */
  last?: Point;
  /** Where and when the unit was beaten, while it kneels there and then catches up with its real place. */
  defeat?: { x: number; y: number; since: number };
}

/** What a character looks like right now, for tests. */
export interface UnitSpriteInfo {
  animation: CharacterAnimation;
  direction: string;
  frame: string;
  texture: string;
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

  /**
   * @param characters The characters to draw units as. Unit types without
   * one, and all units when it is left out, are placeholder shapes.
   */
  constructor(
    private readonly scene: Scene,
    private readonly size: TileSize,
    private readonly characters?: CharacterLibrary,
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
   * @param isShown Whether the player can see an entity; hidden ones are not drawn.
   */
  update(
    state: GameState,
    alpha: number,
    selected: ReadonlySet<number>,
    now: number,
    isShown: (entity: Entity) => boolean,
  ): void {
    this.now = now;
    this.marks.clear();
    this.marks.lineStyle(2, SELECTION_COLOR, 1);
    this.overlay.clear();

    const byId = new Map<number, Entity>();
    for (const entity of state.entities) byId.set(entity.id, entity);

    const seen = new Set<number>();
    for (const entity of state.entities) {
      seen.add(entity.id);
      let sprite = this.sprites.get(entity.id);
      if (!sprite) {
        sprite = this.createSprite(entity);
        this.sprites.set(entity.id, sprite);
      }
      const shown = isShown(entity);
      if (sprite.image.visible !== shown) {
        sprite.image.setVisible(shown);
        sprite.label?.setVisible(shown);
        sprite.shadow?.setVisible(shown);
      }
      // Nothing more is drawn for an entity lost in the fog: no bars, flags or marks.
      if (!shown) continue;
      this.updateFlash(entity.id, sprite);
      if (entity.kind === 'unit') {
        if (sprite.character) {
          this.updateCharacter(entity, sprite, alpha, selected.has(entity.id), byId);
        } else {
          this.updateUnit(entity, sprite, alpha, selected.has(entity.id));
        }
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
      sprite.shadow?.destroy();
      if (sprite.kind === 'unit' && sprite.image.visible) {
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

  /** What a unit drawn as a character looks like right now, or undefined. */
  describeUnit(id: number): UnitSpriteInfo | undefined {
    const sprite = this.sprites.get(id);
    const drawing = sprite?.character;
    if (!sprite || !drawing) return undefined;
    return {
      animation: drawing.animation,
      direction: DIRECTIONS[drawing.direction] ?? 's',
      frame: drawing.frame,
      texture: sprite.image.texture.key,
    };
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
      this.drawCarryMark(
        centre.x + radius - CARRY_MARK_SIZE / 2,
        centre.y - radius - CARRY_MARK_SIZE / 2,
        unit.carryType,
      );
    }
  }

  /**
   * Draws a unit as a character: the animation that fits what it is doing,
   * facing the way it moves or the target it strikes.
   */
  private updateCharacter(
    unit: Unit,
    sprite: EntitySprite,
    alpha: number,
    selected: boolean,
    byId: ReadonlyMap<number, Entity>,
  ): void {
    const drawing = sprite.character as CharacterDrawing;
    const { animations } = drawing.sheet;
    const tileX = unit.prevX + (unit.x - unit.prevX) * alpha;
    const tileY = unit.prevY + (unit.y - unit.prevY) * alpha;
    const ground = tileToWorld(tileX, tileY, this.size);
    let { x, y } = ground;
    if (drawing.last) {
      drawing.travelled += Math.hypot(tileX - drawing.last.x, tileY - drawing.last.y);
    }
    drawing.last = { x: tileX, y: tileY };

    // A unit that has just been beaten kneels where it stood before it leaves.
    const fleeing = hasSurrendered(unit);
    if (fleeing && !drawing.fleeing) drawing.defeat = { x, y, since: this.now };
    drawing.fleeing = fleeing;
    const kneelMs = (animations.defeat.frames / animations.defeat.fps) * 1000;
    const sinceDefeat = drawing.defeat ? this.now - drawing.defeat.since : Infinity;
    if (sinceDefeat >= kneelMs + UI_CONFIG.defeatCatchUpMs) drawing.defeat = undefined;

    let animation: CharacterAnimation;
    let frame: number;
    if (drawing.defeat && sinceDefeat < kneelMs) {
      ({ x, y } = drawing.defeat);
      animation = 'defeat';
      frame = frameAt(animations.defeat, sinceDefeat);
    } else {
      if (drawing.defeat) {
        // Then it runs to catch up with where the simulation has it.
        const t = (sinceDefeat - kneelMs) / UI_CONFIG.defeatCatchUpMs;
        const k = t * t * (3 - 2 * t);
        x = drawing.defeat.x + (ground.x - drawing.defeat.x) * k;
        y = drawing.defeat.y + (ground.y - drawing.defeat.y) * k;
      }
      const activity = activityOf(unit);
      animation = animationFor(animations, activity);
      const info = animations[animation] ?? animations.idle;
      const task = unit.task;
      const face = (at: Point | undefined) => {
        if (at) drawing.direction = facingOf(at.x - unit.x, at.y - unit.y) ?? drawing.direction;
      };
      if (activity === 'walk') {
        drawing.direction = facingOf(unit.x - unit.prevX, unit.y - unit.prevY) ?? drawing.direction;
        // By distance, not by time, so that the feet do not slide on the ground.
        frame = travelFrame(info, drawing.travelled, unit.id * 3);
      } else if (activity === 'attack' && task.kind === 'attack') {
        const target = byId.get(task.targetId);
        face(target && (target.kind === 'unit' ? target : buildingCentre(target)));
        const cooldown = Math.max(0, unit.attackCooldown - alpha);
        frame = attackFrame(info, cooldown, strikeTicks(unit));
      } else if (activity === 'gather' && task.kind === 'gather') {
        // One swing for each unit of the resource: the tool lands as it is taken.
        face({ x: task.node.x + 0.5, y: task.node.y + 0.5 });
        frame = progressFrame(info, (task.workTicks + alpha) / ticksPerUnit(unit));
      } else if (activity === 'gather' && task.kind === 'build') {
        const site = byId.get(task.buildingId);
        face(site?.kind === 'building' ? buildingCentre(site) : undefined);
        frame = frameAt(info, this.now, unit.id * 3);
      } else {
        frame = frameAt(info, this.now, unit.id * 3);
      }
    }

    const name = frameName(animation, drawing.direction, frame);
    if (name !== drawing.frame) {
      sprite.image.setFrame(name);
      drawing.frame = name;
    }
    drawing.animation = animation;

    const lunge = this.lunges.get(unit.id);
    const reach = lunge && this.now < lunge.until ? UI_CONFIG.lungePx : 0;
    sprite.image
      .setPosition(x + (lunge?.dx ?? 0) * reach, y + (lunge?.dy ?? 0) * reach)
      .setDepth(y);
    sprite.shadow?.setPosition(x + CHARACTER_SHADOW.offsetX, y + CHARACTER_SHADOW.offsetY);

    const visual = CHARACTER_VISUALS[unit.type] ?? {
      height: 48,
      halfWidth: 16,
      selectionWidth: 46,
      shadowScale: 1,
    };
    if (selected) {
      this.marks.strokeEllipse(x, y, visual.selectionWidth, visual.selectionWidth / 2);
    }

    if (fleeing) {
      // A white flag on a pole above the unit.
      const top = y - visual.height - 16;
      this.overlay.lineStyle(2, OUTLINE_COLOR, 1);
      this.overlay.lineBetween(x, y - visual.height + 6, x, top);
      this.overlay.fillStyle(0xffffff, 1);
      this.overlay.fillRect(x, top, 10, 7);
      this.overlay.lineStyle(1, OUTLINE_COLOR, 1);
      this.overlay.strokeRect(x, top, 10, 7);
      return;
    }
    this.drawLifeBar(
      x,
      y - visual.height - 8,
      LIFE_BAR.unitWidth,
      unit.hp,
      UNIT_DEFS[unit.type].hp,
    );

    // A small square in the resource's colour, by the shoulder, shows that the unit carries something.
    if (unit.carryAmount > 0 && unit.carryType) {
      this.drawCarryMark(
        x + visual.halfWidth - CARRY_MARK_SIZE / 2,
        y - visual.height,
        unit.carryType,
      );
    }
  }

  private drawCarryMark(x: number, y: number, resource: ResourceType): void {
    this.overlay.fillStyle(RESOURCE_COLORS[resource], 1);
    this.overlay.fillRect(x, y, CARRY_MARK_SIZE, CARRY_MARK_SIZE);
    this.overlay.lineStyle(1, OUTLINE_COLOR, 1);
    this.overlay.strokeRect(x, y, CARRY_MARK_SIZE, CARRY_MARK_SIZE);
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
    const sheet = this.characters?.get(unit.type);
    if (sheet) {
      const frame = frameName('idle', 0, 0);
      const image = this.scene.add
        .image(0, 0, sheet.textureKey(unit.owner), frame)
        .setScale(sheet.displayScale);
      const shadow = this.scene.add
        .image(0, 0, this.shadowTexture())
        .setScale(CHARACTER_VISUALS[unit.type]?.shadowScale ?? 1)
        .setDepth(SHADOW_DEPTH);
      return {
        image,
        shadow,
        kind: 'unit',
        flashing: false,
        character: {
          sheet,
          direction: 0,
          animation: 'idle',
          frame,
          fleeing: false,
          travelled: 0,
        },
      };
    }

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

  /** The picture of a shadow: a dark ellipse that fades out towards its edge. Made on first use. */
  private shadowTexture(): string {
    if (!this.scene.textures.exists(SHADOW_TEXTURE)) {
      const { width, height, alpha, color } = CHARACTER_SHADOW;
      const canvas = this.scene.textures.createCanvas(SHADOW_TEXTURE, width, height);
      const context = canvas?.getContext();
      if (canvas && context) {
        // A round fade, squeezed to the flat shape of a shadow on the ground.
        context.scale(1, height / width);
        const fade = context.createRadialGradient(
          width / 2,
          width / 2,
          0,
          width / 2,
          width / 2,
          width / 2,
        );
        fade.addColorStop(0, `rgba(${color}, ${alpha})`);
        fade.addColorStop(0.6, `rgba(${color}, ${alpha * 0.8})`);
        fade.addColorStop(1, `rgba(${color}, 0)`);
        context.fillStyle = fade;
        context.fillRect(0, 0, width, width);
        canvas.refresh();
      }
    }
    return SHADOW_TEXTURE;
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
