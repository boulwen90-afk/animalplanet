import { describe, expect, it } from 'vitest';
import { MAP_GEN_CONFIG } from '../data/map';
import { BUILDING_DEFS } from '../data/buildings';
import { UNIT_DEFS } from '../data/units';
import { buildingCentre, buildingTiles, buildings, units } from './entities';
import { createGame } from './game';
import { isWalkable } from './map/grid';
import { advance, tick } from './tick';

describe('createGame', () => {
  it('starts at tick 0 with the given seed', () => {
    const state = createGame(5);
    expect(state.seed).toBe(5);
    expect(state.tick).toBe(0);
    expect(state.map.startPositions).toEqual(MAP_GEN_CONFIG.startPositions);
  });

  it('gives an identical state for the same seed', () => {
    expect(createGame(11)).toEqual(createGame(11));
  });

  it('gives different maps for different seeds', () => {
    expect(createGame(1).map.terrain).not.toEqual(createGame(2).map.terrain);
  });

  it('is plain data that survives a JSON round trip', () => {
    const state = createGame(3);
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });
});

describe('starting entities', () => {
  const SEEDS = [1, 2, 3, 7, 42, 1000];

  it('gives each side one Storide centred on its start position', () => {
    for (const seed of SEEDS) {
      const state = createGame(seed);
      const all = buildings(state);
      expect(all).toHaveLength(2);
      for (const owner of [0, 1] as const) {
        const storide = all.find((b) => b.owner === owner)!;
        const start = state.map.startPositions[owner]!;
        expect(storide.type).toBe('storide');
        expect(storide.hp).toBe(BUILDING_DEFS.storide.hp);
        expect(buildingCentre(storide)).toEqual({ x: start.x + 0.5, y: start.y + 0.5 });
        for (const tile of buildingTiles(storide)) {
          expect(isWalkable(state.map, tile.x, tile.y), `seed ${seed}`).toBe(true);
        }
      }
    }
  });

  it('gives each side three Samlare on separate free tiles close to its Storide', () => {
    for (const seed of SEEDS) {
      const state = createGame(seed);
      for (const owner of [0, 1] as const) {
        const storide = buildings(state).find((b) => b.owner === owner)!;
        const footprint = buildingTiles(storide);
        const mine = units(state).filter((u) => u.owner === owner);
        expect(mine).toHaveLength(3);
        expect(new Set(mine.map((u) => `${u.x},${u.y}`)).size).toBe(3);
        for (const unit of mine) {
          const tile = { x: Math.floor(unit.x), y: Math.floor(unit.y) };
          expect(unit.type).toBe('samlare');
          expect(unit.hp).toBe(UNIT_DEFS.samlare.hp);
          expect(unit.path).toEqual([]);
          expect(isWalkable(state.map, tile.x, tile.y)).toBe(true);
          expect(footprint).not.toContainEqual(tile);
          // No more than two tiles from the building.
          const gap = Math.min(
            ...footprint.map((f) => Math.max(Math.abs(f.x - tile.x), Math.abs(f.y - tile.y))),
          );
          expect(gap, `seed ${seed}`).toBeLessThanOrEqual(2);
        }
      }
    }
  });

  it('places the starting units in front of the Storide, where it does not hide them', () => {
    for (const seed of SEEDS) {
      const state = createGame(seed);
      for (const owner of [0, 1] as const) {
        const storide = buildings(state).find((b) => b.owner === owner)!;
        // The front row and column of the footprint are the ones furthest down the screen.
        const frontX = storide.x + BUILDING_DEFS.storide.size - 1;
        const frontY = storide.y + BUILDING_DEFS.storide.size - 1;
        for (const unit of units(state).filter((u) => u.owner === owner)) {
          const tile = { x: Math.floor(unit.x), y: Math.floor(unit.y) };
          expect(tile.x > frontX || tile.y > frontY, `seed ${seed}`).toBe(true);
          // Further down the screen than the middle of the building.
          const centre = buildingCentre(storide);
          expect(unit.x + unit.y).toBeGreaterThan(centre.x + centre.y);
        }
      }
    }
  });

  it('gives every entity its own id', () => {
    const state = createGame(1);
    const ids = state.entities.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(state.nextEntityId).toBeGreaterThan(Math.max(...ids));
  });
});

describe('tick', () => {
  it('advances the tick counter by one', () => {
    const state = createGame(1);
    tick(state);
    expect(state.tick).toBe(1);
  });

  it('advance runs the given number of steps', () => {
    const state = createGame(1);
    advance(state, 40);
    expect(state.tick).toBe(40);
    advance(state, 0);
    expect(state.tick).toBe(40);
  });

  it('two games with the same seed stay identical as they advance', () => {
    const a = createGame(8);
    const b = createGame(8);
    advance(a, 100);
    advance(b, 100);
    expect(a).toEqual(b);
  });
});

describe('extra units for stress runs', () => {
  const stressed = (count: number) =>
    createGame(1, undefined, undefined, {
      extraUnits: { owner: 0, type: 'samlare', count },
    });

  it('gives the side that many more units, each on a walkable tile of its own', () => {
    const plain = createGame(1);
    const state = stressed(120);
    const mine = units(state).filter((unit) => unit.owner === 0);
    expect(mine).toHaveLength(units(plain).filter((unit) => unit.owner === 0).length + 120);
    const tiles = mine.map((unit) => `${Math.floor(unit.x)},${Math.floor(unit.y)}`);
    expect(new Set(tiles).size).toBe(mine.length);
    for (const unit of mine) {
      expect(isWalkable(state.map, Math.floor(unit.x), Math.floor(unit.y))).toBe(true);
    }
  });

  it('leaves the other side and the map as in a normal game', () => {
    const plain = createGame(1);
    const state = stressed(120);
    expect(state.map).toEqual(plain.map);
    expect(units(state).filter((unit) => unit.owner === 1)).toHaveLength(
      units(plain).filter((unit) => unit.owner === 1).length,
    );
  });

  it('gives the same game for the same seed', () => {
    const a = stressed(40);
    const b = stressed(40);
    advance(a, 100);
    advance(b, 100);
    expect(a.entities).toEqual(b.entities);
  });
});
