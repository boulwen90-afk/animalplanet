import { describe, expect, it } from 'vitest';
import { createBuilding, createUnit } from '../../sim/entities';
import { openState, stateFromRows } from '../../sim/testUtils';
import { applyCommand } from '../../sim/commands';
import { advance } from '../../sim/tick';
import { outcomeLayout, rectContains, resourceBarRect, selectionPanelRect } from './layout';
import { describeSelection } from './selectionInfo';

describe('describeSelection', () => {
  it('is undefined when nothing is selected', () => {
    const state = openState(8, 8);
    createUnit(state, 'samlare', 0, 1, 1);
    expect(describeSelection(state.entities, new Set(), 0)).toBeUndefined();
    expect(describeSelection(state.entities, new Set([999]), 0)).toBeUndefined();
  });

  it('shows the name and hit points of a single unit', () => {
    const state = openState(8, 8);
    const unit = createUnit(state, 'samlare', 0, 1, 1);
    expect(describeSelection(state.entities, new Set([unit.id]), 0)).toEqual({
      title: 'Samlare',
      detail: 'Liv 40/40',
    });
  });

  it('shows current hit points when damaged', () => {
    const state = openState(8, 8);
    const unit = createUnit(state, 'samlare', 0, 1, 1);
    unit.hp = 17;
    expect(describeSelection(state.entities, new Set([unit.id]), 0)?.detail).toBe('Liv 17/40');
  });

  it('shows the name and hit points of a building', () => {
    const state = openState(8, 8);
    const building = createBuilding(state, 'storide', 0, 2, 2);
    expect(describeSelection(state.entities, new Set([building.id]), 0)).toEqual({
      title: 'Storide',
      detail: 'Liv 1500/1500',
    });
  });

  it('marks enemy entities', () => {
    const state = openState(8, 8);
    const enemy = createUnit(state, 'samlare', 1, 1, 1);
    expect(describeSelection(state.entities, new Set([enemy.id]), 0)?.title).toBe(
      'Samlare (Fiende)',
    );
  });

  it('counts several selected units', () => {
    const state = openState(8, 8);
    const selected = new Set([0, 1, 2].map((i) => createUnit(state, 'samlare', 0, 1 + i, 1).id));
    expect(describeSelection(state.entities, selected, 0)).toEqual({
      title: '3 enheter markerade',
      detail: 'Samlare ×3',
    });
  });
});

describe('describeSelection for a working unit', () => {
  function gatheringWorker() {
    const state = stateFromRows(['.......', '.......', '.....B.', '.......', '.......']);
    createBuilding(state, 'storide', 0, 1, 1);
    const worker = createUnit(state, 'samlare', 0, 4, 2);
    applyCommand(state, { type: 'gather', player: 0, unitIds: [worker.id], x: 5, y: 2 });
    return { state, worker };
  }

  it('shows what is being gathered and how much is carried', () => {
    const { state, worker } = gatheringWorker();
    advance(state, 60);
    expect(describeSelection(state.entities, new Set([worker.id]), 0)).toEqual({
      title: 'Samlare',
      detail: 'Liv 40/40 · Samlar mat 3/10',
    });
  });

  it('shows the load of a unit that has stopped gathering', () => {
    const { state, worker } = gatheringWorker();
    advance(state, 60);
    applyCommand(state, { type: 'move', player: 0, unitIds: [worker.id], x: 6, y: 4 });
    expect(describeSelection(state.entities, new Set([worker.id]), 0)?.detail).toBe(
      'Liv 40/40 · Bär 3 mat',
    );
  });

  it('does not reveal what an enemy unit is doing', () => {
    const { state, worker } = gatheringWorker();
    advance(state, 60);
    expect(describeSelection(state.entities, new Set([worker.id]), 1)).toEqual({
      title: 'Samlare (Fiende)',
      detail: 'Liv 40/40',
    });
  });
});

describe('describeSelection during construction', () => {
  function site() {
    const state = openState(10, 10);
    const worker = createUnit(state, 'samlare', 0, 3, 4);
    applyCommand(state, {
      type: 'build',
      player: 0,
      unitIds: [worker.id],
      building: 'visthus',
      x: 4,
      y: 4,
    });
    const building = state.entities.find((e) => e.kind === 'building')!;
    return { state, worker, building };
  }

  it('shows how far a building under construction has come', () => {
    const { state, building } = site();
    expect(describeSelection(state.entities, new Set([building.id]), 0)).toEqual({
      title: 'Visthus',
      detail: 'Liv 40/400 · Byggs 0 %',
    });
    advance(state, 100);
    // A quarter built: 10 % of the hit points plus a quarter of the other 90 %.
    expect(describeSelection(state.entities, new Set([building.id]), 0)?.detail).toBe(
      'Liv 130/400 · Byggs 25 %',
    );
  });

  it('shows only hit points once the building is finished', () => {
    const { state, building } = site();
    advance(state, 400);
    expect(describeSelection(state.entities, new Set([building.id]), 0)).toEqual({
      title: 'Visthus',
      detail: 'Liv 400/400',
    });
  });

  it('shows what a builder is building', () => {
    const { state, worker } = site();
    expect(describeSelection(state.entities, new Set([worker.id]), 0)?.detail).toBe(
      'Liv 40/40 · Bygger Visthus',
    );
    advance(state, 400);
    expect(describeSelection(state.entities, new Set([worker.id]), 0)?.detail).toBe('Liv 40/40');
  });
});

describe('describeSelection in combat', () => {
  it('shows that a unit is attacking', () => {
    const state = openState(10, 10);
    const soldier = createUnit(state, 'ramkrigare', 0, 2, 2);
    const enemy = createUnit(state, 'samlare', 1, 7, 2);
    applyCommand(state, { type: 'attack', player: 0, unitIds: [soldier.id], targetId: enemy.id });
    expect(describeSelection(state.entities, new Set([soldier.id]), 0)).toEqual({
      title: 'Ramkrigare',
      detail: 'Liv 100/100 · Anfaller',
    });
  });

  it('shows that a unit has surrendered, whoever it belongs to', () => {
    const state = openState(10, 10);
    const mine = createUnit(state, 'samlare', 0, 2, 2);
    const theirs = createUnit(state, 'samlare', 1, 7, 2);
    for (const unit of [mine, theirs]) {
      unit.hp = 0;
      unit.task = { kind: 'flee', caveId: 1 };
    }
    expect(describeSelection(state.entities, new Set([mine.id]), 0)?.detail).toBe(
      'Liv 0/40 · Har kapitulerat',
    );
    expect(describeSelection(state.entities, new Set([theirs.id]), 0)).toEqual({
      title: 'Samlare (Fiende)',
      detail: 'Liv 0/40 · Har kapitulerat',
    });
  });
});

describe('outcomeLayout', () => {
  it('centres the title and puts a button large enough to tap below it', () => {
    const { title, button } = outcomeLayout(1280, 720);
    expect(title.x).toBe(640);
    expect(button.x + button.width / 2).toBe(640);
    expect(button.y).toBeGreaterThan(title.y);
    expect(button.height).toBeGreaterThanOrEqual(44);
    expect(button.y + button.height).toBeLessThan(720);
  });
});

describe('resourceBarRect', () => {
  it('runs along the whole top edge', () => {
    const rect = resourceBarRect(1280);
    expect(rect).toMatchObject({ x: 0, y: 0, width: 1280 });
    expect(rectContains(rect, 640, 10)).toBe(true);
    expect(rectContains(rect, 640, rect.height + 5)).toBe(false);
  });
});

describe('selectionPanelRect', () => {
  it('sits in the bottom-left corner inside the view', () => {
    const rect = selectionPanelRect(1280, 720);
    expect(rect.x).toBeGreaterThanOrEqual(0);
    expect(rect.y + rect.height).toBeLessThanOrEqual(720);
    expect(rect.x + rect.width).toBeLessThan(1280 / 2);
    expect(rect.y).toBeGreaterThan(720 / 2);
  });

  it('shrinks to fit a narrow screen', () => {
    const rect = selectionPanelRect(200, 400);
    expect(rect.x + rect.width).toBeLessThanOrEqual(200);
  });

  it('rectContains tells inside from outside', () => {
    const rect = selectionPanelRect(1280, 720);
    expect(rectContains(rect, rect.x + 5, rect.y + 5)).toBe(true);
    expect(rectContains(rect, rect.x - 5, rect.y + 5)).toBe(false);
    expect(rectContains(rect, 640, 360)).toBe(false);
  });
});
