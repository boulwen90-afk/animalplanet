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

/** A building atlas as built by `npm run build:characters`. The game does not draw them yet. */
const read = (name: string) =>
  JSON.parse(readFileSync(`assets/buildings/${name}/${name}.json`, 'utf8')) as Atlas;

/** The buildings of the bears, and the lowest roof the size standard allows, in tile widths. */
const BUILDINGS: { name: string; building: BuildingType; sizeClass: string; tileWidths: number }[] =
  [
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

  it('even the smallest building is clearly taller than a warrior', () => {
    expect(roof('bear_storage')).toBeGreaterThan(warrior.meta.figure.height * 1.8);
  });

  it('the main building is the tallest, then the barracks, then the storehouse', () => {
    expect(roof('bear_main')).toBeGreaterThan(roof('bear_barracks'));
    expect(roof('bear_barracks')).toBeGreaterThan(roof('bear_storage'));
  });
});
