import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MAP_CONFIG } from '../../data/map';
import { UNIT_DEFS } from '../../data/units';
import { CHARACTER_VISUALS } from '../views/visuals';
import { DIRECTIONS } from './animation';

/** The atlas file of the bear warrior, as built by `npm run build:characters`. */
const atlas = JSON.parse(
  readFileSync('assets/characters/bear_warrior/bear_warrior.json', 'utf8'),
) as {
  frames: Record<string, { anchor: { x: number; y: number } }>;
  meta: {
    directions: string[];
    figure: { sizeClass: string; height: number };
    animations: Record<string, { frames: number; distance?: number }>;
  };
};

describe('the bear warrior atlas', () => {
  it('has every animation the game plays, in all eight directions', () => {
    expect(atlas.meta.directions).toEqual([...DIRECTIONS]);
    for (const name of ['idle', 'walk', 'attack', 'defeat']) {
      const info = atlas.meta.animations[name];
      expect(info, name).toBeDefined();
      for (const direction of DIRECTIONS) {
        for (let frame = 0; frame < info!.frames; frame++) {
          expect(
            atlas.frames[`${name}_${direction}_${frame}`],
            `${name} ${direction} ${frame}`,
          ).toBeDefined();
        }
      }
    }
  });

  it('follows the size standard: a warrior is 0.55 tile widths tall', () => {
    expect(atlas.meta.figure.sizeClass).toBe('warrior');
    expect(atlas.meta.figure.height / MAP_CONFIG.tileWidth).toBeCloseTo(0.55, 2);
  });

  it('matches what the game takes the figure to be', () => {
    // Clicks, the life bar and the selection ring are placed by this height.
    const visual = CHARACTER_VISUALS.ramkrigare!;
    expect(visual.height).toBeGreaterThanOrEqual(atlas.meta.figure.height);
    expect(visual.height).toBeLessThanOrEqual(atlas.meta.figure.height + 10);
  });

  it('gives the run a distance, so that the game can keep the feet from sliding', () => {
    const { distance, frames } = atlas.meta.animations.walk!;
    expect(distance).toBeGreaterThan(0.5);
    expect(distance).toBeLessThan(1.5);
    // At the Ramkrigare's speed that is between 10 and 30 pictures a second.
    const perSecond = (UNIT_DEFS.ramkrigare.speed / distance!) * frames;
    expect(perSecond).toBeGreaterThan(10);
    expect(perSecond).toBeLessThan(30);
  });

  it('stands every picture on the same point: between the feet', () => {
    const anchors = new Set(Object.values(atlas.frames).map((f) => `${f.anchor.x},${f.anchor.y}`));
    expect(anchors.size).toBe(1);
  });
});
