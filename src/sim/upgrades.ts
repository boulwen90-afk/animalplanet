import { UNIT_DEFS, type UnitType } from '../data/units';
import { UPGRADE_DEFS, UPGRADE_TYPES, type UpgradeStat, type UpgradeType } from '../data/upgrades';
import type { GameState, PlayerId, Unit } from './state';

/** Every upgrade at level 0: what a side starts with. */
export function noUpgrades(): Record<UpgradeType, number> {
  return { weapons: 0, armor: 0, gathering: 0 };
}

/** The level of an upgrade a side has reached; 0 before it has bought any. */
export function upgradeLevel(state: GameState, player: PlayerId, upgrade: UpgradeType): number {
  return state.players[player]?.upgrades[upgrade] ?? 0;
}

/**
 * What a side's upgrades add to a stat of a unit type: the sum of the
 * bonuses of every level it has reached of every upgrade that changes that
 * stat for that type.
 */
export function upgradeBonus(
  state: GameState,
  player: PlayerId,
  unit: UnitType,
  stat: UpgradeStat,
): number {
  let bonus = 0;
  for (const type of UPGRADE_TYPES) {
    const def = UPGRADE_DEFS[type];
    if (def.stat !== stat || !def.units.includes(unit)) continue;
    const level = upgradeLevel(state, player, type);
    for (let i = 0; i < level; i++) bonus += def.levels[i]?.bonus ?? 0;
  }
  return bonus;
}

/** Life a unit's strike takes from its target before the target's armour, with its side's upgrades. */
export function unitDamage(state: GameState, unit: Unit): number {
  return UNIT_DEFS[unit.type].damage + upgradeBonus(state, unit.owner, unit.type, 'damage');
}

/** What is taken off every strike against a unit, with its side's upgrades. */
export function unitArmor(state: GameState, unit: Unit): number {
  return UNIT_DEFS[unit.type].armor + upgradeBonus(state, unit.owner, unit.type, 'armor');
}

/** How many times faster than its own pace a unit gathers and works, with its side's upgrades; 1 without any. */
export function gatherSpeed(state: GameState, unit: Unit): number {
  return 1 + upgradeBonus(state, unit.owner, unit.type, 'gatherSpeed');
}
