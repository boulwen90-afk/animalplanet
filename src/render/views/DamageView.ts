import type { GameObjects, Scene } from 'phaser';
import { UI_CONFIG } from '../../data/ui';
import type { TileSize } from '../../sim/map/iso';
import {
  damageSources,
  flameFrameAt,
  puffAt,
  type DamageLevel,
  type DamageSource,
} from '../effects/damage';

/** How far in front of its building the smoke and the flames are drawn, in depth. */
const IN_FRONT = 0.5;

interface Shown {
  level: DamageLevel;
  sources: DamageSource[];
  /** The puffs of each source's column of smoke, source by source. */
  puffs: GameObjects.Image[];
  /** One fire for each source, while the building burns. */
  flames: GameObjects.Image[];
}

/** What the damage on a building looks like right now, for tests. */
export interface DamageInfo {
  level: DamageLevel;
  /** How many puffs of smoke and how many fires are drawn on it. */
  puffs: number;
  flames: number;
}

/**
 * Draws the damage on buildings: columns of smoke on one that has lost half
 * its life, and fires under them on one that has lost three quarters. The
 * pictures come from the scenery atlas; where they are and how they look at
 * each moment is worked out in effects/damage.ts.
 *
 * Each frame: `begin`, then `show` for every damaged building in sight, then `end`.
 */
export class DamageView {
  private readonly shown = new Map<number, Shown>();
  private readonly seen = new Set<number>();
  private now = 0;

  constructor(
    private readonly scene: Scene,
    private readonly size: TileSize,
    /** Key of the texture with the pictures of smoke and fire. */
    private readonly texture: string,
  ) {}

  /** Starts a frame at a time in milliseconds. */
  begin(now: number): void {
    this.now = now;
    this.seen.clear();
  }

  /**
   * Draws a building's damage this frame.
   * @param ground The middle of its footprint on the ground, in world pixels.
   * @param depth The depth its picture is drawn at.
   * @param side The side of its footprint in tiles.
   * @param roofHeight How far above the ground its top is, in pixels.
   */
  show(
    id: number,
    level: DamageLevel,
    ground: { x: number; y: number },
    depth: number,
    side: number,
    roofHeight: number,
  ): void {
    if (level === 'none') return;
    this.seen.add(id);
    let entry = this.shown.get(id);
    if (!entry) {
      entry = {
        level,
        sources: damageSources(id, side, roofHeight, this.size),
        puffs: [],
        flames: [],
      };
      this.shown.set(id, entry);
    }
    entry.level = level;
    const { puffs, flameScale, smokeAboveFire } = UI_CONFIG.damage;
    const burning = level === 'fire';

    const wantedPuffs = entry.sources.length * puffs;
    while (entry.puffs.length < wantedPuffs) {
      entry.puffs.push(this.scene.add.image(0, 0, this.texture, puffAt(0, 0, 0).frame));
    }
    const wantedFlames = burning ? entry.sources.length : 0;
    while (entry.flames.length < wantedFlames) {
      entry.flames.push(this.scene.add.image(0, 0, this.texture, flameFrameAt(0, 0)));
    }
    while (entry.flames.length > wantedFlames) entry.flames.pop()?.destroy();

    entry.sources.forEach((source, s) => {
      const x = ground.x + source.x;
      const y = ground.y + source.y;
      for (let i = 0; i < puffs; i++) {
        const puff = puffAt(this.now, id + s, i);
        const image = entry.puffs[s * puffs + i];
        if (!image) continue;
        if (image.frame.name !== puff.frame) image.setFrame(puff.frame);
        image
          .setPosition(x + puff.x, y + puff.y - (burning ? smokeAboveFire : 0))
          .setAlpha(puff.alpha)
          .setScale(puff.scale)
          // Smoke is in front of the fire it rises from.
          .setDepth(depth + IN_FRONT + 0.01);
      }
      const flame = entry.flames[s];
      if (flame) {
        const frame = flameFrameAt(this.now, id + s);
        if (flame.frame.name !== frame) flame.setFrame(frame);
        flame
          .setPosition(x, y)
          .setScale(flameScale)
          .setDepth(depth + IN_FRONT);
      }
    });
  }

  /** Ends a frame: what was not shown in it is taken away. */
  end(): void {
    for (const [id, entry] of this.shown) {
      if (this.seen.has(id)) continue;
      for (const image of [...entry.puffs, ...entry.flames]) image.destroy();
      this.shown.delete(id);
    }
  }

  /** What is drawn on a building right now. */
  describe(id: number): DamageInfo {
    const entry = this.shown.get(id);
    if (!entry) return { level: 'none', puffs: 0, flames: 0 };
    return { level: entry.level, puffs: entry.puffs.length, flames: entry.flames.length };
  }
}
