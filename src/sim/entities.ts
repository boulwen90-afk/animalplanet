import { BUILDING_DEFS, type BuildingType } from '../data/buildings';
import { UNIT_DEFS, type UnitType } from '../data/units';
import type { Point } from './map/iso';
import type { Building, Entity, GameState, PlayerId, Unit } from './state';

/** Adds a unit standing on the centre of a tile. */
export function createUnit(
  state: GameState,
  type: UnitType,
  owner: PlayerId,
  tileX: number,
  tileY: number,
): Unit {
  const unit: Unit = {
    id: state.nextEntityId++,
    kind: 'unit',
    type,
    owner,
    x: tileX + 0.5,
    y: tileY + 0.5,
    prevX: tileX + 0.5,
    prevY: tileY + 0.5,
    hp: UNIT_DEFS[type].hp,
    path: [],
    task: { kind: 'idle' },
    carryType: null,
    carryAmount: 0,
  };
  state.entities.push(unit);
  return unit;
}

/** Adds a building whose footprint starts at tile (tileX, tileY). */
export function createBuilding(
  state: GameState,
  type: BuildingType,
  owner: PlayerId,
  tileX: number,
  tileY: number,
): Building {
  const building: Building = {
    id: state.nextEntityId++,
    kind: 'building',
    type,
    owner,
    x: tileX,
    y: tileY,
    hp: BUILDING_DEFS[type].hp,
  };
  state.entities.push(building);
  return building;
}

export function getEntity(state: GameState, id: number): Entity | undefined {
  return state.entities.find((entity) => entity.id === id);
}

export function isUnit(entity: Entity): entity is Unit {
  return entity.kind === 'unit';
}

export function isBuilding(entity: Entity): entity is Building {
  return entity.kind === 'building';
}

export function units(state: GameState): Unit[] {
  return state.entities.filter(isUnit);
}

export function buildings(state: GameState): Building[] {
  return state.entities.filter(isBuilding);
}

/** The tile a unit currently stands on. */
export function unitTile(unit: Unit): Point {
  return { x: Math.floor(unit.x), y: Math.floor(unit.y) };
}

/** The tile a unit is heading for, or the one it stands on if it is not moving. */
export function unitDestination(unit: Unit): Point {
  return unit.path.at(-1) ?? unitTile(unit);
}

/** Every tile covered by a building. */
export function buildingTiles(building: Building): Point[] {
  const size = BUILDING_DEFS[building.type].size;
  const tiles: Point[] = [];
  for (let y = building.y; y < building.y + size; y++) {
    for (let x = building.x; x < building.x + size; x++) tiles.push({ x, y });
  }
  return tiles;
}

/** Centre of a building's footprint in continuous tile coordinates. */
export function buildingCentre(building: Building): Point {
  const half = BUILDING_DEFS[building.type].size / 2;
  return { x: building.x + half, y: building.y + half };
}

/** Number of tiles between a tile and the nearest tile of a building; 0 inside it, 1 next to it. */
export function tileGapToBuilding(building: Building, tileX: number, tileY: number): number {
  const size = BUILDING_DEFS[building.type].size;
  const dx = Math.max(building.x - tileX, 0, tileX - (building.x + size - 1));
  const dy = Math.max(building.y - tileY, 0, tileY - (building.y + size - 1));
  return Math.max(dx, dy);
}

/** The tile of a building's footprint closest to a tile. */
export function nearestBuildingTile(building: Building, tileX: number, tileY: number): Point {
  const size = BUILDING_DEFS[building.type].size;
  return {
    x: Math.min(Math.max(tileX, building.x), building.x + size - 1),
    y: Math.min(Math.max(tileY, building.y), building.y + size - 1),
  };
}

/** Number of units a side has. */
export function populationOf(state: GameState, owner: PlayerId): number {
  return state.entities.filter((entity) => isUnit(entity) && entity.owner === owner).length;
}
