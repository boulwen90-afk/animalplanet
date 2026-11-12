import { describe, expect, it } from 'vitest';
import { MAP_CONFIG } from '../../data/map';
import {
  clampWorldToMap,
  isInsideMap,
  tileCenterToWorld,
  tileToWorld,
  worldToTile,
  worldToTileExact,
} from './iso';

const size = MAP_CONFIG;
const last = { x: MAP_CONFIG.width - 1, y: MAP_CONFIG.height - 1 };

describe('tileToWorld', () => {
  it('puts the top corner of tile (0, 0) at the origin', () => {
    expect(tileToWorld(0, 0, size)).toEqual({ x: 0, y: 0 });
  });

  it('moves half a tile right and down per step along the x axis', () => {
    expect(tileToWorld(1, 0, size)).toEqual({ x: 32, y: 16 });
  });

  it('moves half a tile left and down per step along the y axis', () => {
    expect(tileToWorld(0, 1, size)).toEqual({ x: -32, y: 16 });
  });
});

describe('tile -> world -> tile round trip', () => {
  const tiles = [
    { name: 'top corner', x: 0, y: 0 },
    { name: 'right corner', x: last.x, y: 0 },
    { name: 'left corner', x: 0, y: last.y },
    { name: 'bottom corner', x: last.x, y: last.y },
    { name: 'centre', x: MAP_CONFIG.width / 2, y: MAP_CONFIG.height / 2 },
  ];

  for (const tile of tiles) {
    it(`returns the same tile for the ${tile.name}`, () => {
      const world = tileCenterToWorld(tile.x, tile.y, size);
      expect(worldToTile(world.x, world.y, size)).toEqual({ x: tile.x, y: tile.y });
    });
  }

  it('returns the same tile for every tile on the map', () => {
    for (let ty = 0; ty < MAP_CONFIG.height; ty++) {
      for (let tx = 0; tx < MAP_CONFIG.width; tx++) {
        const world = tileCenterToWorld(tx, ty, size);
        expect(worldToTile(world.x, world.y, size)).toEqual({ x: tx, y: ty });
      }
    }
  });

  it('keeps fractional coordinates', () => {
    const world = tileToWorld(12.25, 40.75, size);
    const tile = worldToTileExact(world.x, world.y, size);
    expect(tile.x).toBeCloseTo(12.25);
    expect(tile.y).toBeCloseTo(40.75);
  });
});

describe('worldToTile', () => {
  it('maps a point in the middle of a diamond to that tile', () => {
    // Tile (3, 1): top corner at (64, 64), so its centre is 16 px further down.
    expect(worldToTile(64, 80, size)).toEqual({ x: 3, y: 1 });
  });

  it('maps points near each corner of a diamond to that tile', () => {
    const centre = tileCenterToWorld(3, 1, size);
    expect(worldToTile(centre.x, centre.y - 14, size)).toEqual({ x: 3, y: 1 });
    expect(worldToTile(centre.x, centre.y + 14, size)).toEqual({ x: 3, y: 1 });
    expect(worldToTile(centre.x - 28, centre.y, size)).toEqual({ x: 3, y: 1 });
    expect(worldToTile(centre.x + 28, centre.y, size)).toEqual({ x: 3, y: 1 });
  });

  it('maps a point outside a diamond corner to the neighbouring tile', () => {
    const centre = tileCenterToWorld(3, 1, size);
    // Right of the right corner lies the tile diagonally to the "east".
    expect(worldToTile(centre.x + 36, centre.y, size)).toEqual({ x: 4, y: 0 });
    // Above the top corner lies the tile diagonally to the "north".
    expect(worldToTile(centre.x, centre.y - 18, size)).toEqual({ x: 2, y: 0 });
  });

  it('gives tiles outside the map for points outside the diamond', () => {
    const tile = worldToTile(0, -10, size);
    expect(isInsideMap(tile.x, tile.y, MAP_CONFIG)).toBe(false);
  });
});

describe('isInsideMap', () => {
  it('accepts the corner tiles and rejects their outside neighbours', () => {
    expect(isInsideMap(0, 0, MAP_CONFIG)).toBe(true);
    expect(isInsideMap(last.x, last.y, MAP_CONFIG)).toBe(true);
    expect(isInsideMap(-1, 0, MAP_CONFIG)).toBe(false);
    expect(isInsideMap(0, -1, MAP_CONFIG)).toBe(false);
    expect(isInsideMap(MAP_CONFIG.width, 0, MAP_CONFIG)).toBe(false);
    expect(isInsideMap(0, MAP_CONFIG.height, MAP_CONFIG)).toBe(false);
  });
});

describe('clampWorldToMap', () => {
  it('leaves a point on the map untouched', () => {
    const inside = tileToWorld(10.5, 20.25, size);
    const clamped = clampWorldToMap(inside.x, inside.y, MAP_CONFIG, size);
    expect(clamped.x).toBeCloseTo(inside.x);
    expect(clamped.y).toBeCloseTo(inside.y);
  });

  it('pulls a point above the map back to the top corner', () => {
    expect(clampWorldToMap(0, -500, MAP_CONFIG, size)).toEqual({ x: 0, y: 0 });
  });

  it('pulls a point far to the right back to the right corner', () => {
    expect(clampWorldToMap(9000, 1024, MAP_CONFIG, size)).toEqual(
      tileToWorld(MAP_CONFIG.width, 0, size),
    );
  });

  it('pulls a point outside one edge back onto that edge', () => {
    // 2 tiles outside the x = 0 edge, level with tile row y = 10.
    const outside = tileToWorld(-2, 10, size);
    expect(clampWorldToMap(outside.x, outside.y, MAP_CONFIG, size)).toEqual(
      tileToWorld(0, 10, size),
    );
  });

  it('always returns a point on the map', () => {
    for (const [wx, wy] of [
      [-5000, -5000],
      [5000, -5000],
      [-5000, 5000],
      [5000, 5000],
      [-3000, 1000],
    ] as const) {
      const clamped = clampWorldToMap(wx, wy, MAP_CONFIG, size);
      const tile = worldToTileExact(clamped.x, clamped.y, size);
      expect(tile.x).toBeGreaterThanOrEqual(0);
      expect(tile.y).toBeGreaterThanOrEqual(0);
      expect(tile.x).toBeLessThanOrEqual(MAP_CONFIG.width);
      expect(tile.y).toBeLessThanOrEqual(MAP_CONFIG.height);
    }
  });
});
