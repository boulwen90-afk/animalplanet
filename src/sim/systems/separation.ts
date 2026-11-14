import { SIM_CONFIG } from '../../data/sim';
import { COLLISION_CONFIG, UNIT_DEFS } from '../../data/units';
import { hasSurrendered, isUnit, unitDestination, unitTile } from '../entities';
import { findPath, type PathGrid } from '../pathfinding/astar';
import { buildPathGrid, nearestFreeTiles } from '../pathfinding/passability';
import type { GameState, Unit } from '../state';

/**
 * Keeps units apart. Every unit has a radius, and two units whose centres
 * are closer than the sum of their radii are pushed away from each other, a
 * part of the overlap each step.
 *
 * The push is soft and slower than walking, so a unit can always force its
 * way through a crowd and nobody gets stuck, however many units there are.
 * Units on the move can therefore still pass through each other for a moment;
 * it is when they stand, and when they fight, that they keep a full body apart.
 *
 * - A unit on the move gives way to one that stands still; two units in the
 *   same state share the push.
 * - A unit that stands still is never pushed off its tile, so everything
 *   that goes by tiles (reach, gathering, building) still holds.
 * - A unit on the move is never pushed onto ground it could not walk on.
 * - Units that have surrendered are not in anybody's way.
 */
export function separateUnits(state: GameState): void {
  const units = state.entities.filter(isUnit).filter((unit) => !hasSurrendered(unit));
  if (units.length < 2) return;

  // Units by the tile they are on; radii are below half a tile, so only
  // units on the same or a neighbouring tile can touch.
  const { width } = state.map;
  const byTile = new Map<number, number[]>();
  units.forEach((unit, index) => {
    const key = Math.floor(unit.y) * width + Math.floor(unit.x);
    const list = byTile.get(key);
    if (list) list.push(index);
    else byTile.set(key, [index]);
  });

  const pushX = new Float64Array(units.length);
  const pushY = new Float64Array(units.length);
  const share = Math.min(1, COLLISION_CONFIG.stiffnessPerSecond / SIM_CONFIG.ticksPerSecond);
  let touched = false;

  units.forEach((a, i) => {
    const tileX = Math.floor(a.x);
    const tileY = Math.floor(a.y);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const others = byTile.get((tileY + dy) * width + tileX + dx);
        if (!others) continue;
        for (const j of others) {
          // Each pair once.
          if (j <= i) continue;
          const b = units[j] as Unit;
          const room = UNIT_DEFS[a.type].radius + UNIT_DEFS[b.type].radius;
          let nx = b.x - a.x;
          let ny = b.y - a.y;
          const distance = Math.hypot(nx, ny);
          if (distance >= room) continue;
          if (distance < 1e-6) {
            // On the very same spot: pick a direction from their ids, so that
            // the same game always plays out the same way.
            const angle = (a.id * 7 + b.id * 13) * 2.399963;
            nx = Math.cos(angle);
            ny = Math.sin(angle);
          } else {
            nx /= distance;
            ny /= distance;
          }
          const overlap = (room - distance) * share;
          const aMoves = a.path.length > 0;
          const bMoves = b.path.length > 0;
          const forA = aMoves === bMoves ? 0.5 : aMoves ? 1 : 0;
          pushX[i] = (pushX[i] as number) - nx * overlap * forA;
          pushY[i] = (pushY[i] as number) - ny * overlap * forA;
          pushX[j] = (pushX[j] as number) + nx * overlap * (1 - forA);
          pushY[j] = (pushY[j] as number) + ny * overlap * (1 - forA);
          touched = true;
        }
      }
    }
  });
  if (!touched) return;

  const furthest = COLLISION_CONFIG.maxPushSpeed / SIM_CONFIG.ticksPerSecond;
  const margin = COLLISION_CONFIG.tileMargin;
  let grid: PathGrid | undefined;
  units.forEach((unit, i) => {
    const [dx, dy] = capped(pushX[i] as number, pushY[i] as number, furthest);
    if (dx === 0 && dy === 0) return;
    const tileX = Math.floor(unit.x);
    const tileY = Math.floor(unit.y);

    if (unit.path.length === 0) {
      // Standing still: stay inside the tile.
      unit.x = Math.min(tileX + 1 - margin, Math.max(tileX + margin, unit.x + dx));
      unit.y = Math.min(tileY + 1 - margin, Math.max(tileY + margin, unit.y + dy));
      return;
    }

    // On the move: anywhere it could walk. Try the whole push, then each direction alone.
    for (const [stepX, stepY] of [
      [dx, dy],
      [dx, 0],
      [0, dy],
    ] as const) {
      const x = unit.x + stepX;
      const y = unit.y + stepY;
      const toX = Math.floor(x);
      const toY = Math.floor(y);
      if (toX !== tileX || toY !== tileY) {
        grid ??= buildPathGrid(state);
        const outside = toX < 0 || toY < 0 || toX >= grid.width || toY >= grid.height;
        if (outside || grid.blocked[toY * grid.width + toX] !== 0) continue;
      }
      unit.x = x;
      unit.y = y;
      return;
    }
  });
}

/** A push no longer than `limit`. */
function capped(dx: number, dy: number, limit: number): [number, number] {
  const length = Math.hypot(dx, dy);
  if (length <= limit) return [dx, dy];
  return [(dx * limit) / length, (dy * limit) / length];
}

/**
 * Sends idle units that have come to a stop on a tile where somebody else
 * already stands to the nearest free tile. A unit stops wherever it is when
 * its target is gone, and that can be on top of another unit. Of several on a
 * tile, the one that came into the game first stays. Units that work on
 * something keep their place: gathering and building go by tiles.
 */
export function settleUnits(state: GameState): void {
  const { width } = state.map;
  const standing = new Map<number, Unit>();
  const crowded: Unit[] = [];
  for (const unit of state.entities) {
    if (!isUnit(unit) || hasSurrendered(unit) || unit.path.length > 0) continue;
    const key = Math.floor(unit.y) * width + Math.floor(unit.x);
    if (!standing.has(key)) standing.set(key, unit);
    else if (unit.task.kind === 'idle') crowded.push(unit);
  }
  if (crowded.length === 0) return;

  const grid = buildPathGrid(state);
  const taken = new Set<number>();
  for (const unit of state.entities) {
    if (!isUnit(unit)) continue;
    const tile = unitDestination(unit);
    taken.add(tile.y * width + tile.x);
  }
  for (const unit of crowded) {
    const here = unitTile(unit);
    const [free] = nearestFreeTiles(grid, [here], 1, taken);
    if (!free) continue;
    const path = findPath(grid, here, free);
    if (!path || path.length === 0) continue;
    unit.path = path;
    taken.add(free.y * width + free.x);
  }
}
