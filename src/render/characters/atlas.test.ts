import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MAP_CONFIG } from '../../data/map';
import type { UnitType } from '../../data/types';
import { UNIT_DEFS } from '../../data/units';
import { CHARACTER_VISUALS } from '../views/visuals';
import { DIRECTIONS } from './animation';

interface Atlas {
  frames: Record<string, { anchor: { x: number; y: number } }>;
  meta: {
    directions: string[];
    figure: { sizeClass: string; height: number };
    animations: Record<string, { frames: number; distance?: number }>;
  };
}

/** An atlas file as built by `npm run build:characters`. */
const read = (name: string) =>
  JSON.parse(readFileSync(`assets/characters/${name}/${name}.json`, 'utf8')) as Atlas;

/** The figures in the game: what each is drawn for, and what the size standard says of it. */
const FIGURES: {
  name: string;
  unit: UnitType;
  sizeClass: string;
  tileWidths: number;
  animations: string[];
}[] = [
  {
    name: 'bear_warrior',
    unit: 'ramkrigare',
    sizeClass: 'warrior',
    tileWidths: 0.55,
    animations: ['idle', 'walk', 'attack', 'defeat'],
  },
  {
    name: 'bear_worker',
    unit: 'samlare',
    sizeClass: 'worker',
    tileWidths: 0.46,
    animations: ['idle', 'walk', 'gather', 'defeat'],
  },
];

describe.each(FIGURES)('the $name atlas', ({ name, unit, sizeClass, tileWidths, animations }) => {
  const atlas = read(name);

  it('has every animation the game plays, in all eight directions', () => {
    expect(atlas.meta.directions).toEqual([...DIRECTIONS]);
    for (const animation of animations) {
      const info = atlas.meta.animations[animation];
      expect(info, animation).toBeDefined();
      for (const direction of DIRECTIONS) {
        for (let frame = 0; frame < info!.frames; frame++) {
          expect(
            atlas.frames[`${animation}_${direction}_${frame}`],
            `${animation} ${direction} ${frame}`,
          ).toBeDefined();
        }
      }
    }
  });

  it(`follows the size standard: a ${sizeClass} is ${tileWidths} tile widths tall`, () => {
    expect(atlas.meta.figure.sizeClass).toBe(sizeClass);
    expect(atlas.meta.figure.height / MAP_CONFIG.tileWidth).toBeCloseTo(tileWidths, 2);
  });

  it('matches what the game takes the figure to be', () => {
    // Clicks, the life bar and the selection ring are placed by this height.
    const visual = CHARACTER_VISUALS[unit]!;
    expect(visual.height).toBeGreaterThanOrEqual(atlas.meta.figure.height);
    expect(visual.height).toBeLessThanOrEqual(atlas.meta.figure.height + 10);
  });

  it('gives the run a distance, so that the game can keep the feet from sliding', () => {
    const { distance, frames } = atlas.meta.animations.walk!;
    expect(distance).toBeGreaterThan(0.5);
    expect(distance).toBeLessThan(1.5);
    // At the unit's speed that is between 10 and 40 pictures a second.
    const perSecond = (UNIT_DEFS[unit].speed / distance!) * frames;
    expect(perSecond).toBeGreaterThan(10);
    expect(perSecond).toBeLessThan(40);
  });

  it('stands every picture on the same point: between the feet', () => {
    const anchors = new Set(Object.values(atlas.frames).map((f) => `${f.anchor.x},${f.anchor.y}`));
    expect(anchors.size).toBe(1);
  });
});

describe('the figures against each other', () => {
  it('a worker is shorter than a warrior', () => {
    const [warrior, worker] = FIGURES.map((figure) => read(figure.name).meta.figure.height);
    expect(worker).toBeLessThan(warrior!);
  });
});
