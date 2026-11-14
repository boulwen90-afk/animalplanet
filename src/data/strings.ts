import type { BuildingType } from './buildings';
import type { ResourceType } from './resources';
import type { UnitType } from './units';

/** All text shown in the game, in one place so it can be translated later. */
export const STRINGS = {
  units: {
    samlare: 'Samlare',
    ramkrigare: 'Ramkrigare',
  } satisfies Record<UnitType, string>,
  buildings: {
    storide: 'Storide',
    visthus: 'Visthus',
    krigshall: 'Krigshall',
    ide: 'Ide',
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
    populationCount: (current: number, room: number) => `${current}/${room}`,
    /** Shown when a unit cannot be trained for lack of room. */
    housingFull: (housing: string) => `Ingen plats – bygg ett ${housing}`,
    populationCap: (cap: number) => `Befolkningstaket ${cap} är nått`,
    gathering: (resource: string, carried: number, capacity: number) =>
      `Samlar ${resource.toLowerCase()} ${carried}/${capacity}`,
    carrying: (resource: string, carried: number) => `Bär ${carried} ${resource.toLowerCase()}`,
    hp: (current: number, max: number) => `Liv ${current}/${max}`,
    attacking: 'Anfaller',
    surrendered: 'Har kapitulerat',
    caveCount: (inside: number, capacity: number) => `${inside}/${capacity}`,
    baseUnderAttack: 'Din bas anfalls!',
    victory: 'Seger',
    defeat: 'Nederlag',
    playAgain: 'Spela igen',
    enemy: 'Fiende',
    unitsSelected: (count: number) => `${count} enheter markerade`,
    countOfType: (name: string, count: number) => `${name} ×${count}`,
    deselect: 'Avmarkera',
    cancelPlacement: 'Avbryt',
    toBase: 'Bas',
  },
  loading: (percent: number) => `Laddar ${percent} %`,
  debug: {
    fps: (fps: number, units: number) => `${fps} bilder/s · ${units} enheter`,
  },
  start: {
    title: 'AnimalPlanet',
    button: 'Starta',
    help: [
      'Samla mat och trä, bygg en Krigshall och träna Ramkrigare. Förstör fiendens Storide för att vinna.',
      'Mus: vänsterklick markerar, högerklick ger order. Piltangenter eller WASD flyttar kameran, H hoppar till basen.',
      'Pekskärm: tryck för att markera och ge order, dra för att flytta kameran, håll kvar och dra för att markera flera.',
    ].join('\n\n'),
  },
} as const;
