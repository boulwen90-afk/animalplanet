import type { Cost } from './resources';
import type { BuildingType, UnitType } from './types';

export type { UnitType } from './types';

export interface UnitDef {
  /** Price of training one. */
  cost: Cost;
  /** Time to train one, in seconds. */
  trainTime: number;
  /** Hit points. */
  hp: number;
  /** Movement speed in tiles per second. */
  speed: number;
  /** How far the unit sees, in tiles. */
  sight: number;
  /** Most resource units carried at once. 0 for units that cannot gather. */
  carryCapacity: number;
  /** Resource units gathered per second. */
  gatherRate: number;
  /** Building types this unit can construct. */
  builds: readonly BuildingType[];
  /** Life taken from the target per strike, before the target's armour. */
  damage: number;
  /** Taken off the damage of every strike against this unit. */
  armor: number;
  /** Time between strikes, in seconds. */
  attackCooldown: number;
  /**
   * How far away, in tiles, the unit notices enemy units and attacks them on
   * its own while standing idle. 0 for units that only fight on order.
   */
  aggroRadius: number;
}

/** Unit types. See GDD section 7. */
export const UNIT_DEFS: Record<UnitType, UnitDef> = {
  /** Worker: gathers resources and constructs buildings. */
  samlare: {
    cost: { food: 50 },
    trainTime: 12,
    hp: 40,
    speed: 2.5,
    sight: 6,
    carryCapacity: 10,
    gatherRate: 1,
    builds: ['visthus', 'krigshall'],
    damage: 3,
    armor: 0,
    attackCooldown: 1.5,
    aggroRadius: 0,
  },
  /** Soldier: fights hand to hand. */
  ramkrigare: {
    cost: { food: 60, wood: 25 },
    trainTime: 18,
    hp: 100,
    speed: 2.2,
    sight: 7,
    carryCapacity: 0,
    gatherRate: 0,
    builds: [],
    damage: 10,
    armor: 1,
    attackCooldown: 1.2,
    aggroRadius: 6,
  },
};

export const COMBAT_CONFIG = {
  /** A unit chasing a moving target looks for a new path this often, in seconds. */
  repathInterval: 0.5,
} as const;
