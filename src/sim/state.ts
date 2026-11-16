import type { BuildingType } from '../data/buildings';
import type { LoadKind, ResourceType } from '../data/resources';
import type { UnitType } from '../data/units';
import type { UpgradeType } from '../data/upgrades';
import type { GameMap } from './map/grid';
import type { Point } from './map/iso';
import type { RngState } from './rng';

/** 0 is the human player, 1 the opponent. */
export type PlayerId = 0 | 1;

/** What a unit is doing besides walking. */
export type UnitTask = IdleTask | GatherTask | BuildTask | RepairTask | AttackTask | FleeTask;

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
  /**
   * The work place by the source that the unit has taken: the tile it stands
   * on while it works. It keeps the place while it carries a load home, and
   * no other worker takes it meanwhile. Null when it has none.
   */
  place: Point | null;
  phase: 'toSource' | 'gathering' | 'toDropoff';
  /** Simulation steps worked towards the next unit of resource. */
  workTicks: number;
  /** Building the load is being carried to, while in the toDropoff phase. */
  dropoffId: number | null;
  /**
   * The building being worked, when the source is a building such as a
   * field; null for a source on the map. `node` and `place` are then both
   * the tile of the building the worker stands on.
   */
  siteId: number | null;
}

/** Walking to a construction site and working on it until it is finished. */
export interface BuildTask {
  kind: 'build';
  buildingId: number;
}

/** Walking to a damaged building of the unit's own side and mending it until it is whole. */
export interface RepairTask {
  kind: 'repair';
  buildingId: number;
  /**
   * The place by the building that the unit has taken: the tile it stands on
   * while it works. No other repairer takes it meanwhile.
   */
  place: Point;
  /** True while the work stands still because the side has no wood to pay for it. */
  waiting: boolean;
}

/** Fighting a unit or building: walking up to it and striking until it is defeated. */
export interface AttackTask {
  kind: 'attack';
  targetId: number;
  /** Simulation steps until the unit may look for a new path to a target that has moved. */
  repathTicks: number;
  /** True while every place by the target is taken and the unit waits nearby for one. */
  waiting?: boolean;
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
  | { type: 'buildingAttacked'; buildingId: number; owner: PlayerId }
  /** The repair of a building has stopped because its side ran out of wood. */
  | { type: 'repairPaused'; buildingId: number; owner: PlayerId }
  /** A side has worked out a level of an upgrade. */
  | { type: 'upgradeDone'; owner: PlayerId; upgrade: UpgradeType; level: number }
  /** A building has shot at a unit. */
  | { type: 'shot'; sourceId: number; targetId: number; projectileId: number }
  /** What a building shot has landed on its target, at a place in tiles. */
  | { type: 'projectileHit'; targetId: number; x: number; y: number; damage: number };

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
  /** The level the side has reached of each upgrade; 0 for one it has not bought. */
  upgrades: Record<UpgradeType, number>;
  /** The computer opponent's memory, for a side it plays; null for a side played by a person. */
  ai: AiState | null;
}

/** What the computer opponent remembers between decisions. */
export interface AiState {
  /** Ids of its soldiers that are out on an attack wave. */
  attackers: number[];
  /** The simulation step at which each wave so far set off. */
  waveTicks: number[];
  /** How many towers it has placed so far. A tower that falls is not replaced. */
  towersPlaced: number;
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
  /**
   * What the load is, as it looks: berries, fish, grain or wood. It is that
   * of the latest unit of the resource the unit got. Null with no load.
   */
  carryLoad: LoadKind | null;
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
  /** Upgrades waiting to be worked out here; the first one is being worked on. Already paid for. */
  research: UpgradeType[];
  /** Simulation steps spent on the first upgrade in that queue. */
  researchTicks: number;
  /** Simulation steps until the building may shoot again, for one that shoots. */
  attackCooldown: number;
  /**
   * Life that has been paid for but not yet given back by a repair. Wood is
   * paid one unit at a time, and one unit buys more life than a step of
   * work gives; what is over waits here.
   */
  repairCredit: number;
}

export type Entity = Unit | Building;

/**
 * Something shot through the air at a unit. It follows its target and
 * lands on it; if the target is gone before that, it is taken away.
 */
export interface Projectile {
  id: number;
  /** The side that shot it. */
  owner: PlayerId;
  /** The building that shot it, and the unit it was shot at. */
  sourceId: number;
  targetId: number;
  /** Where it was shot from, in continuous tile coordinates. */
  startX: number;
  startY: number;
  /** Where it is, and where it was before the latest simulation step. */
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  /** How far it flies in one simulation step, in tiles. */
  speed: number;
  /** Life it takes from its target, before the target's armour. */
  damage: number;
}

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
  /** Id the next created entity or projectile gets. Ids are never reused. */
  nextEntityId: number;
  /** What is in the air right now, in the order it was shot. */
  projectiles: Projectile[];
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
