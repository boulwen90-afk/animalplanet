import { BUILDING_DEFS, CONSTRUCTION_CONFIG } from '../../data/buildings';
import { UNIT_DEFS } from '../../data/units';
import { buildingCentre, buildingTiles, hasSurrendered, isUnit, unitTile } from '../entities';
import { inBounds, tileIndex } from '../map/grid';
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
 */
export function updateVisibility(state: GameState): void {
  for (const player of state.players) {
    const tiles = player.visibility;
    for (let i = 0; i < tiles.length; i++) {
      if (tiles[i] === VISIBLE) tiles[i] = EXPLORED;
    }
  }

  for (const entity of state.entities) {
    const tiles = state.players[entity.owner]?.visibility;
    if (!tiles) continue;
    if (isUnit(entity)) {
      if (hasSurrendered(entity)) continue;
      const here = unitTile(entity);
      reveal(state, tiles, here.x + 0.5, here.y + 0.5, UNIT_DEFS[entity.type].sight);
    } else {
      const centre = buildingCentre(entity);
      const sight = entity.complete ? BUILDING_DEFS[entity.type].sight : CONSTRUCTION_CONFIG.sight;
      reveal(state, tiles, centre.x, centre.y, sight);
    }
  }
}

/** Marks every tile whose centre lies within `radius` of a point as visible. */
function reveal(state: GameState, tiles: number[], x: number, y: number, radius: number): void {
  const { map } = state;
  for (let ty = Math.floor(y - radius); ty <= Math.ceil(y + radius); ty++) {
    for (let tx = Math.floor(x - radius); tx <= Math.ceil(x + radius); tx++) {
      if (!inBounds(tx, ty, map)) continue;
      const dx = tx + 0.5 - x;
      const dy = ty + 0.5 - y;
      if (dx * dx + dy * dy <= radius * radius) tiles[tileIndex(tx, ty, map)] = VISIBLE;
    }
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
