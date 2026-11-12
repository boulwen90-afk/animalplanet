import { expect, test } from '@playwright/test';
import { MAP_CONFIG, MAP_GEN_CONFIG } from '../../src/data/map';
import { TICK_MS } from '../../src/data/sim';
import { getState, openGame, trackConsoleErrors } from './helpers';

test.describe('phase 2: simulation core and terrain', () => {
  test('starts with a generated map and no console errors', async ({ page }) => {
    const errors = trackConsoleErrors(page);
    await openGame(page, '&seed=1');

    const state = await getState(page);
    expect(state.seed).toBe(1);
    expect(state.map.width).toBe(MAP_CONFIG.width);
    expect(state.map.height).toBe(MAP_CONFIG.height);
    expect(state.map.terrain).toHaveLength(MAP_CONFIG.width * MAP_CONFIG.height);
    expect(state.map.startPositions).toEqual(MAP_GEN_CONFIG.startPositions);
    for (const terrain of ['grass', 'tree', 'berries', 'rock', 'water']) {
      expect(state.map.terrain, terrain).toContain(terrain);
    }
    expect(errors).toEqual([]);
  });

  test('?seed=1 gives the same map on two loads', async ({ page }) => {
    await openGame(page, '&seed=1');
    const first = await getState(page);
    await openGame(page, '&seed=1');
    const second = await getState(page);

    expect(second.map).toEqual(first.map);
  });

  test('?seed=1 and ?seed=2 give different maps', async ({ page }) => {
    await openGame(page, '&seed=1');
    const one = await getState(page);
    await openGame(page, '&seed=2');
    const two = await getState(page);

    expect(two.seed).toBe(2);
    expect(two.map.terrain).not.toEqual(one.map.terrain);
  });

  test('uses the default seed without ?seed, or with an invalid one', async ({ page }) => {
    await openGame(page);
    const withoutSeed = await getState(page);
    expect(withoutSeed.seed).toBe(MAP_GEN_CONFIG.defaultSeed);

    await openGame(page, '&seed=abc');
    const invalidSeed = await getState(page);
    expect(invalidSeed.seed).toBe(MAP_GEN_CONFIG.defaultSeed);
    expect(invalidSeed.map).toEqual(withoutSeed.map);
  });

  test('advance(n) runs n simulation steps immediately', async ({ page }) => {
    await openGame(page);

    // Both readings happen in one browser task, so no real-time step can slip in between.
    const ticks = await page.evaluate(() => {
      const t = window.__TEST__!;
      const before = t.getState().tick;
      t.advance(40);
      return { before, after: t.getState().tick };
    });

    expect(ticks.after).toBe(ticks.before + 40);
  });

  test('the simulation runs 20 steps per second of game time', async ({ page }) => {
    await openGame(page);
    const sample = () =>
      page.evaluate(() => {
        const t = window.__TEST__!;
        return { tick: t.getState().tick, elapsedMs: t.elapsedMs };
      });

    const start = await sample();
    await page.waitForFunction((t) => window.__TEST__!.elapsedMs >= t + 1000, start.elapsedMs);
    const end = await sample();

    // Measured against the game's own clock, so the machine's frame rate does not matter.
    const expected = (end.elapsedMs - start.elapsedMs) / TICK_MS;
    expect(Math.abs(end.tick - start.tick - expected)).toBeLessThanOrEqual(1);
    expect(end.tick).toBeGreaterThan(start.tick);
  });

  test('getState returns a copy that cannot change the game', async ({ page }) => {
    await openGame(page);

    const terrain = await page.evaluate(() => {
      const t = window.__TEST__!;
      const copy = t.getState();
      const original = copy.map.terrain[0];
      copy.map.terrain[0] = original === 'water' ? 'grass' : 'water';
      return { original, now: t.getState().map.terrain[0] };
    });

    expect(terrain.now).toBe(terrain.original);
  });
});
