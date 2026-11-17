import { expect, test, type Page } from '@playwright/test';
import { LOCKSTEP_CONFIG } from '../../src/data/lockstep';
import { START_CONFIG } from '../../src/data/setup';
import { UNIT_DEFS } from '../../src/data/units';
import type { Building, GameState, Unit } from '../../src/sim/state';
import {
  getCamera,
  getSelection,
  getState,
  openGame,
  tileToScreen,
  trackConsoleErrors,
} from './helpers';

/** Steps between an order and its carrying out in a match between two players: 8, which is 400 ms. */
const DELAY = LOCKSTEP_CONFIG.delayTurns * LOCKSTEP_CONFIG.stepsPerTurn;
const COST = UNIT_DEFS.samlare.cost.food!;

const advance = (page: Page, steps: number) =>
  page.evaluate((n) => window.__TEST__!.advance(n), steps);
const commandPanel = (page: Page) => page.evaluate(() => window.__TEST__!.getCommandPanel());
const unitsOf = (state: GameState, owner: number) =>
  state.entities.filter((e): e is Unit => e.kind === 'unit' && e.owner === owner);
const homeOf = (state: GameState, owner: number) =>
  state.entities.find((e): e is Building => e.kind === 'building' && e.owner === owner)!;

test.describe('orders through the turns of the match', () => {
  test('against the computer an order is carried out at once, as before', async ({ page }) => {
    const errors = trackConsoleErrors(page);
    // Behind the start screen the match stands still until the test steps it.
    await openGame(page, '', { startScreen: true });
    const home = homeOf(await getState(page), 0);
    const result = await page.evaluate(
      (buildingId) =>
        window.__TEST__!.issue({ type: 'train', player: 0, buildingId, unit: 'samlare' }),
      home.id,
    );
    expect(result).toEqual({ ok: true });
    const state = await getState(page);
    expect(homeOf(state, 0).queue).toEqual(['samlare']);
    expect(state.players[0]!.resources.food).toBe(START_CONFIG.resources.food - COST);
    expect(state.tick).toBe(0);
    expect(errors).toEqual([]);
  });

  test('?lockstep=2: an order is carried out exactly 8 steps after it was given', async ({
    page,
  }) => {
    const errors = trackConsoleErrors(page);
    await openGame(page, '&lockstep=2&ai=0', { startScreen: true });
    await advance(page, 3);
    const before = await getState(page);
    const [unit] = unitsOf(before, 0);
    const result = await page.evaluate(
      ([id, x, y]) =>
        window.__TEST__!.issue({ type: 'move', player: 0, unitIds: [id], x: x + 4, y }),
      [unit!.id, Math.floor(unit!.x), Math.floor(unit!.y)] as const,
    );
    // The answer comes at once; the game is as it was.
    expect(result).toEqual({ ok: true });
    expect(await page.evaluate(() => window.__TEST__!.getChecksum())).toBe(
      await page.evaluate(() => {
        const t = window.__TEST__!;
        return t.getChecksum();
      }),
    );
    const pathOf = async () =>
      unitsOf(await getState(page), 0).find((u) => u.id === unit!.id)!.path;
    expect(await pathOf()).toEqual([]);

    // The steps before its own: nothing yet.
    await advance(page, DELAY);
    expect((await getState(page)).tick).toBe(3 + DELAY);
    expect(await pathOf()).toEqual([]);
    // Its step.
    await advance(page, 1);
    expect((await pathOf()).length).toBeGreaterThan(0);
    expect(errors).toEqual([]);
  });

  test('?lockstep=2: an order that would be refused now is refused at once and never carried out', async ({
    page,
  }) => {
    const errors = trackConsoleErrors(page);
    await openGame(page, '&lockstep=2&ai=0', { startScreen: true });
    const home = homeOf(await getState(page), 0);
    // An upgrade cannot be worked out in the main building.
    const result = await page.evaluate(
      (buildingId) =>
        window.__TEST__!.issue({ type: 'research', player: 0, buildingId, upgrade: 'weapons' }),
      home.id,
    );
    expect(result.ok).toBe(false);
    await advance(page, DELAY + 2);
    expect(homeOf(await getState(page), 0).research).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('?lockstep=2: an order that looked fine but is refused when its step comes is explained then', async ({
    page,
  }) => {
    const errors = trackConsoleErrors(page);
    await openGame(page, '&lockstep=2&ai=0', { startScreen: true });
    const home = homeOf(await getState(page), 0);
    // Three workers are ordered at once. There is room for two more: each
    // order looks fine as the game stands, and the third is one too many.
    const answers = await page.evaluate((buildingId) => {
      const t = window.__TEST__!;
      const order = { type: 'train', player: 0, buildingId, unit: 'samlare' } as const;
      return [t.issue(order), t.issue(order), t.issue(order)];
    }, home.id);
    expect(answers).toEqual([{ ok: true }, { ok: true }, { ok: true }]);
    expect(await page.evaluate(() => window.__TEST__!.getNotice())).toBe('');

    await advance(page, DELAY + 1);
    const state = await getState(page);
    expect(homeOf(state, 0).queue).toEqual(['samlare', 'samlare']);
    expect(state.players[0]!.resources.food).toBe(START_CONFIG.resources.food - 2 * COST);
    // The player is told why the third was refused, as when an order is refused at once.
    await expect
      .poll(() => page.evaluate(() => window.__TEST__!.getNotice()))
      .toBe('Ingen plats – bygg ett Ide');
    expect(errors).toEqual([]);
  });

  test('?lockstep=2: a click on "Träna Samlare" takes effect 400 ms later, give or take 50', async ({
    page,
  }) => {
    const errors = trackConsoleErrors(page);
    await openGame(page, '&lockstep=2&ai=0');
    const home = homeOf(await getState(page), 0);
    const at = await tileToScreen(page, home.x + 1.5, home.y + 1.5);
    await page.mouse.click(at.x, at.y);
    await expect.poll(async () => (await commandPanel(page)).visible).toBe(true);
    const [button] = (await commandPanel(page)).buttons;

    // Note the step of the game when the press reaches the page, and the
    // step in which the worker appears in the queue.
    await page.evaluate((homeId) => {
      const t = window.__TEST__!;
      const seen = { pressedAt: -1, queuedAt: -1 };
      (window as unknown as { __seen: typeof seen }).__seen = seen;
      const stepNow = () => t.getState().tick;
      window.addEventListener('pointerdown', () => (seen.pressedAt = stepNow()), {
        capture: true,
        once: true,
      });
      const watch = () => {
        const state = t.getState();
        const queue = state.entities.find((e) => e.id === homeId) as { queue: string[] };
        if (seen.pressedAt >= 0 && queue.queue.length > 0) seen.queuedAt = state.tick;
        else requestAnimationFrame(watch);
      };
      requestAnimationFrame(watch);
    }, home.id);
    await page.mouse.click(button!.x, button!.y);
    await page.waitForFunction(
      () => (window as unknown as { __seen: { queuedAt: number } }).__seen.queuedAt >= 0,
    );
    const seen = await page.evaluate(
      () => (window as unknown as { __seen: { pressedAt: number; queuedAt: number } }).__seen,
    );
    // The order is carried out in the step 8 after it was given: the worker
    // is in the queue when 9 steps have been run. The game handles a press
    // in its next frame, which can add a step: measured, 9 or 10 steps pass
    // from the press until the worker is seen in the queue. It can never be
    // sooner.
    const steps = seen.queuedAt - seen.pressedAt;
    expect(steps).toBeGreaterThanOrEqual(DELAY + 1);
    if (!process.env.E2E_CPU_THROTTLE) expect(steps).toBeLessThanOrEqual(DELAY + 3);
    expect((await getState(page)).players[0]!.resources.food).toBe(
      START_CONFIG.resources.food - COST,
    );
    expect(errors).toEqual([]);
  });

  test('?lockstep=2: a right-click shows its order ring at once, and the unit sets off when the order is carried out', async ({
    page,
  }) => {
    const errors = trackConsoleErrors(page);
    await openGame(page, '&lockstep=2&ai=0');
    const [unit] = unitsOf(await getState(page), 0);
    const at = await tileToScreen(page, unit!.x, unit!.y);
    await page.mouse.click(at.x, at.y - 4);
    expect(await getSelection(page)).toEqual([unit!.id]);
    const target = await tileToScreen(page, Math.floor(unit!.x) + 0.5, Math.floor(unit!.y) + 5.5);
    await page.mouse.click(target.x, target.y, { button: 'right' });
    await expect
      .poll(() => page.evaluate(() => window.__TEST__!.getOrderMarkerCount()))
      .toBeGreaterThan(0);
    await expect
      .poll(
        async () => unitsOf(await getState(page), 0).find((u) => u.id === unit!.id)!.path.length,
      )
      .toBeGreaterThan(0);
    expect(errors).toEqual([]);
  });
});

test.describe('playing the other side', () => {
  test('?side=1: the player has side 1, sees with its eyes and wins when side 0 falls', async ({
    page,
  }) => {
    const errors = trackConsoleErrors(page);
    await openGame(page, '&side=1&seed=2');
    const state = await getState(page);
    // The computer plays side 0 now.
    expect(state.players[0]!.ai).not.toBeNull();
    expect(state.players[1]!.ai).toBeNull();

    // The view starts on side 1's base, and its own units answer to a click.
    const home = homeOf(state, 1);
    const camera = await getCamera(page);
    expect(Math.abs(camera.centerTile.x - (home.x + 1.5))).toBeLessThan(2);
    expect(Math.abs(camera.centerTile.y - (home.y + 1.5))).toBeLessThan(2);
    const [mine] = unitsOf(state, 1);
    const at = await tileToScreen(page, mine!.x, mine!.y);
    await page.mouse.click(at.x, at.y - 4);
    expect(await getSelection(page)).toEqual([mine!.id]);
    expect((await page.evaluate(() => window.__TEST__!.getHud())).title).toBe('Samlare');

    // A right-click orders it about, as side 0's player orders theirs.
    const target = await tileToScreen(page, Math.floor(mine!.x) + 0.5, Math.floor(mine!.y) - 3.5);
    await page.mouse.click(target.x, target.y, { button: 'right' });
    await expect
      .poll(
        async () => unitsOf(await getState(page), 1).find((u) => u.id === mine!.id)!.path.length,
      )
      .toBeGreaterThan(0);

    // The other side is hidden by the fog: with the view on its base, a
    // click where one of its units stands selects nothing.
    const [theirs] = unitsOf(state, 0);
    await page.keyboard.press('Escape');
    await page.evaluate(([x, y]) => window.__TEST__!.centerCameraOnTile(x, y), [
      Math.floor(theirs!.x),
      Math.floor(theirs!.y),
    ] as const);
    const hidden = await tileToScreen(page, theirs!.x, theirs!.y);
    await page.mouse.click(hidden.x, hidden.y - 4);
    expect(await getSelection(page)).toEqual([]);
    expect(
      (await getState(page)).players[1]!.visibility.filter((v) => v === 2).length,
    ).toBeGreaterThan(50);

    // Side 0's main building falls: for this player that is a victory.
    await page.evaluate(() => {
      const t = window.__TEST__!;
      const s = t.getState();
      const theirs = s.entities.find((e) => e.kind === 'building' && e.owner === 0)!;
      const start = s.map.startPositions[0]!;
      const unitIds = [-3, -2, -1, 0, 1, 2].map((d) =>
        t.spawnUnit('ramkrigare', 1, start.x + d, start.y - 3),
      );
      t.setLife(theirs.id, 20);
      t.command({ type: 'attack', player: 1, unitIds, targetId: theirs.id });
    });
    await advance(page, 400);
    await expect
      .poll(() => page.evaluate(() => window.__TEST__!.getOutcome()))
      .toMatchObject({ visible: true, title: 'Seger' });
    expect(errors).toEqual([]);
  });
});
