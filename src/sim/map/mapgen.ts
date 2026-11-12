import type { Terrain } from '../../data/terrain';
import { nextInt, pick, type RngState } from '../rng';
import {
  EDGE_NEIGHBOURS,
  inBounds,
  isReachable,
  mirrorTile,
  tileDistance,
  tileIndex,
  type GameMap,
} from './grid';
import type { MapSize, Point } from './iso';

export interface FeatureConfig {
  /** Number of features per half of the map. */
  count: number;
  minSize: number;
  maxSize: number;
}

export interface MapGenConfig {
  startPositions: readonly Point[];
  startClearRadius: number;
  startResourceRadius: number;
  startBerries: number;
  startTrees: number;
  obstacleStartDistance: number;
  forests: FeatureConfig;
  berryPatches: FeatureConfig;
  rocks: FeatureConfig;
  lakes: FeatureConfig;
  maxAttempts: number;
}

type TilePredicate = (x: number, y: number) => boolean;

/** Attempts at finding a free tile to start a feature on before giving up on it. */
const ANCHOR_TRIES = 30;

/**
 * Generates a map from the random generator's current state. The map is
 * point-symmetric through its centre, both start positions are surrounded by
 * open ground with berries and trees close by, and the start positions are
 * connected by walkable ground.
 */
export function generateMap(rng: RngState, size: MapSize, config: MapGenConfig): GameMap {
  const starts = validateStartPositions(size, config);

  for (let attempt = 0; attempt < config.maxAttempts; attempt++) {
    const map = emptyMap(size, starts);
    if (!placeStartResources(rng, map, config)) continue;
    placeRandomFeatures(rng, map, config);
    if (isReachable(map, starts[0], starts[1])) return map;
  }

  // Every random layout cut the map in two. Fall back to start resources only,
  // which cannot separate the start positions.
  for (;;) {
    const map = emptyMap(size, starts);
    if (placeStartResources(rng, map, config)) return map;
  }
}

function validateStartPositions(size: MapSize, config: MapGenConfig): [Point, Point] {
  const [first, second] = config.startPositions;
  if (!first || !second || config.startPositions.length !== 2) {
    throw new Error('Map generation needs exactly two start positions');
  }
  const mirrored = mirrorTile(first.x, first.y, size);
  if (mirrored.x !== second.x || mirrored.y !== second.y) {
    throw new Error('The second start position must mirror the first through the map centre');
  }
  for (const start of [first, second]) {
    const r = config.startResourceRadius;
    if (!inBounds(start.x - r, start.y - r, size) || !inBounds(start.x + r, start.y + r, size)) {
      throw new Error('Start positions must be at least startResourceRadius from the map edge');
    }
  }
  return [{ ...first }, { ...second }];
}

function emptyMap(size: MapSize, starts: [Point, Point]): GameMap {
  return {
    width: size.width,
    height: size.height,
    terrain: new Array<Terrain>(size.width * size.height).fill('grass'),
    startPositions: starts.map((p) => ({ ...p })),
  };
}

/** Distance from a tile to the nearest start position. */
function startDistance(map: GameMap, x: number, y: number): number {
  return Math.min(...map.startPositions.map((s) => tileDistance(x, y, s.x, s.y)));
}

function isGrass(map: GameMap, x: number, y: number): boolean {
  return inBounds(x, y, map) && map.terrain[tileIndex(x, y, map)] === 'grass';
}

/** Sets a tile and its mirror image, keeping the map point-symmetric. */
function setSymmetric(map: GameMap, x: number, y: number, terrain: Terrain): void {
  const mirror = mirrorTile(x, y, map);
  map.terrain[tileIndex(x, y, map)] = terrain;
  map.terrain[tileIndex(mirror.x, mirror.y, map)] = terrain;
}

/**
 * Grows an irregular patch of `terrain` from `anchor`, one edge-adjacent tile
 * at a time, onto tiles accepted by `allowed`. Returns the number of tiles
 * placed (not counting mirror images), which is less than `size` if the patch
 * ran out of room.
 */
function growPatch(
  rng: RngState,
  map: GameMap,
  anchor: Point,
  size: number,
  terrain: Terrain,
  allowed: TilePredicate,
): number {
  if (!allowed(anchor.x, anchor.y)) return 0;
  const tiles: Point[] = [anchor];
  setSymmetric(map, anchor.x, anchor.y, terrain);

  for (let tries = size * 20; tiles.length < size && tries > 0; tries--) {
    const from = pick(rng, tiles);
    const step = pick(rng, EDGE_NEIGHBOURS);
    const x = from.x + step.x;
    const y = from.y + step.y;
    if (!allowed(x, y)) continue;
    setSymmetric(map, x, y, terrain);
    tiles.push({ x, y });
  }
  return tiles.length;
}

/** A random tile accepted by `allowed`, or undefined if none was found. */
function findAnchor(rng: RngState, map: GameMap, allowed: TilePredicate): Point | undefined {
  for (let i = 0; i < ANCHOR_TRIES; i++) {
    const x = nextInt(rng, 0, map.width - 1);
    const y = nextInt(rng, 0, map.height - 1);
    if (allowed(x, y)) return { x, y };
  }
  return undefined;
}

/**
 * Places the guaranteed berries and trees in the ring between the clear radius
 * and the resource radius around the first start position; mirroring gives the
 * second start position the same. Returns false if they did not all fit.
 */
function placeStartResources(rng: RngState, map: GameMap, config: MapGenConfig): boolean {
  const start = map.startPositions[0] as Point;
  const inRing: TilePredicate = (x, y) => {
    const d = tileDistance(x, y, start.x, start.y);
    return isGrass(map, x, y) && d > config.startClearRadius && d <= config.startResourceRadius;
  };

  const ringAnchor = (): Point | undefined => {
    const r = config.startResourceRadius;
    for (let i = 0; i < ANCHOR_TRIES; i++) {
      const x = nextInt(rng, start.x - r, start.x + r);
      const y = nextInt(rng, start.y - r, start.y + r);
      if (inRing(x, y)) return { x, y };
    }
    return undefined;
  };

  const resources: [Terrain, number][] = [
    ['berries', config.startBerries],
    ['tree', config.startTrees],
  ];
  for (const [terrain, amount] of resources) {
    const anchor = ringAnchor();
    if (!anchor || growPatch(rng, map, anchor, amount, terrain, inRing) < amount) return false;
  }
  return true;
}

function placeRandomFeatures(rng: RngState, map: GameMap, config: MapGenConfig): void {
  const awayFromStart =
    (distance: number): TilePredicate =>
    (x, y) =>
      isGrass(map, x, y) && startDistance(map, x, y) > distance;

  const features: [Terrain, FeatureConfig, number][] = [
    ['water', config.lakes, config.obstacleStartDistance],
    ['rock', config.rocks, config.obstacleStartDistance],
    ['tree', config.forests, config.startClearRadius],
    ['berries', config.berryPatches, config.startClearRadius],
  ];

  for (const [terrain, feature, distance] of features) {
    const allowed = awayFromStart(distance);
    for (let i = 0; i < feature.count; i++) {
      const anchor = findAnchor(rng, map, allowed);
      if (!anchor) continue;
      growPatch(rng, map, anchor, nextInt(rng, feature.minSize, feature.maxSize), terrain, allowed);
    }
  }
}
