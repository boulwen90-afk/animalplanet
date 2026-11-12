import { describe, expect, it } from 'vitest';
import { createBuilding, createUnit } from '../entities';
import { openState, stateFromRows } from '../testUtils';
import { isPassable } from './astar';
import { buildPathGrid, nearestFreeTiles } from './passability';

describe('buildPathGrid', () => {
  it('blocks every terrain except grass', () => {
    const grid = buildPathGrid(stateFromRows(['.TBRW']));
    expect([0, 1, 2, 3, 4].map((x) => isPassable(grid, x, 0))).toEqual([
      true,
      false,
      false,
      false,
      false,
    ]);
  });

  it('blocks the whole footprint of a building and nothing else', () => {
    const state = openState(7, 7);
    createBuilding(state, 'storide', 0, 2, 2);
    const grid = buildPathGrid(state);
    for (let y = 0; y < 7; y++) {
      for (let x = 0; x < 7; x++) {
        const inside = x >= 2 && x <= 4 && y >= 2 && y <= 4;
        expect(isPassable(grid, x, y), `${x},${y}`).toBe(!inside);
      }
    }
  });

  it('does not block tiles where units stand', () => {
    const state = openState(3, 3);
    createUnit(state, 'samlare', 0, 1, 1);
    expect(isPassable(buildPathGrid(state), 1, 1)).toBe(true);
  });
});

describe('nearestFreeTiles', () => {
  it('returns the source first, then its neighbours', () => {
    const grid = buildPathGrid(openState(7, 7));
    const tiles = nearestFreeTiles(grid, [{ x: 3, y: 3 }], 9);
    expect(tiles[0]).toEqual({ x: 3, y: 3 });
    expect(tiles).toHaveLength(9);
    for (const tile of tiles) {
      expect(Math.max(Math.abs(tile.x - 3), Math.abs(tile.y - 3))).toBeLessThanOrEqual(1);
    }
  });

  it('skips taken tiles', () => {
    const grid = buildPathGrid(openState(7, 7));
    const taken = new Set([3 * 7 + 3]);
    const tiles = nearestFreeTiles(grid, [{ x: 3, y: 3 }], 3, taken);
    expect(tiles).not.toContainEqual({ x: 3, y: 3 });
    expect(tiles).toHaveLength(3);
  });

  it('returns only open tiles around blocked sources', () => {
    const state = openState(9, 9);
    const building = createBuilding(state, 'storide', 0, 3, 3);
    const grid = buildPathGrid(state);
    const sources = [];
    for (let y = building.y; y < building.y + 3; y++) {
      for (let x = building.x; x < building.x + 3; x++) sources.push({ x, y });
    }
    const tiles = nearestFreeTiles(grid, sources, 16);
    expect(tiles).toHaveLength(16);
    for (const tile of tiles) {
      expect(isPassable(grid, tile.x, tile.y)).toBe(true);
      // The ring of 16 tiles directly around a 3x3 building.
      expect(Math.max(Math.abs(tile.x - 4), Math.abs(tile.y - 4))).toBe(2);
    }
  });

  it('does not cross an obstacle to reach tiles on the other side', () => {
    const grid = buildPathGrid(stateFromRows(['..W..', '..W..', '..W..']));
    const tiles = nearestFreeTiles(grid, [{ x: 1, y: 1 }], 20);
    expect(tiles).toHaveLength(6);
    for (const tile of tiles) expect(tile.x).toBeLessThan(2);
  });

  it('returns fewer tiles when there is not enough room', () => {
    const grid = buildPathGrid(stateFromRows(['..T']));
    expect(nearestFreeTiles(grid, [{ x: 0, y: 0 }], 5)).toHaveLength(2);
  });

  it('ignores sources outside the map', () => {
    const grid = buildPathGrid(openState(3, 3));
    expect(nearestFreeTiles(grid, [{ x: -5, y: 0 }], 2)).toEqual([]);
  });
});
