import type { BuildingType } from './buildings';
import type { ResourceType } from './resources';
import type { UnitType } from './units';

/** What each side has when the game starts. See GDD section 9. */
export const START_CONFIG: {
  building: BuildingType;
  units: readonly { type: UnitType; count: number }[];
  resources: Record<ResourceType, number>;
  populationCap: number;
} = {
  /** Main building, centred on the side's start position. */
  building: 'storide',
  /** Units placed on the free tiles nearest to the main building. */
  units: [{ type: 'samlare', count: 3 }],
  /** Resources in stock at the start. */
  resources: { food: 200, wood: 100 },
  /** Most units a side can have. Fixed in the MVP; housing raises it later. */
  populationCap: 30,
};
