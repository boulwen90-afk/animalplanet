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
