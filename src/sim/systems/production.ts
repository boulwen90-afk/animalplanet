import { BUILDING_DEFS } from '../../data/buildings';
import { PRODUCTION_CONFIG } from '../../data/production';
import { START_CONFIG } from '../../data/setup';
import { SIM_CONFIG } from '../../data/sim';
import { UNIT_DEFS, type UnitType } from '../../data/units';
import type { CommandResult } from '../commands';
import { missingResources, pay, refund } from '../economy';
import {
  buildingFrontTile,
  createUnit,
  isBuilding,
  isUnit,
  reservedPopulation,
  unitDestination,
} from '../entities';
import { buildPathGrid, nearestFreeTiles } from '../pathfinding/passability';
import type { Building, GameState, PlayerId } from '../state';

/** Simulation steps it takes to train a unit. */
export function trainTicksFor(type: UnitType): number {
  return Math.round(UNIT_DEFS[type].trainTime * SIM_CONFIG.ticksPerSecond);
}

/** Runs one simulation step of every building that is training units. */
export function produceUnits(state: GameState): void {
  // Copy the list: finished units are added to state.entities while looping.
  for (const building of state.entities.filter(isBuilding)) {
    const next = building.queue[0];
    if (!next) continue;
    if (building.trainTicks < trainTicksFor(next)) building.trainTicks++;
    if (building.trainTicks < trainTicksFor(next)) continue;
    // If there is nowhere to put the unit it waits, fully trained, for room.
    if (spawnUnit(state, building, next)) {
      building.queue.shift();
      building.trainTicks = 0;
    }
  }
}

/**
 * Puts a new unit on the free tile nearest to the front of the building,
 * where no other unit stands or is heading. Returns false if there is none.
 */
function spawnUnit(state: GameState, building: Building, type: UnitType): boolean {
  const grid = buildPathGrid(state);
  const taken = new Set<number>();
  for (const entity of state.entities) {
    if (!isUnit(entity)) continue;
    const tile = unitDestination(entity);
    taken.add(tile.y * grid.width + tile.x);
  }
  const [tile] = nearestFreeTiles(grid, [buildingFrontTile(building)], 1, taken);
  if (!tile) return false;
  createUnit(state, type, building.owner, tile.x, tile.y);
  return true;
}

/**
 * Adds a unit to a building's production queue and takes its price from the
 * owner's stock. Nothing is taken if the order is refused.
 */
export function queueUnit(
  state: GameState,
  player: PlayerId,
  buildingId: number,
  type: UnitType,
): CommandResult {
  const building = ownBuilding(state, player, buildingId);
  const stock = state.players[player];
  if (!building || !stock || !BUILDING_DEFS[building.type].trains.includes(type)) {
    return { ok: false, reason: 'invalid' };
  }
  if (building.queue.length >= PRODUCTION_CONFIG.maxQueue) {
    return { ok: false, reason: 'queueFull' };
  }
  if (reservedPopulation(state, player) >= START_CONFIG.populationCap) {
    return { ok: false, reason: 'populationCap' };
  }
  const missing = missingResources(stock, UNIT_DEFS[type].cost);
  if (missing.length > 0) return { ok: false, reason: 'insufficientResources', missing };

  pay(stock, UNIT_DEFS[type].cost);
  building.queue.push(type);
  return { ok: true };
}

/** Removes a unit from a building's production queue and gives its price back. */
export function cancelQueuedUnit(
  state: GameState,
  player: PlayerId,
  buildingId: number,
  index: number,
): CommandResult {
  const building = ownBuilding(state, player, buildingId);
  const stock = state.players[player];
  const type = building?.queue[index];
  if (!building || !stock || type === undefined || !Number.isInteger(index)) {
    return { ok: false, reason: 'invalid' };
  }
  building.queue.splice(index, 1);
  // Cancelling the unit in training throws away the work done on it.
  if (index === 0) building.trainTicks = 0;
  refund(stock, UNIT_DEFS[type].cost);
  return { ok: true };
}

function ownBuilding(state: GameState, player: PlayerId, id: number): Building | undefined {
  return state.entities.find(
    (entity): entity is Building =>
      entity.id === id && isBuilding(entity) && entity.owner === player,
  );
}
