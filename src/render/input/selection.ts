import type { BuildingType } from '../../data/buildings';
import { UNIT_DEFS } from '../../data/units';
import type { Entity, PlayerId } from '../../sim/state';

/**
 * Selection rules. A selection is either any number of the player's own
 * units, or one single other thing (a building or an enemy unit) to look at.
 */

/** True for a unit the player can give orders to: its own, and not one that has surrendered. */
function isOwnUnit(entity: Entity | undefined, player: PlayerId): boolean {
  return (
    entity !== undefined &&
    entity.kind === 'unit' &&
    entity.owner === player &&
    entity.task.kind !== 'flee'
  );
}

/**
 * Selection after a click. A plain click selects what was clicked, or clears
 * the selection on empty ground. A shift-click adds or removes one of the
 * player's own units and otherwise changes nothing.
 */
export function selectByClick(
  current: ReadonlySet<number>,
  entities: readonly Entity[],
  hit: Entity | undefined,
  shift: boolean,
  player: PlayerId,
): Set<number> {
  if (!shift) return new Set(hit ? [hit.id] : []);
  if (!hit || !isOwnUnit(hit, player)) return new Set(current);

  // Adding a unit to a selection that holds something else replaces it.
  const next = new Set(
    [...current].filter((id) =>
      isOwnUnit(
        entities.find((entity) => entity.id === id),
        player,
      ),
    ),
  );
  if (next.has(hit.id)) next.delete(hit.id);
  else next.add(hit.id);
  return next;
}

/**
 * Selection after a drag box. A plain box selects exactly the boxed units; a
 * shift-box adds them to the units already selected.
 */
export function selectByBox(
  current: ReadonlySet<number>,
  entities: readonly Entity[],
  boxedUnitIds: readonly number[],
  shift: boolean,
  player: PlayerId,
): Set<number> {
  if (!shift) return new Set(boxedUnitIds);
  const kept = [...current].filter((id) =>
    isOwnUnit(
      entities.find((entity) => entity.id === id),
      player,
    ),
  );
  if (boxedUnitIds.length === 0) return new Set(current);
  return new Set([...kept, ...boxedUnitIds]);
}

/** Removes ids of entities that no longer exist. */
export function pruneSelection(
  current: ReadonlySet<number>,
  entities: readonly Entity[],
): Set<number> {
  const alive = new Set(entities.map((entity) => entity.id));
  return new Set([...current].filter((id) => alive.has(id)));
}

/** Ids of the selected units that the player can give orders to. */
export function commandableUnitIds(
  current: ReadonlySet<number>,
  entities: readonly Entity[],
  player: PlayerId,
): number[] {
  return entities
    .filter((entity) => current.has(entity.id) && isOwnUnit(entity, player))
    .map((e) => e.id);
}

/** Ids of the selected units that the player can order to gather resources. */
export function gathererUnitIds(
  current: ReadonlySet<number>,
  entities: readonly Entity[],
  player: PlayerId,
): number[] {
  return entities
    .filter(
      (entity) =>
        current.has(entity.id) &&
        isOwnUnit(entity, player) &&
        entity.kind === 'unit' &&
        UNIT_DEFS[entity.type].carryCapacity > 0,
    )
    .map((entity) => entity.id);
}

/**
 * Ids of the selected units that the player can order to construct a
 * building of the given type.
 */
export function builderUnitIds(
  current: ReadonlySet<number>,
  entities: readonly Entity[],
  player: PlayerId,
  type: BuildingType,
): number[] {
  return entities
    .filter(
      (entity) =>
        current.has(entity.id) &&
        isOwnUnit(entity, player) &&
        entity.kind === 'unit' &&
        UNIT_DEFS[entity.type].builds.includes(type),
    )
    .map((entity) => entity.id);
}

/** Ids of the selected units that the player can order to attack. */
export function attackerUnitIds(
  current: ReadonlySet<number>,
  entities: readonly Entity[],
  player: PlayerId,
): number[] {
  return entities
    .filter(
      (entity) =>
        current.has(entity.id) &&
        isOwnUnit(entity, player) &&
        entity.kind === 'unit' &&
        UNIT_DEFS[entity.type].damage > 0,
    )
    .map((entity) => entity.id);
}
