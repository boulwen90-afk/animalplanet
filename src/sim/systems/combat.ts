import { BUILDING_DEFS } from '../../data/buildings';
import { START_CONFIG } from '../../data/setup';
import { SIM_CONFIG } from '../../data/sim';
import { COMBAT_CONFIG, UNIT_DEFS } from '../../data/units';
import type { CommandResult } from '../commands';
import {
  buildingTiles,
  hasSurrendered,
  isBuilding,
  isUnit,
  removeEntity,
  tileGapToBuilding,
  unitTile,
} from '../entities';
import { tileDistance } from '../map/grid';
import { approachPath } from '../pathfinding/approach';
import type { PathGrid } from '../pathfinding/astar';
import { buildPathGrid } from '../pathfinding/passability';
import type { Building, Entity, GameState, PlayerId, Unit } from '../state';
import { surrender } from './surrender';
import { isEntityVisibleTo } from './visibility';

/** Simulation steps between two strikes by a unit. */
export function strikeTicks(unit: Unit): number {
  return Math.max(1, Math.round(UNIT_DEFS[unit.type].attackCooldown * SIM_CONFIG.ticksPerSecond));
}

/** Life a strike by `attacker` takes from `target`: damage minus armour, at least 1. */
export function strikeDamage(attacker: Unit, target: Entity): number {
  const armor = isUnit(target) ? UNIT_DEFS[target.type].armor : BUILDING_DEFS[target.type].armor;
  return Math.max(1, UNIT_DEFS[attacker.type].damage - armor);
}

/**
 * True if `player`'s units may attack this entity: it belongs to the other
 * side, has not surrendered, and is in sight. A target that slips into the
 * fog of war is lost.
 */
export function isAttackable(state: GameState, entity: Entity, player: PlayerId): boolean {
  if (entity.owner === player) return false;
  if (isUnit(entity) && hasSurrendered(entity)) return false;
  return isEntityVisibleTo(state, player, entity);
}

/** The walkable tiles, built when first needed and rebuilt after a building collapses. */
class GridCache {
  private grid: PathGrid | undefined;

  constructor(private readonly state: GameState) {}

  get(): PathGrid {
    this.grid ??= buildPathGrid(this.state);
    return this.grid;
  }

  invalidate(): void {
    this.grid = undefined;
  }
}

/** Runs one simulation step of fighting for every unit. */
export function resolveCombat(state: GameState): void {
  const grids = new GridCache(state);
  // Copy the list: units and buildings can leave the game while looping.
  for (const unit of state.entities.filter(isUnit)) {
    if (state.winner !== null) return;
    if (!state.entities.includes(unit) || hasSurrendered(unit)) continue;
    if (unit.attackCooldown > 0) unit.attackCooldown--;
    if (unit.task.kind === 'idle' && unit.path.length === 0) acquireTarget(state, unit);
    if (unit.task.kind === 'attack') pursueOrStrike(state, unit, grids);
  }
}

/** Orders units to attack an enemy unit or building. */
export function orderAttack(
  state: GameState,
  player: PlayerId,
  units: readonly Unit[],
  targetId: number,
): CommandResult {
  const target = state.entities.find((entity) => entity.id === targetId);
  const fighters = units.filter((unit) => UNIT_DEFS[unit.type].damage > 0);
  if (!target || !isAttackable(state, target, player) || fighters.length === 0) {
    return { ok: false, reason: 'invalid' };
  }
  for (const unit of fighters) {
    unit.task = { kind: 'attack', targetId, repathTicks: 0 };
    unit.path = [];
  }
  return { ok: true };
}

/**
 * Lets an idle unit that notices enemies pick the nearest enemy unit within
 * its aggro radius as its target. Units with no aggro radius only fight on order.
 */
function acquireTarget(state: GameState, unit: Unit): void {
  const radius = UNIT_DEFS[unit.type].aggroRadius;
  if (radius <= 0) return;
  let nearest: Unit | undefined;
  let nearestDistance = Infinity;
  for (const other of state.entities) {
    if (!isUnit(other) || !isAttackable(state, other, unit.owner)) continue;
    const distance = tileDistance(unit.x, unit.y, other.x, other.y);
    if (distance <= radius && distance < nearestDistance) {
      nearest = other;
      nearestDistance = distance;
    }
  }
  if (nearest) unit.task = { kind: 'attack', targetId: nearest.id, repathTicks: 0 };
}

function isInReach(unit: Unit, target: Entity): boolean {
  const here = unitTile(unit);
  if (isBuilding(target)) return tileGapToBuilding(target, here.x, here.y) <= 1;
  const there = unitTile(target);
  return Math.max(Math.abs(here.x - there.x), Math.abs(here.y - there.y)) <= 1;
}

/**
 * True if the tile the unit is on belongs to somebody else: another unit
 * stands still there, or, for a unit on the move, another unit is on its way
 * there. Of two units that both stand on a tile, the one that came into the
 * game first keeps it, so that they do not both leave.
 */
function standsOnTakenTile(state: GameState, unit: Unit): boolean {
  const here = unitTile(unit);
  const moving = unit.path.length > 0;
  for (const other of state.entities) {
    if (!isUnit(other) || other === unit || hasSurrendered(other)) continue;
    const there = other.path.length > 0 ? other.path.at(-1) : unitTile(other);
    if (!there || there.x !== here.x || there.y !== here.y) continue;
    if (other.path.length > 0) {
      if (moving) return true;
    } else if (moving || other.id < unit.id) {
      return true;
    }
  }
  return false;
}

/** Strikes the target if it is within reach, and otherwise walks towards it. */
function pursueOrStrike(state: GameState, unit: Unit, grids: GridCache): void {
  const task = unit.task;
  if (task.kind !== 'attack') return;
  const target = state.entities.find((entity) => entity.id === task.targetId);
  if (!target || !isAttackable(state, target, unit.owner)) {
    unit.task = { kind: 'idle' };
    unit.path = [];
    return;
  }

  // In reach, it stops and strikes. But not on a tile where somebody else
  // already stands: then it goes on to a place of its own.
  if (isInReach(unit, target) && !standsOnTakenTile(state, unit)) {
    unit.path = [];
    if (unit.attackCooldown === 0) strike(state, unit, target, grids);
    return;
  }

  // The target may be moving, so the path is renewed now and then. A unit
  // that waits for a place by the target looks again at the same pace.
  task.repathTicks--;
  if ((unit.path.length > 0 || task.waiting) && task.repathTicks > 0) return;
  const tiles = isBuilding(target) ? buildingTiles(target) : [unitTile(target)];
  const path = approachPath(state, grids.get(), unit, tiles);
  if (!path) {
    // It cannot get next to the target.
    unit.task = { kind: 'idle' };
    unit.path = [];
    return;
  }
  unit.path = path;
  task.waiting = path.length === 0;
  task.repathTicks = Math.max(
    1,
    Math.round(COMBAT_CONFIG.repathInterval * SIM_CONFIG.ticksPerSecond),
  );
}

function strike(state: GameState, attacker: Unit, target: Entity, grids: GridCache): void {
  const damage = strikeDamage(attacker, target);
  target.hp -= damage;
  attacker.attackCooldown = strikeTicks(attacker);
  state.events.push({ type: 'hit', attackerId: attacker.id, targetId: target.id, damage });

  if (isBuilding(target)) {
    state.events.push({ type: 'buildingAttacked', buildingId: target.id, owner: target.owner });
    if (target.hp <= 0) {
      collapse(state, target);
      grids.invalidate();
    }
  } else if (target.hp <= 0) {
    surrender(state, grids.get(), target);
  }
}

/** Removes a building whose life has run out. Losing the main building loses the game. */
function collapse(state: GameState, building: Building): void {
  removeEntity(state, building.id);
  state.events.push({
    type: 'buildingCollapsed',
    buildingId: building.id,
    owner: building.owner,
    x: building.x,
    y: building.y,
  });
  if (building.type === START_CONFIG.building) {
    state.winner = building.owner === 0 ? 1 : 0;
  }
}
