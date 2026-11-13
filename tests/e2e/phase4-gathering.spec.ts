import { expect, test, type Page } from '@playwright/test';
import { START_CONFIG } from '../../src/data/setup';
import { UNIT_DEFS } from '../../src/data/units';
import type { GameState, Unit } from '../../src/sim/state';
import { getSelection, getState, openGame, tileToScreen, trackConsoleErrors } from './helpers';

const START = START_CONFIG.resources;

function playerUnits(state: GameState): Unit[] {
  return state.entities.filter((e): e is Unit => e.kind === 'unit' && e.owner === 0);
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

/** Selects all of the player's units with a drag box. */
async function selectAllUnits(page: Page): Promise<Unit[]> {
  const units = playerUnits(await getState(page));
  const points = await Promise.all(units.map((u) => tileToScreen(page, u.x, u.y)));
  const left = Math.min(...points.map((p) => p.x)) - 25;
  const right = Math.max(...points.map((p) => p.x)) + 25;
  const top = Math.min(...points.map((p) => p.y)) - 30;
  const bottom = Math.max(...points.map((p) => p.y)) + 20;
  await page.mouse.move(left, top);
  await page.mouse.down();
  await page.mouse.move((left + right) / 2, (top + bottom) / 2, { steps: 4 });
  await page.mouse.move(right, bottom, { steps: 4 });
  await page.mouse.up();
  expect(await getSelection(page)).toEqual(units.map((u) => u.id));
  return units;
}

const resourceBar = (page: Page) => page.evaluate(() => window.__TEST__!.getResourceBar());

test.describe('phase 4: resources and gathering', () => {
  test('the resource bar shows the starting stock and population', async ({ page }) => {
    const errors = trackConsoleErrors(page);
    // A passive opponent: this test is about the mechanics, not the computer player.
    await openGame(page, '&ai=0');

    expect(await resourceBar(page)).toEqual({
      food: `Mat ${START.food}`,
      wood: `Trä ${START.wood}`,
      population: `Befolkning 3/${START_CONFIG.populationCap}`,
    });
    const state = await getState(page);
    expect(state.players.map((p) => p.resources)).toEqual([START, START]);
    expect(errors).toEqual([]);
  });

  test('right-clicking berries makes the selected Samlare bring home food', async ({ page }) => {
    const errors = trackConsoleErrors(page);
    await openGame(page);
    await selectAllUnits(page);

    const bush = nearestTile(await getState(page), 'berries');
    const at = await tileToScreen(page, bush.x + 0.5, bush.y + 0.5);
    await page.mouse.click(at.x, at.y, { button: 'right' });

    const ordered = playerUnits(await getState(page));
    for (const unit of ordered) {
      expect(unit.task).toMatchObject({ kind: 'gather', resource: 'food' });
    }
    expect(await page.evaluate(() => window.__TEST__!.getOrderMarkerCount())).toBe(1);

    // One minute of game time.
    await page.evaluate(() => window.__TEST__!.advance(1200));

    const state = await getState(page);
    const food = state.players[0]!.resources.food;
    expect(food).toBeGreaterThanOrEqual(START.food + 3 * UNIT_DEFS.samlare.carryCapacity);
    expect(state.players[0]!.resources.wood).toBe(START.wood);
    // The bar shows the new stock once the next frame has been drawn.
    await expect.poll(async () => (await resourceBar(page)).food).not.toBe(`Mat ${START.food}`);
    const shown = Number((await resourceBar(page)).food.replace('Mat ', ''));
    expect(shown).toBeGreaterThan(START.food);
    expect(errors).toEqual([]);
  });

  test('right-clicking a tree makes the selected Samlare bring home wood', async ({ page }) => {
    await openGame(page);
    await selectAllUnits(page);

    const tree = nearestTile(await getState(page), 'tree');
    // Click the crown, which is drawn above the tree's own tile.
    const base = await tileToScreen(page, tree.x + 0.5, tree.y + 0.5);
    await page.mouse.click(base.x, base.y - 30, { button: 'right' });

    const ordered = playerUnits(await getState(page));
    for (const unit of ordered) {
      expect(unit.task).toMatchObject({ kind: 'gather', resource: 'wood' });
    }

    await page.evaluate(() => window.__TEST__!.advance(1200));
    const state = await getState(page);
    expect(state.players[0]!.resources.wood).toBeGreaterThan(START.wood);
    expect(state.players[0]!.resources.food).toBe(START.food);
  });

  test('the selection panel shows what a gathering Samlare carries', async ({ page }) => {
    await openGame(page);
    const state = await getState(page);
    const [unit] = playerUnits(state);
    const bush = nearestTile(state, 'berries');

    // Select the unit while it stands still, then give the order.
    const at = await tileToScreen(page, unit!.x, unit!.y);
    await page.mouse.click(at.x, at.y - 4);
    expect(await getSelection(page)).toEqual([unit!.id]);
    await page.evaluate(
      ([id, x, y]) => window.__TEST__!.command({ type: 'gather', player: 0, unitIds: [id], x, y }),
      [unit!.id, bush.x, bush.y] as const,
    );

    await expect
      .poll(async () => (await page.evaluate(() => window.__TEST__!.getHud())).detail)
      .toMatch(/^Liv 40\/40 · Samlar mat \d+\/10$/);
  });

  test('an emptied source disappears from the map', async ({ page }) => {
    const errors = trackConsoleErrors(page);
    await openGame(page);
    const before = await getState(page);
    const bush = nearestTile(before, 'berries');
    const index = bush.y * before.map.width + bush.x;
    const units = playerUnits(before);

    await page.evaluate(
      ([ids, x, y]) =>
        window.__TEST__!.command({ type: 'gather', player: 0, unitIds: [...ids], x, y }),
      [units.map((u) => u.id), bush.x, bush.y] as const,
    );
    // Five minutes of game time: three workers empty a bush of 150 well within that.
    await page.evaluate(() => window.__TEST__!.advance(6000));

    const after = await getState(page);
    expect(after.map.terrain[index]).toBe('grass');
    expect(after.map.resourceAmount[index]).toBe(0);
    expect(after.players[0]!.resources.food).toBeGreaterThanOrEqual(START.food + 150);
    // The game keeps running and drawing after the bush has been removed.
    const tick = after.tick;
    await page.waitForFunction((t) => window.__TEST__!.getState().tick > t, tick);
    expect(errors).toEqual([]);
  });

  test('right-clicking open ground still moves the units', async ({ page }) => {
    await openGame(page);
    await selectAllUnits(page);
    const state = await getState(page);
    const start = state.map.startPositions[0]!;
    const target = { x: start.x - 3, y: start.y + 2 };
    const at = await tileToScreen(page, target.x + 0.5, target.y + 0.5);

    await page.mouse.click(at.x, at.y, { button: 'right' });

    const ordered = playerUnits(await getState(page));
    expect(ordered.every((u) => u.task.kind === 'idle' && u.path.length > 0)).toBe(true);
  });

  test('clicking the resource bar does not change the selection', async ({ page }) => {
    await openGame(page);
    const units = await selectAllUnits(page);

    await page.mouse.click(400, 12);

    expect(await getSelection(page)).toEqual(units.map((u) => u.id));
  });
});
