import { describe, expect, it } from 'vitest';
import { MAP_CONFIG, MAP_GEN_CONFIG } from '../../data/map';
import type { Terrain } from '../../data/terrain';
import { createRng } from '../rng';
import { isReachable, isWalkable, mirrorTile, terrainAt, tileDistance, type GameMap } from './grid';
import { generateMap, type MapGenConfig } from './mapgen';

const SEEDS = Array.from({ length: 40 }, (_, i) => i);

function generate(seed: number, config: MapGenConfig = MAP_GEN_CONFIG): GameMap {
  return generateMap(createRng(seed), MAP_CONFIG, config);
}

function countNear(
  map: GameMap,
  terrain: Terrain,
  centre: { x: number; y: number },
  radius: number,
) {
  let count = 0;
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      if (terrainAt(map, x, y) === terrain && tileDistance(x, y, centre.x, centre.y) <= radius) {
        count++;
      }
    }
  }
  return count;
}

function countAll(map: GameMap, terrain: Terrain): number {
  return map.terrain.filter((t) => t === terrain).length;
}

describe('generateMap', () => {
  it('gives an identical map for the same seed', () => {
    expect(generate(1)).toEqual(generate(1));
    expect(generate(987654321)).toEqual(generate(987654321));
  });

  it('gives different maps for different seeds', () => {
    expect(generate(1).terrain).not.toEqual(generate(2).terrain);
    const distinct = new Set(SEEDS.map((seed) => generate(seed).terrain.join(',')));
    expect(distinct.size).toBe(SEEDS.length);
  });

  it('has the configured size and start positions', () => {
    const map = generate(1);
    expect(map.width).toBe(MAP_CONFIG.width);
    expect(map.height).toBe(MAP_CONFIG.height);
    expect(map.terrain).toHaveLength(MAP_CONFIG.width * MAP_CONFIG.height);
    expect(map.startPositions).toEqual(MAP_GEN_CONFIG.startPositions);
  });

  it('contains every terrain type', () => {
    const map = generate(1);
    for (const terrain of ['grass', 'tree', 'berries', 'rock', 'water'] as const) {
      expect(countAll(map, terrain), terrain).toBeGreaterThan(0);
    }
  });

  it('is mostly open ground', () => {
    for (const seed of SEEDS) {
      const map = generate(seed);
      expect(countAll(map, 'grass') / map.terrain.length, `seed ${seed}`).toBeGreaterThan(0.6);
    }
  });

  it('is point-symmetric through the map centre', () => {
    for (const seed of SEEDS) {
      const map = generate(seed);
      for (let y = 0; y < map.height; y++) {
        for (let x = 0; x < map.width; x++) {
          const mirror = mirrorTile(x, y, map);
          if (terrainAt(map, x, y) !== terrainAt(map, mirror.x, mirror.y)) {
            throw new Error(`seed ${seed}: tile ${x},${y} differs from its mirror`);
          }
        }
      }
    }
  });

  it('connects the two start positions with walkable ground', () => {
    for (const seed of SEEDS) {
      const map = generate(seed);
      const [a, b] = map.startPositions;
      expect(isReachable(map, a!, b!), `seed ${seed}`).toBe(true);
    }
  });

  it('gives each start position at least 4 berry bushes and 10 trees within 8 tiles', () => {
    for (const seed of SEEDS) {
      const map = generate(seed);
      for (const start of map.startPositions) {
        expect(countNear(map, 'berries', start, 8), `seed ${seed} berries`).toBeGreaterThanOrEqual(
          4,
        );
        expect(countNear(map, 'tree', start, 8), `seed ${seed} trees`).toBeGreaterThanOrEqual(10);
      }
    }
  });

  it('places exactly the configured start resources when nothing else is generated', () => {
    const none = { count: 0, minSize: 1, maxSize: 1 };
    const map = generate(3, {
      ...MAP_GEN_CONFIG,
      forests: none,
      berryPatches: none,
      rocks: none,
      lakes: none,
    });
    for (const start of map.startPositions) {
      const radius = MAP_GEN_CONFIG.startResourceRadius;
      expect(countNear(map, 'berries', start, radius)).toBe(MAP_GEN_CONFIG.startBerries);
      expect(countNear(map, 'tree', start, radius)).toBe(MAP_GEN_CONFIG.startTrees);
    }
    expect(countAll(map, 'berries')).toBe(MAP_GEN_CONFIG.startBerries * 2);
    expect(countAll(map, 'tree')).toBe(MAP_GEN_CONFIG.startTrees * 2);
  });

  it('keeps the ground around each start position clear', () => {
    for (const seed of SEEDS) {
      const map = generate(seed);
      for (const start of map.startPositions) {
        const r = MAP_GEN_CONFIG.startClearRadius;
        for (let y = start.y - r; y <= start.y + r; y++) {
          for (let x = start.x - r; x <= start.x + r; x++) {
            if (tileDistance(x, y, start.x, start.y) <= r) {
              expect(isWalkable(map, x, y), `seed ${seed} tile ${x},${y}`).toBe(true);
            }
          }
        }
      }
    }
  });

  it('keeps lakes and rocks away from the start positions', () => {
    for (const seed of SEEDS) {
      const map = generate(seed);
      for (const start of map.startPositions) {
        const radius = MAP_GEN_CONFIG.obstacleStartDistance;
        expect(countNear(map, 'water', start, radius), `seed ${seed}`).toBe(0);
        expect(countNear(map, 'rock', start, radius), `seed ${seed}`).toBe(0);
      }
    }
  });

  it('falls back to a connected map when every random layout is blocked', () => {
    // Lakes large enough to flood all ground outside the start areas.
    const map = generate(1, {
      ...MAP_GEN_CONFIG,
      lakes: { count: 40, minSize: 400, maxSize: 400 },
      obstacleStartDistance: MAP_GEN_CONFIG.startResourceRadius,
      maxAttempts: 2,
    });
    const [a, b] = map.startPositions;
    expect(isReachable(map, a!, b!)).toBe(true);
    expect(countAll(map, 'water')).toBe(0);
    expect(countNear(map, 'tree', a!, 8)).toBe(MAP_GEN_CONFIG.startTrees);
  });

  it('rejects start positions that are not mirror images', () => {
    expect(() =>
      generate(1, {
        ...MAP_GEN_CONFIG,
        startPositions: [
          { x: 9, y: 54 },
          { x: 50, y: 9 },
        ],
      }),
    ).toThrow(/mirror/);
  });

  it('rejects start positions too close to the map edge', () => {
    expect(() =>
      generate(1, {
        ...MAP_GEN_CONFIG,
        startPositions: [
          { x: 2, y: 61 },
          { x: 61, y: 2 },
        ],
      }),
    ).toThrow(/edge/);
  });
});
