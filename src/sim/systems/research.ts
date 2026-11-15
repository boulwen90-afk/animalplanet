import { BUILDING_DEFS } from '../../data/buildings';
import { PRODUCTION_CONFIG } from '../../data/production';
import { SIM_CONFIG } from '../../data/sim';
import { UPGRADE_DEFS, type UpgradeLevel, type UpgradeType } from '../../data/upgrades';
import type { CommandResult } from '../commands';
import { missingResources, pay, refund } from '../economy';
import { isBuilding } from '../entities';
import type { Building, GameState, PlayerId } from '../state';
import { upgradeLevel } from '../upgrades';

/**
 * The level of an upgrade a side would buy next, or undefined when it has
 * them all. Levels are counted from 1; the first is `levels[0]`.
 */
export function nextUpgradeLevel(
  state: GameState,
  player: PlayerId,
  upgrade: UpgradeType,
): UpgradeLevel | undefined {
  return UPGRADE_DEFS[upgrade].levels[upgradeLevel(state, player, upgrade)];
}

/** True if a side has a level of an upgrade waiting or being worked out in one of its buildings. */
export function isBeingResearched(
  state: GameState,
  player: PlayerId,
  upgrade: UpgradeType,
): boolean {
  return state.entities.some(
    (entity) => isBuilding(entity) && entity.owner === player && entity.research.includes(upgrade),
  );
}

/** Simulation steps it takes to work out the next level of an upgrade for a side. */
export function researchTicksFor(state: GameState, player: PlayerId, upgrade: UpgradeType): number {
  const level = nextUpgradeLevel(state, player, upgrade);
  return level ? Math.round(level.time * SIM_CONFIG.ticksPerSecond) : 0;
}

/** How far a building has come with the upgrade it is working out, from 0 to 1; 0 with none. */
export function researchFraction(state: GameState, building: Building): number {
  const [current] = building.research;
  if (!current) return 0;
  const total = researchTicksFor(state, building.owner, current);
  return total > 0 ? Math.min(building.researchTicks / total, 1) : 0;
}

/**
 * Adds the next level of an upgrade to a building's queue and takes its
 * price from the owner's stock. One level of an upgrade is worked out at a
 * time: the order is refused while a level of the same upgrade is waiting
 * or being worked out anywhere, and when the side has every level. Nothing
 * is taken if the order is refused.
 */
export function queueResearch(
  state: GameState,
  player: PlayerId,
  buildingId: number,
  upgrade: UpgradeType,
): CommandResult {
  const building = ownBuilding(state, player, buildingId);
  const stock = state.players[player];
  if (
    !building ||
    !stock ||
    !building.complete ||
    !BUILDING_DEFS[building.type].researches?.includes(upgrade)
  ) {
    return { ok: false, reason: 'invalid' };
  }
  const level = nextUpgradeLevel(state, player, upgrade);
  if (!level || isBeingResearched(state, player, upgrade)) return { ok: false, reason: 'invalid' };
  if (building.research.length >= PRODUCTION_CONFIG.maxQueue) {
    return { ok: false, reason: 'queueFull' };
  }
  const missing = missingResources(stock, level.cost);
  if (missing.length > 0) return { ok: false, reason: 'insufficientResources', missing };

  pay(stock, level.cost);
  building.research.push(upgrade);
  return { ok: true };
}

/** Removes an upgrade from a building's queue and gives its price back. */
export function cancelResearch(
  state: GameState,
  player: PlayerId,
  buildingId: number,
  index: number,
): CommandResult {
  const building = ownBuilding(state, player, buildingId);
  const stock = state.players[player];
  const upgrade = building?.research[index];
  if (!building || !stock || upgrade === undefined || !Number.isInteger(index)) {
    return { ok: false, reason: 'invalid' };
  }
  // The level in the queue is the side's next: it has not been reached yet.
  const level = nextUpgradeLevel(state, player, upgrade);
  building.research.splice(index, 1);
  // Cancelling the upgrade being worked out throws away the work done on it.
  if (index === 0) building.researchTicks = 0;
  if (level) refund(stock, level.cost);
  return { ok: true };
}

/**
 * Runs one simulation step of every building that is working out an
 * upgrade. When the work is done the side has the next level, for all its
 * units from that step on.
 */
export function researchUpgrades(state: GameState): void {
  for (const building of state.entities) {
    if (!isBuilding(building)) continue;
    const [current] = building.research;
    if (!current) continue;
    const side = state.players[building.owner];
    if (!side) continue;
    building.researchTicks++;
    if (building.researchTicks < researchTicksFor(state, building.owner, current)) continue;
    side.upgrades[current]++;
    building.research.shift();
    building.researchTicks = 0;
    state.events.push({
      type: 'upgradeDone',
      owner: building.owner,
      upgrade: current,
      level: side.upgrades[current],
    });
  }
}

function ownBuilding(state: GameState, player: PlayerId, id: number): Building | undefined {
  return state.entities.find(
    (entity): entity is Building =>
      entity.id === id && isBuilding(entity) && entity.owner === player,
  );
}
