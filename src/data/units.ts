import type { Cost } from './resources';
import type { BuildingType, ProjectileKind, UnitType } from './types';

export type { UnitType } from './types';

/** How a unit fights from a distance. */
export interface RangedDef {
  /** Life each throw takes from its target, before the target's armour. */
  damage: number;
  /**
   * How far it throws, in tiles: to an enemy unit, or to the nearest edge of
   * an enemy building.
   */
  range: number;
  /** Seconds between two throws. */
  cooldown: number;
  /** How fast what it throws flies, in tiles per second. */
  projectileSpeed: number;
  /** What it throws. */
  projectile: ProjectileKind;
}

export interface UnitDef {
  /** Price of training one. */
  cost: Cost;
  /** How much of its side's population room one takes up. */
  population: number;
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
  /** True for a unit that can repair its side's damaged buildings. */
  repairs: boolean;
  /**
   * Life taken from the target per strike at close quarters, before the
   * target's armour.
   */
  damage: number;
  /**
   * How the unit fights from a distance, if it does. Such a unit throws at
   * whatever it attacks, except at an enemy unit on a tile next to its own:
   * that one it strikes, for `damage`.
   */
  ranged?: RangedDef;
  /** Taken off the damage of every strike against this unit. */
  armor: number;
  /** Time between strikes, in seconds. */
  attackCooldown: number;
  /**
   * How far away, in tiles, the unit notices enemy units and attacks them on
   * its own while standing idle. 0 for units that only fight on order.
   */
  aggroRadius: number;
  /**
   * How much room the unit takes on the ground, in tiles: two units keep
   * their centres at least the sum of their radii apart. It must stay below
   * 0.5, so that units on neighbouring tiles never push each other.
   */
  radius: number;
}

/** Unit types. See GDD section 7. */
export const UNIT_DEFS: Record<UnitType, UnitDef> = {
  /** Worker: gathers resources and constructs buildings. */
  samlare: {
    cost: { food: 50 },
    population: 1,
    trainTime: 12,
    hp: 40,
    speed: 2.5,
    sight: 6,
    carryCapacity: 10,
    gatherRate: 1,
    builds: [
      'visthus',
      'krigshall',
      'ide',
      'odling',
      'fiskehytta',
      'vakttorn',
      'smedja',
      'kastbana',
      'palissad',
      'port',
    ],
    repairs: true,
    damage: 3,
    armor: 0,
    attackCooldown: 1.5,
    aggroRadius: 0,
    radius: 0.36,
  },
  /** Soldier: fights hand to hand. */
  ramkrigare: {
    cost: { food: 60, wood: 25 },
    population: 1,
    trainTime: 18,
    hp: 100,
    speed: 2.2,
    sight: 7,
    carryCapacity: 0,
    gatherRate: 0,
    builds: [],
    repairs: false,
    damage: 10,
    armor: 1,
    attackCooldown: 1.2,
    aggroRadius: 6,
    radius: 0.45,
  },
  /**
   * Javelin thrower: fights from a distance. It outranges a watchtower, and
   * loses to a soldier that gets up to it: it has little life, no armour and
   * only a weak thrust at close quarters.
   */
  ramkastare: {
    // No more wood than a soldier: at 40 wood a side that trained throwers
    // lost 15 matches of 16 to one that did not.
    cost: { food: 45, wood: 25 },
    population: 1,
    trainTime: 20,
    hp: 60,
    speed: 2.0,
    sight: 8,
    carryCapacity: 0,
    gatherRate: 0,
    builds: [],
    repairs: false,
    damage: 3,
    ranged: { damage: 8, range: 7, cooldown: 1.4, projectileSpeed: 10, projectile: 'javelin' },
    armor: 0,
    attackCooldown: 1.8,
    aggroRadius: 7,
    radius: 0.4,
  },
};

export const COMBAT_CONFIG = {
  /** A unit chasing a moving target looks for a new path this often, in seconds. */
  repathInterval: 0.5,
} as const;

/** How units keep apart. See the separation system. */
export const COLLISION_CONFIG = {
  /** The share of an overlap that is pushed away in one second; the rest follows in the next steps. */
  stiffnessPerSecond: 10,
  /** The fastest a unit can be pushed, in tiles per second. Less than walking speed, so nobody gets stuck. */
  maxPushSpeed: 1.2,
  /** A unit that stands still is never pushed closer than this to the edge of its tile, in tiles. */
  tileMargin: 0.08,
  /**
   * A group that is sent somewhere lines up on every other tile, like the
   * dark squares of a chessboard, so that its units stand clear of each other.
   */
  groupsOnEveryOtherTile: true,
} as const;
