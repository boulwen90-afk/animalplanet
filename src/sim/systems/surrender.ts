import { CAVE_CONFIG } from '../../data/map';
import { hasSurrendered, isUnit, removeEntity, unitTile } from '../entities';
import { tileDistance, type Cave } from '../map/grid';
import { approachPath } from '../pathfinding/approach';
import type { PathGrid } from '../pathfinding/astar';
import type { GameState, Unit } from '../state';

/** Free places in a cave, counting places held for units on their way. */
export function freePlaces(cave: Cave): number {
  return CAVE_CONFIG.capacity - cave.occupants.length - cave.reserved;
}

/**
 * Makes a unit whose life has run out surrender. It stops what it was doing,
 * drops what it carried and sets off for the nearest cave of its own side
 * that has a free place and can be walked to; the place is held for it from
 * this moment. If there is no such cave, the unit vanishes for good.
 */
export function surrender(state: GameState, grid: PathGrid, unit: Unit): void {
  unit.hp = 0;
  unit.carryAmount = 0;
  unit.path = [];

  const here = unitTile(unit);
  const caves = state.map.caves
    .filter((cave) => cave.owner === unit.owner && freePlaces(cave) > 0)
    .sort(
      (a, b) =>
        tileDistance(a.x, a.y, here.x, here.y) - tileDistance(b.x, b.y, here.x, here.y) ||
        a.id - b.id,
    );
  for (const cave of caves) {
    const path = approachPath(state, grid, unit, [{ x: cave.x, y: cave.y }]);
    if (!path) continue;
    cave.reserved++;
    unit.task = { kind: 'flee', caveId: cave.id };
    unit.path = path;
    state.events.push({ type: 'surrender', unitId: unit.id });
    return;
  }

  removeEntity(state, unit.id);
  state.events.push({ type: 'vanish', unitId: unit.id });
}

/** Lets surrendered units that have reached their cave go in. */
export function resolveSurrenders(state: GameState): void {
  for (const unit of state.entities.filter(isUnit)) {
    if (!hasSurrendered(unit) || unit.task.kind !== 'flee' || unit.path.length > 0) continue;
    const caveId = unit.task.caveId;
    const cave = state.map.caves.find((candidate) => candidate.id === caveId);
    const here = unitTile(unit);
    const nextTo =
      cave !== undefined && Math.max(Math.abs(here.x - cave.x), Math.abs(here.y - cave.y)) <= 1;

    if (cave) cave.reserved = Math.max(0, cave.reserved - 1);
    removeEntity(state, unit.id);
    if (cave && nextTo) {
      cave.occupants.push(unit.type);
      state.events.push({ type: 'enterCave', unitId: unit.id, caveId: cave.id });
    } else {
      // Its way to the cave was cut off.
      state.events.push({ type: 'vanish', unitId: unit.id });
    }
  }
}
