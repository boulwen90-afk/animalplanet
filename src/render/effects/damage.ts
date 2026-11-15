import { UI_CONFIG } from '../../data/ui';

/**
 * How a damaged building shows it: where the smoke and the flames sit on
 * it, and what each puff and flame looks like at a given moment. Pure
 * functions, so they can be tested without a browser.
 */

/** The pictures of a puff of smoke and of a fire, as the scenery atlas names them. */
export const SMOKE_FRAMES = ['smoke_1', 'smoke_2', 'smoke_3'] as const;
export const FIRE_FRAMES = ['fire_1', 'fire_2', 'fire_3', 'fire_4'] as const;

/** `smoke`: the building smokes. `fire`: it burns as well. */
export type DamageLevel = 'none' | 'smoke' | 'fire';

/**
 * How badly hurt a building looks. A building under construction has little
 * life because it is not finished, not because it is damaged: it shows nothing.
 */
export function damageLevel(hp: number, maxHp: number, complete: boolean): DamageLevel {
  if (!complete || maxHp <= 0) return 'none';
  const share = hp / maxHp;
  if (share < UI_CONFIG.damage.fireBelow) return 'fire';
  if (share < UI_CONFIG.damage.smokeBelow) return 'smoke';
  return 'none';
}

/** A number from 0 up to 1 that is always the same for the same two whole numbers. */
function noise(a: number, b: number): number {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return ((h >>> 0) % 1000) / 1000;
}

/** A place on a building that smokes or burns, in pixels from the middle of its footprint on the ground; up is negative y. */
export interface DamageSource {
  x: number;
  y: number;
}

/**
 * Where a building smokes and burns: one place for each tile of its
 * footprint's side, spread across the roof. The places differ from building
 * to building but are always the same for the same building.
 *
 * @param roofHeight How far above the ground the top of the building is, in pixels.
 */
export function damageSources(
  buildingId: number,
  size: number,
  roofHeight: number,
  tile: { tileWidth: number; tileHeight: number },
): DamageSource[] {
  const { spread, lowest, highest } = UI_CONFIG.damage.sources;
  const sources: DamageSource[] = [];
  for (let i = 0; i < size; i++) {
    // Across the footprint from one side to the other, and anywhere along it.
    const u = ((i + 0.5) / size - 0.5) * size * spread;
    const v = (noise(buildingId, i) - 0.5) * size * spread;
    const height = roofHeight * (lowest + (highest - lowest) * noise(buildingId + 7, i));
    sources.push({
      x: ((u - v) * tile.tileWidth) / 2,
      y: ((u + v) * tile.tileHeight) / 2 - height,
    });
  }
  return sources;
}

/** What one puff of smoke looks like right now. */
export interface Puff {
  frame: string;
  /** Where it is, in pixels from its source: it rises and drifts a little to the right. */
  x: number;
  y: number;
  alpha: number;
  scale: number;
}

/**
 * The puff with number `index` in the column of smoke from a source, at a
 * time in milliseconds. The puffs of a column follow each other at even
 * spacing; each rises, grows and fades, and then starts over.
 */
export function puffAt(now: number, source: number, index: number): Puff {
  const { puffs, puffMs, risePx, driftPx, puffAlpha, puffScale } = UI_CONFIG.damage;
  // Columns are out of step with each other, so that a roof does not puff in time.
  const phase = (now / puffMs + index / puffs + noise(source, 3)) % 1;
  // It comes out of the roof over the first sixth of its way, and thins out towards the top.
  const fadeIn = Math.min(1, phase * 6);
  return {
    frame: SMOKE_FRAMES[(source + index) % SMOKE_FRAMES.length] as string,
    x: phase * driftPx,
    y: -phase * risePx,
    alpha: puffAlpha * fadeIn * (1 - phase * phase),
    scale: puffScale.start + (puffScale.end - puffScale.start) * phase,
  };
}

/** The picture a fire shows at a time in milliseconds; fires side by side are out of step. */
export function flameFrameAt(now: number, source: number): string {
  const step = Math.floor(now / UI_CONFIG.damage.flameMs) + source;
  return FIRE_FRAMES[step % FIRE_FRAMES.length] as string;
}
