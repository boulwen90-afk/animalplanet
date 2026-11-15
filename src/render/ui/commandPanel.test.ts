import { describe, expect, it } from 'vitest';
import { BUILDING_DEFS } from '../../data/buildings';
import { UNIT_DEFS } from '../../data/units';
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
import { rectContains, selectionPanelRect, type ScreenRect } from './layout';

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
        {
          action: { kind: 'train', unit: 'samlare' },
          label: 'Träna Samlare',
          cost: '50 mat',
          info: 'Samlar och bygger',
        },
      ],
      queue: [],
      queueOf: 'units',
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
    expect(info.queue).toEqual([{ label: 'S' }, { label: 'S' }]);
    expect(info.queueOf).toBe('units');
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
    const visthus = createBuilding(state, 'visthus', 0, 10, 1);
    for (const building of [site, visthus]) {
      expect(describeCommandPanel(state.entities, new Set([building.id]), 0)).toBeUndefined();
    }
  });

  it('shows a button for Ramkrigare with both prices for the selected Krigshall', () => {
    const state = openState(14, 14);
    const krigshall = createBuilding(state, 'krigshall', 0, 6, 6);
    expect(describeCommandPanel(state.entities, new Set([krigshall.id]), 0)).toEqual({
      buildingId: krigshall.id,
      buttons: [
        {
          action: { kind: 'train', unit: 'ramkrigare' },
          label: 'Träna Ramkrigare',
          cost: '60 mat, 25 trä',
          info: 'Slåss i närstrid',
        },
      ],
      queue: [],
      queueOf: 'units',
      progress: 0,
    });
  });

  it('shows no build menu for units that cannot build, or that have surrendered', () => {
    const state = openState(14, 14);
    const soldier = createUnit(state, 'ramkrigare', 0, 1, 1);
    const beaten = createUnit(state, 'samlare', 0, 2, 1);
    beaten.task = { kind: 'flee', caveId: 1 };
    expect(describeCommandPanel(state.entities, new Set([soldier.id]), 0)).toBeUndefined();
    expect(describeCommandPanel(state.entities, new Set([beaten.id]), 0)).toBeUndefined();
  });

  it('shows a build menu with prices and a few words about each building for selected Samlare', () => {
    const { state } = setup();
    const a = createUnit(state, 'samlare', 0, 1, 1);
    const b = createUnit(state, 'samlare', 0, 2, 1);
    const expected = {
      buttons: [
        {
          action: { kind: 'build', building: 'visthus' },
          label: 'Bygg Visthus',
          cost: '80 trä',
          info: 'Lämna mat och trä',
        },
        {
          action: { kind: 'build', building: 'ide' },
          label: 'Bygg Ide',
          cost: '30 trä',
          info: '+5 befolkning',
        },
        {
          action: { kind: 'build', building: 'odling' },
          label: 'Bygg Odling',
          cost: '60 trä',
          info: 'Oändlig mat, 1 Samlare',
        },
        {
          action: { kind: 'build', building: 'fiskehytta' },
          label: 'Bygg Fiskehytta',
          cost: '100 trä',
          info: 'Vid vatten, 3 Samlare',
        },
        {
          action: { kind: 'repair' },
          label: 'Laga',
          cost: '',
          info: 'Inget är skadat',
          disabled: true,
        },
      ],
      progress: 0,
      // The menu opens on the first tab.
      tabs: [
        { menu: 'economy', label: 'Ekonomi', active: true },
        { menu: 'defence', label: 'Försvar', active: false },
      ],
    };
    expect(describeCommandPanel(state.entities, new Set([a.id]), 0)).toEqual(expected);
    expect(describeCommandPanel(state.entities, new Set([a.id, b.id]), 0)).toEqual(expected);
  });

  it('shows the buildings for defence under the second tab, with the repair button there too', () => {
    const { state } = setup();
    const worker = createUnit(state, 'samlare', 0, 1, 1);
    const panel = describeCommandPanel(state.entities, new Set([worker.id]), 0, 'defence')!;
    expect(panel.buttons.map((button) => [button.label, button.cost, button.info])).toEqual([
      ['Bygg Krigshall', '150 trä', 'Tränar Ramkrigare'],
      ['Bygg Vakttorn', '120 trä', 'Skjuter på fiender'],
      ['Bygg Smedja', '150 trä', 'Uppgraderar enheter'],
      ['Laga', '', 'Inget är skadat'],
    ]);
    expect(panel.tabs).toEqual([
      { menu: 'economy', label: 'Ekonomi', active: false },
      { menu: 'defence', label: 'Försvar', active: true },
    ]);
  });

  it('puts every building a Samlare can build under exactly one tab', () => {
    const { state } = setup();
    const worker = createUnit(state, 'samlare', 0, 1, 1);
    const built = (['economy', 'defence'] as const).flatMap((menu) =>
      describeCommandPanel(state.entities, new Set([worker.id]), 0, menu)!
        .buttons.filter((button) => button.action.kind === 'build')
        .map((button) => (button.action.kind === 'build' ? button.action.building : '')),
    );
    expect([...built].sort()).toEqual([...UNIT_DEFS.samlare.builds].sort());
    for (const type of UNIT_DEFS.samlare.builds) {
      expect(['economy', 'defence'], type).toContain(BUILDING_DEFS[type].menu);
    }
  });

  it('shows a button for each upgrade for the selected Smedja: the next level, its price and what it gives', () => {
    const state = openState(14, 14);
    const forge = createBuilding(state, 'smedja', 0, 6, 6);
    expect(describeCommandPanel(state.entities, new Set([forge.id]), 0)).toEqual({
      buildingId: forge.id,
      buttons: [
        {
          action: { kind: 'research', upgrade: 'weapons' },
          label: 'Vapen I',
          cost: '100 mat, 50 trä',
          info: '+2 skada, krigare',
        },
        {
          action: { kind: 'research', upgrade: 'armor' },
          label: 'Rustning I',
          cost: '75 mat, 75 trä',
          info: '+1 rustning, alla',
        },
        {
          action: { kind: 'research', upgrade: 'gathering' },
          label: 'Verktyg I',
          cost: '100 mat, 50 trä',
          info: '+20 % fart, Samlare',
        },
      ],
      queue: [],
      queueOf: 'upgrades',
      progress: 0,
    });
  });

  it('shows the queue of upgrades and how far the first has come, and dims what is being worked out', () => {
    const state = openState(14, 14);
    const forge = createBuilding(state, 'smedja', 0, 6, 6);
    state.players[0]!.resources = { food: 1000, wood: 1000 };
    applyCommand(state, { type: 'research', player: 0, buildingId: forge.id, upgrade: 'armor' });
    applyCommand(state, { type: 'research', player: 0, buildingId: forge.id, upgrade: 'weapons' });
    advance(state, 200);
    const info = describeCommandPanel(state.entities, new Set([forge.id]), 0)!;
    expect(info.queue).toEqual([{ label: 'Ru' }, { label: 'Va' }]);
    // 200 of 800 steps.
    expect(info.progress).toBeCloseTo(0.25);
    expect(info.buttons.map((b) => [b.label, b.cost, b.info, b.disabled])).toEqual([
      ['Vapen I', '', 'Pågår', true],
      ['Rustning I', '', 'Pågår', true],
      ['Verktyg I', '100 mat, 50 trä', '+20 % fart, Samlare', undefined],
    ]);
  });

  it('offers the second level once the first is worked out, and nothing after the last', () => {
    const state = openState(14, 14);
    const forge = createBuilding(state, 'smedja', 0, 6, 6);
    const panel = (levels: { weapons: number; armor: number; gathering: number }) =>
      describeCommandPanel(state.entities, new Set([forge.id]), 0, 'economy', levels)!.buttons.map(
        (b) => [b.label, b.cost, b.info, b.disabled],
      );
    expect(panel({ weapons: 1, armor: 0, gathering: 2 })).toEqual([
      ['Vapen II', '175 mat, 100 trä', '+2 skada, krigare', undefined],
      ['Rustning I', '75 mat, 75 trä', '+1 rustning, alla', undefined],
      ['Verktyg II', '', 'Fullt utvecklad', true],
    ]);
  });

  it('dims an upgrade that is being worked out in another Smedja too', () => {
    const state = openState(14, 14);
    const forge = createBuilding(state, 'smedja', 0, 6, 6);
    const other = createBuilding(state, 'smedja', 0, 10, 6);
    state.players[0]!.resources = { food: 1000, wood: 1000 };
    applyCommand(state, { type: 'research', player: 0, buildingId: other.id, upgrade: 'weapons' });
    const info = describeCommandPanel(state.entities, new Set([forge.id]), 0)!;
    expect(info.buttons[0]).toMatchObject({ label: 'Vapen I', info: 'Pågår', disabled: true });
    expect(info.queue).toEqual([]);
  });

  it('shows no panel for a Smedja that is still being built, or for the enemy`s', () => {
    const state = openState(14, 14);
    const forge = createBuilding(state, 'smedja', 0, 6, 6);
    forge.complete = false;
    expect(describeCommandPanel(state.entities, new Set([forge.id]), 0)).toBeUndefined();
    const theirs = createBuilding(state, 'smedja', 1, 10, 6);
    expect(describeCommandPanel(state.entities, new Set([theirs.id]), 0)).toBeUndefined();
  });

  it('has no tabs for a building that trains units', () => {
    const { state, storide } = setup();
    expect(describeCommandPanel(state.entities, new Set([storide.id]), 0)?.tabs).toBeUndefined();
  });

  it('ends the menu with a repair button that names the nearest damaged building and its cost', () => {
    const { state, storide } = setup();
    const worker = createUnit(state, 'samlare', 0, 1, 1);
    const far = createBuilding(state, 'visthus', 0, 9, 9);
    const repairButton = () =>
      describeCommandPanel(state.entities, new Set([worker.id]), 0)?.buttons.at(-1);

    // Nothing is damaged: the button is there, but dimmed.
    expect(repairButton()).toMatchObject({ label: 'Laga', disabled: true });

    far.hp = 100;
    expect(repairButton()).toEqual({
      action: { kind: 'repair', buildingId: far.id },
      label: 'Laga',
      // 300 life at ten life for a unit of wood.
      cost: 'ca 30 trä',
      info: 'Visthus, 25 % liv',
    });

    // The main building is nearer the worker.
    storide.hp = 750;
    expect(repairButton()).toEqual({
      action: { kind: 'repair', buildingId: storide.id },
      label: 'Laga',
      cost: 'ca 75 trä',
      info: 'Storide, 50 % liv',
    });
  });

  it('counts only finished buildings of the player`s own as damaged', () => {
    const { state } = setup();
    const worker = createUnit(state, 'samlare', 0, 1, 1);
    const theirs = createBuilding(state, 'visthus', 1, 9, 9);
    theirs.hp = 100;
    const site = createBuilding(state, 'visthus', 0, 9, 2);
    site.complete = false;
    site.hp = 40;
    const button = describeCommandPanel(state.entities, new Set([worker.id]), 0)?.buttons.at(-1);
    expect(button).toMatchObject({ label: 'Laga', disabled: true, info: 'Inget är skadat' });
  });

  it('has no repair button for units that cannot repair', () => {
    const { state, storide } = setup();
    storide.hp = 100;
    const soldier = createUnit(state, 'ramkrigare', 0, 1, 1);
    expect(describeCommandPanel(state.entities, new Set([soldier.id]), 0)).toBeUndefined();
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
    // Their lower edges are level.
    expect(layout.panel.y + layout.panel.height).toBe(selection.y + selection.height);
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

describe('commandPanelLayout on a phone', () => {
  const inside = (panel: ScreenRect, rect: ScreenRect) =>
    rectContains(panel, rect.x, rect.y) &&
    rectContains(panel, rect.x + rect.width, rect.y + rect.height);
  const overlaps = (a: ScreenRect, b: ScreenRect) =>
    a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

  it.each([
    [390, 844, 1, true],
    [390, 844, 2, false],
    [390, 844, 4, false],
    [360, 640, 1, true],
    [360, 640, 5, false],
    [320, 568, 2, false],
    [320, 568, 4, false],
  ])('fits a %i×%i screen with %i button(s)', (width, height, buttonCount, withQueue) => {
    const layout = commandPanelLayout(width, height, buttonCount, withQueue);
    expect(layout.panel.x).toBeGreaterThanOrEqual(0);
    expect(layout.panel.x + layout.panel.width).toBeLessThanOrEqual(width);
    const parts = [...layout.buttons, ...layout.slots];
    for (const rect of parts) {
      expect(inside(layout.panel, rect)).toBe(true);
      expect(rect.width).toBeGreaterThanOrEqual(44);
      expect(rect.height).toBeGreaterThanOrEqual(44);
    }
    if (withQueue) expect(inside(layout.panel, layout.progressBar)).toBe(true);
    for (let i = 0; i < parts.length; i++) {
      for (let j = i + 1; j < parts.length; j++) {
        expect(overlaps(parts[i]!, parts[j]!)).toBe(false);
      }
    }
    // The panel stays clear of the selection panel below it.
    expect(layout.panel.y + layout.panel.height).toBeLessThanOrEqual(
      selectionPanelRect(width, height).y,
    );
  });

  it('puts the buttons that do not fit in one row in the next', () => {
    const layout = commandPanelLayout(390, 844, 4, false);
    const [a, b, c, d] = layout.buttons;
    expect(b!.y).toBe(a!.y);
    expect(c!.y).toBeGreaterThanOrEqual(a!.y + a!.height);
    expect(c!.x).toBe(a!.x);
    expect(d!.y).toBe(c!.y);
  });

  it('keeps four buttons in one row beside the selection panel on a wide screen', () => {
    const layout = commandPanelLayout(1280, 720, 4, false);
    const selection = selectionPanelRect(1280, 720);
    expect(new Set(layout.buttons.map((rect) => rect.y)).size).toBe(1);
    expect(layout.panel.x).toBeGreaterThan(selection.x + selection.width);
    expect(layout.panel.x + layout.panel.width).toBeLessThanOrEqual(1280);
  });

  it('puts the tabs in a row above the buttons, each large enough to tap', () => {
    for (const [width, height] of [
      [390, 844],
      [844, 390],
      [1280, 720],
    ] as const) {
      const layout = commandPanelLayout(width, height, 5, false, 2);
      expect(layout.tabs).toHaveLength(2);
      const [first, second] = layout.tabs;
      expect(second!.y).toBe(first!.y);
      expect(second!.x).toBeGreaterThanOrEqual(first!.x + first!.width);
      for (const tab of layout.tabs) {
        expect(tab.height).toBeGreaterThanOrEqual(40);
        expect(tab.width).toBeGreaterThanOrEqual(100);
        expect(tab.x).toBeGreaterThanOrEqual(layout.panel.x);
        expect(tab.x + tab.width).toBeLessThanOrEqual(layout.panel.x + layout.panel.width);
        // Every button is below the tabs.
        for (const button of layout.buttons) {
          expect(button.y).toBeGreaterThanOrEqual(tab.y + tab.height);
        }
      }
      expect(layout.panel.y).toBeGreaterThanOrEqual(0);
      expect(layout.panel.y + layout.panel.height).toBeLessThanOrEqual(height);
    }
  });

  it('has no row of tabs when the panel has none', () => {
    const plain = commandPanelLayout(1280, 720, 4, false);
    const tabbed = commandPanelLayout(1280, 720, 4, false, 2);
    expect(plain.tabs).toEqual([]);
    expect(tabbed.panel.height).toBeGreaterThan(plain.panel.height);
  });

  it('tells a press on a tab from a press on a button', () => {
    const layout = commandPanelLayout(1280, 720, 4, false, 2);
    const tab = layout.tabs[1]!;
    const button = layout.buttons[0]!;
    expect(commandPanelHit(layout, tab.x + 5, tab.y + 5)).toEqual({ kind: 'tab', index: 1 });
    expect(commandPanelHit(layout, button.x + 5, button.y + 5)).toEqual({
      kind: 'button',
      index: 0,
    });
  });

  it('keeps the panel on the screen however many rows it has', () => {
    for (const [width, height] of [
      [320, 568],
      [844, 390],
      [1280, 720],
    ] as const) {
      const layout = commandPanelLayout(width, height, 6, false);
      expect(layout.panel.y).toBeGreaterThanOrEqual(0);
      expect(layout.panel.y + layout.panel.height).toBeLessThanOrEqual(height);
    }
  });

  it('puts the queue under the buttons when one row cannot hold both', () => {
    const layout = commandPanelLayout(390, 844, 1);
    expect(layout.slots[0]!.y).toBeGreaterThanOrEqual(
      layout.buttons[0]!.y + layout.buttons[0]!.height,
    );
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
