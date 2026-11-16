import { GATHER_CONFIG, RESOURCE_TYPES } from '../data/resources';
import type { UnitType } from '../data/units';
import { UNIT_DEFS } from '../data/units';
import { applyCommand } from './commands';
import { buildingCentre, isBuilding, isUnit } from './entities';
import type { ExtraUnits } from './game';
import { isWalkable, tileDistance } from './map/grid';
import type { Point } from './map/iso';
import { resourceAt } from './resources';
import type { GameState, PlayerId } from './state';

/**
 * Stress runs: a match with many extra units, for measuring how the game
 * runs on a machine. The units are shared between the two sides, as they
 * would be in a match between two players, and get their orders through
 * the same commands as a player's.
 *
 * - `still`: workers that stand where they were put.
 * - `gather`: workers that gather, every other crew wood and the rest food.
 * - `fight`: soldiers that walk to the middle of the map and fight there.
 */
export type StressMode = 'still' | 'gather' | 'fight';

export const STRESS_MODES: readonly StressMode[] = ['still', 'gather', 'fight'];

/** The mode a stress run has when none is asked for. */
export const DEFAULT_STRESS_MODE: StressMode = 'gather';

/** In a fight, one soldier in this many fights from a distance. */
const THROWER_EVERY = 3;

/**
 * The extra units of a stress run with `count` of them: half to each side,
 * the odd one to side 0. Workers, or in a fight soldiers of both kinds.
 */
export function stressUnits(count: number, mode: StressMode): ExtraUnits[] {
  const types = Object.keys(UNIT_DEFS) as UnitType[];
  const worker = types.find((type) => UNIT_DEFS[type].carryCapacity > 0);
  const melee = types.find(
    (type) => UNIT_DEFS[type].aggroRadius > 0 && UNIT_DEFS[type].ranged === undefined,
  );
  const ranged = types.find((type) => UNIT_DEFS[type].ranged !== undefined);
  const extra: ExtraUnits[] = [];
  const add = (owner: PlayerId, type: UnitType | undefined, units: number) => {
    if (type && units > 0) extra.push({ owner, type, count: units });
  };
  for (const owner of [0, 1] as const) {
    const share = owner === 0 ? Math.ceil(count / 2) : Math.floor(count / 2);
    if (mode !== 'fight') {
      add(owner, worker, share);
      continue;
    }
    const throwers = ranged ? Math.floor(share / THROWER_EVERY) : 0;
    add(owner, melee, share - throwers);
    add(owner, ranged, throwers);
  }
  return extra;
}

/** Gives the units of a stress run their first orders. In `still` there are none. */
export function startStress(state: GameState, mode: StressMode): void {
  if (mode === 'gather') {
    state.players.forEach((_, index) => putToWork(state, index as PlayerId));
  }
  if (mode === 'fight') {
    const middle = { x: Math.floor(state.map.width / 2), y: Math.floor(state.map.height / 2) };
    state.players.forEach((_, index) => {
      const player = index as PlayerId;
      const unitIds = state.entities
        .filter(isUnit)
        .filter((unit) => unit.owner === player && UNIT_DEFS[unit.type].aggroRadius > 0)
        .map((unit) => unit.id);
      applyCommand(state, { type: 'move', player, unitIds, ...middle });
    });
  }
}

/** A source of a resource, how far it is from a side's base, and how many workers have room at it. */
interface Source extends Point {
  distance: number;
  room: number;
}

/**
 * Sends a side's workers to gather, every other one wood and the rest food:
 * as many to each source as have room there, the sources nearest its base
 * first, and only sources on its own half of the map. Workers left over
 * when one resource has no more sources gather the other.
 */
function putToWork(state: GameState, player: PlayerId): void {
  const home = state.entities.find((entity) => isBuilding(entity) && entity.owner === player);
  const away = state.entities.find((entity) => isBuilding(entity) && entity.owner !== player);
  if (!home || !isBuilding(home)) return;
  const centre = buildingCentre(home);
  const other = away && isBuilding(away) ? buildingCentre(away) : undefined;

  // The sources of each resource on this side's half, nearest first.
  const sources = RESOURCE_TYPES.map((resource) => {
    const found: Source[] = [];
    for (let y = 0; y < state.map.height; y++) {
      for (let x = 0; x < state.map.width; x++) {
        if (resourceAt(state.map, x, y) !== resource) continue;
        const distance = tileDistance(x, y, centre.x, centre.y);
        if (other && distance > tileDistance(x, y, other.x, other.y)) continue;
        // Room for a worker on each open tile beside it, up to the most a source takes.
        let open = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if ((dx !== 0 || dy !== 0) && isWalkable(state.map, x + dx, y + dy)) open++;
          }
        }
        const room = Math.min(open, GATHER_CONFIG.placesPerSource);
        if (room > 0) found.push({ x, y, distance, room });
      }
    }
    return found.sort((a, b) => a.distance - b.distance || a.y - b.y || a.x - b.x);
  });

  const workers = state.entities
    .filter(isUnit)
    .filter((unit) => unit.owner === player && UNIT_DEFS[unit.type].carryCapacity > 0);
  const used = sources.map(() => 0);
  let turn = 0;
  for (let i = 0; i < workers.length;) {
    // The next resource in turn that still has a source without a crew.
    let kind = -1;
    for (let tries = 0; tries < sources.length && kind < 0; tries++) {
      const candidate = (turn + tries) % sources.length;
      if ((used[candidate] as number) < (sources[candidate] as Source[]).length) kind = candidate;
    }
    if (kind < 0) return;
    turn = kind + 1;
    const source = (sources[kind] as Source[])[used[kind] as number] as Source;
    used[kind] = (used[kind] as number) + 1;
    const unitIds = workers.slice(i, i + source.room).map((unit) => unit.id);
    i += source.room;
    applyCommand(state, { type: 'gather', player, unitIds, x: source.x, y: source.y });
  }
}
