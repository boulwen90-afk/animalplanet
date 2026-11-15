import { describe, expect, it } from 'vitest';
import { BUILDING_DEFS } from '../../data/buildings';
import { MAP_GEN_CONFIG } from '../../data/map';
import { RESOURCE_DEFS } from '../../data/resources';
import { unitTile } from '../entities';
import { createGame } from '../game';
import { resourceAmountAt, resourceAt } from '../resources';
import type { Building, GameState, PlayerId, Unit } from '../state';
import { placementProblem } from '../systems/construction';
import { plannedWorkTiles } from '../systems/gathering';
import { tileDistance } from './grid';

/**
 * Both sides must start with the same access to water, wood and berries, on
 * every map. Checked through the game's own rules for where a fishing hut
 * may stand and what it gives, not through the map generator's.
 */
const SEEDS = Array.from({ length: 40 }, (_, i) => i + 1);
const FISHERS = BUILDING_DEFS.fiskehytta.work!.workers;
const WATER = MAP_GEN_CONFIG.startWater;

/**
 * The game of each seed and each side's places for a fishing hut, worked
 * out once and shared by the tests: making forty maps and searching each
 * for hut sites takes seconds, and nothing here changes a game.
 */
const games = new Map<number, GameState>();
const sites = new Map<string, number[]>();
function gameOf(seed: number): GameState {
  let state = games.get(seed);
  if (!state) {
    state = createGame(seed, undefined, undefined, { ai: [], fog: false });
    games.set(seed, state);
  }
  return state;
}
function sitesOf(seed: number, player: PlayerId): number[] {
  const key = `${seed}:${player}`;
  let found = sites.get(key);
  if (!found) {
    found = fishingSites(gameOf(seed), player);
    sites.set(key, found);
  }
  return found;
}

const mainBuilding = (state: GameState, player: PlayerId) =>
  state.entities.find((e): e is Building => e.kind === 'building' && e.owner === player)!;
const worker = (state: GameState, player: PlayerId) =>
  state.entities.find((e): e is Unit => e.kind === 'unit' && e.owner === player)!;

/** What is left of a resource in the sources within a distance of a side's start position. */
function resourceNear(
  state: GameState,
  player: PlayerId,
  resource: 'food' | 'wood',
  radius: number,
) {
  const start = state.map.startPositions[player]!;
  let total = 0;
  for (let y = 0; y < state.map.height; y++) {
    for (let x = 0; x < state.map.width; x++) {
      if (resourceAt(state.map, x, y) !== resource) continue;
      if (tileDistance(x, y, start.x, start.y) > radius) continue;
      total += resourceAmountAt(state.map, x, y);
    }
  }
  return total;
}

/**
 * The places where a side could build a fishing hut that gives every fisher
 * a place it can walk to, as distances from the side's start position, the
 * nearest first; as far out as the map promises one.
 */
function fishingSites(state: GameState, player: PlayerId): number[] {
  const start = state.map.startPositions[player]!;
  const from = unitTile(worker(state, player));
  const size = BUILDING_DEFS.fiskehytta.size;
  const distances: number[] = [];
  const span = Math.ceil(WATER.siteDistance) + 1;
  for (let y = start.y - span; y <= start.y + span; y++) {
    for (let x = start.x - span; x <= start.x + span; x++) {
      if (placementProblem(state, 'fiskehytta', x, y, undefined, from)) continue;
      if (plannedWorkTiles(state, 'fiskehytta', { x, y }, from).length < FISHERS) continue;
      const distance = tileDistance(x + size / 2, y + size / 2, start.x + 0.5, start.y + 0.5);
      // Only as far as the map promises a place.
      if (distance <= WATER.siteDistance) distances.push(distance);
    }
  }
  return distances.sort((a, b) => a - b);
}

describe('a fair start, on every map', () => {
  it('each side has a place for a fishing hut with all its fishing places near its start', () => {
    for (const seed of SEEDS) {
      for (const player of [0, 1] as const) {
        const [nearest] = sitesOf(seed, player);
        expect(nearest, `seed ${seed}, player ${player}`).toBeDefined();
        expect(nearest, `seed ${seed}, player ${player}`).toBeLessThanOrEqual(WATER.siteDistance);
      }
    }
  });

  it('each side has the guaranteed trees and berries near its start', () => {
    const radius = MAP_GEN_CONFIG.startResourceRadius;
    for (const seed of SEEDS) {
      const state = gameOf(seed);
      for (const player of [0, 1] as const) {
        expect(resourceNear(state, player, 'wood', radius), `seed ${seed}`).toBeGreaterThanOrEqual(
          MAP_GEN_CONFIG.startTrees * RESOURCE_DEFS.wood.amountPerNode,
        );
        expect(resourceNear(state, player, 'food', radius), `seed ${seed}`).toBeGreaterThanOrEqual(
          MAP_GEN_CONFIG.startBerries * RESOURCE_DEFS.food.amountPerNode,
        );
      }
    }
  });

  it('the two sides have exactly the same: water, wood and berries at every distance', () => {
    for (const seed of SEEDS) {
      const state = gameOf(seed);
      // The same number of places to fish from, at the same distances.
      const round = (list: number[]) => list.map((d) => d.toFixed(3));
      expect(round(sitesOf(seed, 0)), `seed ${seed}`).toEqual(round(sitesOf(seed, 1)));
      for (const radius of [8, 12, 16, 24]) {
        for (const resource of ['wood', 'food'] as const) {
          expect(
            resourceNear(state, 0, resource, radius),
            `seed ${seed}, ${resource} ${radius}`,
          ).toBe(resourceNear(state, 1, resource, radius));
        }
      }
      // And the main buildings stand mirrored through the middle of the map.
      const [a, b] = [mainBuilding(state, 0), mainBuilding(state, 1)];
      const side = BUILDING_DEFS[a.type].size;
      expect(a.x + side - 1 + b.x).toBe(state.map.width - 1);
      expect(a.y + side - 1 + b.y).toBe(state.map.height - 1);
    }
  });
});
