import { describe, expect, it } from 'vitest';
import { applyCommand } from '../../sim/commands';
import { createBuilding, createUnit } from '../../sim/entities';
import { openState } from '../../sim/testUtils';
import { advance } from '../../sim/tick';
import {
  commandPanelHit,
  commandPanelLayout,
  describeCommandPanel,
  formatCost,
} from './commandPanel';
import { rectContains, selectionPanelRect } from './layout';

function setup() {
  const state = openState(12, 12);
  const storide = createBuilding(state, 'storide', 0, 4, 4);
  return { state, storide };
}

describe('formatCost', () => {
  it('lists the resources that cost something', () => {
    expect(formatCost({ food: 50 })).toBe('50 mat');
    expect(formatCost({ food: 60, wood: 25 })).toBe('60 mat, 25 trä');
    expect(formatCost({ wood: 80 })).toBe('80 trä');
    expect(formatCost({})).toBe('');
  });
});

describe('describeCommandPanel', () => {
  it('shows a train button with its price for the selected Storide', () => {
    const { state, storide } = setup();
    expect(describeCommandPanel(state.entities, new Set([storide.id]), 0)).toEqual({
      buildingId: storide.id,
      buttons: [
        { action: { kind: 'train', unit: 'samlare' }, label: 'Träna Samlare', cost: '50 mat' },
      ],
      queue: [],
      progress: 0,
    });
  });

  it('shows the queue and how far the first unit has come', () => {
    const { state, storide } = setup();
    for (let i = 0; i < 2; i++) {
      applyCommand(state, { type: 'train', player: 0, buildingId: storide.id, unit: 'samlare' });
    }
    advance(state, 60);
    const info = describeCommandPanel(state.entities, new Set([storide.id]), 0)!;
    expect(info.queue).toEqual([
      { unit: 'samlare', label: 'S' },
      { unit: 'samlare', label: 'S' },
    ]);
    // 60 of 240 steps.
    expect(info.progress).toBeCloseTo(0.25);
  });

  it('does not show for nothing, an enemy building or a mix of a building and units', () => {
    const { state, storide } = setup();
    const unit = createUnit(state, 'samlare', 0, 1, 1);
    const enemy = createBuilding(state, 'storide', 1, 8, 8);
    expect(describeCommandPanel(state.entities, new Set(), 0)).toBeUndefined();
    expect(describeCommandPanel(state.entities, new Set([storide.id, unit.id]), 0)).toBeUndefined();
    expect(describeCommandPanel(state.entities, new Set([enemy.id]), 0)).toBeUndefined();
  });

  it('does not show for a building under construction or one that trains nothing', () => {
    const state = openState(14, 14);
    const site = createBuilding(state, 'storide', 0, 1, 1);
    site.complete = false;
    const krigshall = createBuilding(state, 'krigshall', 0, 6, 6);
    const visthus = createBuilding(state, 'visthus', 0, 10, 1);
    for (const building of [site, krigshall, visthus]) {
      expect(describeCommandPanel(state.entities, new Set([building.id]), 0)).toBeUndefined();
    }
  });

  it('shows a build menu with prices for selected Samlare', () => {
    const { state } = setup();
    const a = createUnit(state, 'samlare', 0, 1, 1);
    const b = createUnit(state, 'samlare', 0, 2, 1);
    const expected = {
      buttons: [
        { action: { kind: 'build', building: 'visthus' }, label: 'Bygg Visthus', cost: '80 trä' },
        {
          action: { kind: 'build', building: 'krigshall' },
          label: 'Bygg Krigshall',
          cost: '150 trä',
        },
      ],
      progress: 0,
    };
    expect(describeCommandPanel(state.entities, new Set([a.id]), 0)).toEqual(expected);
    expect(describeCommandPanel(state.entities, new Set([a.id, b.id]), 0)).toEqual(expected);
  });

  it('shows no build menu for enemy units', () => {
    const { state } = setup();
    const enemy = createUnit(state, 'samlare', 1, 1, 1);
    expect(describeCommandPanel(state.entities, new Set([enemy.id]), 0)).toBeUndefined();
  });
});

describe('commandPanelLayout', () => {
  it('sits beside the selection panel on a wide screen', () => {
    const layout = commandPanelLayout(1280, 720, 1);
    const selection = selectionPanelRect(1280, 720);
    expect(layout.panel.x).toBeGreaterThan(selection.x + selection.width);
    expect(layout.panel.y).toBe(selection.y);
    expect(layout.panel.x + layout.panel.width).toBeLessThanOrEqual(1280);
  });

  it('sits above the selection panel on a narrow screen', () => {
    const layout = commandPanelLayout(500, 800, 1);
    const selection = selectionPanelRect(500, 800);
    expect(layout.panel.y + layout.panel.height).toBeLessThanOrEqual(selection.y);
    expect(layout.panel.x + layout.panel.width).toBeLessThanOrEqual(500);
  });

  it('keeps every button, queue place and the progress bar inside the panel', () => {
    const layout = commandPanelLayout(1280, 720, 1);
    const inside = (rect: { x: number; y: number; width: number; height: number }) =>
      rectContains(layout.panel, rect.x, rect.y) &&
      rectContains(layout.panel, rect.x + rect.width, rect.y + rect.height);
    expect(layout.buttons).toHaveLength(1);
    expect(layout.slots).toHaveLength(5);
    for (const rect of [...layout.buttons, ...layout.slots, layout.progressBar]) {
      expect(inside(rect)).toBe(true);
    }
  });

  it('makes buttons and queue places at least 44 px, large enough to tap', () => {
    const layout = commandPanelLayout(1280, 720, 1);
    for (const rect of [...layout.buttons, ...layout.slots]) {
      expect(rect.width).toBeGreaterThanOrEqual(44);
      expect(rect.height).toBeGreaterThanOrEqual(44);
    }
  });

  it('does not let queue places overlap each other or the buttons', () => {
    const layout = commandPanelLayout(1280, 720, 1);
    const rects = [...layout.buttons, ...layout.slots].sort((a, b) => a.x - b.x);
    for (let i = 1; i < rects.length; i++) {
      expect(rects[i]!.x).toBeGreaterThanOrEqual(rects[i - 1]!.x + rects[i - 1]!.width);
    }
  });
});

describe('commandPanelHit', () => {
  const layout = commandPanelLayout(1280, 720, 1);
  const centre = (rect: { x: number; y: number; width: number; height: number }) =>
    [rect.x + rect.width / 2, rect.y + rect.height / 2] as const;

  it('finds the button', () => {
    expect(commandPanelHit(layout, ...centre(layout.buttons[0]!))).toEqual({
      kind: 'button',
      index: 0,
    });
  });

  it('finds each of several buttons, and no queue places in a panel without a queue', () => {
    const menu = commandPanelLayout(1280, 720, 2, false);
    expect(menu.slots).toEqual([]);
    expect(menu.progressBar.width).toBe(0);
    menu.buttons.forEach((button, index) => {
      expect(commandPanelHit(menu, ...centre(button))).toEqual({ kind: 'button', index });
      expect(button.x + button.width).toBeLessThanOrEqual(menu.panel.x + menu.panel.width);
    });
  });

  it('finds each queue place', () => {
    layout.slots.forEach((slot, index) => {
      expect(commandPanelHit(layout, ...centre(slot))).toEqual({ kind: 'queue', index });
    });
  });

  it('finds nothing between the parts or outside the panel', () => {
    expect(commandPanelHit(layout, layout.panel.x + 2, layout.panel.y + 2)).toBeUndefined();
    expect(commandPanelHit(layout, 640, 100)).toBeUndefined();
    expect(commandPanelHit(layout, ...centre(layout.progressBar))).toBeUndefined();
  });
});
