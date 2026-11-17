import { BUILDING_DEFS, type BuildingType } from '../data/buildings';
import { UNIT_DEFS, type UnitType } from '../data/units';
import { UPGRADE_TYPES } from '../data/upgrades';
import type { Command } from './commands';
import {
  buildingFrontTile,
  createBuilding,
  createUnit,
  hasSurrendered,
  isBuilding,
  isUnit,
} from './entities';
import { createGame } from './game';
import type { Point } from './map/iso';
import { buildPathGrid, nearestFreeTiles } from './pathfinding/passability';
import { resourceAt } from './resources';
import { nextFloat, nextInt, pick, type RngState } from './rng';
import type { Building, GameState, PlayerId, Unit } from './state';
import { canPlaceBuilding } from './systems/construction';

/**
 * Two scripted players, for tests that need a match with orders of every
 * kind in it: a game where both sides have a small base and a few soldiers,
 * and orders picked at random, sensible or not. The players' whims take
 * their random numbers from a generator of the test's own, so the game's
 * are untouched.
 */

const BUILDINGS = (Object.keys(BUILDING_DEFS) as BuildingType[]).filter(
  (type) => BUILDING_DEFS[type].buildTime > 0,
);
const UNITS = Object.keys(UNIT_DEFS) as UnitType[];

/** What each scripted player has from the start besides its main building, so that every kind of order has a use. */
const STARTING_BUILDINGS: readonly BuildingType[] = [
  'ide',
  'ide',
  'ide',
  'krigshall',
  'smedja',
  'odling',
  'kastbana',
];

/** Puts a finished building on the first place near a point where it can stand, with room around it. */
function raiseNear(state: GameState, type: BuildingType, owner: PlayerId, near: Point): void {
  for (let reach = 4; reach <= 16; reach += 4) {
    for (let dy = -reach; dy <= reach; dy += 4) {
      for (let dx = -reach; dx <= reach; dx += 4) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== reach) continue;
        if (!canPlaceBuilding(state, type, near.x + dx, near.y + dy)) continue;
        createBuilding(state, type, owner, near.x + dx, near.y + dy);
        return;
      }
    }
  }
}

/**
 * Gives both sides a stock, a small base and a few soldiers, so that the
 * scripted players have something to do with every kind of order.
 */
export function prepared(seed: number): GameState {
  const state = createGame(seed, undefined, undefined, { ai: [] });
  state.map.startPositions.forEach((home, index) => {
    for (const type of STARTING_BUILDINGS) raiseNear(state, type, index as PlayerId, home);
  });
  const taken = new Set<number>();
  for (const unit of state.entities.filter(isUnit)) {
    taken.add(Math.floor(unit.y) * state.map.width + Math.floor(unit.x));
  }
  state.players.forEach((side, index) => {
    side.resources = { food: 4000, wood: 4000 };
    const home = state.entities.find((e): e is Building => isBuilding(e) && e.owner === index)!;
    const tiles = nearestFreeTiles(buildPathGrid(state), [buildingFrontTile(home)], 9, taken);
    tiles.forEach((tile, i) => {
      taken.add(tile.y * state.map.width + tile.x);
      createUnit(
        state,
        i % 3 === 2 ? 'ramkastare' : 'ramkrigare',
        index as PlayerId,
        tile.x,
        tile.y,
      );
    });
  });
  return state;
}

/** Some of the items, each with the given chance; never none if there are any. */
function some<T>(rng: RngState, items: readonly T[], chance: number): T[] {
  const chosen = items.filter(() => nextFloat(rng) < chance);
  return chosen.length > 0 || items.length === 0 ? chosen : [pick(rng, items)];
}

/** An order of a random kind from a player, sensible or not: orders that are refused are part of the game too. */
export function scriptedOrder(
  state: GameState,
  rng: RngState,
  player: PlayerId,
): Command | undefined {
  const mine = state.entities.filter((entity) => entity.owner === player);
  const units = mine.filter(isUnit).filter((unit) => !hasSurrendered(unit));
  const buildings = mine.filter(isBuilding);
  const workers = units.filter((unit: Unit) => UNIT_DEFS[unit.type].carryCapacity > 0);
  const soldiers = units.filter((unit: Unit) => UNIT_DEFS[unit.type].aggroRadius > 0);
  const others = state.entities.filter((entity) => entity.owner !== player);
  const home = state.map.startPositions[player];
  const away = state.map.startPositions[1 - player];
  if (!home || !away || units.length === 0 || buildings.length === 0) return undefined;
  const near = (centre: { x: number; y: number }, reach: number) => ({
    x: centre.x + nextInt(rng, -reach, reach),
    y: centre.y + nextInt(rng, -reach, reach),
  });
  const ids = (list: readonly Unit[], chance: number) =>
    some(rng, list, chance).map((unit) => unit.id);
  // Mostly a building the order could be meant for, sometimes any building.
  const fitting = (accept: (building: Building) => boolean) => {
    const suited = buildings.filter(accept);
    return pick(rng, suited.length > 0 && nextFloat(rng) < 0.8 ? suited : buildings);
  };

  switch (nextInt(rng, 0, 13)) {
    case 0:
      return { type: 'move', player, unitIds: ids(units, 0.3), ...near(home, 12) };
    case 1:
      // An army on its way to the other side: this is what starts the fighting.
      return { type: 'move', player, unitIds: ids(soldiers, 0.8), ...near(away, 6) };
    case 2:
    case 3: {
      // A source of food or wood somewhere near the base, if the tile picked is one.
      const tile = near(home, 14);
      if (!resourceAt(state.map, tile.x, tile.y)) return undefined;
      return { type: 'gather', player, unitIds: ids(workers, 0.4), ...tile };
    }
    case 4: {
      const building = fitting((b) => b.complete && BUILDING_DEFS[b.type].trains.length > 0);
      const trains = BUILDING_DEFS[building.type].trains;
      const unit = trains.length > 0 && nextFloat(rng) < 0.8 ? pick(rng, trains) : pick(rng, UNITS);
      return { type: 'train', player, buildingId: building.id, unit };
    }
    case 5: {
      const building = fitting((b) => b.queue.length > 0);
      return { type: 'cancelTrain', player, buildingId: building.id, index: nextInt(rng, 0, 2) };
    }
    case 6: {
      const building = fitting((b) => b.complete && BUILDING_DEFS[b.type].researches !== undefined);
      const upgrade = pick(rng, UPGRADE_TYPES);
      return { type: 'research', player, buildingId: building.id, upgrade };
    }
    case 7: {
      const building = fitting((b) => b.research.length > 0);
      return { type: 'cancelResearch', player, buildingId: building.id, index: 0 };
    }
    case 8:
    case 9:
      return {
        type: 'build',
        player,
        unitIds: ids(workers, 0.3),
        // Housing often: without room nothing can be trained.
        building: nextFloat(rng) < 0.3 ? 'ide' : pick(rng, BUILDINGS),
        ...near(home, 9),
      };
    case 10: {
      const from = near(home, 9);
      const to = near(from, 6);
      return {
        type: 'buildLine',
        player,
        unitIds: ids(workers, 0.3),
        building: 'palissad',
        fromX: from.x,
        fromY: from.y,
        toX: to.x,
        toY: to.y,
      };
    }
    case 11: {
      if (nextFloat(rng) < 0.5) {
        const site = fitting((b) => !b.complete);
        return { type: 'construct', player, unitIds: ids(workers, 0.3), buildingId: site.id };
      }
      const hurt = fitting((b) => b.complete && b.hp < BUILDING_DEFS[b.type].hp);
      return { type: 'repair', player, unitIds: ids(workers, 0.3), buildingId: hurt.id };
    }
    case 12: {
      const place = fitting((b) => b.complete && BUILDING_DEFS[b.type].work !== undefined);
      return { type: 'work', player, unitIds: ids(workers, 0.3), buildingId: place.id };
    }
    default:
      if (others.length === 0) return undefined;
      return { type: 'attack', player, unitIds: ids(units, 0.6), targetId: pick(rng, others).id };
  }
}
