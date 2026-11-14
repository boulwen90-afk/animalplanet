import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BUILDING_DEFS, type BuildingType } from '../../data/buildings';
import { MAP_CONFIG } from '../../data/map';

interface Atlas {
  frames: Record<
    string,
    { anchor: { x: number; y: number }; sourceSize: { w: number; h: number } }
  >;
  meta: {
    stages: string[];
    building: {
      gameBuilding: string;
      sizeClass: string;
      footprint: number;
      roofHeight: number;
      minRoofHeight: number;
    };
  };
}

/** A building atlas as built by `npm run build:characters`. */
const read = (name: string) =>
  JSON.parse(readFileSync(`assets/buildings/${name}/${name}.json`, 'utf8')) as Atlas;

/** The buildings of the bears, and the lowest roof the size standard allows, in tile widths. */
const BUILDINGS: { name: string; building: BuildingType; sizeClass: string; tileWidths: number }[] =
  [
    // A field is ground, not a house: the standard asks no height of it.
    { name: 'bear_field', building: 'odling', sizeClass: 'plot', tileWidths: 0 },
    { name: 'bear_den', building: 'ide', sizeClass: 'small', tileWidths: 1.0 },
    { name: 'bear_fishery', building: 'fiskehytta', sizeClass: 'small', tileWidths: 1.0 },
    { name: 'bear_storage', building: 'visthus', sizeClass: 'small', tileWidths: 1.0 },
    { name: 'bear_barracks', building: 'krigshall', sizeClass: 'large', tileWidths: 1.4 },
    { name: 'bear_main', building: 'storide', sizeClass: 'main', tileWidths: 1.8 },
  ];

describe.each(BUILDINGS)('the $name atlas', ({ name, building, sizeClass, tileWidths }) => {
  const atlas = read(name);

  it('is built for the building in the game, on a footprint of the same size', () => {
    expect(atlas.meta.building.gameBuilding).toBe(building);
    expect(atlas.meta.building.footprint).toBe(BUILDING_DEFS[building].size);
  });

  it(`follows the size standard: a ${sizeClass} building is at least ${tileWidths} tile widths tall`, () => {
    expect(atlas.meta.building.sizeClass).toBe(sizeClass);
    expect(atlas.meta.building.minRoofHeight / MAP_CONFIG.tileWidth).toBeCloseTo(tileWidths, 2);
    expect(atlas.meta.building.roofHeight).toBeGreaterThanOrEqual(
      atlas.meta.building.minRoofHeight,
    );
  });

  it('has a picture of each stage and of its shadow, all standing on the same point', () => {
    expect(atlas.meta.stages).toEqual(['construction_1', 'construction_2', 'complete']);
    for (const frame of [...atlas.meta.stages, 'shadow']) {
      expect(atlas.frames[frame], frame).toBeDefined();
    }
    const anchors = new Set(Object.values(atlas.frames).map((f) => `${f.anchor.x},${f.anchor.y}`));
    expect(anchors.size).toBe(1);
  });
});

describe('the buildings against each other and the figures', () => {
  const roof = (name: string) => read(name).meta.building.roofHeight;
  const warrior = JSON.parse(
    readFileSync('assets/characters/bear_warrior/bear_warrior.json', 'utf8'),
  ) as { meta: { figure: { height: number } } };

  it('even the smallest houses are clearly taller than a warrior', () => {
    for (const house of ['bear_den', 'bear_fishery', 'bear_storage']) {
      expect(roof(house), house).toBeGreaterThan(warrior.meta.figure.height * 1.8);
    }
  });

  it('a field is lower than the house beside it, and its fence no higher than a worker', () => {
    const worker = JSON.parse(
      readFileSync('assets/characters/bear_worker/bear_worker.json', 'utf8'),
    ) as { meta: { figure: { height: number } } };
    expect(roof('bear_field')).toBeLessThan(roof('bear_storage'));
    // The scarecrow is the tallest thing on it: about as tall as the worker.
    expect(roof('bear_field')).toBeLessThan(worker.meta.figure.height * 1.3);
  });

  it('the main building is the tallest, then the barracks, then the storehouse', () => {
    expect(roof('bear_main')).toBeGreaterThan(roof('bear_barracks'));
    expect(roof('bear_barracks')).toBeGreaterThan(roof('bear_storage'));
  });
});
