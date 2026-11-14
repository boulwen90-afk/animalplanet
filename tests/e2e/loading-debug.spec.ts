import { expect, test } from '@playwright/test';
import type { Unit } from '../../src/sim/state';
import { getState, openGame, trackConsoleErrors } from './helpers';

test.describe('loading bar', () => {
  test('shows how far the loading has got, in percent, and then gives way to the start screen', async ({
    page,
  }) => {
    const errors = trackConsoleErrors(page);
    // Hold back the pictures of the figures until the test lets them through.
    let release!: () => void;
    const held = new Promise<void>((resolve) => (release = resolve));
    await page.route('**/*.png', async (route) => {
      await held;
      await route.continue();
    });
    await page.goto('./?test=1');
    await page.waitForFunction(() => window.__TEST_LOADING__ !== undefined);

    const loading = () => page.evaluate(() => window.__TEST_LOADING__!());
    await expect.poll(async () => (await loading()).visible).toBe(true);
    const during = await loading();
    expect(during.percent).toBeGreaterThanOrEqual(0);
    expect(during.percent).toBeLessThan(100);
    expect(during.text).toBe(`Laddar ${during.percent} %`);
    // The game is not built yet, so there is nothing to start.
    expect(await page.evaluate(() => window.__TEST__ === undefined)).toBe(true);

    release();
    await page.waitForFunction(() => window.__TEST__?.ready === true);
    await expect.poll(async () => (await loading()).visible).toBe(false);
    const start = await page.evaluate(() => window.__TEST__!.getStartScreen());
    expect(start.visible).toBe(true);
    // The text the page shows before the game's code has loaded is gone.
    expect(await page.locator('#boot').count()).toBe(0);
    expect(errors).toEqual([]);
  });
});

test.describe('measuring how the game runs', () => {
  test('?debug=1 shows frames a second and the number of units', async ({ page }) => {
    // Without the computer player nobody trains units, so the number stays the same.
    await openGame(page, '&debug=1&ai=0');
    await expect
      .poll(async () => (await page.evaluate(() => window.__TEST__!.getDebug())).text)
      .toMatch(/^\d+ bilder\/s · \d+ enheter$/);
    // A frame can take seconds on a slowed-down machine, which reads as 0; wait for a real reading.
    await expect
      .poll(async () => (await page.evaluate(() => window.__TEST__!.getDebug())).fps)
      .toBeGreaterThan(0);
    const debug = await page.evaluate(() => window.__TEST__!.getDebug());
    expect(debug.visible).toBe(true);
    const units = (await getState(page)).entities.filter((e) => e.kind === 'unit').length;
    expect(debug.text).toContain(`${units} enheter`);
  });

  test('the counter is off without ?debug=1', async ({ page }) => {
    await openGame(page);
    expect((await page.evaluate(() => window.__TEST__!.getDebug())).visible).toBe(false);
  });

  test('?stress=120 starts the match with 120 more Samlare, at work, and the counter on', async ({
    page,
  }) => {
    const errors = trackConsoleErrors(page);
    await openGame(page, '&stress=120');
    const state = await getState(page);
    const mine = state.entities.filter(
      (e): e is Unit => e.kind === 'unit' && e.owner === 0 && e.type === 'samlare',
    );
    expect(mine).toHaveLength(123);
    expect(mine.filter((unit) => unit.task.kind === 'gather').length).toBeGreaterThan(20);
    expect((await page.evaluate(() => window.__TEST__!.getDebug())).visible).toBe(true);

    // Nobody shares a work place, however many they are.
    await page.evaluate(() => window.__TEST__!.advance(300));
    const places = (await getState(page)).entities
      .filter((e): e is Unit => e.kind === 'unit' && e.task.kind === 'gather')
      .map((unit) => (unit.task.kind === 'gather' ? unit.task.place : null))
      .filter((place) => place !== null)
      .map((place) => `${place!.x},${place!.y}`);
    expect(new Set(places).size).toBe(places.length);
    expect(errors).toEqual([]);
  });
});
