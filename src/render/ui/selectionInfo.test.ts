import { describe, expect, it } from 'vitest';
import { createBuilding, createUnit } from '../../sim/entities';
import { openState } from '../../sim/testUtils';
import { rectContains, selectionPanelRect } from './layout';
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
      detail: 'HP 40/40',
    });
  });

  it('shows current hit points when damaged', () => {
    const state = openState(8, 8);
    const unit = createUnit(state, 'samlare', 0, 1, 1);
    unit.hp = 17;
    expect(describeSelection(state.entities, new Set([unit.id]), 0)?.detail).toBe('HP 17/40');
  });

  it('shows the name and hit points of a building', () => {
    const state = openState(8, 8);
    const building = createBuilding(state, 'storide', 0, 2, 2);
    expect(describeSelection(state.entities, new Set([building.id]), 0)).toEqual({
      title: 'Storide',
      detail: 'HP 1500/1500',
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
