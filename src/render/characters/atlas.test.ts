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
    figure: { sizeClass: string; height: number; speed?: number };
    animations: Record<string, { frames: number; distance?: number; loopsPerSecond?: number }>;
    loopsPerSecondRange: [number, number];
    layers: string[];
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
  /** The layers the game draws on top of the figure. */
  layers: string[];
}[] = [
  {
    name: 'bear_warrior',
    unit: 'ramkrigare',
    sizeClass: 'warrior',
    tileWidths: 0.55,
    animations: ['idle', 'walk', 'attack', 'defeat'],
    layers: [],
  },
  {
    name: 'bear_worker',
    unit: 'samlare',
    sizeClass: 'worker',
    tileWidths: 0.46,
    animations: ['idle', 'walk', 'chop', 'pick', 'hammer', 'defeat'],
    layers: ['load_wood', 'load_food'],
  },
];

describe.each(FIGURES)('the $name atlas', (figure) => {
  const { name, unit, sizeClass, tileWidths, animations, layers } = figure;
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
    const { distance } = atlas.meta.animations.walk!;
    expect(distance).toBeGreaterThan(0.5);
    expect(distance).toBeLessThan(1.5);
  });

  it("was built for the unit's speed in the game", () => {
    // The pipeline has the speed in its own config; it must not drift from the game's.
    expect(atlas.meta.figure.speed).toBe(UNIT_DEFS[unit].speed);
  });

  it('keeps the legs within the allowed pace at that speed', () => {
    const { distance, loopsPerSecond } = atlas.meta.animations.walk!;
    const [slowest, fastest] = atlas.meta.loopsPerSecondRange;
    // One loop is a step with each foot.
    const inGame = UNIT_DEFS[unit].speed / distance!;
    expect(loopsPerSecond).toBeCloseTo(inGame, 2);
    expect(inGame).toBeGreaterThanOrEqual(slowest - 0.01);
    expect(inGame).toBeLessThanOrEqual(fastest + 0.01);
  });

  it('has its layers as pictures of their own, one for every picture of the figure', () => {
    expect(atlas.meta.layers).toEqual(layers);
    const own = Object.keys(atlas.frames).filter((frame) => !frame.includes('.'));
    for (const layer of layers) {
      for (const frame of own) {
        expect(atlas.frames[`${layer}.${frame}`], `${layer}.${frame}`).toBeDefined();
      }
    }
    expect(Object.keys(atlas.frames)).toHaveLength(own.length * (1 + layers.length));
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

  it('a tiger warrior is a tenth taller than a bear warrior: the same class, another stature', () => {
    // The tigers are not in the game yet; their first figure is built to prepare for them.
    const tiger = read('tiger_raider').meta;
    const bear = read('bear_warrior').meta;
    expect(tiger.figure.sizeClass).toBe('warrior');
    expect(tiger.figure.height / bear.figure.height).toBeCloseTo(1.1, 2);
    for (const animation of ['idle', 'walk', 'attack', 'defeat']) {
      expect(tiger.animations[animation], animation).toBeDefined();
    }
    const [slowest, fastest] = tiger.loopsPerSecondRange;
    const pace = tiger.animations.walk!.loopsPerSecond!;
    expect(pace).toBeGreaterThanOrEqual(slowest);
    expect(pace).toBeLessThanOrEqual(fastest);
  });
});
