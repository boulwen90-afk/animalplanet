import type { BuildingType } from '../data/buildings';
import type { ResourceType } from '../data/resources';
import type { UnitType } from '../data/units';
import type { GameMap } from './map/grid';
import type { Point } from './map/iso';
import type { RngState } from './rng';

/** 0 is the human player, 1 the opponent. */
export type PlayerId = 0 | 1;

/** What a unit is doing besides walking. */
export type UnitTask = IdleTask | GatherTask;

export interface IdleTask {
  kind: 'idle';
}

/**
 * Gathering a resource in a loop: walk to the source, fill up, walk to a
 * drop-off building, deliver, and back again.
 */
export interface GatherTask {
  kind: 'gather';
  resource: ResourceType;
  /** Tile of the source being worked. */
  node: Point;
  phase: 'toSource' | 'gathering' | 'toDropoff';
  /** Simulation steps worked towards the next unit of resource. */
  workTicks: number;
  /** Building the load is being carried to, while in the toDropoff phase. */
  dropoffId: number | null;
}

/** What a side owns apart from its units and buildings. */
export interface PlayerState {
  /** Resources in stock. Gathered resources count once they are delivered. */
  resources: Record<ResourceType, number>;
}

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
  task: UnitTask;
  /** Kind and amount of resource the unit carries. The kind is kept when the amount is 0. */
  carryType: ResourceType | null;
  carryAmount: number;
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
  /** One entry per side, indexed by PlayerId. */
  players: PlayerState[];
  /** All units and buildings, in order of creation. */
  entities: Entity[];
  /** Id the next created entity gets. Ids are never reused. */
  nextEntityId: number;
}
