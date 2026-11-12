import type { BuildingType } from './buildings';
import type { UnitType } from './units';

/** All text shown in the game, in one place so it can be translated later. */
export const STRINGS = {
  units: {
    samlare: 'Samlare',
  } satisfies Record<UnitType, string>,
  buildings: {
    storide: 'Storide',
  } satisfies Record<BuildingType, string>,
  hud: {
    hp: (current: number, max: number) => `HP ${current}/${max}`,
    enemy: 'Fiende',
    unitsSelected: (count: number) => `${count} enheter markerade`,
    countOfType: (name: string, count: number) => `${name} ×${count}`,
  },
} as const;
