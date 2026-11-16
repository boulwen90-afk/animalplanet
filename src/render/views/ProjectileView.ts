import type { GameObjects, Scene } from 'phaser';
import type { ProjectileKind } from '../../data/types';
import { UI_CONFIG } from '../../data/ui';
import { buildingCentre } from '../../sim/entities';
import { tileToWorld, type TileSize } from '../../sim/map/iso';
import type { Entity, GameState } from '../../sim/state';
import { hitBurstAt, projectilePose } from '../effects/projectiles';
import { BUILDING_VISUALS, MUZZLE_HEIGHT, THROW_HEIGHT } from './visuals';

/**
 * The pictures of what flies through the air, by kind, and of the burst
 * where it lands, as the scenery atlas names them.
 */
export const PROJECTILE_FRAMES: Record<ProjectileKind, string> = {
  arrow: 'arrow',
  javelin: 'javelin',
};
export const HIT_FRAME = 'hit';

/**
 * How far above the ground something lands on a target, in pixels: at the
 * chest of a unit, and half-way up the wall of a building. Undefined for
 * the chest of a unit, which is what the flight is drawn for unless told.
 */
export function landHeight(target: Entity | undefined): number | undefined {
  if (target?.kind !== 'building') return undefined;
  return BUILDING_VISUALS[target.type].wallHeight * UI_CONFIG.projectile.buildingHitShare;
}

/** In front of everything standing on the map: an arrow flies over roofs and trees. */
const DEPTH = 800_000;

/** What is drawn of the projectiles right now, for tests. */
export interface ProjectileInfo {
  /** Where each projectile in sight is on the screen's world, how it is turned in radians, and its picture. */
  projectiles: {
    id: number;
    x: number;
    y: number;
    rotation: number;
    texture: string;
    frame: string;
  }[];
  /** How many bursts are showing where projectiles have just landed. */
  bursts: number;
  /** How many bursts have been shown since the game started. */
  burstsShown: number;
}

/**
 * Draws what is in the air: each projectile as an arrow or a javelin in the
 * colour of the side that sent it, flying in an arc from the top of its
 * tower or the hand of its thrower and pointing the way it goes, and a
 * short burst where one lands.
 */
export class ProjectileView {
  private readonly arrows = new Map<number, GameObjects.Image>();
  /**
   * How high each projectile was let go, in pixels. Kept from when it is
   * first drawn: its tower or thrower may be gone before it lands.
   */
  private readonly muzzles = new Map<number, number>();
  private bursts: { image: GameObjects.Image; since: number }[] = [];
  private burstsShown = 0;
  private now = 0;

  /**
   * @param textureOf Key of the scenery texture in a side's colour.
   */
  constructor(
    private readonly scene: Scene,
    private readonly size: TileSize,
    private readonly textureOf: (owner: number) => string,
  ) {}

  /**
   * @param alpha How far into the next simulation step the frame is, from 0 to 1.
   * @param now Frame time in milliseconds.
   * @param isVisible Whether the player can see a tile; what flies over hidden ground is not drawn.
   */
  update(
    state: GameState,
    alpha: number,
    now: number,
    isVisible: (tileX: number, tileY: number) => boolean,
  ): void {
    this.now = now;
    const seen = new Set<number>();
    for (const projectile of state.projectiles) {
      seen.add(projectile.id);
      const at = {
        x: projectile.prevX + (projectile.x - projectile.prevX) * alpha,
        y: projectile.prevY + (projectile.y - projectile.prevY) * alpha,
      };
      const target = state.entities.find((entity) => entity.id === projectile.targetId);
      const aim =
        target?.kind === 'unit'
          ? {
              x: target.prevX + (target.x - target.prevX) * alpha,
              y: target.prevY + (target.y - target.prevY) * alpha,
            }
          : target?.kind === 'building'
            ? buildingCentre(target)
            : at;
      let muzzle = this.muzzles.get(projectile.id);
      if (muzzle === undefined) {
        const source = state.entities.find((entity) => entity.id === projectile.sourceId);
        muzzle =
          (source?.kind === 'building' ? MUZZLE_HEIGHT[source.type] : undefined) ??
          (source?.kind === 'unit' ? THROW_HEIGHT[source.type] : undefined) ??
          0;
        this.muzzles.set(projectile.id, muzzle);
      }
      const pose = projectilePose(
        { x: projectile.startX, y: projectile.startY },
        at,
        aim,
        muzzle,
        this.size,
        landHeight(target),
      );
      let image = this.arrows.get(projectile.id);
      if (!image) {
        image = this.scene.add
          .image(
            pose.x,
            pose.y,
            this.textureOf(projectile.owner),
            PROJECTILE_FRAMES[projectile.kind],
          )
          .setDepth(DEPTH);
        this.arrows.set(projectile.id, image);
      }
      image
        .setPosition(pose.x, pose.y)
        .setRotation(pose.rotation)
        .setVisible(isVisible(Math.floor(at.x), Math.floor(at.y)));
    }
    for (const [id, image] of this.arrows) {
      if (seen.has(id)) continue;
      image.destroy();
      this.arrows.delete(id);
      this.muzzles.delete(id);
    }

    this.bursts = this.bursts.filter((burst) => {
      const look = hitBurstAt(now - burst.since);
      if (!look) {
        burst.image.destroy();
        return false;
      }
      burst.image.setAlpha(look.alpha).setScale(look.scale);
      return true;
    });
  }

  /**
   * Shows the burst of a projectile that has landed at a place in tiles.
   * @param heightPx How far above the ground it landed; the chest of a unit unless given.
   */
  showHit(tileX: number, tileY: number, heightPx?: number): void {
    const ground = tileToWorld(tileX, tileY, this.size);
    const height = heightPx ?? UI_CONFIG.projectile.targetHeightPx;
    const image = this.scene.add
      .image(ground.x, ground.y - height, this.textureOf(0), HIT_FRAME)
      .setDepth(DEPTH + 1);
    // The picture stands on the ground under the burst. Here the middle of
    // the burst itself is put on the unit, and it grows from there: the
    // middle of what is left of the picture after the empty space round it
    // was trimmed away.
    const { frame } = image;
    image.setOrigin(
      (frame.x + frame.cutWidth / 2) / frame.realWidth,
      (frame.y + frame.cutHeight / 2) / frame.realHeight,
    );
    const look = hitBurstAt(0);
    if (look) image.setAlpha(look.alpha).setScale(look.scale);
    this.bursts.push({ image, since: this.now });
    this.burstsShown++;
  }

  /** What is drawn right now. */
  describe(): ProjectileInfo {
    return {
      projectiles: [...this.arrows]
        .filter(([, image]) => image.visible)
        .map(([id, image]) => ({
          id,
          x: image.x,
          y: image.y,
          rotation: image.rotation,
          texture: image.texture.key,
          frame: image.frame.name,
        })),
      bursts: this.bursts.length,
      burstsShown: this.burstsShown,
    };
  }
}
