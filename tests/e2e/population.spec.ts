import { expect, test, type Page } from '@playwright/test';
import { BUILDING_DEFS } from '../../src/data/buildings';
import { START_CONFIG } from '../../src/data/setup';
import { SIM_CONFIG } from '../../src/data/sim';
import { UNIT_DEFS } from '../../src/data/units';
import type { Building, GameState, Unit } from '../../src/sim/state';
import { getSelection, getState, openGame, tileToScreen, trackConsoleErrors } from './helpers';

const HOME = BUILDING_DEFS.storide.housing;
const HOUSE = BUILDING_DEFS.ide.housing;
const COST = UNIT_DEFS.samlare.cost.food!;

const playerStoride = (state: GameState) =>
  state.entities.find((e): e is Building => e.kind === 'building' && e.owner === 0)!;
const playerWorkers = (state: GameState) =>
  state.entities.filter((e): e is Unit => e.kind === 'unit' && e.owner === 0);
const commandPanel = (page: Page) => page.evaluate(() => window.__TEST__!.getCommandPanel());
const population = async (page: Page) =>
  (await page.evaluate(() => window.__TEST__!.getResourceBar())).population;
const notice = (page: Page) => page.evaluate(() => window.__TEST__!.getNotice());
const flashing = (page: Page) => page.evaluate(() => window.__TEST__!.getFlashing());

async function selectStoride(page: Page): Promise<Building> {
  const storide = playerStoride(await getState(page));
  const at = await tileToScreen(page, storide.x + 1.5, storide.y + 1.5);
  await page.mouse.click(at.x, at.y);
  expect(await getSelection(page)).toEqual([storide.id]);
  await expect.poll(async () => (await commandPanel(page)).visible).toBe(true);
  return storide;
}

async function clickTrain(page: Page): Promise<void> {
  const [button] = (await commandPanel(page)).buttons;
  await page.mouse.click(button!.x, button!.y);
}

test.describe('population', () => {
  test('the counter shows the units against the room: three of five at the start', async ({
    page,
  }) => {
    await openGame(page, '&ai=0');
    await expect.poll(() => population(page)).toBe(`Befolkning 3/${HOME}`);
  });

  test('training is refused when the room is full, with the number in red and a message', async ({
    page,
  }) => {
    const errors = trackConsoleErrors(page);
    await openGame(page, '&ai=0');
    const storide = await selectStoride(page);

    // Two more fit; in the queue they already count.
    await clickTrain(page);
    await clickTrain(page);
    await expect.poll(() => population(page)).toBe(`Befolkning ${HOME}/${HOME}`);
    expect(await notice(page)).toBe('');
    expect(await flashing(page)).not.toContain('population');

    // The third is refused: nothing is queued and nothing is paid.
    await clickTrain(page);
    await expect.poll(() => notice(page)).toBe('Ingen plats – bygg ett Ide');
    expect(await flashing(page)).toContain('population');
    const state = await getState(page);
    expect(playerStoride(state).queue).toHaveLength(2);
    expect(state.players[0]!.resources.food).toBe(START_CONFIG.resources.food - 2 * COST);
    expect(await getSelection(page)).toEqual([storide.id]);

    // The message and the red go away by themselves.
    await expect.poll(() => notice(page), { timeout: 10_000 }).toBe('');
    await expect.poll(() => flashing(page)).not.toContain('population');
    expect(errors).toEqual([]);
  });

  test('a worker builds an Ide, which gives room for five more', async ({ page }) => {
    const errors = trackConsoleErrors(page);
    await openGame(page, '&ai=0&fog=0');
    const state = await getState(page);
    const home = playerStoride(state);
    const [worker] = playerWorkers(state);

    // The build menu offers it, and it is the cheapest building.
    const at = await tileToScreen(page, worker!.x, worker!.y);
    await page.mouse.click(at.x, at.y - 10);
    expect(await getSelection(page)).toEqual([worker!.id]);
    await expect.poll(async () => (await commandPanel(page)).visible).toBe(true);
    expect((await commandPanel(page)).buttons.map((b) => [b.label, b.cost])).toContainEqual([
      'Bygg Ide',
      '30 trä',
    ]);

    // The first free place for it near the base.
    const placed = await page.evaluate(
      ([id, hx, hy]) => {
        const t = window.__TEST__!;
        for (let r = 4; r < 10; r++) {
          for (let dy = -r; dy <= r; dy++) {
            for (let dx = -r; dx <= r; dx++) {
              const result = t.command({
                type: 'build',
                player: 0,
                unitIds: [id],
                building: 'ide',
                x: hx + dx,
                y: hy + dy,
              });
              if (result.ok) return true;
            }
          }
        }
        return false;
      },
      [worker!.id, home.x, home.y] as const,
    );
    expect(placed).toBe(true);
    expect((await getState(page)).players[0]!.resources.wood).toBe(
      START_CONFIG.resources.wood - BUILDING_DEFS.ide.cost.wood!,
    );
    // Under construction it gives nothing yet.
    await expect.poll(() => population(page)).toBe(`Befolkning 3/${HOME}`);

    await page.evaluate(
      (steps) => window.__TEST__!.advance(steps),
      (BUILDING_DEFS.ide.buildTime + 10) * SIM_CONFIG.ticksPerSecond,
    );
    const site = (await getState(page)).entities.find(
      (e): e is Building => e.kind === 'building' && e.type === 'ide' && e.owner === 0,
    )!;
    expect(site.complete).toBe(true);
    await expect.poll(() => population(page)).toBe(`Befolkning 3/${HOME + HOUSE}`);
    // It has no pictures yet: a placeholder block.
    expect(await page.evaluate((id) => window.__TEST__!.getBuildingSprite(id), site.id)).toBeNull();
    expect(errors).toEqual([]);
  });

  test('the computer opponent builds housing and grows past the room of its main building', async ({
    page,
  }) => {
    await openGame(page, '&fog=0');
    await page.evaluate(
      (steps) => window.__TEST__!.advance(steps),
      4 * 60 * SIM_CONFIG.ticksPerSecond,
    );
    const state = await getState(page);
    const houses = state.entities.filter(
      (e) => e.kind === 'building' && e.type === 'ide' && e.owner === 1 && e.complete,
    );
    const theirs = state.entities.filter((e) => e.kind === 'unit' && e.owner === 1);
    expect(houses.length).toBeGreaterThanOrEqual(1);
    expect(theirs.length).toBeGreaterThan(HOME);
  });
});
