import { describe, expect, it } from 'vitest';
import { UI_CONFIG } from '../../data/ui';
import sceneryAtlas from '../../../assets/scenery/scenery.json';
import {
  FIRE_FRAMES,
  SMOKE_FRAMES,
  damageLevel,
  damageSources,
  flameFrameAt,
  puffAt,
} from './damage';

const TILE = { tileWidth: 64, tileHeight: 32 };
const { damage } = UI_CONFIG;

describe('damageLevel', () => {
  it('smokes below half its life and burns below a quarter', () => {
    expect(damage.smokeBelow).toBe(0.5);
    expect(damage.fireBelow).toBe(0.25);
    expect(damageLevel(400, 400, true)).toBe('none');
    expect(damageLevel(200, 400, true)).toBe('none');
    expect(damageLevel(199, 400, true)).toBe('smoke');
    expect(damageLevel(100, 400, true)).toBe('smoke');
    expect(damageLevel(99, 400, true)).toBe('fire');
    expect(damageLevel(1, 400, true)).toBe('fire');
  });

  it('shows nothing on a building under construction, however little life it has', () => {
    expect(damageLevel(40, 400, false)).toBe('none');
  });
});

describe('damageSources', () => {
  it('gives one place for each tile of the building`s side', () => {
    expect(damageSources(3, 2, 70, TILE)).toHaveLength(2);
    expect(damageSources(3, 3, 100, TILE)).toHaveLength(3);
  });

  it('always gives the same building the same places, and different buildings different ones', () => {
    expect(damageSources(11, 3, 100, TILE)).toEqual(damageSources(11, 3, 100, TILE));
    expect(damageSources(11, 3, 100, TILE)).not.toEqual(damageSources(12, 3, 100, TILE));
  });

  it('keeps every place on the building: over its footprint and no higher than its roof', () => {
    for (let id = 1; id <= 40; id++) {
      for (const size of [2, 3]) {
        const roof = 90;
        for (const source of damageSources(id, size, roof, TILE)) {
          // Back on the ground under it, the place is inside the footprint's diamond.
          const height = -source.y;
          expect(height).toBeGreaterThan(0);
          const reach = (size * TILE.tileWidth) / 2;
          expect(Math.abs(source.x)).toBeLessThan(reach);
          expect(height).toBeLessThanOrEqual(roof * damage.sources.highest + reach / 2);
        }
      }
    }
  });
});

describe('puffAt', () => {
  it('rises, grows and thins out, and then starts over', () => {
    const start = puffAt(0, 0, 0);
    const steps = Array.from({ length: 20 }, (_, i) => puffAt((i * damage.puffMs) / 20, 0, 0));
    // One full turn brings it back to where it was.
    expect(puffAt(damage.puffMs, 0, 0)).toEqual(start);
    const heights = steps.map((puff) => -puff.y);
    expect(Math.max(...heights)).toBeGreaterThan(damage.risePx * 0.9);
    expect(Math.max(...heights)).toBeLessThanOrEqual(damage.risePx);
    for (const puff of steps) {
      expect(puff.alpha).toBeGreaterThanOrEqual(0);
      expect(puff.alpha).toBeLessThanOrEqual(damage.puffAlpha);
      expect(puff.scale).toBeGreaterThanOrEqual(damage.puffScale.start);
      expect(puff.scale).toBeLessThanOrEqual(damage.puffScale.end);
    }
    // The higher a puff is, the larger it has grown.
    const sorted = [...steps].sort((a, b) => b.y - a.y);
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i]!.scale).toBeGreaterThanOrEqual(sorted[i - 1]!.scale);
    }
  });

  it('spaces the puffs of a column evenly, so that the smoke never stops', () => {
    const heights = Array.from({ length: damage.puffs }, (_, i) => -puffAt(500, 4, i).y).sort(
      (a, b) => a - b,
    );
    for (let i = 1; i < heights.length; i++) {
      expect(heights[i]! - heights[i - 1]!).toBeCloseTo(damage.risePx / damage.puffs, 6);
    }
  });

  it('is nearly gone where it starts and where it ends, so that it never pops in or out', () => {
    // Just before and just after the moment a puff starts over.
    const turn = damage.puffMs;
    let lowest = Infinity;
    for (let t = 0; t < turn; t += 5) lowest = Math.min(lowest, puffAt(t, 0, 0).alpha);
    expect(lowest).toBeLessThan(0.05);
  });
});

describe('flameFrameAt', () => {
  it('goes through the four pictures of a fire in turn, one every 110 ms', () => {
    expect(damage.flameMs).toBe(110);
    const seen = [0, 1, 2, 3, 4].map((i) => flameFrameAt(i * damage.flameMs, 0));
    expect(seen).toEqual([...FIRE_FRAMES, FIRE_FRAMES[0]]);
    expect(flameFrameAt(damage.flameMs - 1, 0)).toBe(FIRE_FRAMES[0]);
  });

  it('puts fires side by side out of step', () => {
    expect(flameFrameAt(0, 1)).not.toBe(flameFrameAt(0, 0));
  });
});

describe('the pictures of smoke and fire', () => {
  const frames = sceneryAtlas.frames as Record<string, unknown>;
  const items = sceneryAtlas.meta.scenery.items as Record<string, { kind: string; height: number }>;

  it('are all in the scenery atlas, with the hammer that marks a repair', () => {
    for (const frame of [...SMOKE_FRAMES, ...FIRE_FRAMES, 'icon_repair']) {
      expect(frames[frame], frame).toBeDefined();
    }
  });

  it('are small beside a building: a puff or a fire is no taller than a Samlare', () => {
    for (const frame of [...SMOKE_FRAMES, ...FIRE_FRAMES]) {
      expect(items[frame]!.kind, frame).toBe('effect');
      expect(items[frame]!.height, frame).toBeGreaterThanOrEqual(13);
      expect(items[frame]!.height, frame).toBeLessThanOrEqual(35);
    }
  });

  it('the hammer fits in a mouse pointer of 32 pixels', () => {
    const hammer = (frames.icon_repair as { frame: { w: number; h: number } }).frame;
    expect(hammer.w).toBeLessThanOrEqual(32);
    expect(hammer.h).toBeLessThanOrEqual(32);
  });
});
