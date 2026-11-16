import { SIM_CONFIG } from '../../data/sim';
import type { ProjectileKind } from '../../data/types';
import type { Point } from '../map/iso';
import type { GameState, PlayerId, Projectile } from '../state';

/** What is sent through the air: what it is, how hard it lands and how fast it flies. */
export interface Launch {
  kind: ProjectileKind;
  /** Life it takes from its target, before the target's armour. */
  damage: number;
  /** In tiles per second. */
  speed: number;
}

/**
 * Sends a projectile from a building or a unit after a target, and tells
 * the display that it was shot. It is flown by `flyProjectiles`.
 */
export function launchProjectile(
  state: GameState,
  owner: PlayerId,
  sourceId: number,
  from: Point,
  targetId: number,
  launch: Launch,
): Projectile {
  const projectile: Projectile = {
    id: state.nextEntityId++,
    owner,
    kind: launch.kind,
    sourceId,
    targetId,
    startX: from.x,
    startY: from.y,
    x: from.x,
    y: from.y,
    prevX: from.x,
    prevY: from.y,
    speed: launch.speed / SIM_CONFIG.ticksPerSecond,
    damage: launch.damage,
  };
  state.projectiles.push(projectile);
  state.events.push({ type: 'shot', sourceId, targetId, projectileId: projectile.id });
  return projectile;
}
