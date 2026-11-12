import { BUILDING_DEFS } from '../../data/buildings';
import { PRODUCTION_CONFIG } from '../../data/production';
import { RESOURCE_TYPES } from '../../data/resources';
import { STRINGS } from '../../data/strings';
import { UNIT_DEFS, type Cost, type UnitType } from '../../data/units';
import type { Entity, PlayerId } from '../../sim/state';
import { trainTicksFor } from '../../sim/systems/production';
import { rectContains, selectionPanelRect, type ScreenRect } from './layout';

/** What the command panel shows for the selected building. */
export interface CommandPanelInfo {
  buildingId: number;
  /** One button per unit type the building can train. */
  buttons: { unit: UnitType; label: string; cost: string }[];
  /** The production queue; the first unit is the one in training. */
  queue: { unit: UnitType; label: string }[];
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
 * show. It shows when exactly one of the player's own buildings is selected
 * and that building can train units.
 */
export function describeCommandPanel(
  entities: readonly Entity[],
  selected: ReadonlySet<number>,
  player: PlayerId,
): CommandPanelInfo | undefined {
  if (selected.size !== 1) return undefined;
  const building = entities.find((entity) => selected.has(entity.id));
  if (!building || building.kind !== 'building' || building.owner !== player) return undefined;
  const trains = BUILDING_DEFS[building.type].trains;
  if (trains.length === 0) return undefined;

  const first = building.queue[0];
  return {
    buildingId: building.id,
    buttons: trains.map((unit) => ({
      unit,
      label: STRINGS.hud.train(STRINGS.units[unit]),
      cost: formatCost(UNIT_DEFS[unit].cost),
    })),
    queue: building.queue.map((unit) => ({ unit, label: STRINGS.units[unit].charAt(0) })),
    progress: first ? Math.min(building.trainTicks / trainTicksFor(first), 1) : 0,
  };
}

/** Where the parts of the command panel sit on the screen. */
export interface CommandPanelLayout {
  panel: ScreenRect;
  /** One rectangle per train button. */
  buttons: ScreenRect[];
  /** One rectangle per place in the production queue. */
  slots: ScreenRect[];
  /** The whole progress bar; the filled part grows from its left edge. */
  progressBar: ScreenRect;
}

const MARGIN = 12;
const PANEL = { width: 424, height: 64 };
const BUTTON = { width: 150, height: 48, gap: 8 };
/** Queue places are at least 44 px so they can be tapped on a touch screen. */
const SLOT = { size: 44, gap: 2 };

export function commandPanelLayout(
  viewWidth: number,
  viewHeight: number,
  buttonCount: number,
): CommandPanelLayout {
  const selection = selectionPanelRect(viewWidth, viewHeight);
  const beside = selection.x + selection.width + MARGIN;
  // Next to the selection panel when there is room, otherwise above it.
  const fitsBeside = beside + PANEL.width + MARGIN <= viewWidth;
  const panel: ScreenRect = {
    x: fitsBeside ? beside : MARGIN,
    y: fitsBeside ? selection.y : selection.y - 8 - PANEL.height,
    width: Math.min(PANEL.width, viewWidth - 2 * MARGIN),
    height: PANEL.height,
  };

  const buttons: ScreenRect[] = [];
  for (let i = 0; i < buttonCount; i++) {
    buttons.push({
      x: panel.x + 8 + i * (BUTTON.width + BUTTON.gap),
      y: panel.y + 8,
      width: BUTTON.width,
      height: BUTTON.height,
    });
  }

  const slotsX = panel.x + 8 + buttonCount * (BUTTON.width + BUTTON.gap) + 4;
  const slots: ScreenRect[] = [];
  for (let i = 0; i < PRODUCTION_CONFIG.maxQueue; i++) {
    slots.push({
      x: slotsX + i * (SLOT.size + SLOT.gap),
      y: panel.y + 6,
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
      y: panel.y + 6 + SLOT.size + 3,
      width: PRODUCTION_CONFIG.maxQueue * (SLOT.size + SLOT.gap) - SLOT.gap,
      height: 6,
    },
  };
}

/** What a click on the command panel means. */
export type CommandPanelHit = { kind: 'train'; index: number } | { kind: 'queue'; index: number };

/** The button or queue place at a screen position, if any. */
export function commandPanelHit(
  layout: CommandPanelLayout,
  x: number,
  y: number,
): CommandPanelHit | undefined {
  const button = layout.buttons.findIndex((rect) => rectContains(rect, x, y));
  if (button >= 0) return { kind: 'train', index: button };
  const slot = layout.slots.findIndex((rect) => rectContains(rect, x, y));
  if (slot >= 0) return { kind: 'queue', index: slot };
  return undefined;
}
