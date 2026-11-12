import { describe, expect, it } from 'vitest';
import { createBuilding, createUnit } from '../../sim/entities';
import { openState } from '../../sim/testUtils';
import {
  commandableUnitIds,
  gathererUnitIds,
  pruneSelection,
  selectByBox,
  selectByClick,
} from './selection';

function setup() {
  const state = openState(12, 12);
  const a = createUnit(state, 'samlare', 0, 1, 1);
  const b = createUnit(state, 'samlare', 0, 2, 1);
  const c = createUnit(state, 'samlare', 0, 3, 1);
  const enemy = createUnit(state, 'samlare', 1, 9, 9);
  const building = createBuilding(state, 'storide', 0, 5, 5);
  return { entities: state.entities, a, b, c, enemy, building };
}

const ids = (set: ReadonlySet<number>) => [...set].sort((x, y) => x - y);

describe('selectByClick', () => {
  it('selects the clicked unit and nothing else', () => {
    const { entities, a, b } = setup();
    expect(ids(selectByClick(new Set([b.id]), entities, a, false, 0))).toEqual([a.id]);
  });

  it('clears the selection on empty ground', () => {
    const { entities, a } = setup();
    expect(ids(selectByClick(new Set([a.id]), entities, undefined, false, 0))).toEqual([]);
  });

  it('selects a building or an enemy unit on its own', () => {
    const { entities, a, enemy, building } = setup();
    expect(ids(selectByClick(new Set([a.id]), entities, building, false, 0))).toEqual([
      building.id,
    ]);
    expect(ids(selectByClick(new Set([a.id]), entities, enemy, false, 0))).toEqual([enemy.id]);
  });

  it('shift-click adds an own unit to the selection', () => {
    const { entities, a, b } = setup();
    expect(ids(selectByClick(new Set([a.id]), entities, b, true, 0))).toEqual([a.id, b.id]);
  });

  it('shift-click removes an own unit that is already selected', () => {
    const { entities, a, b } = setup();
    expect(ids(selectByClick(new Set([a.id, b.id]), entities, b, true, 0))).toEqual([a.id]);
  });

  it('shift-click on empty ground, a building or an enemy keeps the selection', () => {
    const { entities, a, b, enemy, building } = setup();
    const current = new Set([a.id, b.id]);
    for (const hit of [undefined, building, enemy]) {
      expect(ids(selectByClick(current, entities, hit, true, 0))).toEqual([a.id, b.id]);
    }
  });

  it('shift-click on an own unit replaces a selected building or enemy', () => {
    const { entities, a, enemy, building } = setup();
    expect(ids(selectByClick(new Set([building.id]), entities, a, true, 0))).toEqual([a.id]);
    expect(ids(selectByClick(new Set([enemy.id]), entities, a, true, 0))).toEqual([a.id]);
  });

  it('does not change the set it was given', () => {
    const { entities, a, b } = setup();
    const current = new Set([a.id]);
    selectByClick(current, entities, b, true, 0);
    expect(ids(current)).toEqual([a.id]);
  });
});

describe('selectByBox', () => {
  it('selects exactly the boxed units', () => {
    const { entities, a, b, c } = setup();
    expect(ids(selectByBox(new Set([a.id]), entities, [b.id, c.id], false, 0))).toEqual([
      b.id,
      c.id,
    ]);
  });

  it('clears the selection when the box is empty', () => {
    const { entities, a } = setup();
    expect(ids(selectByBox(new Set([a.id]), entities, [], false, 0))).toEqual([]);
  });

  it('shift-box adds the boxed units', () => {
    const { entities, a, b, c } = setup();
    expect(ids(selectByBox(new Set([a.id]), entities, [b.id, c.id], true, 0))).toEqual([
      a.id,
      b.id,
      c.id,
    ]);
  });

  it('shift-box with an empty box keeps the selection', () => {
    const { entities, a, building } = setup();
    expect(ids(selectByBox(new Set([a.id]), entities, [], true, 0))).toEqual([a.id]);
    expect(ids(selectByBox(new Set([building.id]), entities, [], true, 0))).toEqual([building.id]);
  });

  it('shift-box replaces a selected building', () => {
    const { entities, a, building } = setup();
    expect(ids(selectByBox(new Set([building.id]), entities, [a.id], true, 0))).toEqual([a.id]);
  });
});

describe('pruneSelection', () => {
  it('drops ids of entities that no longer exist', () => {
    const { entities, a, b } = setup();
    const remaining = entities.filter((entity) => entity.id !== b.id);
    expect(ids(pruneSelection(new Set([a.id, b.id, 999]), remaining))).toEqual([a.id]);
  });
});

describe('commandableUnitIds', () => {
  it("returns only the player's own selected units", () => {
    const { entities, a, b, enemy, building } = setup();
    const selected = new Set([a.id, b.id, enemy.id, building.id]);
    expect(commandableUnitIds(selected, entities, 0)).toEqual([a.id, b.id]);
    expect(commandableUnitIds(selected, entities, 1)).toEqual([enemy.id]);
  });
});

describe('gathererUnitIds', () => {
  it("returns the player's own selected units that can carry resources", () => {
    const { entities, a, b, enemy, building } = setup();
    const selected = new Set([a.id, b.id, enemy.id, building.id]);
    expect(gathererUnitIds(selected, entities, 0)).toEqual([a.id, b.id]);
    expect(gathererUnitIds(new Set([building.id]), entities, 0)).toEqual([]);
  });
});
