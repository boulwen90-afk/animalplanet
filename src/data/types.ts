/**
 * Names of the unit and building types. They are listed here, rather than
 * derived from the definition tables, because units refer to buildings (what
 * they can build) and buildings refer to units (what they can train).
 */
export type UnitType = 'samlare' | 'ramkrigare' | 'ramkastare';

export type BuildingType =
  | 'storide'
  | 'visthus'
  | 'krigshall'
  | 'ide'
  | 'odling'
  | 'fiskehytta'
  | 'vakttorn'
  | 'smedja'
  | 'kastbana';

/** What flies through the air: what a tower shoots, and what a unit throws. */
export type ProjectileKind = 'arrow' | 'javelin';
