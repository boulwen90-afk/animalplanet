import sceneryAtlasUrl from '../../../assets/scenery/scenery.json?url';
import sceneryBaseUrl from '../../../assets/scenery/scenery.png';
import sceneryMaskUrl from '../../../assets/scenery/scenery_mask.png';

/**
 * The files of the scenery, as built by tools/blender (npm run
 * build:characters): the trees, bushes, rocks and caves, and the ground's
 * water and shore, in one atlas.
 */
export const SCENERY_SOURCE = {
  name: 'scenery',
  /** The JSON file that says where each picture is in the atlas. */
  atlasUrl: sceneryAtlasUrl,
  /** The atlas, with the team-coloured parts in a neutral grey. */
  baseUrl: sceneryBaseUrl,
  /** The same layout with only the team-coloured parts. */
  maskUrl: sceneryMaskUrl,
} as const;
