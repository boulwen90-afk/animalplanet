import { expect, test, type Page } from '@playwright/test';
import { BUILDING_DEFS } from '../../src/data/buildings';
import { START_CONFIG } from '../../src/data/setup';
import { SIM_CONFIG } from '../../src/data/sim';
import type { Building, GameState, Unit } from '../../src/sim/state';
import { getSelection, getState, openGame, tileToScreen, trackConsoleErrors } from './helpers';

const VISTHUS = BUILDING_DEFS.visthus;
const VISTHUS_TICKS = VISTHUS.buildTime * SIM_CONFIG.ticksPerSecond;
const START_WOOD = START_CONFIG.resources.wood;

const playerUnits = (state: GameState) =>
  state.entities.filter((e): e is Unit => e.kind === 'unit' && e.owner === 0);
const playerBuildings = (state: GameState, type: string) =>
  state.entities.filter(
    (e): e is Building => e.kind === 'building' && e.owner === 0 && e.type === type,
  );

const commandPanel = (page: Page) => page.evaluate(() => window.__TEST__!.getCommandPanel());
const placement = (page: Page) => page.evaluate(() => window.__TEST__!.getPlacement());
const advance = (page: Page, steps: number) =>
  page.evaluate((n) => window.__TEST__!.advance(n), steps);

/** Selects one of the player's Samlare by clicking it. */
async function selectWorker(page: Page): Promise<Unit> {
  const [unit] = playerUnits(await getState(page));
  const at = await tileToScreen(page, unit!.x, unit!.y);
  await page.mouse.click(at.x, at.y - 4);
  expect(await getSelection(page)).toEqual([unit!.id]);
  await expect.poll(async () => (await commandPanel(page)).visible).toBe(true);
  return unit!;
}

/** Clicks the build button for a building, by its label. */
async function clickBuildButton(page: Page, label: string): Promise<void> {
  const button = (await commandPanel(page)).buttons.find((b) => b.label === label);
  expect(button, `button "${label}"`).toBeDefined();
  await page.mouse.click(button!.x, button!.y);
}

/**
 * A free 2x2 place for a Visthus beside the player's Storide: wholly inside
 * the four tiles kept clear around the start position, off the Storide and
 * off the tiles where the units start.
 */
async function freeVisthusOrigin(page: Page): Promise<{ x: number; y: number }> {
  const start = (await getState(page)).map.startPositions[0]!;
  return { x: start.x - 3, y: start.y + 1 };
}

/**
 * The free square of `size` x `size` grass tiles closest to the player's start
 * position, with no building or unit on it. Map generation only guarantees
 * four clear tiles around the start, which is too little for a 3x3 building,
 * so the place has to be looked up in the current state.
 */
function freeOriginNear(state: GameState, size: number): { x: number; y: number } {
  const start = state.map.startPositions[0]!;
  const occupied = new Set<string>();
  for (const entity of state.entities) {
    if (entity.kind === 'unit') {
      occupied.add(`${Math.floor(entity.x)},${Math.floor(entity.y)}`);
    } else {
      const side = BUILDING_DEFS[entity.type].size;
      for (let y = entity.y; y < entity.y + side; y++) {
        for (let x = entity.x; x < entity.x + side; x++) occupied.add(`${x},${y}`);
      }
    }
  }
  const isFree = (x: number, y: number) =>
    x >= 0 &&
    y >= 0 &&
    x < state.map.width &&
    y < state.map.height &&
    state.map.terrain[y * state.map.width + x] === 'grass' &&
    !occupied.has(`${x},${y}`);

  let best: { x: number; y: number } | undefined;
  let bestDistance = Infinity;
  for (let y = start.y - 10; y <= start.y + 10; y++) {
    for (let x = start.x - 10; x <= start.x + 10; x++) {
      let free = true;
      for (let dy = 0; free && dy < size; dy++) {
        for (let dx = 0; free && dx < size; dx++) free = isFree(x + dx, y + dy);
      }
      const distance = Math.hypot(x - start.x, y - start.y);
      if (free && distance < bestDistance) {
        best = { x, y };
        bestDistance = distance;
      }
    }
  }
  if (!best) throw new Error('No free place for a building near the start position');
  return best;
}

/**
 * Screen position that puts a 2x2 building's outline with its lowest corner on
 * the given tile. The outline is centred on the mouse, so for a 2x2 building
 * the mouse is over the tile diagonally after the lowest corner.
 */
async function mouseFor2x2(page: Page, origin: { x: number; y: number }) {
  return tileToScreen(page, origin.x + 1.5, origin.y + 1.5);
}

test.describe('phase 6: building', () => {
  test('a selected Samlare gets a build menu with prices', async ({ page }) => {
    await openGame(page);
    await selectWorker(page);

    const panel = await commandPanel(page);
    expect(panel.buttons.map((b) => [b.label, b.cost])).toEqual([
      ['Bygg Visthus', '80 trä'],
      ['Bygg Krigshall', '150 trä'],
      ['Bygg Ide', '30 trä'],
    ]);
    expect(panel.queue).toEqual([]);
    expect(await placement(page)).toBeNull();
  });

  test('building a Visthus: menu, outline, click, and it stands finished', async ({ page }) => {
    const errors = trackConsoleErrors(page);
    await openGame(page);
    const worker = await selectWorker(page);
    const origin = await freeVisthusOrigin(page);

    await clickBuildButton(page, 'Bygg Visthus');
    const at = await mouseFor2x2(page, origin);
    await page.mouse.move(at.x, at.y);
    await expect
      .poll(() => placement(page))
      .toEqual({ building: 'visthus', x: origin.x, y: origin.y, valid: true });

    await page.mouse.click(at.x, at.y);

    const placed = await getState(page);
    const [site] = playerBuildings(placed, 'visthus');
    expect(site).toMatchObject({ x: origin.x, y: origin.y, complete: false });
    expect(placed.players[0]!.resources.wood).toBe(START_WOOD - VISTHUS.cost.wood!);
    expect(await placement(page)).toBeNull();
    // The click placed the building; it did not change the selection.
    expect(await getSelection(page)).toEqual([worker.id]);
    const builder = playerUnits(placed).find((u) => u.id === worker.id)!;
    expect(builder.task).toEqual({ kind: 'build', buildingId: site!.id });

    // Walking there takes a few seconds; then 20 seconds of building.
    await advance(page, VISTHUS_TICKS + 200);

    const done = await getState(page);
    expect(playerBuildings(done, 'visthus')).toMatchObject([{ complete: true, hp: VISTHUS.hp }]);
    expect(done.players[0]!.resources.wood).toBe(START_WOOD - VISTHUS.cost.wood!);
    await expect
      .poll(async () => (await page.evaluate(() => window.__TEST__!.getResourceBar())).wood)
      .toBe(`Trä ${START_WOOD - VISTHUS.cost.wood!}`);
    expect(errors).toEqual([]);
  });

  test('the outline is red on an invalid place and a click there does nothing', async ({
    page,
  }) => {
    await openGame(page);
    await selectWorker(page);
    await clickBuildButton(page, 'Bygg Visthus');

    // On top of the Storide.
    const start = (await getState(page)).map.startPositions[0]!;
    const at = await tileToScreen(page, start.x + 0.5, start.y + 0.5);
    await page.mouse.move(at.x, at.y);
    await expect.poll(async () => (await placement(page))?.valid).toBe(false);

    await page.mouse.click(at.x, at.y);

    const state = await getState(page);
    expect(playerBuildings(state, 'visthus')).toEqual([]);
    expect(state.players[0]!.resources.wood).toBe(START_WOOD);
    // Still placing, so the player can try another spot.
    expect(await placement(page)).not.toBeNull();
  });

  test('right-click and Esc cancel the placement without moving the units', async ({ page }) => {
    await openGame(page);
    const worker = await selectWorker(page);
    const origin = await freeVisthusOrigin(page);
    const at = await mouseFor2x2(page, origin);

    await clickBuildButton(page, 'Bygg Visthus');
    await page.mouse.move(at.x, at.y);
    await expect.poll(() => placement(page)).not.toBeNull();
    await page.mouse.click(at.x, at.y, { button: 'right' });
    expect(await placement(page)).toBeNull();

    await clickBuildButton(page, 'Bygg Visthus');
    await expect.poll(() => placement(page)).not.toBeNull();
    await page.keyboard.press('Escape');
    expect(await placement(page)).toBeNull();

    const state = await getState(page);
    expect(playerBuildings(state, 'visthus')).toEqual([]);
    expect(state.players[0]!.resources.wood).toBe(START_WOOD);
    // Neither cancel gave a move order or cleared the selection.
    expect(playerUnits(state).find((u) => u.id === worker.id)!.path).toEqual([]);
    expect(await getSelection(page)).toEqual([worker.id]);
  });

  test('a building that cannot be afforded flashes the wood number and is not placed', async ({
    page,
  }) => {
    await openGame(page);
    await selectWorker(page);
    // The starting 100 wood does not pay for a Krigshall at 150.
    expect(START_WOOD).toBeLessThan(BUILDING_DEFS.krigshall.cost.wood!);

    await clickBuildButton(page, 'Bygg Krigshall');

    expect(await page.evaluate(() => window.__TEST__!.getFlashing())).toEqual(['wood']);
    expect(await placement(page)).toBeNull();
    expect(playerBuildings(await getState(page), 'krigshall')).toEqual([]);
  });

  test('right-clicking a construction site sends more Samlare to help', async ({ page }) => {
    await openGame(page);
    const state = await getState(page);
    const [first, second] = playerUnits(state);
    const origin = await freeVisthusOrigin(page);
    const result = await page.evaluate(
      ([id, x, y]) =>
        window.__TEST__!.command({
          type: 'build',
          player: 0,
          unitIds: [id],
          building: 'visthus',
          x,
          y,
        }),
      [first!.id, origin.x, origin.y] as const,
    );
    expect(result).toEqual({ ok: true });

    const at = await tileToScreen(page, second!.x, second!.y);
    await page.mouse.click(at.x, at.y - 4);
    expect(await getSelection(page)).toEqual([second!.id]);
    const siteAt = await tileToScreen(page, origin.x + 1, origin.y + 1);
    await page.mouse.click(siteAt.x, siteAt.y, { button: 'right' });

    const after = await getState(page);
    const [site] = playerBuildings(after, 'visthus');
    const helper = playerUnits(after).find((u) => u.id === second!.id)!;
    expect(helper.task).toEqual({ kind: 'build', buildingId: site!.id });
    expect(await page.evaluate(() => window.__TEST__!.getOrderMarkerCount())).toBe(1);
  });

  test('a finished Krigshall can be selected and trains Ramkrigare', async ({ page }) => {
    // A passive opponent: this test is about the mechanics, not the computer player.
    await openGame(page, '&ai=0');
    // Gather wood first: the three workers bring home enough for a Krigshall.
    const state = await getState(page);
    const workers = playerUnits(state);
    const start = state.map.startPositions[0]!;
    let tree = { x: 0, y: 0 };
    let best = Infinity;
    state.map.terrain.forEach((terrain, i) => {
      if (terrain !== 'tree') return;
      const x = i % state.map.width;
      const y = Math.floor(i / state.map.width);
      const distance = Math.hypot(x - start.x, y - start.y);
      if (distance < best) {
        best = distance;
        tree = { x, y };
      }
    });
    await page.evaluate(
      ([ids, x, y]) =>
        window.__TEST__!.command({ type: 'gather', player: 0, unitIds: [...ids], x, y }),
      [workers.map((w) => w.id), tree.x, tree.y] as const,
    );
    await advance(page, 2400);
    expect((await getState(page)).players[0]!.resources.wood).toBeGreaterThanOrEqual(
      BUILDING_DEFS.krigshall.cost.wood!,
    );

    const origin = freeOriginNear(await getState(page), BUILDING_DEFS.krigshall.size);
    const result = await page.evaluate(
      ([ids, x, y]) =>
        window.__TEST__!.command({
          type: 'build',
          player: 0,
          unitIds: [...ids],
          building: 'krigshall',
          x,
          y,
        }),
      [workers.map((w) => w.id), origin.x, origin.y] as const,
    );
    expect(result).toEqual({ ok: true });
    await advance(page, BUILDING_DEFS.krigshall.buildTime * SIM_CONFIG.ticksPerSecond + 200);
    const [krigshall] = playerBuildings(await getState(page), 'krigshall');
    expect(krigshall).toMatchObject({ complete: true, hp: BUILDING_DEFS.krigshall.hp });

    const at = await tileToScreen(page, origin.x + 1.5, origin.y + 1.5);
    await page.mouse.click(at.x, at.y);
    expect(await getSelection(page)).toEqual([krigshall!.id]);
    await expect
      .poll(async () => (await page.evaluate(() => window.__TEST__!.getHud())).title)
      .toBe('Krigshall');
    await expect.poll(async () => (await commandPanel(page)).visible).toBe(true);
    const panel = await commandPanel(page);
    expect(panel.buttons.map((b) => [b.label, b.cost])).toEqual([
      ['Träna Ramkrigare', '60 mat, 25 trä'],
    ]);

    // Enough is left after the building to pay for one soldier.
    const before = (await getState(page)).players[0]!.resources;
    expect(before.wood).toBeGreaterThanOrEqual(25);
    expect(before.food).toBeGreaterThanOrEqual(60);
    await page.mouse.click(panel.buttons[0]!.x, panel.buttons[0]!.y);
    await advance(page, 18 * SIM_CONFIG.ticksPerSecond);

    const after = await getState(page);
    expect(after.players[0]!.resources).toEqual({
      food: before.food - 60,
      wood: before.wood - 25,
    });
    const soldiers = after.entities.filter((e) => e.kind === 'unit' && e.type === 'ramkrigare');
    expect(soldiers).toMatchObject([{ owner: 0, hp: 100 }]);
  });
});
