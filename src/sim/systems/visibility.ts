import { BUILDING_DEFS, CONSTRUCTION_CONFIG } from '../../data/buildings';
import { UNIT_DEFS } from '../../data/units';
import { buildingCentre, buildingTiles, hasSurrendered, isUnit, unitTile } from '../entities';
import { inBounds, tileIndex } from '../map/grid';
import type { MapSize } from '../map/iso';
import {
  EXPLORED,
  UNEXPLORED,
  VISIBLE,
  type Entity,
  type GameState,
  type PlayerId,
} from '../state';

/**
 * Recomputes what each side sees. Tiles within sight of one of the side's
 * units or buildings are VISIBLE; tiles that were visible before stay
 * EXPLORED. Sight is a circle measured in tiles, and terrain does not block
 * it. A unit that has surrendered no longer sees for its side.
 *
 * Each side's sight is first drawn into a list of marks, a row of tiles at
 * a time, and then written into what the side knows in one pass. Hundreds
 * of units mostly see the same tiles; trying every tile around every unit
 * was most of a simulation step with 400 of them.
 */
export function updateVisibility(state: GameState): void {
  const { map } = state;
  const size = map.width * map.height;
  const seen = state.players.map(() => new Uint8Array(size));

  for (const entity of state.entities) {
    const marks = seen[entity.owner];
    if (!marks) continue;
    if (isUnit(entity)) {
      if (hasSurrendered(entity)) continue;
      const here = unitTile(entity);
      reveal(map, marks, here.x + 0.5, here.y + 0.5, UNIT_DEFS[entity.type].sight);
    } else {
      const centre = buildingCentre(entity);
      const sight = entity.complete ? BUILDING_DEFS[entity.type].sight : CONSTRUCTION_CONFIG.sight;
      reveal(map, marks, centre.x, centre.y, sight);
    }
  }

  state.players.forEach((player, index) => {
    const tiles = player.visibility;
    const marks = seen[index] as Uint8Array;
    for (let i = 0; i < size; i++) {
      if (marks[i] === 1) tiles[i] = VISIBLE;
      else if (tiles[i] === VISIBLE) tiles[i] = EXPLORED;
    }
  });
}

/**
 * Marks every tile whose centre lies within `radius` of a point. Row by row:
 * the tiles of a row that are within the circle lie side by side, so only
 * the two ends of the stretch have to be found.
 */
function reveal(map: MapSize, marks: Uint8Array, x: number, y: number, radius: number): void {
  const within = radius * radius;
  const top = Math.max(0, Math.floor(y - radius));
  const bottom = Math.min(map.height - 1, Math.ceil(y + radius));
  for (let ty = top; ty <= bottom; ty++) {
    const dy = ty + 0.5 - y;
    const room = within - dy * dy;
    if (room < 0) continue;
    // About where the stretch ends, and then exactly: the tile at an end is
    // inside, and the one beyond it is not.
    const half = Math.sqrt(room);
    const inside = (tx: number) => {
      const dx = tx + 0.5 - x;
      return dx * dx <= room;
    };
    let first = Math.ceil(x - 0.5 - half);
    while (inside(first - 1)) first--;
    while (first <= x && !inside(first)) first++;
    let last = Math.floor(x - 0.5 + half);
    while (inside(last + 1)) last++;
    while (last >= first && !inside(last)) last--;
    first = Math.max(first, 0);
    last = Math.min(last, map.width - 1);
    if (first <= last) marks.fill(1, ty * map.width + first, ty * map.width + last + 1);
  }
}

/**
 * What a side knows about a tile. With the fog of war off, and for a side
 * played by the computer, everything is visible.
 */
export function visibilityAt(state: GameState, player: PlayerId, x: number, y: number): number {
  // The computer opponent knows the whole map (GDD section 10).
  if (!state.fogEnabled || state.players[player]?.ai) return VISIBLE;
  if (!inBounds(x, y, state.map)) return UNEXPLORED;
  return state.players[player]?.visibility[tileIndex(x, y, state.map)] ?? UNEXPLORED;
}

export function isTileVisible(state: GameState, player: PlayerId, x: number, y: number): boolean {
  return visibilityAt(state, player, x, y) === VISIBLE;
}

/** True if the side has seen the tile at some point. */
export function isTileExplored(state: GameState, player: PlayerId, x: number, y: number): boolean {
  return visibilityAt(state, player, x, y) !== UNEXPLORED;
}

/**
 * True if a side can see an entity right now: its own always, others when
 * they stand on a visible tile (for a building, when any of its tiles is visible).
 */
export function isEntityVisibleTo(state: GameState, player: PlayerId, entity: Entity): boolean {
  if (entity.owner === player || !state.fogEnabled || state.players[player]?.ai) return true;
  if (isUnit(entity)) {
    const tile = unitTile(entity);
    return isTileVisible(state, player, tile.x, tile.y);
  }
  return buildingTiles(entity).some((tile) => isTileVisible(state, player, tile.x, tile.y));
}

/** Every entity a side can see right now. */
export function visibleEntities(state: GameState, player: PlayerId): Entity[] {
  return state.entities.filter((entity) => isEntityVisibleTo(state, player, entity));
}
