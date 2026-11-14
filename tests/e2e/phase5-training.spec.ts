import { expect, test, type Page } from '@playwright/test';
import { PRODUCTION_CONFIG } from '../../src/data/production';
import { BUILDING_DEFS } from '../../src/data/buildings';
import { START_CONFIG } from '../../src/data/setup';
import { SIM_CONFIG } from '../../src/data/sim';
import { UNIT_DEFS } from '../../src/data/units';
import type { Building, GameState, Unit } from '../../src/sim/state';
import {
  buildHouse,
  getSelection,
  getState,
  openGame,
  tileToScreen,
  trackConsoleErrors,
} from './helpers';

const COST = UNIT_DEFS.samlare.cost.food!;
const TRAIN_TICKS = UNIT_DEFS.samlare.trainTime * SIM_CONFIG.ticksPerSecond;
const START_FOOD = START_CONFIG.resources.food;

const playerUnits = (state: GameState) =>
  state.entities.filter((e): e is Unit => e.kind === 'unit' && e.owner === 0);
const playerStoride = (state: GameState) =>
  state.entities.find((e): e is Building => e.kind === 'building' && e.owner === 0)!;

const commandPanel = (page: Page) => page.evaluate(() => window.__TEST__!.getCommandPanel());
const resourceBar = (page: Page) => page.evaluate(() => window.__TEST__!.getResourceBar());
const advance = (page: Page, steps: number) =>
  page.evaluate((n) => window.__TEST__!.advance(n), steps);

/** Clicks the player's Storide and checks that it is selected. */
async function selectStoride(page: Page): Promise<Building> {
  const storide = playerStoride(await getState(page));
  const at = await tileToScreen(page, storide.x + 1.5, storide.y + 1.5);
  await page.mouse.click(at.x, at.y);
  expect(await getSelection(page)).toEqual([storide.id]);
  return storide;
}

async function clickTrain(page: Page): Promise<void> {
  const [button] = (await commandPanel(page)).buttons;
  await page.mouse.click(button!.x, button!.y);
}

test.describe('phase 5: training workers', () => {
  test('the command panel shows only when the Storide is selected', async ({ page }) => {
    await openGame(page);
    expect((await commandPanel(page)).visible).toBe(false);

    await selectStoride(page);
    await expect.poll(async () => (await commandPanel(page)).visible).toBe(true);
    const panel = await commandPanel(page);
    expect(panel.buttons.map((b) => [b.label, b.cost])).toEqual([['Träna Samlare', '50 mat']]);
    expect(panel.queue).toEqual([]);

    await page.keyboard.press('Escape');
    await expect.poll(async () => (await commandPanel(page)).visible).toBe(false);
  });

  test('clicking "Träna Samlare" gives a fourth Samlare for 50 food', async ({ page }) => {
    const errors = trackConsoleErrors(page);
    await openGame(page);
    await selectStoride(page);
    await expect.poll(async () => (await commandPanel(page)).visible).toBe(true);

    await clickTrain(page);

    const queued = await getState(page);
    expect(playerStoride(queued).queue).toEqual(['samlare']);
    expect(queued.players[0]!.resources.food).toBe(START_FOOD - COST);
    expect(playerUnits(queued)).toHaveLength(3);
    // Clicking the button keeps the Storide selected.
    expect(await getSelection(page)).toEqual([playerStoride(queued).id]);

    await advance(page, TRAIN_TICKS);

    const done = await getState(page);
    expect(playerUnits(done)).toHaveLength(4);
    expect(done.players[0]!.resources.food).toBe(START_FOOD - COST);
    expect(playerStoride(done).queue).toEqual([]);
    await expect
      .poll(() => resourceBar(page))
      .toEqual({
        food: `Mat ${START_FOOD - COST}`,
        wood: `Trä ${START_CONFIG.resources.wood}`,
        population: `Befolkning 4/${BUILDING_DEFS.storide.housing}`,
      });
    expect(errors).toEqual([]);
  });

  test('the queue shows the waiting units and the progress of the first', async ({ page }) => {
    await openGame(page);
    await selectStoride(page);
    await expect.poll(async () => (await commandPanel(page)).visible).toBe(true);

    await clickTrain(page);
    await clickTrain(page);
    await advance(page, TRAIN_TICKS / 2);

    await expect.poll(async () => (await commandPanel(page)).queue.length).toBe(2);
    const panel = await commandPanel(page);
    expect(panel.queue.map((q) => q.label)).toEqual(['S', 'S']);
    expect(panel.progress).toBeGreaterThanOrEqual(0.5);
    expect(panel.progress).toBeLessThan(0.75);
  });

  test('clicking a queued unit cancels it and gives the food back', async ({ page }) => {
    await openGame(page);
    await selectStoride(page);
    await expect.poll(async () => (await commandPanel(page)).visible).toBe(true);
    await clickTrain(page);
    await clickTrain(page);
    await expect.poll(async () => (await commandPanel(page)).queue.length).toBe(2);
    expect((await getState(page)).players[0]!.resources.food).toBe(START_FOOD - 2 * COST);

    const second = (await commandPanel(page)).queue[1]!;
    await page.mouse.click(second.x, second.y);

    const state = await getState(page);
    expect(playerStoride(state).queue).toEqual(['samlare']);
    expect(state.players[0]!.resources.food).toBe(START_FOOD - COST);
    await expect.poll(async () => (await commandPanel(page)).queue.length).toBe(1);
  });

  test('clicking an empty queue place does nothing', async ({ page }) => {
    await openGame(page);
    const storide = await selectStoride(page);
    await expect.poll(async () => (await commandPanel(page)).visible).toBe(true);
    await clickTrain(page);
    await expect.poll(async () => (await commandPanel(page)).queue.length).toBe(1);

    // The second place is empty; it sits one place to the right of the first.
    const first = (await commandPanel(page)).queue[0]!;
    await page.mouse.click(first.x + 46, first.y);

    const state = await getState(page);
    expect(playerStoride(state).queue).toEqual(['samlare']);
    expect(await getSelection(page)).toEqual([storide.id]);
  });

  test('with too little food nothing is queued and the food number flashes red', async ({
    page,
  }) => {
    await openGame(page);
    // Room for more than the food can pay for, so that food is what runs out.
    await buildHouse(page);
    await selectStoride(page);
    await expect.poll(async () => (await commandPanel(page)).visible).toBe(true);

    // The starting food pays for four Samlare.
    const affordable = Math.floor(START_FOOD / COST);
    expect(affordable).toBeLessThan(PRODUCTION_CONFIG.maxQueue);
    for (let i = 0; i < affordable; i++) await clickTrain(page);
    expect((await getState(page)).players[0]!.resources.food).toBe(START_FOOD - affordable * COST);
    expect(await page.evaluate(() => window.__TEST__!.getFlashing())).toEqual([]);

    await clickTrain(page);

    expect(await page.evaluate(() => window.__TEST__!.getFlashing())).toEqual(['food']);
    const state = await getState(page);
    expect(playerStoride(state).queue).toHaveLength(affordable);
    expect(state.players[0]!.resources.food).toBe(START_FOOD - affordable * COST);
    // The flash ends by itself.
    await expect
      .poll(() => page.evaluate(() => window.__TEST__!.getFlashing()), { timeout: 5000 })
      .toEqual([]);
  });

  test('the test interface reports why a train order was refused', async ({ page }) => {
    await openGame(page);
    // Room for more than the food can pay for, so that food is what runs out.
    await buildHouse(page);
    const storide = playerStoride(await getState(page));
    const train = () =>
      page.evaluate(
        (id) =>
          window.__TEST__!.command({ type: 'train', player: 0, buildingId: id, unit: 'samlare' }),
        storide.id,
      );

    for (let i = 0; i < 4; i++) expect(await train()).toEqual({ ok: true });
    expect(await train()).toEqual({
      ok: false,
      reason: 'insufficientResources',
      missing: ['food'],
    });
  });
});
