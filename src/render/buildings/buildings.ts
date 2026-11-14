import type { BuildingType } from '../../data/types';
import bearBarracksAtlasUrl from '../../../assets/buildings/bear_barracks/bear_barracks.json?url';
import bearBarracksBaseUrl from '../../../assets/buildings/bear_barracks/bear_barracks.png';
import bearBarracksMaskUrl from '../../../assets/buildings/bear_barracks/bear_barracks_mask.png';
import bearMainAtlasUrl from '../../../assets/buildings/bear_main/bear_main.json?url';
import bearMainBaseUrl from '../../../assets/buildings/bear_main/bear_main.png';
import bearMainMaskUrl from '../../../assets/buildings/bear_main/bear_main_mask.png';
import bearStorageAtlasUrl from '../../../assets/buildings/bear_storage/bear_storage.json?url';
import bearStorageBaseUrl from '../../../assets/buildings/bear_storage/bear_storage.png';
import bearStorageMaskUrl from '../../../assets/buildings/bear_storage/bear_storage_mask.png';

/** The files of one building, as built by tools/blender (npm run build:characters). */
export interface BuildingSource {
  /** Name of the building's pictures: <race>_<building>. */
  name: string;
  /** The JSON file that says where each picture is in the atlas. */
  atlasUrl: string;
  /** The atlas, with the team-coloured parts in a neutral grey. */
  baseUrl: string;
  /** The same layout with only the team-coloured parts. */
  maskUrl: string;
}

/** The building types that are drawn from pictures. Any others are placeholder blocks. */
export const BUILDING_ART: Partial<Record<BuildingType, BuildingSource>> = {
  storide: {
    name: 'bear_main',
    atlasUrl: bearMainAtlasUrl,
    baseUrl: bearMainBaseUrl,
    maskUrl: bearMainMaskUrl,
  },
  visthus: {
    name: 'bear_storage',
    atlasUrl: bearStorageAtlasUrl,
    baseUrl: bearStorageBaseUrl,
    maskUrl: bearStorageMaskUrl,
  },
  krigshall: {
    name: 'bear_barracks',
    atlasUrl: bearBarracksAtlasUrl,
    baseUrl: bearBarracksBaseUrl,
    maskUrl: bearBarracksMaskUrl,
  },
};
