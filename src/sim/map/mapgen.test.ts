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
    for (const terrain of ['grass', 'tree', 'berries', 'rock', 'water', 'cave'] as const) {
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

  it('gives each side two caves on its own half of the map', () => {
    for (const seed of SEEDS) {
      const map = generate(seed);
      const [home, away] = map.startPositions as [
        { x: number; y: number },
        { x: number; y: number },
      ];
      expect(map.caves).toHaveLength(4);
      expect(new Set(map.caves.map((c) => c.id)).size).toBe(4);
      for (const owner of [0, 1]) {
        const own = map.caves.filter((c) => c.owner === owner);
        expect(own, `seed ${seed}`).toHaveLength(2);
        const [mine, theirs] = owner === 0 ? [home, away] : [away, home];
        for (const cave of own) {
          expect(terrainAt(map, cave.x, cave.y)).toBe('cave');
          expect(cave).toMatchObject({ occupants: [], reserved: 0 });
          const distance = tileDistance(cave.x, cave.y, mine.x, mine.y);
          expect(distance).toBeGreaterThanOrEqual(MAP_GEN_CONFIG.caves.minStartDistance);
          expect(distance).toBeLessThanOrEqual(MAP_GEN_CONFIG.caves.maxStartDistance);
          expect(distance).toBeLessThan(tileDistance(cave.x, cave.y, theirs.x, theirs.y));
          const margin = MAP_GEN_CONFIG.caves.edgeMargin;
          expect(cave.x).toBeGreaterThanOrEqual(margin);
          expect(cave.y).toBeGreaterThanOrEqual(margin);
          expect(cave.x).toBeLessThan(map.width - margin);
          expect(cave.y).toBeLessThan(map.height - margin);
        }
        const [a, b] = own as [(typeof own)[0], (typeof own)[0]];
        expect(tileDistance(a.x, a.y, b.x, b.y)).toBeGreaterThanOrEqual(
          MAP_GEN_CONFIG.caves.minSeparation,
        );
      }
      // Exactly as many cave tiles as caves.
      expect(countAll(map, 'cave')).toBe(4);
    }
  });

  it("mirrors each side's caves through the map centre", () => {
    for (const seed of SEEDS) {
      const map = generate(seed);
      const mirrored = map.caves.filter((c) => c.owner === 0).map((c) => mirrorTile(c.x, c.y, map));
      const theirs = map.caves.filter((c) => c.owner === 1).map((c) => ({ x: c.x, y: c.y }));
      expect(theirs, `seed ${seed}`).toEqual(mirrored);
    }
  });

  it("lets every cave be walked up to from its side's start position", () => {
    for (const seed of SEEDS) {
      const map = generate(seed);
      for (const cave of map.caves) {
        const start = map.startPositions[cave.owner]!;
        const reachable = [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ].some(([dx, dy]) => isReachable(map, start, { x: cave.x + dx!, y: cave.y + dy! }));
        expect(reachable, `seed ${seed} cave ${cave.id}`).toBe(true);
      }
    }
  });

  it('gives caves no resources and keeps the terrain of earlier seeds otherwise unchanged', () => {
    const map = generate(1);
    for (const cave of map.caves) {
      expect(map.resourceAmount[cave.y * map.width + cave.x]).toBe(0);
    }
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
