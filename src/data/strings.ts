import type { BuildMenu, BuildingType } from './buildings';
import type { ResourceType } from './resources';
import type { UnitType } from './units';
import type { UpgradeType } from './upgrades';

/** All text shown in the game, in one place so it can be translated later. */
export const STRINGS = {
  units: {
    samlare: 'Samlare',
    ramkrigare: 'Ramkrigare',
    ramkastare: 'Ramkastare',
  } satisfies Record<UnitType, string>,
  buildings: {
    storide: 'Storide',
    visthus: 'Visthus',
    krigshall: 'Krigshall',
    ide: 'Ide',
    odling: 'Odling',
    fiskehytta: 'Fiskehytta',
    vakttorn: 'Vakttorn',
    smedja: 'Smedja',
    kastbana: 'Kastbana',
    palissad: 'Palissad',
    port: 'Port',
  } satisfies Record<BuildingType, string>,
  /** The tabs of the build menu. */
  menus: {
    economy: 'Ekonomi',
    army: 'Armé',
    defence: 'Försvar',
  } satisfies Record<BuildMenu, string>,
  /** One short line about each building, shown in the build menu. */
  buildingInfo: {
    storide: 'Huvudbyggnad',
    visthus: 'Lämna mat och trä',
    krigshall: 'Tränar Ramkrigare',
    ide: '+5 befolkning',
    odling: 'Oändlig mat, 1 Samlare',
    fiskehytta: 'Vid vatten, 3 Samlare',
    vakttorn: 'Skjuter på fiender',
    smedja: 'Uppgraderar enheter',
    kastbana: 'Tränar Ramkastare',
    palissad: 'Dras ut i en linje',
    port: 'Bara egna går igenom',
  } satisfies Record<BuildingType, string>,
  /** The upgrades worked out at a Smedja: their names, and what a level of each gives. */
  upgrades: {
    weapons: 'Vapen',
    armor: 'Rustning',
    gathering: 'Verktyg',
  } satisfies Record<UpgradeType, string>,
  upgradeInfo: {
    weapons: (bonus: number) => `+${bonus} skada, soldater`,
    armor: (bonus: number) => `+${bonus} rustning, alla`,
    gathering: (bonus: number) => `+${Math.round(bonus * 100)} % fart, Samlare`,
  } satisfies Record<UpgradeType, (bonus: number) => string>,
  /** One short line about each unit, shown on its train button. */
  unitInfo: {
    samlare: 'Samlar och bygger',
    ramkrigare: 'Slåss i närstrid',
    ramkastare: 'Kastar spjut på avstånd',
  } satisfies Record<UnitType, string>,
  resources: {
    food: 'Mat',
    wood: 'Trä',
  } satisfies Record<ResourceType, string>,
  hud: {
    train: (name: string) => `Träna ${name}`,
    build: (name: string) => `Bygg ${name}`,
    underConstruction: (percent: number) => `Byggs ${percent} %`,
    building: (name: string) => `Bygger ${name}`,
    /** The repair button in a worker's menu, and what a repairing worker is doing. */
    repair: 'Laga',
    repairing: (name: string) => `Lagar ${name}`,
    repairWaiting: (name: string) => `Lagar ${name} – väntar på trä`,
    /** On the repair button: what mending the nearest damaged building will cost. */
    repairCost: (wood: number, resource: string) => `ca ${wood} ${resource.toLowerCase()}`,
    /** On the repair button: the building it would mend, and how much life that has left. */
    repairTarget: (name: string, percent: number) => `${name}, ${percent} % liv`,
    /** On the repair button when nothing of the player's is damaged. */
    nothingToRepair: 'Inget är skadat',
    /** Shown when a repair stops for lack of wood. */
    repairPaused: 'Slut på trä – lagningen väntar',
    costPart: (amount: number, resource: string) => `${amount} ${resource.toLowerCase()}`,
    /** The price of something that is bought a piece at a time, such as a wall. */
    costEach: (cost: string) => `${cost} per del`,
    /** By a wall that is being drawn out: how many pieces it is, and what they cost together. */
    wallLine: (pieces: number, cost: string) =>
      pieces === 1 ? `1 del · ${cost}` : `${pieces} delar · ${cost}`,
    population: 'Befolkning',
    populationCount: (current: number, room: number) => `${current}/${room}`,
    /** Shown when a unit cannot be trained for lack of room. */
    housingFull: (housing: string) => `Ingen plats – bygg ett ${housing}`,
    populationCap: (cap: number) => `Befolkningstaket ${cap} är nått`,
    /** Shown by the outline of a building where it cannot be placed: why not. */
    placement: {
      blocked: 'Platsen är upptagen',
      unexplored: 'Outforskad mark',
      needsShore: 'Måste stå intill vatten',
      noWorkPlace: 'Ingen fiskeplats här',
      /** On a touch screen, before a wall has been given a place to start. */
      lineStart: 'Tryck där muren ska börja',
      /** Shown where a fishing hut may stand: how many of its workers get a place on the shore. */
      workPlaces: (count: number) => (count === 1 ? '1 fiskeplats' : `${count} fiskeplatser`),
    },
    gathering: (resource: string, carried: number, capacity: number) =>
      `Samlar ${resource.toLowerCase()} ${carried}/${capacity}`,
    carrying: (resource: string, carried: number) => `Bär ${carried} ${resource.toLowerCase()}`,
    hp: (current: number, max: number) => `Liv ${current}/${max}`,
    attacking: 'Anfaller',
    /** An upgrade with its level in Roman numerals, such as "Vapen II". */
    upgradeLevel: (name: string, level: number) =>
      `${name} ${['I', 'II', 'III'][level - 1] ?? level}`,
    /** On an upgrade's button while that upgrade is being worked out, and when it has no more levels. */
    upgradeInProgress: 'Pågår',
    upgradeDone: 'Fullt utvecklad',
    /** Shown when an upgrade has been worked out. */
    upgradeReady: (name: string) => `${name} är klar`,
    /** What a unit can do, with its side's upgrades: under its life in the selection panel. */
    statDamage: (damage: number) => `Skada ${damage}`,
    /** For a unit that fights from a distance: its throw, how far it reaches in tiles, and its strike at close quarters. */
    statThrow: (damage: number) => `Kast ${damage}`,
    statRange: (range: number) => `Räckvidd ${range}`,
    statStrike: (damage: number) => `Slag ${damage}`,
    statArmor: (armor: number) => `Rustning ${armor}`,
    statGather: (perSecond: string) => `Samlar ${perSecond}/s`,
    /** After a value that an upgrade has raised: by how much. */
    statBonus: (bonus: string) => ` (+${bonus})`,
    /** What a building that shoots can do: the life a shot takes and how far it reaches, in tiles. */
    shoots: (damage: number, range: number) => `Skada ${damage} · Räckvidd ${range}`,
    surrendered: 'Har kapitulerat',
    caveCount: (inside: number, capacity: number) => `${inside}/${capacity}`,
    baseUnderAttack: 'Din bas anfalls!',
    /** Shown while a match between two players stands still because their games have come apart and are being set right. */
    outOfStep: 'Spelen har glidit isär – synkar om',
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
    /** How long a simulation step takes, in milliseconds: on average and the longest of late. */
    step: (averageMs: number, largestMs: number) =>
      `steg ${averageMs.toFixed(1).replace('.', ',')} ms (längst ${largestMs.toFixed(1).replace('.', ',')})`,
  },
  start: {
    title: 'AnimalPlanet',
    button: 'Starta',
    /** Above the choice of how hard the computer opponent plays. */
    levelTitle: 'Svårighetsgrad',
    levels: { easy: 'Nybörjare', medium: 'Medel', hard: 'Proffs' },
    help: [
      'Samla mat och trä, bygg en Krigshall och träna Ramkrigare. Förstör fiendens Storide för att vinna.',
      'Mus: vänsterklick markerar, högerklick ger order. Piltangenter eller WASD flyttar kameran, H hoppar till basen.',
      'Pekskärm: tryck för att markera och ge order, dra för att flytta kameran, håll kvar och dra för att markera flera.',
    ].join('\n\n'),
  },
} as const;
