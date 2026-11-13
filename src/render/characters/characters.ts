import type { UnitType } from '../../data/types';
import bearWarriorAtlasUrl from '../../../assets/characters/bear_warrior/bear_warrior.json?url';
import bearWarriorBaseUrl from '../../../assets/characters/bear_warrior/bear_warrior.png';
import bearWarriorMaskUrl from '../../../assets/characters/bear_warrior/bear_warrior_mask.png';
import bearWorkerAtlasUrl from '../../../assets/characters/bear_worker/bear_worker.json?url';
import bearWorkerBaseUrl from '../../../assets/characters/bear_worker/bear_worker.png';
import bearWorkerMaskUrl from '../../../assets/characters/bear_worker/bear_worker_mask.png';

/** The files of one character, as built by tools/blender (npm run build:characters). */
export interface CharacterSource {
  /** Name of the figure: <race>_<unit>. */
  name: string;
  /** The JSON file that says where each picture is in the atlas. */
  atlasUrl: string;
  /** The atlas, with the team-coloured parts in a neutral grey. */
  baseUrl: string;
  /** The same layout with only the team-coloured parts. */
  maskUrl: string;
}

/** The unit types that are drawn as characters. Any others are placeholder shapes. */
export const CHARACTERS: Partial<Record<UnitType, CharacterSource>> = {
  samlare: {
    name: 'bear_worker',
    atlasUrl: bearWorkerAtlasUrl,
    baseUrl: bearWorkerBaseUrl,
    maskUrl: bearWorkerMaskUrl,
  },
  ramkrigare: {
    name: 'bear_warrior',
    atlasUrl: bearWarriorAtlasUrl,
    baseUrl: bearWarriorBaseUrl,
    maskUrl: bearWarriorMaskUrl,
  },
};
