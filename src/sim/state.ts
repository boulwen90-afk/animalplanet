import type { BuildingType } from '../data/buildings';
import type { ResourceType } from '../data/resources';
import type { UnitType } from '../data/units';
import type { GameMap } from './map/grid';
import type { Point } from './map/iso';
import type { RngState } from './rng';

/** 0 is the human player, 1 the opponent. */
export type PlayerId = 0 | 1;

/** What a unit is doing besides walking. */
export type UnitTask = IdleTask | GatherTask | BuildTask | AttackTask | FleeTask;

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

/** Walking to a construction site and working on it until it is finished. */
export interface BuildTask {
  kind: 'build';
  buildingId: number;
}

/** Fighting a unit or building: walking up to it and striking until it is defeated. */
export interface AttackTask {
  kind: 'attack';
  targetId: number;
  /** Simulation steps until the unit may look for a new path to a target that has moved. */
  repathTicks: number;
}

/**
 * The unit has surrendered and is walking to a cave. It no longer fights,
 * cannot be attacked or given orders, and does not count as population.
 */
export interface FleeTask {
  kind: 'flee';
  /** The cave it has a place in. */
  caveId: number;
}

/** Something that happened during the latest simulation step, for the display to react to. */
export type SimEvent =
  | { type: 'hit'; attackerId: number; targetId: number; damage: number }
  | { type: 'surrender'; unitId: number }
  | { type: 'enterCave'; unitId: number; caveId: number }
  | { type: 'vanish'; unitId: number }
  | { type: 'buildingCollapsed'; buildingId: number; owner: PlayerId; x: number; y: number }
  | { type: 'buildingAttacked'; buildingId: number; owner: PlayerId };

/** How much a side knows about a tile. See GDD section 9. */
export const UNEXPLORED = 0;
/** Seen before, but not right now: the terrain is known, what stands there is not. */
export const EXPLORED = 1;
/** Within sight of one of the side's units or buildings right now. */
export const VISIBLE = 2;

/** What a side owns and knows apart from its units and buildings. */
export interface PlayerState {
  /** Resources in stock. Gathered resources count once they are delivered. */
  resources: Record<ResourceType, number>;
  /**
   * What the side knows about each tile: UNEXPLORED, EXPLORED or VISIBLE.
   * Same indexing as the map's terrain.
   */
  visibility: number[];
  /** The computer opponent's memory, for a side it plays; null for a side played by a person. */
  ai: AiState | null;
}

/** What the computer opponent remembers between decisions. */
export interface AiState {
  /** Ids of its soldiers that are out on an attack wave. */
  attackers: number[];
  /** The simulation step at which each wave so far set off. */
  waveTicks: number[];
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
  /** Simulation steps until the unit may strike again. */
  attackCooldown: number;
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
  /** False while the building is under construction. An unfinished building has no function. */
  complete: boolean;
  /** Work done on the construction so far, in worker-steps: one worker adds 1 per step. */
  buildProgress: number;
  /** Units waiting to be trained here; the first one is in training. Already paid for. */
  queue: UnitType[];
  /** Simulation steps spent training the first unit in the queue. */
  trainTicks: number;
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
  /**
   * Whether the fog of war is on. With it off, every side sees everything;
   * unit tests of other things and ?fog=0 use that.
   */
  fogEnabled: boolean;
  /** The side that has won, once a main building has collapsed. The simulation then stops. */
  winner: PlayerId | null;
  /** What happened during the latest simulation step. Replaced every step. */
  events: SimEvent[];
}
