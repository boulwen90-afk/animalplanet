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
}

/** Building types. See GDD section 8. */
export const BUILDING_DEFS: Record<BuildingType, BuildingDef> = {
  /** Main building. Each side starts with one; it cannot be built. */
  storide: {
    trains: ['samlare'],
    hp: 1500,
    size: 3,
    dropoff: true,
    cost: {},
    buildTime: 0,
    armor: 0,
  },
  /** Storehouse: a drop-off point to place near resources. */
  visthus: {
    trains: [],
    hp: 400,
    size: 2,
    dropoff: true,
    cost: { wood: 80 },
    buildTime: 20,
    armor: 0,
  },
  /** Barracks: trains soldiers. */
  krigshall: {
    trains: ['ramkrigare'],
    hp: 700,
    size: 3,
    dropoff: false,
    cost: { wood: 150 },
    buildTime: 35,
    armor: 0,
  },
};

export const CONSTRUCTION_CONFIG = {
  /** A newly placed building starts with this share of its hit points. */
  startHpFraction: 0.1,
  /** Each worker beyond the first adds this share of one worker's building speed. */
  extraBuilderRate: 0.5,
} as const;
