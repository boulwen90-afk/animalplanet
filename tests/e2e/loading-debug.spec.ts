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
  test('?debug=1 shows frames a second, the number of units and the time of a simulation step', async ({
    page,
  }) => {
    // Without the computer player nobody trains units, so the number stays the same.
    await openGame(page, '&debug=1&ai=0');
    await expect
      .poll(async () => (await page.evaluate(() => window.__TEST__!.getDebug())).text)
      .toMatch(/^\d+ bilder\/s · \d+ enheter · steg \d+,\d ms \(längst \d+,\d\)$/);
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

  test('?stress=120 starts the match with 60 more Samlare on each side, at work, no computer player, and the counter on', async ({
    page,
  }) => {
    const errors = trackConsoleErrors(page);
    await openGame(page, '&stress=120');
    const state = await getState(page);
    for (const owner of [0, 1]) {
      const workers = state.entities.filter(
        (e): e is Unit => e.kind === 'unit' && e.owner === owner && e.type === 'samlare',
      );
      expect(workers).toHaveLength(63);
      expect(workers.filter((unit) => unit.task.kind === 'gather').length).toBeGreaterThan(20);
    }
    // The other side's units have their orders from the stress run, not from a computer player.
    expect(state.players.map((side) => side.ai)).toEqual([null, null]);
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

  test('?stress=400 gives 200 extra units to each side and shows what a simulation step costs', async ({
    page,
  }) => {
    test.slow();
    const errors = trackConsoleErrors(page);
    await openGame(page, '&stress=400');
    const state = await getState(page);
    expect(state.entities.filter((e) => e.kind === 'unit')).toHaveLength(406);
    for (const owner of [0, 1]) {
      expect(state.entities.filter((e) => e.kind === 'unit' && e.owner === owner)).toHaveLength(
        203,
      );
    }
    // The counter reads 406 units and a step time above nothing.
    await expect
      .poll(async () => (await page.evaluate(() => window.__TEST__!.getDebug())).text, {
        timeout: 20_000,
      })
      .toMatch(/· 406 enheter · steg (?!0,0 )\d+,\d ms \(längst \d+,\d\)$/);
    expect(errors).toEqual([]);
  });

  test('?stressmode=still leaves the units standing, and ?stressmode=fight sends soldiers to the middle', async ({
    page,
  }) => {
    test.slow();
    const errors = trackConsoleErrors(page);
    await openGame(page, '&stress=60&stressmode=still');
    await page.evaluate(() => window.__TEST__!.advance(60));
    const still = await getState(page);
    const standing = still.entities.filter((e): e is Unit => e.kind === 'unit');
    expect(standing).toHaveLength(66);
    expect(standing.every((unit) => unit.task.kind === 'idle' && unit.path.length === 0)).toBe(
      true,
    );

    await openGame(page, '&stress=60&stressmode=fight');
    const fight = await getState(page);
    for (const owner of [0, 1]) {
      const soldiers = fight.entities.filter(
        (e): e is Unit => e.kind === 'unit' && e.owner === owner && e.type !== 'samlare',
      );
      expect(soldiers).toHaveLength(30);
      expect(soldiers.filter((unit) => unit.type === 'ramkastare')).toHaveLength(10);
      expect(soldiers.every((unit) => unit.path.length > 0)).toBe(true);
    }
    // They meet in the middle and fight.
    await page.evaluate(() => window.__TEST__!.advance(40 * 20));
    const later = await getState(page);
    const fighting = later.entities.filter((e) => e.kind === 'unit' && e.task.kind === 'attack');
    const fled = later.entities.filter((e) => e.kind === 'unit' && e.task.kind === 'flee');
    expect(fighting.length + fled.length).toBeGreaterThan(10);

    // An unknown mode is the usual one: gathering.
    await openGame(page, '&stress=20&stressmode=nonsense');
    const usual = await getState(page);
    expect(
      usual.entities.filter((e) => e.kind === 'unit' && e.task.kind === 'gather').length,
    ).toBeGreaterThan(10);
    expect(errors).toEqual([]);
  });
});
