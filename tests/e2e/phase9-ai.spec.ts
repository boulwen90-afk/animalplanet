import { expect, test, type Page } from '@playwright/test';
import { AI_CONFIG } from '../../src/data/ai';
import { START_CONFIG } from '../../src/data/setup';
import { SIM_CONFIG } from '../../src/data/sim';
import type { Building, GameState, Unit } from '../../src/sim/state';
import { getState, openGame, trackConsoleErrors } from './helpers';

const SECOND = SIM_CONFIG.ticksPerSecond;

const advance = (page: Page, steps: number) =>
  page.evaluate((n) => window.__TEST__!.advance(n), steps);

const unitsOf = (state: GameState, owner: number, type: string) =>
  state.entities.filter(
    (e): e is Unit =>
      e.kind === 'unit' && e.owner === owner && e.type === type && e.task.kind !== 'flee',
  );
const buildingsOf = (state: GameState, owner: number, type: string) =>
  state.entities.filter(
    (e): e is Building => e.kind === 'building' && e.owner === owner && e.type === type,
  );

test.describe('phase 9: the computer opponent', () => {
  test('the game starts with a computer opponent and no console errors', async ({ page }) => {
    const errors = trackConsoleErrors(page);
    await openGame(page);
    const state = await getState(page);

    expect(state.players[0]!.ai).toBeNull();
    expect(state.players[1]!.ai).toEqual({ attackers: [], waveTicks: [] });
    expect(errors).toEqual([]);
  });

  test('after 2 minutes the opponent has more Samlare, and has started to build', async ({
    page,
  }) => {
    const errors = trackConsoleErrors(page);
    await openGame(page);
    const before = await getState(page);
    expect(unitsOf(before, 1, 'samlare')).toHaveLength(3);

    await advance(page, 120 * SECOND);

    const after = await getState(page);
    expect(unitsOf(after, 1, 'samlare').length).toBeGreaterThan(3);
    expect(unitsOf(after, 1, 'samlare').length).toBeLessThanOrEqual(AI_CONFIG.targetWorkers);
    expect(buildingsOf(after, 1, 'krigshall')).toHaveLength(1);
    // It pays its way: nothing in its stock is below zero.
    const stock = after.players[1]!.resources;
    expect(stock.food).toBeGreaterThanOrEqual(0);
    expect(stock.wood).toBeGreaterThanOrEqual(0);
    // The player's own side has been left alone.
    expect(unitsOf(after, 0, 'samlare')).toHaveLength(3);
    expect(after.players[0]!.resources).toEqual(START_CONFIG.resources);
    expect(errors).toEqual([]);
  });

  test('the first wave arrives, warns the player and wins against no defence', async ({ page }) => {
    const errors = trackConsoleErrors(page);
    await openGame(page);
    const [first] = AI_CONFIG.waves;

    await advance(page, first.earliest * SECOND + SECOND);
    const sent = await getState(page);
    expect(sent.players[1]!.ai!.waveTicks).toHaveLength(1);
    expect(sent.players[1]!.ai!.attackers).toHaveLength(first.size);
    expect(sent.winner).toBeNull();

    // The walk across the map takes about a minute.
    await advance(page, 75 * SECOND);
    const arrived = await getState(page);
    const myStoride = buildingsOf(arrived, 0, 'storide')[0];
    if (arrived.winner === null) {
      expect(myStoride!.hp).toBeLessThan(1500);
      await expect
        .poll(() => page.evaluate(() => window.__TEST__!.getAlert()))
        .toBe('Din bas anfalls!');
    }

    await advance(page, 120 * SECOND);
    expect((await getState(page)).winner).toBe(1);
    await expect
      .poll(async () => (await page.evaluate(() => window.__TEST__!.getOutcome())).title)
      .toBe('Nederlag');
    expect(errors).toEqual([]);
  });

  test('?ai=0 leaves the opponent standing still in test mode', async ({ page }) => {
    await openGame(page, '&ai=0');
    const before = await getState(page);
    expect(before.players[1]!.ai).toBeNull();

    await advance(page, 120 * SECOND);

    const after = await getState(page);
    expect(unitsOf(after, 1, 'samlare')).toHaveLength(3);
    expect(after.players[1]!.resources).toEqual(START_CONFIG.resources);
    expect(buildingsOf(after, 1, 'krigshall')).toEqual([]);
  });

  test('the opponent stays hidden in the fog while it builds', async ({ page }) => {
    await openGame(page);
    await advance(page, 120 * SECOND);
    const state = await getState(page);
    const seen = state.players[0]!.visibility;
    // Nothing the opponent owns stands on a tile the player can see.
    for (const entity of state.entities.filter((e) => e.owner === 1)) {
      const index = Math.floor(entity.y) * state.map.width + Math.floor(entity.x);
      expect(seen[index], `${entity.kind} ${entity.id}`).not.toBe(2);
    }
  });
});
