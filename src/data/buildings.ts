import type { Cost, LoadKind, ResourceType } from './resources';
import type { BuildingType, UnitType } from './types';
import type { UpgradeType } from './upgrades';

export type { BuildingType } from './types';

/** Work that workers do at a building, which gives a resource without end. */
export interface WorkDef {
  /** What a worker gets from working here. */
  resource: ResourceType;
  /** What that looks like in the worker's basket. */
  load: LoadKind;
  /** How many workers can work here at a time. */
  workers: number;
  /** Seconds a worker works for one unit of the resource. */
  secondsPerUnit: number;
  /**
   * Where the workers stand. `inside`: on the building's own tiles, as on a
   * field. `shore`: on open ground beside water near the building, as when
   * fishing; the places are the ones closest to the building.
   */
  places: 'inside' | 'shore';
  /** For places on the shore: how far from the building they may be, in tiles. */
  reach?: number;
  /**
   * Where the workers carry what they get. `nearest`: the side's nearest
   * drop-off building. `here`: this building, which takes nothing else.
   */
  deliverTo: 'nearest' | 'here';
}

/** How a building shoots, for one that defends itself and what stands near it. */
export interface AttackDef {
  /** Life each shot takes from its target, before the target's armour. */
  damage: number;
  /** How far it shoots, in tiles, from the middle of the building to the target. */
  range: number;
  /** Seconds between two shots. */
  cooldown: number;
  /** How fast what it shoots flies, in tiles per second. */
  projectileSpeed: number;
}

/** The tabs of the build menu. Every building belongs to one. */
export const BUILD_MENUS = ['economy', 'defence'] as const;
export type BuildMenu = (typeof BUILD_MENUS)[number];

export interface BuildingDef {
  /** Which tab of the build menu the building is found under. */
  menu: BuildMenu;
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
  /**
   * True for a building that units can walk across, such as a field. It
   * still takes up its tiles: nothing else can be built there.
   */
  walkable: boolean;
  /** What workers can do at the finished building, if anything. */
  work?: WorkDef;
  /** True for a building that must stand with a side of its footprint against water. */
  shore?: boolean;
  /**
   * What the building counts as costing when it is repaired, for one that
   * has no price of its own. See REPAIR_CONFIG.
   */
  repairPrice?: Cost;
  /** How the finished building shoots at enemy units that come near, if it does. */
  attack?: AttackDef;
  /** The upgrades that can be worked out in the finished building, if any. */
  researches?: readonly UpgradeType[];
}

/** Building types. See GDD section 8. */
export const BUILDING_DEFS: Record<BuildingType, BuildingDef> = {
  /** Main building. Each side starts with one; it cannot be built. */
  storide: {
    menu: 'economy',
    trains: ['samlare'],
    hp: 1500,
    sight: 9,
    size: 3,
    dropoff: true,
    cost: {},
    buildTime: 0,
    armor: 0,
    housing: 5,
    walkable: false,
    repairPrice: { wood: 300 },
  },
  /** Storehouse: a drop-off point to place near resources. */
  visthus: {
    menu: 'economy',
    trains: [],
    hp: 400,
    sight: 5,
    size: 2,
    dropoff: true,
    cost: { wood: 80 },
    buildTime: 20,
    armor: 0,
    housing: 0,
    walkable: false,
  },
  /** Barracks: trains soldiers. */
  krigshall: {
    menu: 'defence',
    trains: ['ramkrigare'],
    hp: 700,
    sight: 6,
    size: 3,
    dropoff: false,
    cost: { wood: 150 },
    buildTime: 35,
    armor: 0,
    housing: 0,
    walkable: false,
  },
  /** Housing: the bears' den. It only gives room for more units. */
  ide: {
    menu: 'economy',
    trains: [],
    hp: 300,
    sight: 4,
    size: 2,
    dropoff: false,
    cost: { wood: 30 },
    buildTime: 15,
    armor: 0,
    housing: 5,
    walkable: false,
  },
  /**
   * A field. One worker tills it and carries the food to the nearest
   * drop-off, as with berries. It never runs out, but gives food more slowly.
   */
  odling: {
    menu: 'economy',
    trains: [],
    hp: 200,
    sight: 3,
    size: 2,
    dropoff: false,
    cost: { wood: 60 },
    buildTime: 20,
    armor: 0,
    housing: 0,
    walkable: true,
    work: {
      resource: 'food',
      load: 'grain',
      workers: 1,
      secondsPerUnit: 2.5,
      places: 'inside',
      deliverTo: 'nearest',
    },
  },
  /**
   * A fishing hut. It must stand by water. Its workers fish from the shore
   * near it and carry the catch to the hut itself. It never runs out, and
   * gives food faster than a field but more slowly than berries.
   */
  fiskehytta: {
    menu: 'economy',
    trains: [],
    hp: 350,
    sight: 5,
    size: 2,
    dropoff: false,
    cost: { wood: 100 },
    buildTime: 25,
    armor: 0,
    housing: 0,
    walkable: false,
    shore: true,
    work: {
      resource: 'food',
      load: 'fish',
      workers: 3,
      secondsPerUnit: 1.6,
      places: 'shore',
      reach: 3,
      deliverTo: 'here',
    },
  },
  /**
   * A watchtower. It shoots by itself at the nearest enemy unit within its
   * range, and sees far. It stands on a single tile.
   */
  vakttorn: {
    menu: 'defence',
    trains: [],
    hp: 500,
    sight: 8,
    size: 1,
    dropoff: false,
    cost: { wood: 120 },
    buildTime: 30,
    armor: 0,
    housing: 0,
    walkable: false,
    attack: { damage: 9, range: 6, cooldown: 1.5, projectileSpeed: 12 },
  },
  /**
   * A smithy. Upgrades are worked out here: bought once, they hold for all
   * of the side's units.
   */
  smedja: {
    menu: 'defence',
    trains: [],
    hp: 600,
    sight: 5,
    size: 2,
    dropoff: false,
    cost: { wood: 150 },
    buildTime: 35,
    armor: 0,
    housing: 0,
    walkable: false,
    researches: ['weapons', 'armor', 'gathering'],
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
