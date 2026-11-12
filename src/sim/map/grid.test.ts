import { describe, expect, it } from 'vitest';
import type { Terrain } from '../../data/terrain';
import { isReachable, isWalkable, mirrorTile, terrainAt, tileDistance, type GameMap } from './grid';

/** Builds a map from rows of characters: . grass, T tree, B berries, R rock, W water. */
function mapFromRows(rows: string[]): GameMap {
  const legend: Record<string, Terrain> = {
    '.': 'grass',
    T: 'tree',
    B: 'berries',
    R: 'rock',
    W: 'water',
  };
  return {
    width: (rows[0] as string).length,
    height: rows.length,
    terrain: rows.flatMap((row) => [...row].map((c) => legend[c] as Terrain)),
    startPositions: [],
  };
}

describe('terrain lookup', () => {
  const map = mapFromRows(['.T', 'BW', 'R.']);

  it('reads terrain by x and y', () => {
    expect(terrainAt(map, 1, 0)).toBe('tree');
    expect(terrainAt(map, 0, 1)).toBe('berries');
    expect(terrainAt(map, 1, 1)).toBe('water');
    expect(terrainAt(map, 0, 2)).toBe('rock');
  });

  it('gives undefined outside the map', () => {
    expect(terrainAt(map, -1, 0)).toBeUndefined();
    expect(terrainAt(map, 2, 0)).toBeUndefined();
    expect(terrainAt(map, 0, 3)).toBeUndefined();
  });

  it('only grass is walkable, and nothing outside the map', () => {
    expect(isWalkable(map, 0, 0)).toBe(true);
    expect(isWalkable(map, 1, 2)).toBe(true);
    expect(isWalkable(map, 1, 0)).toBe(false);
    expect(isWalkable(map, 0, 1)).toBe(false);
    expect(isWalkable(map, 1, 1)).toBe(false);
    expect(isWalkable(map, 0, 2)).toBe(false);
    expect(isWalkable(map, 5, 5)).toBe(false);
  });
});

describe('mirrorTile', () => {
  it('maps corners to opposite corners and is its own inverse', () => {
    const size = { width: 64, height: 64 };
    expect(mirrorTile(0, 0, size)).toEqual({ x: 63, y: 63 });
    expect(mirrorTile(9, 54, size)).toEqual({ x: 54, y: 9 });
    const back = mirrorTile(54, 9, size);
    expect(back).toEqual({ x: 9, y: 54 });
  });
});

describe('tileDistance', () => {
  it('is the straight-line distance', () => {
    expect(tileDistance(0, 0, 3, 4)).toBe(5);
    expect(tileDistance(2, 2, 2, 2)).toBe(0);
  });
});

describe('isReachable', () => {
  it('finds a way around an obstacle', () => {
    const map = mapFromRows(['.T.', '.T.', '...']);
    expect(isReachable(map, { x: 0, y: 0 }, { x: 2, y: 0 })).toBe(true);
  });

  it('fails when a wall cuts the map in two', () => {
    const map = mapFromRows(['.W.', '.W.', '.W.']);
    expect(isReachable(map, { x: 0, y: 0 }, { x: 2, y: 0 })).toBe(false);
  });

  it('does not squeeze diagonally between two obstacles', () => {
    const map = mapFromRows(['.R', 'R.']);
    expect(isReachable(map, { x: 0, y: 0 }, { x: 1, y: 1 })).toBe(false);
  });

  it('fails when either end is blocked', () => {
    const map = mapFromRows(['.T', '..']);
    expect(isReachable(map, { x: 0, y: 0 }, { x: 1, y: 0 })).toBe(false);
    expect(isReachable(map, { x: 1, y: 0 }, { x: 0, y: 0 })).toBe(false);
  });

  it('a tile reaches itself', () => {
    const map = mapFromRows(['.']);
    expect(isReachable(map, { x: 0, y: 0 }, { x: 0, y: 0 })).toBe(true);
  });
});
