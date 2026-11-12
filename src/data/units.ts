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
  /** Most resource units carried at once. 0 for units that cannot gather. */
  carryCapacity: number;
  /** Resource units gathered per second. */
  gatherRate: number;
  /** Building types this unit can construct. */
  builds: readonly BuildingType[];
}

/** Unit types. See GDD section 7. Later phases add combat values. */
export const UNIT_DEFS: Record<UnitType, UnitDef> = {
  /** Worker: gathers resources and constructs buildings. */
  samlare: {
    cost: { food: 50 },
    trainTime: 12,
    hp: 40,
    speed: 2.5,
    carryCapacity: 10,
    gatherRate: 1,
    builds: ['visthus', 'krigshall'],
  },
};
