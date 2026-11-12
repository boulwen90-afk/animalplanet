import type { BuildingType } from './buildings';
import type { ResourceType } from './resources';
import type { UnitType } from './units';

/** All text shown in the game, in one place so it can be translated later. */
export const STRINGS = {
  units: {
    samlare: 'Samlare',
  } satisfies Record<UnitType, string>,
  buildings: {
    storide: 'Storide',
    visthus: 'Visthus',
    krigshall: 'Krigshall',
  } satisfies Record<BuildingType, string>,
  resources: {
    food: 'Mat',
    wood: 'Trä',
  } satisfies Record<ResourceType, string>,
  hud: {
    train: (name: string) => `Träna ${name}`,
    build: (name: string) => `Bygg ${name}`,
    underConstruction: (percent: number) => `Byggs ${percent} %`,
    building: (name: string) => `Bygger ${name}`,
    costPart: (amount: number, resource: string) => `${amount} ${resource.toLowerCase()}`,
    population: 'Befolkning',
    populationCount: (current: number, cap: number) => `${current}/${cap}`,
    gathering: (resource: string, carried: number, capacity: number) =>
      `Samlar ${resource.toLowerCase()} ${carried}/${capacity}`,
    carrying: (resource: string, carried: number) => `Bär ${carried} ${resource.toLowerCase()}`,
    hp: (current: number, max: number) => `HP ${current}/${max}`,
    enemy: 'Fiende',
    unitsSelected: (count: number) => `${count} enheter markerade`,
    countOfType: (name: string, count: number) => `${name} ×${count}`,
  },
} as const;
