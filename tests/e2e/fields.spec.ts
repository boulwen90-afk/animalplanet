import { expect, test, type Page } from '@playwright/test';
import { BUILDING_DEFS } from '../../src/data/buildings';
import { SIM_CONFIG } from '../../src/data/sim';
import type { Building, GameState, Unit } from '../../src/sim/state';
import {
  buildNearHome,
  finger,
  getSelection,
  getState,
  openGame,
  tileToScreen,
  trackConsoleErrors,
} from './helpers';

const WORK = BUILDING_DEFS.odling.work!;

const sprite = (page: Page, id: number) =>
  page.evaluate((unitId) => window.__TEST__!.getUnitSprite(unitId), id);
const buildingSprite = (page: Page, id: number) =>
  page.evaluate((buildingId) => window.__TEST__!.getBuildingSprite(buildingId), id);
const advance = (page: Page, steps: number) =>
  page.evaluate((n) => window.__TEST__!.advance(n), steps);
const unitOf = (state: GameState, id: number) =>
  state.entities.find((e): e is Unit => e.kind === 'unit' && e.id === id)!;
const buildingOf = (state: GameState, id: number) =>
  state.entities.find((e): e is Building => e.kind === 'building' && e.id === id)!;
const playerWorkers = (state: GameState) =>
  state.entities.filter((e): e is Unit => e.kind === 'unit' && e.owner === 0);
/** The id of the field a unit works, or null. */
const fieldOf = (unit: Unit) => (unit.task.kind === 'gather' ? unit.task.siteId : null);

/** Steps the game on until the unit stands tilling its field. */
async function untilTilling(page: Page, unitId: number): Promise<void> {
  const tilling = await page.evaluate((id) => {
    const t = window.__TEST__!;
    for (let step = 0; step < 1200; step++) {
      const unit = t.getState().entities.find((e) => e.id === id);
      if (
        unit?.kind === 'unit' &&
        unit.task.kind === 'gather' &&
        unit.task.siteId !== null &&
        unit.task.phase === 'gathering'
      ) {
        return true;
      }
      t.advance(1);
    }
    return false;
  }, unitId);
  expect(tilling, 'the unit reached its field').toBe(true);
}

/** Sends a unit a few tiles away from a field and waits until it has stopped working there. */
async function sendAway(page: Page, unitId: number, field: Building): Promise<void> {
  await page.evaluate(
    ([id, x, y]) => window.__TEST__!.command({ type: 'move', player: 0, unitIds: [id], x, y }),
    [unitId, field.x - 2, field.y - 2] as const,
  );
  await advance(page, 3 * SIM_CONFIG.ticksPerSecond);
}

/** Selects a unit by clicking it. */
async function select(page: Page, unitId: number): Promise<void> {
  const unit = unitOf(await getState(page), unitId);
  const at = await tileToScreen(page, unit.x, unit.y);
  await page.mouse.click(at.x, at.y - 8);
  expect(await getSelection(page)).toEqual([unitId]);
}

/** A point on the screen in the near half of a field, clear of the worker at its far corner. */
async function fieldPoint(page: Page, field: Building): Promise<{ x: number; y: number }> {
  return tileToScreen(page, field.x + 1.5, field.y + 1.5);
}

test.describe('fields', () => {
  test('a Samlare builds an Odling and then tills it with its hoe, for food without end', async ({
    page,
  }) => {
    const errors = trackConsoleErrors(page);
    await openGame(page, '&ai=0&fog=0');
    const { buildingId, workerId } = await buildNearHome(page, 'odling', 'front');

    await expect
      .poll(() => buildingSprite(page, buildingId))
      .toEqual({ frame: 'complete', texture: 'building-bear_field-player-0' });

    // The one who built it starts to work it without being told.
    await untilTilling(page, workerId);
    expect(fieldOf(unitOf(await getState(page), workerId))).toBe(buildingId);
    // It stands on the bare corner of the field and faces the crops.
    await expect
      .poll(async () => {
        const shown = await sprite(page, workerId);
        return [shown?.animation, shown?.direction, shown?.behindBuilding];
      })
      .toEqual(['till', 's', false]);

    // Three minutes of work, with the walks to the Storide: the food keeps coming.
    const before = (await getState(page)).players[0]!.resources.food;
    await advance(page, 180 * SIM_CONFIG.ticksPerSecond);
    const after = await getState(page);
    const gained = after.players[0]!.resources.food - before;
    expect(gained).toBeGreaterThan(0);
    // Never faster than the field yields with no walking at all.
    expect(gained).toBeLessThanOrEqual(Math.ceil(180 / WORK.secondsPerUnit));
    expect(fieldOf(unitOf(after, workerId))).toBe(buildingId);
    expect(errors).toEqual([]);
  });

  test('a right click on an Odling puts a Samlare to work there, and only one at a time', async ({
    page,
  }) => {
    await openGame(page, '&ai=0&fog=0');
    const { buildingId, workerId } = await buildNearHome(page, 'odling', 'front');
    const field = buildingOf(await getState(page), buildingId);
    const [second, third] = playerWorkers(await getState(page)).filter((u) => u.id !== workerId);
    await sendAway(page, workerId, field);
    expect(fieldOf(unitOf(await getState(page), workerId))).toBeNull();

    const at = await fieldPoint(page, field);
    await select(page, second!.id);
    await page.mouse.click(at.x, at.y, { button: 'right' });
    expect(fieldOf(unitOf(await getState(page), second!.id))).toBe(buildingId);
    await untilTilling(page, second!.id);

    // The field has its one worker: the next keeps doing what it did.
    const taskBefore = unitOf(await getState(page), third!.id).task;
    await select(page, third!.id);
    await page.mouse.click(at.x, at.y, { button: 'right' });
    const thirdNow = unitOf(await getState(page), third!.id);
    expect(fieldOf(thirdNow)).toBeNull();
    expect(thirdNow.task.kind).toBe(taskBefore.kind);
  });

  test('units walk across an Odling, and are drawn on top of it', async ({ page }) => {
    await openGame(page, '&ai=0&fog=0');
    const { buildingId, workerId } = await buildNearHome(page, 'odling', 'front');
    const field = buildingOf(await getState(page), buildingId);
    const walker = playerWorkers(await getState(page)).find((u) => u.id !== workerId)!;

    // To the middle of the field: a tile no other building would let a unit stand on.
    await page.evaluate(
      ([id, x, y]) => window.__TEST__!.command({ type: 'move', player: 0, unitIds: [id], x, y }),
      [walker.id, field.x + 1, field.y + 1] as const,
    );
    await advance(page, 20 * SIM_CONFIG.ticksPerSecond);

    const now = unitOf(await getState(page), walker.id);
    expect(Math.floor(now.x)).toBe(field.x + 1);
    expect(Math.floor(now.y)).toBe(field.y + 1);
    await expect.poll(async () => (await sprite(page, walker.id))?.behindBuilding).toBe(false);
  });
});

test.describe('fields on a touch screen', () => {
  test.use({ hasTouch: true });

  test('a tap on an Odling puts the selected Samlare to work there', async ({ page }) => {
    await openGame(page, '&ai=0&fog=0');
    const { buildingId, workerId } = await buildNearHome(page, 'odling', 'front');
    const field = buildingOf(await getState(page), buildingId);
    const other = playerWorkers(await getState(page)).find((u) => u.id !== workerId)!;
    await sendAway(page, workerId, field);

    const touch = await finger(page);
    const unit = unitOf(await getState(page), other.id);
    const on = await tileToScreen(page, unit.x, unit.y);
    await touch.tap(on.x, on.y - 8);
    expect(await getSelection(page)).toEqual([other.id]);

    const at = await fieldPoint(page, field);
    await touch.tap(at.x, at.y);
    expect(fieldOf(unitOf(await getState(page), other.id))).toBe(buildingId);
    // The Samlare is still the one selected: the tap gave an order, it did not select the field.
    expect(await getSelection(page)).toEqual([other.id]);
  });
});
