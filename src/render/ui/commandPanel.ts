import {
  BUILDING_DEFS,
  BUILD_MENUS,
  type BuildMenu,
  type BuildingType,
} from '../../data/buildings';
import { PRODUCTION_CONFIG } from '../../data/production';
import { RESOURCE_TYPES, type Cost } from '../../data/resources';
import { STRINGS } from '../../data/strings';
import { UNIT_DEFS, type UnitType } from '../../data/units';
import type { Entity, PlayerId } from '../../sim/state';
import { trainTicksFor } from '../../sim/systems/production';
import { costToMend, nearestDamaged } from '../../sim/systems/repair';
import { rectContains, selectionPanelRect, type ScreenRect } from './layout';

/** What pressing a button in the command panel does. */
export type CommandAction =
  | { kind: 'train'; unit: UnitType }
  | { kind: 'build'; building: BuildingType }
  /** Send the selected workers to mend the building; with none damaged the button does nothing. */
  | { kind: 'repair'; buildingId?: number };

/** A button of the command panel: what it does, its price and a few words about it. */
export interface CommandButton {
  action: CommandAction;
  label: string;
  cost: string;
  info: string;
  /** True for a button that can do nothing right now; it is drawn dimmed. */
  disabled?: true;
}

/** What the command panel shows for the current selection. */
export interface CommandPanelInfo {
  /** The building whose production queue is shown, when a building is selected. */
  buildingId?: number;
  /** One button per thing the selection can train, build or otherwise do. */
  buttons: CommandButton[];
  /**
   * The tabs of a build menu, when what the selection can build is found
   * under more than one; the buttons are those of the active tab. Left out
   * for panels without tabs.
   */
  tabs?: { menu: BuildMenu; label: string; active: boolean }[];
  /**
   * The production queue; the first unit is the one in training. Undefined
   * for panels without a queue, such as the build menu.
   */
  queue?: { unit: UnitType; label: string }[];
  /** How far the unit in training has come, from 0 to 1. */
  progress: number;
}

/** A price as text, such as "60 mat, 25 trä". */
export function formatCost(cost: Cost): string {
  return RESOURCE_TYPES.filter((resource) => (cost[resource] ?? 0) > 0)
    .map((resource) => STRINGS.hud.costPart(cost[resource] ?? 0, STRINGS.resources[resource]))
    .join(', ');
}

/**
 * The command panel for the current selection, or undefined if it should not
 * show. One finished building of the player's that can train units gives
 * train buttons and its queue. A selection of the player's own units gives a
 * build menu with what any of them can build under the tab `menu`, and last
 * a button to repair if any of them can: it names the damaged building
 * nearest the first of them and what mending it will cost. The menu has a
 * tab for each group of buildings there is something to build in, and none
 * if there is only one such group.
 */
export function describeCommandPanel(
  entities: readonly Entity[],
  selected: ReadonlySet<number>,
  player: PlayerId,
  menu: BuildMenu = BUILD_MENUS[0],
): CommandPanelInfo | undefined {
  const chosen = entities.filter((entity) => selected.has(entity.id));
  const [first] = chosen;
  if (!first || chosen.some((entity) => entity.owner !== player)) return undefined;

  if (chosen.length === 1 && first.kind === 'building') {
    const trains = BUILDING_DEFS[first.type].trains;
    if (!first.complete || trains.length === 0) return undefined;
    const inTraining = first.queue[0];
    return {
      buildingId: first.id,
      buttons: trains.map((unit) => ({
        action: { kind: 'train', unit },
        label: STRINGS.hud.train(STRINGS.units[unit]),
        cost: formatCost(UNIT_DEFS[unit].cost),
        info: STRINGS.unitInfo[unit],
      })),
      queue: first.queue.map((unit) => ({ unit, label: STRINGS.units[unit].charAt(0) })),
      progress: inTraining ? Math.min(first.trainTicks / trainTicksFor(inTraining), 1) : 0,
    };
  }

  const buildable: BuildingType[] = [];
  let repairer: Entity | undefined;
  for (const entity of chosen) {
    // Buildings mixed in, or a unit that has surrendered: nothing to order.
    if (entity.kind !== 'unit' || entity.task.kind === 'flee') return undefined;
    for (const type of UNIT_DEFS[entity.type].builds) {
      if (!buildable.includes(type)) buildable.push(type);
    }
    if (UNIT_DEFS[entity.type].repairs) repairer ??= entity;
  }
  // A tab for each group that has something to build; the one asked for, or else the first.
  const menus = BUILD_MENUS.filter((name) =>
    buildable.some((type) => BUILDING_DEFS[type].menu === name),
  );
  const active = menus.includes(menu) ? menu : menus[0];
  const buttons: CommandButton[] = buildable
    .filter((building) => BUILDING_DEFS[building].menu === active)
    .map((building) => ({
      action: { kind: 'build', building },
      label: STRINGS.hud.build(STRINGS.buildings[building]),
      cost: formatCost(BUILDING_DEFS[building].cost),
      info: STRINGS.buildingInfo[building],
    }));
  // Repairing is at hand under every tab.
  if (repairer?.kind === 'unit') buttons.push(repairButton(entities, player, repairer));
  if (buttons.length === 0) return undefined;
  if (menus.length < 2) return { buttons, progress: 0 };
  return {
    buttons,
    progress: 0,
    tabs: menus.map((name) => ({
      menu: name,
      label: STRINGS.menus[name],
      active: name === active,
    })),
  };
}

/** The repair button for a selection whose first repairer stands at `from`. */
function repairButton(
  entities: readonly Entity[],
  player: PlayerId,
  from: { x: number; y: number },
): CommandButton {
  const target = nearestDamaged(entities, player, from);
  if (!target) {
    return {
      action: { kind: 'repair' },
      label: STRINGS.hud.repair,
      cost: '',
      info: STRINGS.hud.nothingToRepair,
      disabled: true,
    };
  }
  const life = Math.floor((target.hp / BUILDING_DEFS[target.type].hp) * 100);
  return {
    action: { kind: 'repair', buildingId: target.id },
    label: STRINGS.hud.repair,
    cost: STRINGS.hud.repairCost(costToMend(target), STRINGS.resources.wood),
    info: STRINGS.hud.repairTarget(STRINGS.buildings[target.type], life),
  };
}

/** Where the parts of the command panel sit on the screen. */
export interface CommandPanelLayout {
  panel: ScreenRect;
  /** One rectangle per tab, in a row along the top of the panel; empty for panels without tabs. */
  tabs: ScreenRect[];
  /** One rectangle per button. */
  buttons: ScreenRect[];
  /** One rectangle per place in the production queue; empty for panels without a queue. */
  slots: ScreenRect[];
  /** The whole progress bar; the filled part grows from its left edge. */
  progressBar: ScreenRect;
}

const MARGIN = 12;
/** Space between the edge of the panel and what is in it. */
const PAD = 8;
/**
 * A button holds three lines: what it does, what it costs and a few words
 * about it. It is `width` wide where there is room and never narrower than
 * `minWidth`; buttons that do not fit in one row go on in the next.
 */
const BUTTON = { width: 160, minWidth: 136, height: 64, gap: 8 };
/** The narrowest panel that is put beside the selection panel instead of above it. */
const MIN_BESIDE = 2 * PAD + 2 * BUTTON.width + BUTTON.gap;
/** A tab of the build menu, and the space between the row of tabs and the buttons under it. */
const TAB = { width: 108, height: 40, gap: 6 };
/** Queue places are at least 44 px so they can be tapped on a touch screen. */
const SLOT = { size: 44, gap: 2 };
/** Space between the buttons and the queue. */
const QUEUE_GAP = 8;
/** The progress bar under the queue: the space above it and its height. */
const PROGRESS = { gap: 3, height: 6 };

export function commandPanelLayout(
  viewWidth: number,
  viewHeight: number,
  buttonCount: number,
  withQueue = true,
  tabCount = 0,
): CommandPanelLayout {
  const selection = selectionPanelRect(viewWidth, viewHeight);
  const beside = selection.x + selection.width + MARGIN;
  const queueWidth = withQueue ? PRODUCTION_CONFIG.maxQueue * (SLOT.size + SLOT.gap) - SLOT.gap : 0;
  const queueHeight = withQueue ? SLOT.size + PROGRESS.gap + PROGRESS.height : 0;
  const rowWidth = (count: number, width: number) =>
    count * width + Math.max(0, count - 1) * BUTTON.gap;

  // The panel is as wide as one row of everything needs, if the screen has
  // the room: next to the selection panel when a fair part of it fits there,
  // otherwise above it.
  const wanted =
    2 * PAD + rowWidth(buttonCount, BUTTON.width) + (withQueue ? QUEUE_GAP + queueWidth : 0);
  const roomBeside = viewWidth - beside - MARGIN;
  const fitsBeside = roomBeside >= Math.min(wanted, MIN_BESIDE);
  const width = Math.min(wanted, fitsBeside ? roomBeside : viewWidth - 2 * MARGIN);
  const inner = width - 2 * PAD;

  // The queue goes under the buttons when one row cannot hold both.
  const stacked =
    withQueue && rowWidth(buttonCount, BUTTON.minWidth) + QUEUE_GAP + queueWidth > inner;
  const buttonRoom = withQueue && !stacked ? inner - QUEUE_GAP - queueWidth : inner;
  const columns = Math.max(
    1,
    Math.min(buttonCount, Math.floor((buttonRoom + BUTTON.gap) / (BUTTON.minWidth + BUTTON.gap))),
  );
  const rows = Math.max(1, Math.ceil(buttonCount / columns));
  const buttonWidth = Math.min(
    BUTTON.width,
    Math.floor((buttonRoom - (columns - 1) * BUTTON.gap) / columns),
  );
  const buttonsHeight = rows * BUTTON.height + (rows - 1) * BUTTON.gap;
  // The tabs take a row of their own above the buttons.
  const tabsHeight = tabCount > 0 ? TAB.height + TAB.gap : 0;
  const height = 2 * PAD + tabsHeight + buttonsHeight + (stacked ? QUEUE_GAP + queueHeight : 0);

  // Its lower edge is level with the selection panel's, or just above that panel.
  const panel: ScreenRect = {
    x: fitsBeside ? beside : MARGIN,
    y: fitsBeside ? selection.y + selection.height - height : selection.y - 8 - height,
    width,
    height,
  };

  const tabs: ScreenRect[] = [];
  for (let i = 0; i < tabCount; i++) {
    tabs.push({
      x: panel.x + PAD + i * (TAB.width + BUTTON.gap),
      y: panel.y + PAD,
      width: TAB.width,
      height: TAB.height,
    });
  }

  const buttonsTop = panel.y + PAD + tabsHeight;
  const buttons: ScreenRect[] = [];
  for (let i = 0; i < buttonCount; i++) {
    buttons.push({
      x: panel.x + PAD + (i % columns) * (buttonWidth + BUTTON.gap),
      y: buttonsTop + Math.floor(i / columns) * (BUTTON.height + BUTTON.gap),
      width: buttonWidth,
      height: BUTTON.height,
    });
  }

  const slotsX = stacked
    ? panel.x + PAD
    : panel.x + PAD + rowWidth(buttonCount, buttonWidth) + QUEUE_GAP;
  const slotsY = stacked
    ? buttonsTop + buttonsHeight + QUEUE_GAP
    : buttonsTop + Math.floor((buttonsHeight - queueHeight) / 2);
  const slots: ScreenRect[] = [];
  for (let i = 0; withQueue && i < PRODUCTION_CONFIG.maxQueue; i++) {
    slots.push({
      x: slotsX + i * (SLOT.size + SLOT.gap),
      y: slotsY,
      width: SLOT.size,
      height: SLOT.size,
    });
  }

  return {
    panel,
    tabs,
    buttons,
    slots,
    progressBar: {
      x: slotsX,
      y: slotsY + SLOT.size + PROGRESS.gap,
      width: queueWidth,
      height: withQueue ? PROGRESS.height : 0,
    },
  };
}

/** What a click on the command panel means. */
export type CommandPanelHit =
  | { kind: 'button'; index: number }
  | { kind: 'queue'; index: number }
  | { kind: 'tab'; index: number };

/** The button or queue place at a screen position, if any. */
export function commandPanelHit(
  layout: CommandPanelLayout,
  x: number,
  y: number,
): CommandPanelHit | undefined {
  const tab = layout.tabs.findIndex((rect) => rectContains(rect, x, y));
  if (tab >= 0) return { kind: 'tab', index: tab };
  const button = layout.buttons.findIndex((rect) => rectContains(rect, x, y));
  if (button >= 0) return { kind: 'button', index: button };
  const slot = layout.slots.findIndex((rect) => rectContains(rect, x, y));
  if (slot >= 0) return { kind: 'queue', index: slot };
  return undefined;
}
