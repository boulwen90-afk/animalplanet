import { BUILDING_DEFS } from '../../data/buildings';
import { START_CONFIG } from '../../data/setup';
import { SIM_CONFIG } from '../../data/sim';
import { COMBAT_CONFIG, UNIT_DEFS, type RangedDef } from '../../data/units';
import type { CommandResult } from '../commands';
import {
  buildingTiles,
  hasSurrendered,
  isBuilding,
  isUnit,
  removeEntity,
  tileGapToBuilding,
  unitDestination,
  unitTile,
} from '../entities';
import { tileDistance } from '../map/grid';
import type { Point } from '../map/iso';
import { approachPath } from '../pathfinding/approach';
import { findPath, reachableTiles, type PathGrid } from '../pathfinding/astar';
import { PathGrids } from '../pathfinding/passability';
import { isPathOpen, rerouteForOpening } from '../pathfinding/reroute';
import type { Building, Entity, GameState, PlayerId, Unit } from '../state';
import { throwDamage, unitArmor, unitDamage } from '../upgrades';
import { launchProjectile } from './projectiles';
import { surrender } from './surrender';
import { isEntityVisibleTo } from './visibility';

/** Simulation steps between two strikes by a unit. */
export function strikeTicks(unit: Unit): number {
  return Math.max(1, Math.round(UNIT_DEFS[unit.type].attackCooldown * SIM_CONFIG.ticksPerSecond));
}

/** Simulation steps between two throws by a unit that fights from a distance; 0 for one that does not. */
export function throwTicks(unit: Unit): number {
  const ranged = UNIT_DEFS[unit.type].ranged;
  return ranged ? Math.max(1, Math.round(ranged.cooldown * SIM_CONFIG.ticksPerSecond)) : 0;
}

/**
 * How far it is from a unit to something, in tiles, as a throw is measured:
 * to the middle of a unit, and to the nearest edge of a building.
 */
export function throwDistance(from: Point, target: Entity): number {
  if (isUnit(target)) return tileDistance(from.x, from.y, target.x, target.y);
  const size = BUILDING_DEFS[target.type].size;
  const x = Math.min(Math.max(from.x, target.x), target.x + size);
  const y = Math.min(Math.max(from.y, target.y), target.y + size);
  return tileDistance(from.x, from.y, x, y);
}

/**
 * How a unit attacks a target from where it stands. A unit that fights from
 * a distance throws at everything except an enemy unit on a tile next to
 * its own: it has no room to throw at that, and strikes it. Every other
 * unit strikes.
 */
export function attackMode(unit: Unit, target: Entity): 'strike' | 'throw' {
  if (!UNIT_DEFS[unit.type].ranged) return 'strike';
  return isUnit(target) && isInReach(unit, target) ? 'strike' : 'throw';
}

/**
 * Life a strike by `attacker` takes from `target`: damage minus armour, at
 * least 1. Both count the upgrades their sides have.
 */
export function strikeDamage(state: GameState, attacker: Unit, target: Entity): number {
  const armor = isUnit(target) ? unitArmor(state, target) : BUILDING_DEFS[target.type].armor;
  return Math.max(1, unitDamage(state, attacker) - armor);
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

/** Runs one simulation step of fighting for every unit. */
export function resolveCombat(state: GameState): void {
  const grids = new PathGrids(state);
  // The units that want to look for a path to their target this step.
  const seekers: Unit[] = [];
  // Copy the list: units and buildings can leave the game while looping.
  for (const unit of state.entities.filter(isUnit)) {
    if (state.winner !== null) return;
    if (!state.entities.includes(unit) || hasSurrendered(unit)) continue;
    if (unit.attackCooldown > 0) unit.attackCooldown--;
    if (unit.task.kind === 'idle' && unit.path.length === 0) acquireTarget(state, unit);
    if (unit.task.kind === 'attack' && pursueOrStrike(state, unit, grids)) seekers.push(unit);
  }
  seekPaths(state, seekers, grids);
}

/**
 * Lets the units that want a path to their target look for one, but no more
 * than `searchesPerStep` of them in one step: those that have waited longest
 * first, and of those the oldest unit. The others keep the path they have,
 * or stand, and are among the first in the next step.
 *
 * Without the limit an army ordered to attack looked for its paths in one
 * and the same step, and again every half second after: with 400 units
 * that step took longer than three steps have.
 */
function seekPaths(state: GameState, seekers: Unit[], grids: PathGrids): void {
  const waited = (unit: Unit) => (unit.task.kind === 'attack' ? -unit.task.repathTicks : 0);
  seekers.sort((a, b) => waited(b) - waited(a) || a.id - b.id);
  for (const unit of seekers.slice(0, COMBAT_CONFIG.searchesPerStep)) {
    // An earlier one in the list may have ended the match, or this unit's fight.
    if (state.winner !== null) return;
    if (unit.task.kind !== 'attack' || !state.entities.includes(unit)) continue;
    const target = state.entities.find((entity) => entity.id === targetIdOf(unit));
    if (target) seekPath(state, unit, target, grids);
  }
}

function targetIdOf(unit: Unit): number | undefined {
  return unit.task.kind === 'attack' ? unit.task.targetId : undefined;
}

/**
 * The tile a target is on: for a building its corner. A unit that has
 * found a path to a target need not look again while the target is still
 * there.
 */
function aimOf(state: GameState, target: Entity): number {
  const tile = isBuilding(target) ? { x: target.x, y: target.y } : unitTile(target);
  return tile.y * state.map.width + tile.x;
}

/**
 * Counts down to the next time a unit on its way to a target may look for a
 * new path, and says whether that time has come. A unit that has a path and
 * is not waiting for a place looks again only if the target has moved to
 * another tile since, or something has come to stand in the way; a unit
 * without a path, or one that waits for a place by the target, looks every
 * time.
 */
function isDueToSeek(state: GameState, unit: Unit, target: Entity, grids: PathGrids): boolean {
  const task = unit.task;
  if (task.kind !== 'attack') return false;
  task.repathTicks--;
  if (unit.path.length === 0 && !task.waiting) return true;
  if (task.repathTicks > 0) return false;
  if (
    !task.waiting &&
    task.aim === aimOf(state, target) &&
    isPathOpen(grids.for(unit.owner), unitTile(unit), unit.path)
  ) {
    // The target stands where it stood and nothing has come in the way: the path still leads there.
    task.repathTicks = repathSteps();
    return false;
  }
  return true;
}

/** How many steps a unit waits between two looks for a new path. */
function repathSteps(): number {
  return Math.max(1, Math.round(COMBAT_CONFIG.repathInterval * SIM_CONFIG.ticksPerSecond));
}

/** Looks for a path for a unit to where it can strike or throw at its target, and sets it walking. */
function seekPath(state: GameState, unit: Unit, target: Entity, grids: PathGrids): void {
  const task = unit.task;
  if (task.kind !== 'attack') return;
  const ranged = UNIT_DEFS[unit.type].ranged;
  const grid = grids.for(unit.owner);
  let path: Point[] | undefined;
  if (ranged && attackMode(unit, target) === 'throw') {
    path = throwingPath(state, grid, unit, target, ranged.range);
  } else {
    const tiles = isBuilding(target) ? buildingTiles(target) : [unitTile(target)];
    path = approachPath(state, grid, unit, tiles);
  }
  if (!path) {
    // It cannot get to where it could strike or throw.
    unit.task = { kind: 'idle' };
    unit.path = [];
    return;
  }
  unit.path = path;
  task.waiting = path.length === 0;
  task.aim = aimOf(state, target);
  task.repathTicks = repathSteps();
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
 * Makes a unit that has been hit from a distance turn on the unit that
 * threw, if it stands idle, fights on its own and can see the thrower.
 * Without this a soldier would stand and be thrown at from just outside
 * the radius at which it notices enemies.
 */
export function provoke(state: GameState, victim: Unit, attackerId: number): void {
  if (victim.task.kind !== 'idle' || victim.path.length > 0) return;
  if (UNIT_DEFS[victim.type].aggroRadius <= 0) return;
  const attacker = state.entities.find((entity) => entity.id === attackerId);
  if (!attacker || !isUnit(attacker) || !isAttackable(state, attacker, victim.owner)) return;
  victim.task = { kind: 'attack', targetId: attacker.id, repathTicks: 0 };
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

/**
 * Strikes the target if it is within reach, and otherwise walks towards it.
 * A unit that fights from a distance throws instead, from within its range.
 */
function pursueOrStrike(state: GameState, unit: Unit, grids: PathGrids): boolean {
  const task = unit.task;
  if (task.kind !== 'attack') return false;
  const target = state.entities.find((entity) => entity.id === task.targetId);
  if (!target || !isAttackable(state, target, unit.owner)) {
    unit.task = { kind: 'idle' };
    unit.path = [];
    return false;
  }

  const ranged = UNIT_DEFS[unit.type].ranged;
  if (ranged && attackMode(unit, target) === 'throw')
    return pursueOrThrow(state, unit, target, ranged, grids);

  // In reach, it stops and strikes. But not on a tile where somebody else
  // already stands: then it goes on to a place of its own.
  if (isInReach(unit, target) && !standsOnTakenTile(state, unit)) {
    unit.path = [];
    if (unit.attackCooldown === 0) strike(state, unit, target, grids);
    return false;
  }
  // The target may be moving, so the path is renewed now and then.
  return isDueToSeek(state, unit, target, grids);
}

/**
 * Throws at the target if it is within range, and otherwise says whether
 * the unit wants to look for a path to where it can throw from. The unit
 * stops as soon as it is within range, as far from the target as it can
 * be; but not on a tile where somebody else already stands.
 */
function pursueOrThrow(
  state: GameState,
  unit: Unit,
  target: Entity,
  ranged: RangedDef,
  grids: PathGrids,
): boolean {
  const task = unit.task;
  if (task.kind !== 'attack') return false;
  if (throwDistance(unit, target) <= ranged.range && !standsOnTakenTile(state, unit)) {
    unit.path = [];
    if (unit.attackCooldown > 0) return false;
    launchProjectile(state, unit.owner, unit.id, { x: unit.x, y: unit.y }, target.id, {
      kind: ranged.projectile,
      damage: throwDamage(state, unit),
      speed: ranged.projectileSpeed,
    });
    unit.attackCooldown = throwTicks(unit);
    task.threw = true;
    return false;
  }
  return isDueToSeek(state, unit, target, grids);
}

/**
 * A unit that stands anywhere on a tile is no further than this from the
 * middle of the tile: half the diagonal. A tile whose middle is this much
 * inside a range is within the range all over.
 */
const TILE_REACH = Math.SQRT1_2;

/**
 * A path for a unit to a tile it can throw at the target from: of the tiles
 * that are within `range` of the target all over, that the unit can walk
 * to, and that no other unit stands on or is heading for, the one closest
 * to the unit. Coming from outside the range that is a tile at the rim of
 * it, so a group spreads out along the rim instead of crowding in.
 *
 * Returns an empty path if the unit already stands on that tile, and
 * undefined if there is no such tile.
 */
function throwingPath(
  state: GameState,
  grid: PathGrid,
  unit: Unit,
  target: Entity,
  range: number,
): Point[] | undefined {
  const here = unitTile(unit);
  const reach = reachableTiles(grid, here);
  const taken = new Set<number>();
  for (const other of state.entities) {
    if (!isUnit(other) || other === unit) continue;
    const tile = unitDestination(other);
    taken.add(tile.y * grid.width + tile.x);
  }

  const size = isBuilding(target) ? BUILDING_DEFS[target.type].size : 0;
  const far = Math.ceil(range);
  const fromX = Math.max(0, Math.floor(target.x) - far);
  const fromY = Math.max(0, Math.floor(target.y) - far);
  const toX = Math.min(grid.width - 1, Math.floor(target.x) + size + far);
  const toY = Math.min(grid.height - 1, Math.floor(target.y) + size + far);
  let best: Point | undefined;
  let bestDistance = Infinity;
  for (let y = fromY; y <= toY; y++) {
    for (let x = fromX; x <= toX; x++) {
      const index = y * grid.width + x;
      if (!reach[index] || taken.has(index)) continue;
      const middle = { x: x + 0.5, y: y + 0.5 };
      if (throwDistance(middle, target) > range - TILE_REACH) continue;
      const distance = tileDistance(middle.x, middle.y, unit.x, unit.y);
      if (distance < bestDistance) {
        best = { x, y };
        bestDistance = distance;
      }
    }
  }
  return best && findPath(grid, here, best);
}

function strike(state: GameState, attacker: Unit, target: Entity, grids: PathGrids): void {
  const damage = strikeDamage(state, attacker, target);
  target.hp -= damage;
  attacker.attackCooldown = strikeTicks(attacker);
  if (attacker.task.kind === 'attack') attacker.task.threw = false;
  state.events.push({ type: 'hit', attackerId: attacker.id, targetId: target.id, damage });

  if (isBuilding(target)) {
    state.events.push({ type: 'buildingAttacked', buildingId: target.id, owner: target.owner });
    if (target.hp <= 0) {
      collapse(state, target);
      grids.invalidate();
    }
  } else if (target.hp <= 0) {
    surrender(state, grids.for(target.owner), target);
  }
}

/**
 * Removes a building whose life has run out. Units on the move take the way
 * that has opened, if it is shorter. Losing the main building loses the game.
 */
export function collapse(state: GameState, building: Building): void {
  removeEntity(state, building.id);
  if (!BUILDING_DEFS[building.type].walkable) rerouteForOpening(state);
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
