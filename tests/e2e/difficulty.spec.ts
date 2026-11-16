import { expect, test, type Page } from '@playwright/test';
import type { Building, GameState, Unit } from '../../src/sim/state';
import { finger, getState, openGame, trackConsoleErrors } from './helpers';

const advance = (page: Page, steps: number) =>
  page.evaluate((n) => window.__TEST__!.advance(n), steps);
const startScreen = (page: Page) => page.evaluate(() => window.__TEST__!.getStartScreen());
const outcome = (page: Page) => page.evaluate(() => window.__TEST__!.getOutcome());
const levelOf = async (page: Page) => (await getState(page)).players[1]!.ai!.level;
const chosen = async (page: Page) =>
  (await startScreen(page)).levels.filter((level) => level.chosen).map((level) => level.label);

const storideOf = (state: GameState, owner: number) =>
  state.entities.find(
    (e): e is Building => e.kind === 'building' && e.type === 'storide' && e.owner === owner,
  )!;
const workersOf = (state: GameState, owner: number) =>
  state.entities.filter(
    (e): e is Unit =>
      e.kind === 'unit' && e.owner === owner && e.type === 'samlare' && e.task.kind !== 'flee',
  );

/** Presses a level on the start screen, by its label. */
async function choose(page: Page, label: string): Promise<void> {
  const level = (await startScreen(page)).levels.find((l) => l.label === label)!;
  await page.mouse.click(level.x, level.y);
}

/** Presses "Starta" and waits for the match to run. */
async function start(page: Page): Promise<void> {
  const { button } = await startScreen(page);
  await page.mouse.click(button.x, button.y);
  await expect.poll(async () => (await getState(page)).tick).toBeGreaterThan(0);
}

test.describe('difficulty levels', () => {
  test('the start screen offers three levels, with Medel chosen', async ({ page }) => {
    const errors = trackConsoleErrors(page);
    await openGame(page, '', { startScreen: true });
    const screen = await startScreen(page);

    expect(screen.levelTitle).toBe('Svårighetsgrad');
    expect(screen.levels.map((level) => [level.id, level.label, level.chosen])).toEqual([
      ['easy', 'Nybörjare', false],
      ['medium', 'Medel', true],
      ['hard', 'Proffs', false],
    ]);
    // Side by side, from left to right, above the start button.
    const [easy, medium, hard] = screen.levels;
    expect(easy!.x).toBeLessThan(medium!.x);
    expect(medium!.x).toBeLessThan(hard!.x);
    expect(easy!.y).toBe(medium!.y);
    expect(medium!.y).toBe(hard!.y);
    expect(medium!.y + 22).toBeLessThanOrEqual(screen.button.y - 26);
    expect(Math.abs(medium!.x - screen.button.x)).toBeLessThanOrEqual(1);

    // Pressing "Starta" without choosing plays against the middle level.
    await start(page);
    expect(await levelOf(page)).toBe('medium');
    expect(errors).toEqual([]);
  });

  test('choosing a level only marks it; the match starts with "Starta", on that level', async ({
    page,
  }) => {
    const errors = trackConsoleErrors(page);
    await openGame(page, '', { startScreen: true });

    await choose(page, 'Proffs');
    expect(await chosen(page)).toEqual(['Proffs']);
    await choose(page, 'Nybörjare');
    expect(await chosen(page)).toEqual(['Nybörjare']);
    // Still behind the start screen: no time has passed.
    await page.waitForFunction((t) => window.__TEST__!.elapsedMs >= t + 200, 0);
    expect((await startScreen(page)).visible).toBe(true);
    expect((await getState(page)).tick).toBe(0);

    await choose(page, 'Proffs');
    await start(page);
    expect(await levelOf(page)).toBe('hard');
    expect((await startScreen(page)).visible).toBe(false);
    expect(errors).toEqual([]);
  });

  test('the levels play differently: after five minutes Proffs has 14 Samlare, Medel 10 and Nybörjare 7', async ({
    page,
  }) => {
    test.slow();
    const errors = trackConsoleErrors(page);
    const counts: number[] = [];
    for (const label of ['Nybörjare', 'Medel', 'Proffs']) {
      await openGame(page, '&seed=2', { startScreen: true });
      await choose(page, label);
      await start(page);
      // The player's main building cannot fall, so that the match goes on.
      await page.evaluate(() => {
        const t = window.__TEST__!;
        const home = t.getState().entities.find((e) => e.kind === 'building' && e.owner === 0)!;
        t.setLife(home.id, 1e9);
      });
      const now = (await getState(page)).tick;
      await advance(page, 5 * 60 * 20 - now);
      counts.push(workersOf(await getState(page), 1).length);
    }
    expect(counts).toEqual([7, 10, 14]);
    expect(errors).toEqual([]);
  });

  test('"Spela igen" plays on the level that was chosen, and the start screen remembers it', async ({
    page,
  }) => {
    test.slow();
    const errors = trackConsoleErrors(page);
    await openGame(page, '', { startScreen: true });
    await choose(page, 'Nybörjare');
    await start(page);
    expect(await levelOf(page)).toBe('easy');

    // Eight soldiers at the enemy base decide the match.
    const state = await getState(page);
    const enemy = state.map.startPositions[1]!;
    const tiles = [
      [-3, 0],
      [-3, 1],
      [-3, -1],
      [-2, -3],
      [-1, -3],
      [0, -3],
      [1, -3],
      [2, -3],
    ].map(([dx, dy]) => ({ x: enemy.x + dx!, y: enemy.y + dy! }));
    await page.evaluate(
      ([where, targetId]) => {
        const t = window.__TEST__!;
        const unitIds = where.map((tile) => t.spawnUnit('ramkrigare', 0, tile.x, tile.y));
        t.command({ type: 'attack', player: 0, unitIds, targetId });
      },
      [tiles, storideOf(state, 1).id] as const,
    );
    await advance(page, 700);
    await expect.poll(() => outcome(page)).toMatchObject({ visible: true, title: 'Seger' });
    const { button } = await outcome(page);
    await page.mouse.click(button.x, button.y);

    // A new match, without the start screen, on the same level.
    await page.waitForFunction(() => {
      const t = window.__TEST__;
      return t?.ready === true && !t.getStartScreen().visible && t.getState().tick > 0;
    });
    expect((await getState(page)).winner).toBeNull();
    expect(await levelOf(page)).toBe('easy');

    // Opening the page anew shows the start screen, with that level chosen.
    await page.reload();
    await page.waitForFunction(() => window.__TEST__?.ready === true);
    expect((await startScreen(page)).visible).toBe(true);
    expect(await chosen(page)).toEqual(['Nybörjare']);
    expect(errors).toEqual([]);
  });

  test('?level= sets the level in test mode, and an unknown name gives Medel', async ({ page }) => {
    const errors = trackConsoleErrors(page);
    await openGame(page, '&level=hard');
    expect(await levelOf(page)).toBe('hard');

    await openGame(page, '&level=easy', { startScreen: true });
    expect(await chosen(page)).toEqual(['Nybörjare']);
    await start(page);
    expect(await levelOf(page)).toBe('easy');

    await page.evaluate(() => window.sessionStorage.clear());
    await openGame(page, '&level=nonsense');
    expect(await levelOf(page)).toBe('medium');
    expect(errors).toEqual([]);
  });
});

test.describe('difficulty levels on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('the three levels fit a 390 px wide screen and answer to a finger', async ({ page }) => {
    const errors = trackConsoleErrors(page);
    await openGame(page, '', { startScreen: true });
    const touch = await finger(page);
    const screen = await startScreen(page);

    // Each is at least 44 px wide and high, and none overlaps its neighbour.
    const xs = screen.levels.map((level) => level.x);
    expect(xs[0]! - 22).toBeGreaterThanOrEqual(0);
    expect(xs[2]! + 22).toBeLessThanOrEqual(390);
    expect(xs[1]! - xs[0]!).toBeGreaterThanOrEqual(44 + 8);
    expect(xs[2]! - xs[1]!).toBeGreaterThanOrEqual(44 + 8);
    for (const level of screen.levels) {
      expect(level.y - 22).toBeGreaterThanOrEqual(0);
      expect(level.y + 22).toBeLessThanOrEqual(screen.button.y - 26);
    }
    expect(screen.button.y + 26).toBeLessThanOrEqual(844);

    const easy = screen.levels[0]!;
    await touch.tap(easy.x, easy.y);
    expect(await chosen(page)).toEqual(['Nybörjare']);
    expect((await getState(page)).tick).toBe(0);
    await touch.tap(screen.button.x, screen.button.y);
    await expect.poll(async () => (await getState(page)).tick).toBeGreaterThan(0);
    expect(await levelOf(page)).toBe('easy');
    expect(errors).toEqual([]);
  });
});

test.describe('difficulty levels on a phone held sideways', () => {
  test.use({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });

  test('title, text, levels and start button all fit a 390 px high screen', async ({ page }) => {
    const errors = trackConsoleErrors(page);
    await openGame(page, '', { startScreen: true });
    const touch = await finger(page);
    const screen = await startScreen(page);
    // Too low to stack: the start button stands to the right of the levels.
    for (const level of screen.levels) {
      expect(level.y - 22).toBeGreaterThanOrEqual(0);
      expect(level.y + 22).toBeLessThanOrEqual(390);
      expect(level.y).toBe(screen.button.y);
      expect(level.x + 56).toBeLessThanOrEqual(screen.button.x - 100);
    }
    expect(screen.button.x + 100).toBeLessThanOrEqual(844);
    expect(screen.button.y + 26).toBeLessThanOrEqual(390);

    const hard = screen.levels[2]!;
    await touch.tap(hard.x, hard.y);
    expect(await chosen(page)).toEqual(['Proffs']);
    await touch.tap(screen.button.x, screen.button.y);
    await expect.poll(async () => (await getState(page)).tick).toBeGreaterThan(0);
    expect(await levelOf(page)).toBe('hard');
    expect(errors).toEqual([]);
  });
});
