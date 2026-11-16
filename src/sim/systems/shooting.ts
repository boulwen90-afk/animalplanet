import { BUILDING_DEFS } from '../../data/buildings';
import { SIM_CONFIG } from '../../data/sim';
import { buildingCentre, hasSurrendered, isBuilding, isUnit } from '../entities';
import { tileDistance } from '../map/grid';
import { buildPathGrid } from '../pathfinding/passability';
import type { Building, Entity, GameState, Projectile, Unit } from '../state';
import { collapse, isAttackable, provoke } from './combat';
import { launchProjectile } from './projectiles';
import { unitArmor } from '../upgrades';
import { surrender } from './surrender';

/** Simulation steps between two shots by a building that shoots. */
export function shotTicks(building: Building): number {
  const attack = BUILDING_DEFS[building.type].attack;
  return attack ? Math.max(1, Math.round(attack.cooldown * SIM_CONFIG.ticksPerSecond)) : 0;
}

/**
 * Life a shot or a throw with the given damage takes from what it lands on:
 * damage minus the target's armour, a unit's with its side's upgrades, and
 * at least 1.
 */
export function shotDamage(state: GameState, damage: number, target: Entity): number {
  const armor = isUnit(target) ? unitArmor(state, target) : BUILDING_DEFS[target.type].armor;
  return Math.max(1, damage - armor);
}

/**
 * The enemy unit a building would shoot at now: the nearest one its side
 * can see within its range, measured from the middle of the building. Of
 * two equally near, the one that came into the game first.
 */
export function shootingTarget(state: GameState, building: Building): Unit | undefined {
  const attack = BUILDING_DEFS[building.type].attack;
  if (!attack || !building.complete) return undefined;
  const centre = buildingCentre(building);
  let nearest: Unit | undefined;
  let nearestDistance = Infinity;
  for (const entity of state.entities) {
    if (!isUnit(entity) || !isAttackable(state, entity, building.owner)) continue;
    const distance = tileDistance(centre.x, centre.y, entity.x, entity.y);
    if (distance <= attack.range && distance < nearestDistance) {
      nearest = entity;
      nearestDistance = distance;
    }
  }
  return nearest;
}

/**
 * Runs one simulation step of every finished building that shoots: when it
 * may shoot again and an enemy unit is within range, it sends a projectile
 * after the nearest one.
 */
export function shootFromBuildings(state: GameState): void {
  if (state.winner !== null) return;
  for (const building of state.entities) {
    if (!isBuilding(building)) continue;
    const attack = BUILDING_DEFS[building.type].attack;
    if (!attack || !building.complete) continue;
    if (building.attackCooldown > 0) building.attackCooldown--;
    if (building.attackCooldown > 0) continue;
    const target = shootingTarget(state, building);
    if (!target) continue;

    launchProjectile(state, building.owner, building.id, buildingCentre(building), target.id, {
      kind: attack.projectile,
      damage: attack.damage,
      speed: attack.projectileSpeed,
    });
    building.attackCooldown = shotTicks(building);
  }
}

/**
 * Runs one simulation step of everything in the air. A projectile flies
 * straight towards where its target is now, the middle of a building, and
 * lands when it gets there: the target loses life. A unit with none left
 * surrenders, and a building with none left collapses. A unit that is hit
 * while it stands idle turns on the unit that threw. A projectile whose
 * target has left the game or surrendered meanwhile is taken away.
 */
export function flyProjectiles(state: GameState): void {
  if (state.projectiles.length === 0) return;
  const flying: Projectile[] = [];
  for (const projectile of state.projectiles) {
    if (state.winner !== null) break;
    const target = state.entities.find((entity) => entity.id === projectile.targetId);
    if (!target || (isUnit(target) && hasSurrendered(target))) continue;

    projectile.prevX = projectile.x;
    projectile.prevY = projectile.y;
    const aim = isUnit(target) ? { x: target.x, y: target.y } : buildingCentre(target);
    const dx = aim.x - projectile.x;
    const dy = aim.y - projectile.y;
    const distance = Math.hypot(dx, dy);
    if (distance > projectile.speed) {
      projectile.x += (dx / distance) * projectile.speed;
      projectile.y += (dy / distance) * projectile.speed;
      flying.push(projectile);
      continue;
    }

    const damage = shotDamage(state, projectile.damage, target);
    target.hp -= damage;
    state.events.push({ type: 'projectileHit', targetId: target.id, x: aim.x, y: aim.y, damage });
    if (isBuilding(target)) {
      state.events.push({ type: 'buildingAttacked', buildingId: target.id, owner: target.owner });
      if (target.hp <= 0) collapse(state, target);
    } else if (target.hp <= 0) {
      surrender(state, buildPathGrid(state), target);
    } else {
      provoke(state, target, projectile.sourceId);
    }
  }
  state.projectiles = flying;
}
