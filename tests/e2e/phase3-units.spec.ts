import { expect, test, type Page } from '@playwright/test';
import { UNIT_DEFS } from '../../src/data/units';
import type { Unit } from '../../src/sim/state';
import { getSelection, getState, openGame, tileToScreen, trackConsoleErrors } from './helpers';

/** The player's units, in id order. */
async function playerUnits(page: Page): Promise<Unit[]> {
  const state = await getState(page);
  return state.entities.filter((e): e is Unit => e.kind === 'unit' && e.owner === 0);
}

/**
 * Where a unit's circle is drawn on screen. The circle sits a few pixels
 * above the unit's ground position.
 */
async function unitScreen(page: Page, unit: Unit): Promise<{ x: number; y: number }> {
  const ground = await tileToScreen(page, unit.x, unit.y);
  return { x: ground.x, y: ground.y - 4 };
}

/** Drags a selection box around all the given units. */
async function boxSelect(page: Page, units: Unit[], modifiers: { shift?: boolean } = {}) {
  const points = await Promise.all(units.map((unit) => unitScreen(page, unit)));
  const left = Math.min(...points.map((p) => p.x)) - 25;
  const right = Math.max(...points.map((p) => p.x)) + 25;
  const top = Math.min(...points.map((p) => p.y)) - 25;
  const bottom = Math.max(...points.map((p) => p.y)) + 25;
  if (modifiers.shift) await page.keyboard.down('Shift');
  await page.mouse.move(left, top);
  await page.mouse.down();
  await page.mouse.move((left + right) / 2, (top + bottom) / 2, { steps: 4 });
  await page.mouse.move(right, bottom, { steps: 4 });
  await page.mouse.up();
  if (modifiers.shift) await page.keyboard.up('Shift');
}

const tileOf = (unit: Unit) => ({ x: Math.floor(unit.x), y: Math.floor(unit.y) });

/**
 * An open tile near the player's base with nothing on it. It lies in front
 * of the Storide to the left, inside the radius of four tiles that map
 * generation keeps clear, and away from the tiles where the units start.
 */
async function openTileNearBase(page: Page): Promise<{ x: number; y: number }> {
  const state = await getState(page);
  const start = state.map.startPositions[0]!;
  return { x: start.x - 3, y: start.y + 2 };
}

test.describe('phase 3: units, selection and movement', () => {
  test('starts with a Storide and three Samlare per side, without console errors', async ({
    page,
  }) => {
    const errors = trackConsoleErrors(page);
    // Without the computer player: it starts on its first house in its first step.
    await openGame(page, '&ai=0');

    const state = await getState(page);
    for (const owner of [0, 1]) {
      const mine = state.entities.filter((e) => e.owner === owner);
      expect(mine.filter((e) => e.kind === 'building').map((e) => e.type)).toEqual(['storide']);
      expect(mine.filter((e) => e.kind === 'unit').map((e) => e.type)).toEqual([
        'samlare',
        'samlare',
        'samlare',
      ]);
    }
    expect(await getSelection(page)).toEqual([]);
    expect(await page.evaluate(() => window.__TEST__!.getHud().visible)).toBe(false);
    expect(errors).toEqual([]);
  });

  test('clicking a Samlare selects it and shows its name and hit points', async ({ page }) => {
    await openGame(page);
    const [unit] = await playerUnits(page);
    const at = await unitScreen(page, unit!);

    await page.mouse.click(at.x, at.y);

    expect(await getSelection(page)).toEqual([unit!.id]);
    expect(await page.evaluate(() => window.__TEST__!.getHud())).toEqual({
      visible: true,
      title: 'Samlare',
      detail: `Liv ${UNIT_DEFS.samlare.hp}/${UNIT_DEFS.samlare.hp}`,
    });
  });

  test('clicking the Storide selects it', async ({ page }) => {
    await openGame(page);
    const state = await getState(page);
    const storide = state.entities.find((e) => e.kind === 'building' && e.owner === 0)!;
    // The middle of the footprint; the block drawn above it covers this point.
    const at = await tileToScreen(page, storide.x + 1.5, storide.y + 1.5);

    await page.mouse.click(at.x, at.y);

    expect(await getSelection(page)).toEqual([storide.id]);
    expect(await page.evaluate(() => window.__TEST__!.getHud().title)).toBe('Storide');
  });

  test('a drag box over all three Samlare selects three', async ({ page }) => {
    await openGame(page);
    const units = await playerUnits(page);

    await boxSelect(page, units);

    expect(await getSelection(page)).toEqual(units.map((u) => u.id));
    expect(await page.evaluate(() => window.__TEST__!.getHud())).toEqual({
      visible: true,
      title: '3 enheter markerade',
      detail: 'Samlare ×3',
    });
  });

  test('shift-click adds and removes units', async ({ page }) => {
    await openGame(page);
    const [a, b] = await playerUnits(page);
    const atA = await unitScreen(page, a!);
    const atB = await unitScreen(page, b!);

    await page.mouse.click(atA.x, atA.y);
    await page.keyboard.down('Shift');
    await page.mouse.click(atB.x, atB.y);
    expect(await getSelection(page)).toEqual([a!.id, b!.id]);

    await page.mouse.click(atA.x, atA.y);
    await page.keyboard.up('Shift');
    expect(await getSelection(page)).toEqual([b!.id]);
  });

  test('clicking empty ground or pressing Esc clears the selection', async ({ page }) => {
    await openGame(page);
    const units = await playerUnits(page);
    const [first] = units;
    const at = await unitScreen(page, first!);
    const open = await openTileNearBase(page);
    const ground = await tileToScreen(page, open.x + 0.5, open.y + 0.5);

    await page.mouse.click(at.x, at.y);
    expect(await getSelection(page)).toHaveLength(1);
    await page.mouse.click(ground.x, ground.y);
    expect(await getSelection(page)).toEqual([]);

    await page.mouse.click(at.x, at.y);
    expect(await getSelection(page)).toHaveLength(1);
    await page.keyboard.press('Escape');
    expect(await getSelection(page)).toEqual([]);
  });

  test('right-click sends the selected units to stand at and next to the tile', async ({
    page,
  }) => {
    const errors = trackConsoleErrors(page);
    await openGame(page);
    const units = await playerUnits(page);
    await boxSelect(page, units);

    const target = await openTileNearBase(page);
    const at = await tileToScreen(page, target.x + 0.5, target.y + 0.5);
    await page.mouse.click(at.x, at.y, { button: 'right' });

    expect(await page.evaluate(() => window.__TEST__!.getOrderMarkerCount())).toBe(1);
    const walking = await playerUnits(page);
    expect(walking.every((u) => u.path.length > 0)).toBe(true);

    await page.evaluate(() => window.__TEST__!.advance(400));

    const arrived = await playerUnits(page);
    const tiles = arrived.map(tileOf);
    expect(new Set(tiles.map((t) => `${t.x},${t.y}`)).size).toBe(3);
    expect(tiles).toContainEqual(target);
    for (const tile of tiles) {
      expect(
        Math.max(Math.abs(tile.x - target.x), Math.abs(tile.y - target.y)),
      ).toBeLessThanOrEqual(1);
    }
    expect(arrived.every((u) => u.path.length === 0)).toBe(true);
    // The selection survives the order.
    expect(await getSelection(page)).toEqual(units.map((u) => u.id));
    expect(errors).toEqual([]);
  });

  test('right-click without a selection does nothing', async ({ page }) => {
    await openGame(page);
    const before = await playerUnits(page);
    const open = await openTileNearBase(page);
    const at = await tileToScreen(page, open.x + 0.5, open.y + 0.5);

    await page.mouse.click(at.x, at.y, { button: 'right' });
    await page.evaluate(() => window.__TEST__!.advance(40));

    const after = await playerUnits(page);
    expect(after.map(tileOf)).toEqual(before.map(tileOf));
    expect(await page.evaluate(() => window.__TEST__!.getOrderMarkerCount())).toBe(0);
  });

  test('the order ring disappears after 400 ms of game time', async ({ page }) => {
    await openGame(page);
    const [unit] = await playerUnits(page);
    const at = await unitScreen(page, unit!);
    await page.mouse.click(at.x, at.y);
    const open = await openTileNearBase(page);
    const target = await tileToScreen(page, open.x + 0.5, open.y + 0.5);

    const before = await page.evaluate(() => window.__TEST__!.elapsedMs);
    await page.mouse.click(target.x, target.y, { button: 'right' });
    expect(await page.evaluate(() => window.__TEST__!.getOrderMarkerCount())).toBe(1);

    await page.waitForFunction(() => window.__TEST__!.getOrderMarkerCount() === 0);
    const lifetime = (await page.evaluate(() => window.__TEST__!.elapsedMs)) - before;
    // The ring lives 400 ms; reading it takes up to a few frames more.
    expect(lifetime).toBeGreaterThanOrEqual(400);
    expect(lifetime).toBeLessThan(900);
  });

  test('units move in real time without being stepped by the test', async ({ page }) => {
    await openGame(page);
    const [unit] = await playerUnits(page);
    const target = await openTileNearBase(page);
    await page.evaluate(
      ([id, x, y]) => window.__TEST__!.command({ type: 'move', player: 0, unitIds: [id], x, y }),
      [unit!.id, target.x, target.y] as const,
    );

    await page.waitForFunction(
      (id) => {
        const u = window.__TEST__!.getState().entities.find((e) => e.id === id);
        return u !== undefined && u.kind === 'unit' && u.path.length === 0;
      },
      unit!.id,
      { timeout: 20_000 },
    );

    const [moved] = await playerUnits(page);
    expect(tileOf(moved!)).toEqual(target);
  });

  test("the test interface cannot move the opponent's units as the player", async ({ page }) => {
    // With the computer player running, as in a real match. It gives its own
    // units orders from the first step, so the unit may well be on its way
    // somewhere; the test is that it is not on its way to where the player
    // tried to send it.
    await openGame(page);
    const state = await getState(page);
    const enemy = state.entities.find((e) => e.kind === 'unit' && e.owner === 1)!;
    const target = { x: 30, y: 30 };

    await page.evaluate(
      ([id, x, y]) => window.__TEST__!.command({ type: 'move', player: 0, unitIds: [id], x, y }),
      [enemy.id, target.x, target.y] as const,
    );

    const after = await getState(page);
    const same = after.entities.find((e) => e.id === enemy.id) as Unit;
    expect(same.path.at(-1)).not.toEqual(target);
    expect(same.task.kind).not.toBe('idle');
  });

  test("without the computer player, an order for the opponent's unit leaves it standing", async ({
    page,
  }) => {
    await openGame(page, '&ai=0');
    const state = await getState(page);
    const enemy = state.entities.find((e) => e.kind === 'unit' && e.owner === 1)!;
    await page.evaluate(
      (id) => window.__TEST__!.command({ type: 'move', player: 0, unitIds: [id], x: 30, y: 30 }),
      enemy.id,
    );
    await page.evaluate(() => window.__TEST__!.advance(20));
    const same = (await getState(page)).entities.find((e) => e.id === enemy.id) as Unit;
    expect(same.path).toEqual([]);
    expect([same.x, same.y]).toEqual([enemy.x, enemy.y]);
  });
});
