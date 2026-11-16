import type { Cost } from './resources';
import type { UnitType } from './types';

/**
 * Upgrades: improvements a side buys once at a Smedja, which then hold for
 * all its units of the kinds named, those it has and those it trains later.
 * See GDD section 8.
 */
export type UpgradeType = 'weapons' | 'armor' | 'gathering';

export const UPGRADE_TYPES: readonly UpgradeType[] = ['weapons', 'armor', 'gathering'];

/** What an upgrade changes. */
export type UpgradeStat =
  /** Life taken from the target per strike: the bonus is added. */
  | 'damage'
  /** Taken off the damage of every strike against the unit: the bonus is added. */
  | 'armor'
  /** How fast the unit gathers and works: the bonus is a share added to its pace, 0.2 for a fifth faster. */
  | 'gatherSpeed';

export interface UpgradeLevel {
  /** Price of this level. */
  cost: Cost;
  /** Time it takes to work out, in seconds. */
  time: number;
  /** What this level adds, on top of the levels before it. */
  bonus: number;
}

export interface UpgradeDef {
  stat: UpgradeStat;
  /** The unit types it holds for. */
  units: readonly UnitType[];
  /** The levels, in the order they are bought. */
  levels: readonly UpgradeLevel[];
}

export const UPGRADE_DEFS: Record<UpgradeType, UpgradeDef> = {
  /** Sharper blades and points: soldiers strike and throw harder. */
  weapons: {
    stat: 'damage',
    units: ['ramkrigare', 'ramkastare'],
    levels: [
      { cost: { food: 100, wood: 50 }, time: 40, bonus: 2 },
      { cost: { food: 175, wood: 100 }, time: 60, bonus: 2 },
    ],
  },
  /** Better armour: every unit takes less from each strike. */
  armor: {
    stat: 'armor',
    units: ['samlare', 'ramkrigare', 'ramkastare'],
    levels: [
      { cost: { food: 75, wood: 75 }, time: 40, bonus: 1 },
      { cost: { food: 150, wood: 150 }, time: 60, bonus: 1 },
    ],
  },
  /** Better tools: workers gather, till and fish faster. */
  gathering: {
    stat: 'gatherSpeed',
    units: ['samlare'],
    levels: [
      { cost: { food: 100, wood: 50 }, time: 40, bonus: 0.2 },
      { cost: { food: 175, wood: 100 }, time: 60, bonus: 0.2 },
    ],
  },
};
