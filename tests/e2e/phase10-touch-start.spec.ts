import { expect, test, type Page } from '@playwright/test';
import { BUILDING_DEFS } from '../../src/data/buildings';
import type { Building, GameState, Unit } from '../../src/sim/state';
import {
  centerCameraOnMapMiddle,
  finger,
  getCamera,
  getSelection,
  getState,
  openGame,
  tileToScreen,
  trackConsoleErrors,
} from './helpers';

const advance = (page: Page, steps: number) =>
  page.evaluate((n) => window.__TEST__!.advance(n), steps);
const startScreen = (page: Page) => page.evaluate(() => window.__TEST__!.getStartScreen());
const outcome = (page: Page) => page.evaluate(() => window.__TEST__!.getOutcome());
const hudButtons = (page: Page) => page.evaluate(() => window.__TEST__!.getHudButtons());
const commandPanel = (page: Page) => page.evaluate(() => window.__TEST__!.getCommandPanel());
const placement = (page: Page) => page.evaluate(() => window.__TEST__!.getPlacement());
const touchMode = (page: Page) => page.evaluate(() => window.__TEST__!.getTouchMode());

const playerUnits = (state: GameState) =>
  state.entities.filter((e): e is Unit => e.kind === 'unit' && e.owner === 0);
const storideOf = (state: GameState, owner: number) =>
  state.entities.find(
    (e): e is Building => e.kind === 'building' && e.type === 'storide' && e.owner === owner,
  )!;

/** Where on the screen a unit is drawn. */
async function unitScreen(page: Page, unit: Unit): Promise<{ x: number; y: number }> {
  const at = await tileToScreen(page, unit.x, unit.y);
  return { x: at.x, y: at.y - 4 };
}

/**
 * An open tile in front of the player's Storide, inside the four tiles that
 * map generation keeps clear and away from the tiles where the units start.
 */
function openTileNearBase(state: GameState): { x: number; y: number } {
  const start = state.map.startPositions[0]!;
  return { x: start.x - 3, y: start.y + 2 };
}

/** The tile of the given terrain closest to the player's start position. */
function nearestTile(state: GameState, terrain: 'tree' | 'berries'): { x: number; y: number } {
  const start = state.map.startPositions[0]!;
  let best: { x: number; y: number } | undefined;
  let bestDistance = Infinity;
  state.map.terrain.forEach((tile, i) => {
    if (tile !== terrain) return;
    const x = i % state.map.width;
    const y = Math.floor(i / state.map.width);
    const distance = Math.hypot(x - start.x, y - start.y);
    if (distance < bestDistance) {
      best = { x, y };
      bestDistance = distance;
    }
  });
  return best!;
}

test.describe('phase 10: start screen', () => {
  test('the match waits behind the start screen until "Starta" is pressed', async ({ page }) => {
    const errors = trackConsoleErrors(page);
    await openGame(page, '', { startScreen: true });

    const screen = await startScreen(page);
    expect(screen).toMatchObject({
      visible: true,
      title: 'AnimalPlanet',
      button: { label: 'Starta' },
    });
    expect(screen.help).toContain('Förstör fiendens Storide');
    expect(screen.help).toContain('Mus:');
    expect(screen.help).toContain('Pekskärm:');

    // Nothing happens behind it: no time passes, nothing can be selected, no buttons show.
    await page.waitForFunction((t) => window.__TEST__!.elapsedMs >= t + 300, 0);
    expect((await getState(page)).tick).toBe(0);
    const [unit] = playerUnits(await getState(page));
    const at = await unitScreen(page, unit!);
    if (Math.hypot(at.x - screen.button.x, at.y - screen.button.y) > 150) {
      await page.mouse.click(at.x, at.y);
      expect(await getSelection(page)).toEqual([]);
    }
    expect(await hudButtons(page)).toEqual([]);
    const before = await getCamera(page);
    await page.keyboard.down('ArrowRight');
    await page.waitForFunction((t) => window.__TEST__!.elapsedMs >= t + 200, 300);
    await page.keyboard.up('ArrowRight');
    expect((await getCamera(page)).x).toBe(before.x);

    await page.mouse.click(screen.button.x, screen.button.y);
    expect((await startScreen(page)).visible).toBe(false);
    await expect.poll(async () => (await getState(page)).tick).toBeGreaterThan(0);
    expect(errors).toEqual([]);
  });

  test('the whole way: start screen, match, end screen and "Spela igen"', async ({ page }) => {
    const errors = trackConsoleErrors(page);
    await openGame(page, '', { startScreen: true });
    await page.mouse.click((await startScreen(page)).button.x, (await startScreen(page)).button.y);
    await expect.poll(async () => (await getState(page)).tick).toBeGreaterThan(0);

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

    // A new match starts at once, without the start screen.
    await page.waitForFunction(() => {
      const t = window.__TEST__;
      return (
        t?.ready === true &&
        t.getState().winner === null &&
        !t.getOutcome().visible &&
        !t.getStartScreen().visible &&
        t.getState().tick > 0
      );
    });
    const fresh = await getState(page);
    expect(storideOf(fresh, 1).hp).toBe(BUILDING_DEFS.storide.hp);
    expect(fresh.entities.filter((e) => e.kind === 'unit' && e.type === 'ramkrigare')).toEqual([]);

    // Opening the page anew shows the start screen again.
    await page.reload();
    await page.waitForFunction(() => window.__TEST__?.ready === true);
    expect((await startScreen(page)).visible).toBe(true);
    expect(errors).toEqual([]);
  });
});

test.describe('phase 10: jumping to the base', () => {
  test('the H key and the "Bas" button centre the view on the Storide', async ({ page }) => {
    const errors = trackConsoleErrors(page);
    await openGame(page, '&ai=0');
    const start = (await getState(page)).map.startPositions[0]!;
    const atBase = async () => {
      const { centerTile } = await getCamera(page);
      expect(centerTile.x).toBeCloseTo(start.x + 0.5, 1);
      expect(centerTile.y).toBeCloseTo(start.y + 0.5, 1);
    };

    await centerCameraOnMapMiddle(page);
    expect((await getCamera(page)).centerTile.x).toBeCloseTo(32, 1);
    await page.keyboard.press('h');
    await atBase();

    await centerCameraOnMapMiddle(page);
    const base = (await hudButtons(page)).find((b) => b.id === 'base');
    expect(base).toMatchObject({ label: 'Bas' });
    await page.mouse.click(base!.x, base!.y);
    await atBase();
    expect(errors).toEqual([]);
  });
});

test.describe('phase 10: touch', () => {
  test.use({ hasTouch: true });

  test('a tap selects a unit, and a tap on the ground then sends it there', async ({ page }) => {
    const errors = trackConsoleErrors(page);
    await openGame(page, '&ai=0');
    const touch = await finger(page);
    const state = await getState(page);
    const [unit, other] = playerUnits(state);

    const at = await unitScreen(page, unit!);
    await touch.tap(at.x, at.y);
    expect(await getSelection(page)).toEqual([unit!.id]);

    const open = openTileNearBase(state);
    const ground = await tileToScreen(page, open.x + 0.5, open.y + 0.5);
    await touch.tap(ground.x, ground.y);
    // The unit stays selected, has its order, and a ring shows where it is going.
    expect(await getSelection(page)).toEqual([unit!.id]);
    expect(await page.evaluate(() => window.__TEST__!.getOrderMarkerCount())).toBe(1);
    await advance(page, 200);
    const moved = playerUnits(await getState(page)).find((u) => u.id === unit!.id)!;
    expect({ x: Math.floor(moved.x), y: Math.floor(moved.y) }).toEqual(open);

    // A tap on another of the player's units selects that one instead.
    const next = await unitScreen(page, other!);
    await touch.tap(next.x, next.y);
    expect(await getSelection(page)).toEqual([other!.id]);
    expect(errors).toEqual([]);
  });

  test('a tap on a tree sends the selected Samlare to gather wood', async ({ page }) => {
    await openGame(page, '&ai=0');
    const touch = await finger(page);
    const state = await getState(page);
    const [unit] = playerUnits(state);
    const at = await unitScreen(page, unit!);
    await touch.tap(at.x, at.y);

    const tree = nearestTile(state, 'tree');
    const target = await tileToScreen(page, tree.x + 0.5, tree.y + 0.5);
    await touch.tap(target.x, target.y);
    const ordered = playerUnits(await getState(page)).find((u) => u.id === unit!.id)!;
    expect(ordered.task).toMatchObject({ kind: 'gather', resource: 'wood' });
  });

  test('a tap on an enemy sends the selected Ramkrigare to attack it', async ({ page }) => {
    await openGame(page, '&ai=0&fog=0');
    const touch = await finger(page);
    const state = await getState(page);
    const enemyStoride = storideOf(state, 1);
    const enemy = state.map.startPositions[1]!;
    const soldier = await page.evaluate(
      ([x, y]) => window.__TEST__!.spawnUnit('ramkrigare', 0, x, y),
      [enemy.x - 3, enemy.y - 3] as const,
    );
    await page.evaluate(([x, y]) => window.__TEST__!.centerCameraOnTile(x, y), [
      enemy.x + 0.5,
      enemy.y + 0.5,
    ] as const);

    const unit = (await getState(page)).entities.find((e): e is Unit => e.id === soldier)!;
    const at = await unitScreen(page, unit);
    await touch.tap(at.x, at.y);
    expect(await getSelection(page)).toEqual([soldier]);

    const roof = await tileToScreen(page, enemyStoride.x + 1.5, enemyStoride.y + 1.5);
    await touch.tap(roof.x, roof.y - 30);
    const ordered = (await getState(page)).entities.find((e): e is Unit => e.id === soldier)!;
    expect(ordered.task).toMatchObject({ kind: 'attack', targetId: enemyStoride.id });
    expect(await getSelection(page)).toEqual([soldier]);
  });

  test('holding 300 ms and then dragging selects several units', async ({ page }) => {
    const errors = trackConsoleErrors(page);
    await openGame(page, '&ai=0');
    const touch = await finger(page);
    const units = playerUnits(await getState(page));
    const points = await Promise.all(units.map((unit) => unitScreen(page, unit)));
    const left = Math.min(...points.map((p) => p.x)) - 25;
    const right = Math.max(...points.map((p) => p.x)) + 25;
    const top = Math.min(...points.map((p) => p.y)) - 25;
    const bottom = Math.max(...points.map((p) => p.y)) + 25;
    const before = await getCamera(page);

    await touch.down(left, top);
    expect(await touchMode(page)).toBe('pending');
    // The finger rests until the game says it has been held long enough.
    await expect.poll(() => touchMode(page)).toBe('held');
    await touch.move((left + right) / 2, (top + bottom) / 2);
    expect(await touchMode(page)).toBe('box');
    await touch.move(right, bottom);
    await touch.up();

    expect(await touchMode(page)).toBe('none');
    expect(await getSelection(page)).toEqual(units.map((u) => u.id).sort((a, b) => a - b));
    // The camera stood still while the box was drawn.
    const after = await getCamera(page);
    expect({ x: after.x, y: after.y }).toEqual({ x: before.x, y: before.y });
    expect(errors).toEqual([]);
  });

  test('dragging at once moves the camera and leaves the selection alone', async ({ page }) => {
    await openGame(page, '&ai=0');
    const touch = await finger(page);
    const [unit] = playerUnits(await getState(page));
    const at = await unitScreen(page, unit!);
    await touch.tap(at.x, at.y);
    await centerCameraOnMapMiddle(page);
    const before = await getCamera(page);

    // Start and first move are sent together, so no time passes between them.
    await Promise.all([touch.down(640, 300), touch.move(620, 290)]);
    expect(await touchMode(page)).toBe('pan');
    await touch.move(540, 250);
    await touch.up();

    const after = await getCamera(page);
    expect(after.x).toBeCloseTo(before.x + 100, 0);
    expect(after.y).toBeCloseTo(before.y + 50, 0);
    expect(await getSelection(page)).toEqual([unit!.id]);
  });

  test('"Avmarkera" clears the selection, and a finger on a button never moves the camera', async ({
    page,
  }) => {
    const errors = trackConsoleErrors(page);
    await openGame(page, '&ai=0');
    const touch = await finger(page);
    expect((await hudButtons(page)).map((b) => b.id)).toEqual(['base']);

    const [unit] = playerUnits(await getState(page));
    const at = await unitScreen(page, unit!);
    await touch.tap(at.x, at.y);
    await expect
      .poll(async () => (await hudButtons(page)).map((b) => b.label))
      .toEqual(['Bas', 'Avmarkera']);
    for (const button of await hudButtons(page)) {
      expect(button.width).toBeGreaterThanOrEqual(44);
      expect(button.height).toBeGreaterThanOrEqual(44);
    }

    const deselect = (await hudButtons(page)).find((b) => b.id === 'deselect')!;
    const before = await getCamera(page);
    await touch.down(deselect.x, deselect.y);
    await touch.move(deselect.x - 80, deselect.y + 60);
    await touch.up();
    expect(await getSelection(page)).toEqual([]);
    const after = await getCamera(page);
    expect({ x: after.x, y: after.y }).toEqual({ x: before.x, y: before.y });
    await expect.poll(async () => (await hudButtons(page)).map((b) => b.id)).toEqual(['base']);
    expect(errors).toEqual([]);
  });

  test('a building is placed with taps: one to move the outline, one on it to build', async ({
    page,
  }) => {
    const errors = trackConsoleErrors(page);
    await openGame(page, '&ai=0');
    const touch = await finger(page);
    const state = await getState(page);
    const [unit] = playerUnits(state);
    const at = await unitScreen(page, unit!);
    await touch.tap(at.x, at.y);
    await expect.poll(async () => (await commandPanel(page)).visible).toBe(true);

    const build = (await commandPanel(page)).buttons.find((b) => b.label === 'Bygg Visthus')!;
    await touch.tap(build.x, build.y);
    // The outline starts in the middle of the view; nothing is built yet.
    await expect.poll(() => placement(page)).toMatchObject({ building: 'visthus' });
    expect((await hudButtons(page)).map((b) => b.label)).toEqual(['Bas', 'Avbryt']);

    // A free 2x2 place inside the four clear tiles around the start position.
    const start = state.map.startPositions[0]!;
    const origin = { x: start.x - 3, y: start.y + 1 };
    const spot = await tileToScreen(page, origin.x + 1.5, origin.y + 1.5);
    await touch.tap(spot.x, spot.y);
    await expect
      .poll(() => placement(page))
      .toEqual({ building: 'visthus', x: origin.x, y: origin.y, valid: true });
    const visthus = (s: GameState) =>
      s.entities.filter((e) => e.kind === 'building' && e.type === 'visthus');
    expect(visthus(await getState(page))).toEqual([]);

    // Dragging still moves the camera, and the outline stays on its tiles.
    await Promise.all([touch.down(300, 200), touch.move(320, 210)]);
    await touch.move(340, 220);
    await touch.up();
    expect(await placement(page)).toMatchObject({ x: origin.x, y: origin.y });

    const again = await tileToScreen(page, origin.x + 0.5, origin.y + 0.5);
    await touch.tap(again.x, again.y);
    const built = visthus(await getState(page));
    expect(built).toHaveLength(1);
    expect(built[0]).toMatchObject({ x: origin.x, y: origin.y, complete: false, owner: 0 });
    expect(await placement(page)).toBeNull();
    expect(errors).toEqual([]);
  });

  test('"Avbryt" cancels a placement and keeps the selection', async ({ page }) => {
    await openGame(page, '&ai=0');
    const touch = await finger(page);
    const [unit] = playerUnits(await getState(page));
    const at = await unitScreen(page, unit!);
    await touch.tap(at.x, at.y);
    await expect.poll(async () => (await commandPanel(page)).visible).toBe(true);
    const build = (await commandPanel(page)).buttons.find((b) => b.label === 'Bygg Visthus')!;
    await touch.tap(build.x, build.y);
    await expect.poll(() => placement(page)).not.toBeNull();

    const cancel = (await hudButtons(page)).find((b) => b.label === 'Avbryt')!;
    await touch.tap(cancel.x, cancel.y);
    expect(await placement(page)).toBeNull();
    expect(await getSelection(page)).toEqual([unit!.id]);
    await expect
      .poll(async () => (await hudButtons(page)).map((b) => b.label))
      .toEqual(['Bas', 'Avmarkera']);
  });
});

test.describe('phase 10: on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('the start screen and the panels fit a 390 px wide screen', async ({ page }) => {
    const errors = trackConsoleErrors(page);
    await openGame(page, '&ai=0', { startScreen: true });
    const touch = await finger(page);
    const onScreen = (p: { x: number; y: number }, halfWidth = 22, halfHeight = 22) => {
      expect(p.x - halfWidth).toBeGreaterThanOrEqual(0);
      expect(p.x + halfWidth).toBeLessThanOrEqual(390);
      expect(p.y - halfHeight).toBeGreaterThanOrEqual(0);
      expect(p.y + halfHeight).toBeLessThanOrEqual(844);
    };

    const screen = await startScreen(page);
    expect(screen.visible).toBe(true);
    onScreen(screen.button, 100, 26);
    await touch.tap(screen.button.x, screen.button.y);
    expect((await startScreen(page)).visible).toBe(false);

    // The build menu of a Samlare.
    const state = await getState(page);
    const [unit] = playerUnits(state);
    const at = await unitScreen(page, unit!);
    await touch.tap(at.x, at.y);
    expect(await getSelection(page)).toEqual([unit!.id]);
    await expect.poll(async () => (await commandPanel(page)).buttons.length).toBe(3);
    for (const button of (await commandPanel(page)).buttons) onScreen(button);
    for (const button of await hudButtons(page)) {
      onScreen(button, button.width / 2, button.height / 2);
    }

    // The train button and the queue of the Storide.
    const storide = storideOf(state, 0);
    const roof = await tileToScreen(page, storide.x + 1.5, storide.y + 1.5);
    await touch.tap(roof.x, roof.y - 30);
    expect(await getSelection(page)).toEqual([storide.id]);
    await expect.poll(async () => (await commandPanel(page)).buttons.length).toBe(1);
    const train = (await commandPanel(page)).buttons[0]!;
    onScreen(train);
    await touch.tap(train.x, train.y);
    await touch.tap(train.x, train.y);
    await expect.poll(async () => (await commandPanel(page)).queue.length).toBe(2);
    for (const slot of (await commandPanel(page)).queue) onScreen(slot);

    // A tap on a queue place cancels that unit.
    const last = (await commandPanel(page)).queue[1]!;
    await touch.tap(last.x, last.y);
    await expect.poll(async () => (await commandPanel(page)).queue.length).toBe(1);
    expect(errors).toEqual([]);
  });
});
