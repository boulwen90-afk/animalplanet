import type { BuildingType } from '../data/buildings';
import type { UnitType } from '../data/units';
import type { GameMap } from './map/grid';
import type { Point } from './map/iso';
import type { RngState } from './rng';

/** 0 is the human player, 1 the opponent. */
export type PlayerId = 0 | 1;

export interface Unit {
  id: number;
  kind: 'unit';
  type: UnitType;
  owner: PlayerId;
  /** Position in continuous tile coordinates; the centre of tile (3, 4) is (3.5, 4.5). */
  x: number;
  y: number;
  /** Position before the latest simulation step. Rendering interpolates from here to x, y. */
  prevX: number;
  prevY: number;
  hp: number;
  /** Tiles still to walk through, next one first. Empty when standing still. */
  path: Point[];
}

export interface Building {
  id: number;
  kind: 'building';
  type: BuildingType;
  owner: PlayerId;
  /** Tile of the footprint corner with the lowest x and y. */
  x: number;
  y: number;
  hp: number;
}

export type Entity = Unit | Building;

/**
 * The complete state of a game. Everything the simulation needs lives here,
 * as plain data, so a state can be copied, compared and inspected by tests.
 */
export interface GameState {
  /** Seed the game was created from. */
  seed: number;
  /** Number of simulation steps run so far. */
  tick: number;
  /** Random generator; all randomness in the simulation draws from it. */
  rng: RngState;
  map: GameMap;
  /** All units and buildings, in order of creation. */
  entities: Entity[];
  /** Id the next created entity gets. Ids are never reused. */
  nextEntityId: number;
}
