import { BUILDING_DEFS, type BuildingType } from '../../data/buildings';
import { PRODUCTION_CONFIG } from '../../data/production';
import { RESOURCE_TYPES, type Cost } from '../../data/resources';
import { STRINGS } from '../../data/strings';
import { UNIT_DEFS, type UnitType } from '../../data/units';
import type { Entity, PlayerId } from '../../sim/state';
import { trainTicksFor } from '../../sim/systems/production';
import { rectContains, selectionPanelRect, type ScreenRect } from './layout';

/** What pressing a button in the command panel does. */
export type CommandAction =
  { kind: 'train'; unit: UnitType } | { kind: 'build'; building: BuildingType };

/** What the command panel shows for the current selection. */
export interface CommandPanelInfo {
  /** The building whose production queue is shown, when a building is selected. */
  buildingId?: number;
  /** One button per thing the selection can train or build. */
  buttons: { action: CommandAction; label: string; cost: string }[];
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
 * build menu with everything any of them can build.
 */
export function describeCommandPanel(
  entities: readonly Entity[],
  selected: ReadonlySet<number>,
  player: PlayerId,
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
      })),
      queue: first.queue.map((unit) => ({ unit, label: STRINGS.units[unit].charAt(0) })),
      progress: inTraining ? Math.min(first.trainTicks / trainTicksFor(inTraining), 1) : 0,
    };
  }

  const buildable: BuildingType[] = [];
  for (const entity of chosen) {
    // Buildings mixed in, or a unit that has surrendered: nothing to order.
    if (entity.kind !== 'unit' || entity.task.kind === 'flee') return undefined;
    for (const type of UNIT_DEFS[entity.type].builds) {
      if (!buildable.includes(type)) buildable.push(type);
    }
  }
  if (buildable.length === 0) return undefined;
  return {
    buttons: buildable.map((building) => ({
      action: { kind: 'build', building },
      label: STRINGS.hud.build(STRINGS.buildings[building]),
      cost: formatCost(BUILDING_DEFS[building].cost),
    })),
    progress: 0,
  };
}

/** Where the parts of the command panel sit on the screen. */
export interface CommandPanelLayout {
  panel: ScreenRect;
  /** One rectangle per button. */
  buttons: ScreenRect[];
  /** One rectangle per place in the production queue; empty for panels without a queue. */
  slots: ScreenRect[];
  /** The whole progress bar; the filled part grows from its left edge. */
  progressBar: ScreenRect;
}

const MARGIN = 12;
const PANEL = { width: 424, height: 64 };
/** Space between the edge of the panel and what is in it. */
const PAD = 8;
const BUTTON = { width: 150, height: 48, gap: 8 };
/** Queue places are at least 44 px so they can be tapped on a touch screen. */
const SLOT = { size: 44, gap: 2 };

export function commandPanelLayout(
  viewWidth: number,
  viewHeight: number,
  buttonCount: number,
  withQueue = true,
): CommandPanelLayout {
  const selection = selectionPanelRect(viewWidth, viewHeight);
  const beside = selection.x + selection.width + MARGIN;
  // Next to the selection panel when there is room, otherwise above it.
  const fitsBeside = beside + PANEL.width + MARGIN <= viewWidth;
  const width = Math.min(PANEL.width, viewWidth - 2 * MARGIN);

  // On a narrow screen the buttons shrink to share the width of the panel.
  const room = width - 2 * PAD - (buttonCount - 1) * BUTTON.gap;
  const buttonWidth =
    buttonCount > 0 ? Math.min(BUTTON.width, Math.floor(room / buttonCount)) : BUTTON.width;
  const buttonsWidth = buttonCount * (buttonWidth + BUTTON.gap);
  const queueWidth = PRODUCTION_CONFIG.maxQueue * (SLOT.size + SLOT.gap) - SLOT.gap;
  // And the queue goes under the buttons when one row cannot hold both.
  const stacked = withQueue && PAD + buttonsWidth + 4 + queueWidth + 4 > width;
  const height = stacked ? PANEL.height + SLOT.size + 14 : PANEL.height;

  const panel: ScreenRect = {
    x: fitsBeside ? beside : MARGIN,
    y: fitsBeside ? selection.y : selection.y - 8 - height,
    width,
    height,
  };

  const buttons: ScreenRect[] = [];
  for (let i = 0; i < buttonCount; i++) {
    buttons.push({
      x: panel.x + PAD + i * (buttonWidth + BUTTON.gap),
      y: panel.y + PAD,
      width: buttonWidth,
      height: BUTTON.height,
    });
  }

  const slotsX = stacked ? panel.x + PAD : panel.x + PAD + buttonsWidth + 4;
  const slotsY = stacked ? panel.y + PAD + BUTTON.height + 6 : panel.y + 6;
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
    buttons,
    slots,
    progressBar: {
      x: slotsX,
      y: slotsY + SLOT.size + 3,
      width: withQueue ? queueWidth : 0,
      height: withQueue ? 6 : 0,
    },
  };
}

/** What a click on the command panel means. */
export type CommandPanelHit = { kind: 'button'; index: number } | { kind: 'queue'; index: number };

/** The button or queue place at a screen position, if any. */
export function commandPanelHit(
  layout: CommandPanelLayout,
  x: number,
  y: number,
): CommandPanelHit | undefined {
  const button = layout.buttons.findIndex((rect) => rectContains(rect, x, y));
  if (button >= 0) return { kind: 'button', index: button };
  const slot = layout.slots.findIndex((rect) => rectContains(rect, x, y));
  if (slot >= 0) return { kind: 'queue', index: slot };
  return undefined;
}
