import type { BuildingType } from './buildings';
import type { UnitType } from './units';

/** What each side has when the game starts. See GDD section 9. */
export const START_CONFIG: {
  building: BuildingType;
  units: readonly { type: UnitType; count: number }[];
} = {
  /** Main building, centred on the side's start position. */
  building: 'storide',
  /** Units placed on the free tiles nearest to the main building. */
  units: [{ type: 'samlare', count: 3 }],
};
