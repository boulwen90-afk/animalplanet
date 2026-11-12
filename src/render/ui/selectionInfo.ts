import { BUILDING_DEFS } from '../../data/buildings';
import { STRINGS } from '../../data/strings';
import { UNIT_DEFS } from '../../data/units';
import type { Entity, PlayerId } from '../../sim/state';

/** The two lines of text shown in the selection panel. */
export interface SelectionInfo {
  title: string;
  detail: string;
}

function entityName(entity: Entity): string {
  return entity.kind === 'unit' ? STRINGS.units[entity.type] : STRINGS.buildings[entity.type];
}

function maxHp(entity: Entity): number {
  return entity.kind === 'unit' ? UNIT_DEFS[entity.type].hp : BUILDING_DEFS[entity.type].hp;
}

/**
 * What the selection panel should say about the selected entities, or
 * undefined when nothing is selected. One entity shows its name and hit
 * points; several show how many there are of each kind.
 */
export function describeSelection(
  entities: readonly Entity[],
  selected: ReadonlySet<number>,
  player: PlayerId,
): SelectionInfo | undefined {
  const chosen = entities.filter((entity) => selected.has(entity.id));
  const [first] = chosen;
  if (!first) return undefined;

  if (chosen.length === 1) {
    const name = entityName(first);
    return {
      title: first.owner === player ? name : `${name} (${STRINGS.hud.enemy})`,
      detail: STRINGS.hud.hp(first.hp, maxHp(first)),
    };
  }

  const counts = new Map<string, number>();
  for (const entity of chosen) {
    const name = entityName(entity);
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return {
    title: STRINGS.hud.unitsSelected(chosen.length),
    detail: [...counts].map(([name, count]) => STRINGS.hud.countOfType(name, count)).join(', '),
  };
}
