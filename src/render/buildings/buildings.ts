import type { BuildingType } from '../../data/types';
import bearBarracksAtlasUrl from '../../../assets/buildings/bear_barracks/bear_barracks.json?url';
import bearBarracksBaseUrl from '../../../assets/buildings/bear_barracks/bear_barracks.png';
import bearBarracksMaskUrl from '../../../assets/buildings/bear_barracks/bear_barracks_mask.png';
import bearDenAtlasUrl from '../../../assets/buildings/bear_den/bear_den.json?url';
import bearDenBaseUrl from '../../../assets/buildings/bear_den/bear_den.png';
import bearDenMaskUrl from '../../../assets/buildings/bear_den/bear_den_mask.png';
import bearFieldAtlasUrl from '../../../assets/buildings/bear_field/bear_field.json?url';
import bearFieldBaseUrl from '../../../assets/buildings/bear_field/bear_field.png';
import bearFieldMaskUrl from '../../../assets/buildings/bear_field/bear_field_mask.png';
import bearFisheryAtlasUrl from '../../../assets/buildings/bear_fishery/bear_fishery.json?url';
import bearFisheryBaseUrl from '../../../assets/buildings/bear_fishery/bear_fishery.png';
import bearFisheryMaskUrl from '../../../assets/buildings/bear_fishery/bear_fishery_mask.png';
import bearGateAtlasUrl from '../../../assets/buildings/bear_gate/bear_gate.json?url';
import bearGateBaseUrl from '../../../assets/buildings/bear_gate/bear_gate.png';
import bearGateMaskUrl from '../../../assets/buildings/bear_gate/bear_gate_mask.png';
import bearForgeAtlasUrl from '../../../assets/buildings/bear_forge/bear_forge.json?url';
import bearForgeBaseUrl from '../../../assets/buildings/bear_forge/bear_forge.png';
import bearForgeMaskUrl from '../../../assets/buildings/bear_forge/bear_forge_mask.png';
import bearMainAtlasUrl from '../../../assets/buildings/bear_main/bear_main.json?url';
import bearMainBaseUrl from '../../../assets/buildings/bear_main/bear_main.png';
import bearMainMaskUrl from '../../../assets/buildings/bear_main/bear_main_mask.png';
import bearRangeAtlasUrl from '../../../assets/buildings/bear_range/bear_range.json?url';
import bearRangeBaseUrl from '../../../assets/buildings/bear_range/bear_range.png';
import bearRangeMaskUrl from '../../../assets/buildings/bear_range/bear_range_mask.png';
import bearStorageAtlasUrl from '../../../assets/buildings/bear_storage/bear_storage.json?url';
import bearStorageBaseUrl from '../../../assets/buildings/bear_storage/bear_storage.png';
import bearStorageMaskUrl from '../../../assets/buildings/bear_storage/bear_storage_mask.png';
import bearWallAtlasUrl from '../../../assets/buildings/bear_wall/bear_wall.json?url';
import bearWallBaseUrl from '../../../assets/buildings/bear_wall/bear_wall.png';
import bearWallMaskUrl from '../../../assets/buildings/bear_wall/bear_wall_mask.png';
import bearTowerAtlasUrl from '../../../assets/buildings/bear_tower/bear_tower.json?url';
import bearTowerBaseUrl from '../../../assets/buildings/bear_tower/bear_tower.png';
import bearTowerMaskUrl from '../../../assets/buildings/bear_tower/bear_tower_mask.png';

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
  ide: {
    name: 'bear_den',
    atlasUrl: bearDenAtlasUrl,
    baseUrl: bearDenBaseUrl,
    maskUrl: bearDenMaskUrl,
  },
  fiskehytta: {
    name: 'bear_fishery',
    atlasUrl: bearFisheryAtlasUrl,
    baseUrl: bearFisheryBaseUrl,
    maskUrl: bearFisheryMaskUrl,
  },
  odling: {
    name: 'bear_field',
    atlasUrl: bearFieldAtlasUrl,
    baseUrl: bearFieldBaseUrl,
    maskUrl: bearFieldMaskUrl,
  },
  smedja: {
    name: 'bear_forge',
    atlasUrl: bearForgeAtlasUrl,
    baseUrl: bearForgeBaseUrl,
    maskUrl: bearForgeMaskUrl,
  },
  vakttorn: {
    name: 'bear_tower',
    atlasUrl: bearTowerAtlasUrl,
    baseUrl: bearTowerBaseUrl,
    maskUrl: bearTowerMaskUrl,
  },
  kastbana: {
    name: 'bear_range',
    atlasUrl: bearRangeAtlasUrl,
    baseUrl: bearRangeBaseUrl,
    maskUrl: bearRangeMaskUrl,
  },
  palissad: {
    name: 'bear_wall',
    atlasUrl: bearWallAtlasUrl,
    baseUrl: bearWallBaseUrl,
    maskUrl: bearWallMaskUrl,
  },
  port: {
    name: 'bear_gate',
    atlasUrl: bearGateAtlasUrl,
    baseUrl: bearGateBaseUrl,
    maskUrl: bearGateMaskUrl,
  },
};
