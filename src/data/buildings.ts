import type { Cost } from './resources';
import type { BuildingType, UnitType } from './types';

export type { BuildingType } from './types';

export interface BuildingDef {
  /** Unit types this building can train. */
  trains: readonly UnitType[];
  /** Hit points. */
  hp: number;
  /** Side of the square footprint, in tiles. */
  size: number;
  /** Workers can deliver gathered resources here. */
  dropoff: boolean;
  /** Price of placing one. */
  cost: Cost;
  /** Time for one worker to build it, in seconds. */
  buildTime: number;
  /** Taken off the damage of every strike against this building. */
  armor: number;
  /** How far the finished building sees, in tiles, measured from its centre. */
  sight: number;
  /** How many units the finished building gives room for. See POPULATION_CONFIG. */
  housing: number;
}

/** Building types. See GDD section 8. */
export const BUILDING_DEFS: Record<BuildingType, BuildingDef> = {
  /** Main building. Each side starts with one; it cannot be built. */
  storide: {
    trains: ['samlare'],
    hp: 1500,
    sight: 9,
    size: 3,
    dropoff: true,
    cost: {},
    buildTime: 0,
    armor: 0,
    housing: 5,
  },
  /** Storehouse: a drop-off point to place near resources. */
  visthus: {
    trains: [],
    hp: 400,
    sight: 5,
    size: 2,
    dropoff: true,
    cost: { wood: 80 },
    buildTime: 20,
    armor: 0,
    housing: 0,
  },
  /** Barracks: trains soldiers. */
  krigshall: {
    trains: ['ramkrigare'],
    hp: 700,
    sight: 6,
    size: 3,
    dropoff: false,
    cost: { wood: 150 },
    buildTime: 35,
    armor: 0,
    housing: 0,
  },
  /** Housing: the bears' den. It only gives room for more units. */
  ide: {
    trains: [],
    hp: 300,
    sight: 4,
    size: 2,
    dropoff: false,
    cost: { wood: 30 },
    buildTime: 15,
    armor: 0,
    housing: 5,
  },
};

export const CONSTRUCTION_CONFIG = {
  /** A newly placed building starts with this share of its hit points. */
  startHpFraction: 0.1,
  /** Each worker beyond the first adds this share of one worker's building speed. */
  extraBuilderRate: 0.5,
  /** How far a building under construction sees, in tiles. */
  sight: 2,
} as const;
