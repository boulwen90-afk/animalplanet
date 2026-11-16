import { expect, test, type Page } from '@playwright/test';
import { BUILDING_DEFS } from '../../src/data/buildings';
import { SIM_CONFIG } from '../../src/data/sim';
import { START_CONFIG } from '../../src/data/setup';
import { DIRECTIONS, facingOf } from '../../src/render/characters/animation';
import { isWater } from '../../src/sim/map/grid';
import type { Building, GameState, Unit } from '../../src/sim/state';
import { placementProblem } from '../../src/sim/systems/construction';
import { plannedWorkTiles, workFocus } from '../../src/sim/systems/gathering';
import { getSelection, getState, openGame, tileToScreen, trackConsoleErrors } from './helpers';

const HUT = BUILDING_DEFS.fiskehytta;
const WORK = HUT.work!;

const commandPanel = (page: Page) => page.evaluate(() => window.__TEST__!.getCommandPanel());
const placement = (page: Page) => page.evaluate(() => window.__TEST__!.getPlacement());
const preview = (page: Page) => page.evaluate(() => window.__TEST__!.getPlacementPreview());
const sprite = (page: Page, id: number) =>
  page.evaluate((unitId) => window.__TEST__!.getUnitSprite(unitId), id);
const buildingSprite = (page: Page, id: number) =>
  page.evaluate((buildingId) => window.__TEST__!.getBuildingSprite(buildingId), id);
const advance = (page: Page, steps: number) =>
  page.evaluate((n) => window.__TEST__!.advance(n), steps);
const centreOn = (page: Page, x: number, y: number) =>
  page.evaluate(([tx, ty]) => window.__TEST__!.centerCameraOnTile(tx, ty), [x, y] as const);

const workers = (state: GameState) =>
  state.entities.filter((e): e is Unit => e.kind === 'unit' && e.owner === 0);
const huts = (state: GameState) =>
  state.entities.filter(
    (e): e is Building => e.kind === 'building' && e.owner === 0 && e.type === 'fiskehytta',
  );
const unitOf = (state: GameState, id: number) =>
  state.entities.find((e): e is Unit => e.kind === 'unit' && e.id === id)!;
const hutOf = (unit: Unit) => (unit.task.kind === 'gather' ? unit.task.siteId : null);
const wood = (state: GameState) => state.players[0]!.resources.wood;

/**
 * The places for a hut nearest the player's main building: one by the water
 * with a fishing place for every fisher, and one on open ground inland,
 * where only the water is missing. Both are corners of the footprint.
 */
function places(state: GameState): {
  shore: { x: number; y: number };
  inland: { x: number; y: number };
} {
  const home = state.entities.find((e) => e.kind === 'building' && e.owner === 0)!;
  const [worker] = workers(state);
  const from = { x: Math.floor(worker!.x), y: Math.floor(worker!.y) };
  let shore: { x: number; y: number } | undefined;
  let inland: { x: number; y: number } | undefined;
  let shoreDistance = Infinity;
  let inlandDistance = Infinity;
  for (let y = 0; y < state.map.height; y++) {
    for (let x = 0; x < state.map.width; x++) {
      const distance = Math.hypot(x - home.x, y - home.y);
      const problem = placementProblem(state, 'fiskehytta', x, y, 0);
      if (problem === undefined && distance < shoreDistance) {
        // Some stretches of shore are shut in, and give fewer places than the hut has fishers.
        const fishing = plannedWorkTiles(state, 'fiskehytta', { x, y }, from);
        if (fishing.length === WORK.workers) [shore, shoreDistance] = [{ x, y }, distance];
      }
      // Not right next to the main building, where the units stand.
      if (problem === 'needsShore' && distance > 5 && distance < inlandDistance) {
        [inland, inlandDistance] = [{ x, y }, distance];
      }
    }
  }
  expect(shore, 'a place by water').toBeDefined();
  expect(inland, 'a place inland').toBeDefined();
  return { shore: shore!, inland: inland! };
}

/** Where the mouse must be for the outline of a 2x2 building to have its corner on a tile. */
const mouseFor = (page: Page, origin: { x: number; y: number }) =>
  tileToScreen(page, origin.x + 1.5, origin.y + 1.5);

/** Selects one of the player's Samlare by clicking it, and returns it. */
async function selectWorker(page: Page): Promise<Unit> {
  const [unit] = workers(await getState(page));
  await centreOn(page, unit!.x, unit!.y);
  const at = await tileToScreen(page, unit!.x, unit!.y);
  await page.mouse.click(at.x, at.y - 8);
  expect(await getSelection(page)).toEqual([unit!.id]);
  await expect.poll(async () => (await commandPanel(page)).visible).toBe(true);
  return unit!;
}

/** Has a worker build a hut on the place by the water nearest the base, and waits until it stands. */
async function buildHut(page: Page): Promise<{ hut: Building; builderId: number }> {
  const state = await getState(page);
  const { shore } = places(state);
  const [builder] = workers(state);
  const result = await page.evaluate(
    ([id, x, y]) =>
      window.__TEST__!.command({
        type: 'build',
        player: 0,
        unitIds: [id],
        building: 'fiskehytta',
        x,
        y,
      }),
    [builder!.id, shore.x, shore.y] as const,
  );
  expect(result).toEqual({ ok: true });
  const done = await page.evaluate(() => {
    const t = window.__TEST__!;
    for (let step = 0; step < 4000; step++) {
      t.advance(1);
      const hut = t
        .getState()
        .entities.find((e) => e.kind === 'building' && e.type === 'fiskehytta');
      if (hut?.kind === 'building' && hut.complete) return true;
    }
    return false;
  });
  expect(done, 'the hut was finished').toBe(true);
  return { hut: huts(await getState(page))[0]!, builderId: builder!.id };
}

/** Steps the game on until the unit stands fishing. */
async function untilFishing(page: Page, unitId: number): Promise<void> {
  const fishing = await page.evaluate((id) => {
    const t = window.__TEST__!;
    for (let step = 0; step < 2400; step++) {
      const unit = t.getState().entities.find((e) => e.id === id);
      if (
        unit?.kind === 'unit' &&
        unit.task.kind === 'gather' &&
        unit.task.siteId !== null &&
        unit.task.phase === 'gathering'
      ) {
        return true;
      }
      t.advance(1);
    }
    return false;
  }, unitId);
  expect(fishing, 'the unit reached its fishing place').toBe(true);
}

test.describe('placing a fishing hut', () => {
  test('inland the building is shown in red with the reason, and a click does nothing', async ({
    page,
  }) => {
    const errors = trackConsoleErrors(page);
    await openGame(page, '&ai=0&fog=0');
    await selectWorker(page);
    const { inland } = places(await getState(page));
    await centreOn(page, inland.x + 1, inland.y + 1);

    const button = (await commandPanel(page)).buttons.find((b) => b.label === 'Bygg Fiskehytta')!;
    expect([button.cost, button.info]).toEqual(['100 trä', 'Vid vatten, 3 Samlare']);
    await page.mouse.click(button.x, button.y);
    const at = await mouseFor(page, inland);
    await page.mouse.move(at.x, at.y);

    await expect
      .poll(() => placement(page))
      .toEqual({
        building: 'fiskehytta',
        x: inland.x,
        y: inland.y,
        valid: false,
        problem: 'needsShore',
        note: 'Måste stå intill vatten',
      });
    await expect
      .poll(() => preview(page))
      .toEqual({
        texture: 'building-bear_fishery-player-0',
        red: true,
        frame: 'complete',
        pieces: 0,
      });

    await page.mouse.click(at.x, at.y);
    const state = await getState(page);
    expect(huts(state)).toHaveLength(0);
    expect(wood(state)).toBe(START_CONFIG.resources.wood);
    // The outline stays, for another try.
    expect(await placement(page)).toMatchObject({ building: 'fiskehytta', valid: false });
    expect(errors).toEqual([]);
  });

  test('by the water it is shown as it is, and a click builds it', async ({ page }) => {
    const errors = trackConsoleErrors(page);
    await openGame(page, '&ai=0&fog=0');
    const worker = await selectWorker(page);
    const { shore } = places(await getState(page));
    await centreOn(page, shore.x + 1, shore.y + 1);

    const button = (await commandPanel(page)).buttons.find((b) => b.label === 'Bygg Fiskehytta')!;
    await page.mouse.click(button.x, button.y);
    const at = await mouseFor(page, shore);
    await page.mouse.move(at.x, at.y);

    // It may stand there, and shows how many fishers get a place on the shore, and where.
    await expect
      .poll(() => placement(page))
      .toMatchObject({ building: 'fiskehytta', x: shore.x, y: shore.y, valid: true });
    const shown = (await placement(page))!;
    expect(shown.problem).toBeUndefined();
    const expected = plannedWorkTiles(await getState(page), 'fiskehytta', shore, {
      x: Math.floor(worker.x),
      y: Math.floor(worker.y),
    });
    expect(shown.places).toEqual(expected);
    expect(shown.note).toBe(
      expected.length === 1 ? '1 fiskeplats' : `${expected.length} fiskeplatser`,
    );
    await expect
      .poll(() => preview(page))
      .toEqual({
        texture: 'building-bear_fishery-player-0',
        red: false,
        frame: 'complete',
        pieces: 0,
      });

    await page.mouse.click(at.x, at.y);
    const state = await getState(page);
    expect(huts(state)).toMatchObject([{ x: shore.x, y: shore.y, complete: false }]);
    expect(wood(state)).toBe(START_CONFIG.resources.wood - HUT.cost.wood!);
    expect(unitOf(state, worker.id).task).toMatchObject({ kind: 'build' });
    expect(await placement(page)).toBeNull();
    expect(await preview(page)).toBeNull();
    expect(errors).toEqual([]);
  });

  test('another building may not stand on something either, and says so', async ({ page }) => {
    await openGame(page, '&ai=0&fog=0');
    await selectWorker(page);
    const state = await getState(page);
    const home = state.entities.find((e) => e.kind === 'building' && e.owner === 0)!;
    await centreOn(page, home.x + 1, home.y + 1);

    const button = (await commandPanel(page)).buttons.find((b) => b.label === 'Bygg Visthus')!;
    await page.mouse.click(button.x, button.y);
    // On the main building itself.
    const at = await mouseFor(page, { x: home.x, y: home.y });
    await page.mouse.move(at.x, at.y);
    await expect
      .poll(() => placement(page))
      .toMatchObject({ valid: false, problem: 'blocked', note: 'Platsen är upptagen' });
  });
});

test.describe('fishing', () => {
  test('the builder of a hut fishes from the shore with a rod, and the food keeps coming', async ({
    page,
  }) => {
    const errors = trackConsoleErrors(page);
    await openGame(page, '&ai=0&fog=0');
    const { hut, builderId } = await buildHut(page);
    await expect
      .poll(() => buildingSprite(page, hut.id))
      .toEqual({ frame: 'complete', texture: 'building-bear_fishery-player-0' });

    await untilFishing(page, builderId);
    const state = await getState(page);
    const fisher = unitOf(state, builderId);
    expect(hutOf(fisher)).toBe(hut.id);
    // It stands on dry land, beside the water, and looks at the water.
    expect(isWater(state.map, Math.floor(fisher.x), Math.floor(fisher.y))).toBe(false);
    const focus = workFocus(state, fisher, hut)!;
    expect(isWater(state.map, Math.floor(focus.x), Math.floor(focus.y))).toBe(true);
    const facing = DIRECTIONS[facingOf(focus.x - fisher.x, focus.y - fisher.y)!];
    await expect
      .poll(async () => {
        const shown = await sprite(page, builderId);
        return [shown?.animation, shown?.direction];
      })
      .toEqual(['fish', facing]);

    // Three minutes: the catch is carried to the hut and counted.
    const before = state.players[0]!.resources.food;
    await advance(page, 180 * SIM_CONFIG.ticksPerSecond);
    const after = await getState(page);
    const gained = after.players[0]!.resources.food - before;
    expect(gained).toBeGreaterThan(0);
    expect(gained).toBeLessThanOrEqual(Math.ceil(180 / WORK.secondsPerUnit));
    expect(hutOf(unitOf(after, builderId))).toBe(hut.id);
    expect(errors).toEqual([]);
  });

  test('a right click on a hut puts Samlare to fish there, as many as it has places', async ({
    page,
  }) => {
    await openGame(page, '&ai=0&fog=0');
    const { hut, builderId } = await buildHut(page);
    await centreOn(page, hut.x + 1, hut.y + 1);
    const others = workers(await getState(page)).filter((u) => u.id !== builderId);
    // One more than the hut has places for, counting the builder who is already there.
    const extra = await page.evaluate(([x, y]) => window.__TEST__!.spawnUnit('samlare', 0, x, y), [
      others[0]!.x + 1,
      others[0]!.y + 1,
    ] as const);
    const ids = [...others.map((u) => u.id), extra];
    expect(ids.length + 1).toBe(WORK.workers + 1);

    // The first by a direct order, the others each by a right click on the hut.
    await page.evaluate(
      ([unitIds, id]) =>
        window.__TEST__!.command({ type: 'work', player: 0, unitIds, buildingId: id }),
      [ids.slice(0, 1), hut.id] as const,
    );
    const second = unitOf(await getState(page), ids[0]!);
    expect(hutOf(second)).toBe(hut.id);

    const rest = ids.slice(1);
    for (const id of rest) {
      const unit = unitOf(await getState(page), id);
      await centreOn(page, unit.x, unit.y);
      const on = await tileToScreen(page, unit.x, unit.y);
      await page.mouse.click(on.x, on.y - 8);
      expect(await getSelection(page)).toEqual([id]);
      await centreOn(page, hut.x + 1, hut.y + 1);
      const at = await tileToScreen(page, hut.x + 1, hut.y + 1);
      await page.mouse.click(at.x, at.y, { button: 'right' });
    }

    const state = await getState(page);
    const fishing = workers(state).filter((u) => hutOf(u) === hut.id);
    expect(fishing).toHaveLength(WORK.workers);
    // The last one found the hut full and kept doing what it did.
    expect(hutOf(unitOf(state, rest.at(-1)!))).toBeNull();
    // Each has a place of its own.
    const taken = fishing.map((u) =>
      u.task.kind === 'gather' ? `${u.task.place?.x},${u.task.place?.y}` : '',
    );
    expect(new Set(taken).size).toBe(WORK.workers);
  });
});
