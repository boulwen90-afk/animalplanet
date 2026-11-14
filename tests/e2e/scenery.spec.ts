import { expect, test, type Page } from '@playwright/test';
import { BUILDING_DEFS } from '../../src/data/buildings';
import { RESOURCE_DEFS } from '../../src/data/resources';
import { SIM_CONFIG } from '../../src/data/sim';
import {
  BUSH_FEW_SHARE,
  ROCK_FRAMES,
  TREE_FRAMES,
  objectFrame,
  waterFrames,
} from '../../src/render/scenery/scenery';
import { buildPathGrid } from '../../src/sim/pathfinding/passability';
import type { Building, GameState, Unit } from '../../src/sim/state';
import { placementProblem } from '../../src/sim/systems/construction';
import { plannedWorkTiles, workPlacesOf } from '../../src/sim/systems/gathering';
import { buildNearHome, getState, openGame, trackConsoleErrors } from './helpers';

const scenery = (page: Page, x: number, y: number) =>
  page.evaluate(([tx, ty]) => window.__TEST__!.getScenery(tx, ty), [x, y] as const);
const sprite = (page: Page, id: number) =>
  page.evaluate((unitId) => window.__TEST__!.getUnitSprite(unitId), id);
const workers = (state: GameState) =>
  state.entities.filter((e): e is Unit => e.kind === 'unit' && e.owner === 0);
const terrainAt = (state: GameState, x: number, y: number) =>
  state.map.terrain[y * state.map.width + x];

/** The tile of the given terrain nearest the player's start position. */
function nearest(state: GameState, terrain: string): { x: number; y: number } {
  const start = state.map.startPositions[0]!;
  let best: { x: number; y: number } | undefined;
  let bestDistance = Infinity;
  for (let y = 0; y < state.map.height; y++) {
    for (let x = 0; x < state.map.width; x++) {
      if (terrainAt(state, x, y) !== terrain) continue;
      const distance = Math.hypot(x - start.x, y - start.y);
      if (distance < bestDistance) [best, bestDistance] = [{ x, y }, distance];
    }
  }
  expect(best, `a tile of ${terrain}`).toBeDefined();
  return best!;
}

/** Sends every worker of the player to gather from a tile, and steps the game on until `done`. */
async function gatherUntil(
  page: Page,
  tile: { x: number; y: number },
  done: 'half' | 'empty',
): Promise<void> {
  const reached = await page.evaluate(
    ([x, y, until]) => {
      const t = window.__TEST__!;
      const state = t.getState();
      const index = y * state.map.width + x;
      const full = state.map.resourceAmount[index]!;
      const unitIds = state.entities
        .filter((e) => e.kind === 'unit' && e.owner === 0)
        .map((e) => e.id);
      t.command({ type: 'gather', player: 0, unitIds, x, y });
      for (let step = 0; step < 20000; step++) {
        t.advance(1);
        const left = t.getState().map.resourceAmount[index]!;
        if (until === 'half' ? left <= full / 2 && left > 0 : left === 0) return true;
      }
      return false;
    },
    [tile.x, tile.y, done] as const,
  );
  expect(reached, `the source at ${tile.x},${tile.y} was ${done}`).toBe(true);
}

test.describe('the scenery', () => {
  test('trees, rocks and bushes are drawn from pictures, in more than one kind', async ({
    page,
  }) => {
    const errors = trackConsoleErrors(page);
    await openGame(page, '&ai=0&fog=0');
    const state = await getState(page);
    const seen = { tree: new Set<string>(), rock: new Set<string>(), berries: new Set<string>() };
    // Every third tile across the map, read in one go: asking the page about
    // one tile at a time takes longer than the test has on a slow machine.
    const tiles: { x: number; y: number }[] = [];
    for (let y = 0; y < state.map.height; y++) {
      for (let x = 0; x < state.map.width; x += 3) {
        const terrain = terrainAt(state, x, y)!;
        if (terrain === 'tree' || terrain === 'rock' || terrain === 'berries') tiles.push({ x, y });
      }
    }
    const drawn = await page.evaluate(
      (list) => list.map(({ x, y }) => window.__TEST__!.getScenery(x, y).object),
      tiles,
    );
    let checked = 0;
    for (const [i, { x, y }] of tiles.entries()) {
      const terrain = terrainAt(state, x, y) as 'tree' | 'rock' | 'berries';
      expect(drawn[i], `${terrain} at ${x},${y}`).toBe(objectFrame(terrain, x, y));
      seen[terrain].add(drawn[i]!);
      checked++;
    }
    expect(checked).toBeGreaterThan(50);
    // A forest and a ridge of rock are not one picture repeated.
    expect([...seen.tree].sort()).toEqual([...TREE_FRAMES]);
    expect([...seen.rock].sort()).toEqual([...ROCK_FRAMES]);
    expect([...seen.berries]).toEqual(['bush_full']);
    // Open ground has nothing on it.
    const grass = nearest(state, 'grass');
    expect(await scenery(page, grass.x, grass.y)).toEqual({ object: null, lying: [], water: [] });
    expect(errors).toEqual([]);
  });

  test('a berry bush shows fewer berries as it is picked, and is left bare', async ({ page }) => {
    await openGame(page, '&ai=0&fog=0');
    const bush = nearest(await getState(page), 'berries');
    expect((await scenery(page, bush.x, bush.y)).object).toBe('bush_full');

    await gatherUntil(page, bush, 'half');
    const state = await getState(page);
    const left = state.map.resourceAmount[bush.y * state.map.width + bush.x]!;
    expect(left / RESOURCE_DEFS.food.amountPerNode).toBeLessThanOrEqual(BUSH_FEW_SHARE);
    await expect.poll(async () => (await scenery(page, bush.x, bush.y)).object).toBe('bush_few');

    await gatherUntil(page, bush, 'empty');
    expect(terrainAt(await getState(page), bush.x, bush.y)).toBe('grass');
    await expect
      .poll(() => scenery(page, bush.x, bush.y))
      .toEqual({ object: null, lying: ['bush_bare'], water: [] });
  });

  test('a felled tree leaves a stump', async ({ page }) => {
    await openGame(page, '&ai=0&fog=0');
    const tree = nearest(await getState(page), 'tree');
    expect(TREE_FRAMES).toContain((await scenery(page, tree.x, tree.y)).object);

    await gatherUntil(page, tree, 'empty');
    expect(terrainAt(await getState(page), tree.x, tree.y)).toBe('grass');
    await expect
      .poll(() => scenery(page, tree.x, tree.y))
      .toEqual({ object: null, lying: ['stump'], water: [] });
  });

  test('water has a shore wherever it meets land', async ({ page }) => {
    await openGame(page, '&ai=0&fog=0');
    const state = await getState(page);
    const { width, height } = state.map;
    const isWater = (x: number, y: number) =>
      x < 0 || y < 0 || x >= width || y >= height ? true : terrainAt(state, x, y) === 'water';
    let water = 0;
    let withShore = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (terrainAt(state, x, y) !== 'water') continue;
        water++;
        const expected = waterFrames(isWater, x, y);
        if (expected.length > 1) withShore++;
        // One tile in three is asked for, to keep the test quick.
        if ((x + y) % 3 === 0) expect((await scenery(page, x, y)).water).toEqual(expected);
      }
    }
    expect(water).toBeGreaterThan(0);
    expect(withShore).toBeGreaterThan(0);
  });

  test('the fishing places of a hut are marked on the shore', async ({ page }) => {
    await openGame(page, '&ai=0&fog=0');
    const before = await getState(page);
    const [worker] = workers(before);
    const from = { x: Math.floor(worker!.x), y: Math.floor(worker!.y) };
    const start = before.map.startPositions[0]!;
    // The place by the water nearest the base that gives every fisher a place.
    let site: { x: number; y: number } | undefined;
    let best = Infinity;
    for (let y = 0; y < before.map.height; y++) {
      for (let x = 0; x < before.map.width; x++) {
        const distance = Math.hypot(x - start.x, y - start.y);
        if (distance >= best || placementProblem(before, 'fiskehytta', x, y, 0, from)) continue;
        const fishers = BUILDING_DEFS.fiskehytta.work!.workers;
        if (plannedWorkTiles(before, 'fiskehytta', { x, y }, from).length < fishers) continue;
        [site, best] = [{ x, y }, distance];
      }
    }
    expect(site, 'a place for a fishing hut').toBeDefined();
    const ok = await page.evaluate(
      ([id, x, y]) =>
        window.__TEST__!.command({
          type: 'build',
          player: 0,
          unitIds: [id],
          building: 'fiskehytta',
          x,
          y,
        }),
      [worker!.id, site!.x, site!.y] as const,
    );
    expect(ok).toEqual({ ok: true });
    // No marks while it is being built.
    await page.evaluate(() => window.__TEST__!.advance(5 * 20));

    await page.evaluate((ticks) => window.__TEST__!.advance(ticks), 60 * SIM_CONFIG.ticksPerSecond);
    const state = await getState(page);
    const hut = state.entities.find(
      (e): e is Building => e.kind === 'building' && e.type === 'fiskehytta',
    )!;
    expect(hut.complete).toBe(true);
    const places = workPlacesOf(state, buildPathGrid(state), hut);
    expect(places).toHaveLength(BUILDING_DEFS.fiskehytta.work!.workers);
    for (const place of places) {
      await expect
        .poll(async () => (await scenery(page, place.x, place.y)).lying, {
          message: `the fishing place at ${place.x},${place.y}`,
        })
        .toContain('fishing_place');
    }
  });
});

test.describe('what is in the basket', () => {
  /** Steps the game on until the unit carries something. */
  async function untilLoaded(page: Page, unitId: number): Promise<void> {
    const loaded = await page.evaluate((id) => {
      const t = window.__TEST__!;
      for (let step = 0; step < 4000; step++) {
        const unit = t.getState().entities.find((e) => e.id === id);
        if (unit?.kind === 'unit' && unit.carryAmount > 0) return true;
        t.advance(1);
      }
      return false;
    }, unitId);
    expect(loaded, 'the unit got something to carry').toBe(true);
  }
  const layerOf = async (page: Page, id: number) => (await sprite(page, id))?.load?.split('.')[0];

  test('berries from a bush and logs from a tree', async ({ page }) => {
    await openGame(page, '&ai=0&fog=0');
    const state = await getState(page);
    const [picker, chopper] = workers(state);
    const bush = nearest(state, 'berries');
    const tree = nearest(state, 'tree');
    await page.evaluate(
      ([a, b, bx, by, tx, ty]) => {
        const t = window.__TEST__!;
        t.command({ type: 'gather', player: 0, unitIds: [a], x: bx, y: by });
        t.command({ type: 'gather', player: 0, unitIds: [b], x: tx, y: ty });
      },
      [picker!.id, chopper!.id, bush.x, bush.y, tree.x, tree.y] as const,
    );
    await untilLoaded(page, picker!.id);
    await untilLoaded(page, chopper!.id);
    await expect.poll(() => layerOf(page, picker!.id)).toBe('load_berries');
    await expect.poll(() => layerOf(page, chopper!.id)).toBe('load_wood');
  });

  test('grain from a field', async ({ page }) => {
    await openGame(page, '&ai=0&fog=0');
    const { workerId } = await buildNearHome(page, 'odling', 'front');
    await untilLoaded(page, workerId);
    await expect.poll(() => layerOf(page, workerId)).toBe('load_grain');
  });

  test('fish from the shore', async ({ page }) => {
    await openGame(page, '&ai=0&fog=0');
    const before = await getState(page);
    const [worker] = workers(before);
    const from = { x: Math.floor(worker!.x), y: Math.floor(worker!.y) };
    const start = before.map.startPositions[0]!;
    let site: { x: number; y: number } | undefined;
    let best = Infinity;
    for (let y = 0; y < before.map.height; y++) {
      for (let x = 0; x < before.map.width; x++) {
        const distance = Math.hypot(x - start.x, y - start.y);
        if (distance >= best || placementProblem(before, 'fiskehytta', x, y, 0, from)) continue;
        [site, best] = [{ x, y }, distance];
      }
    }
    await page.evaluate(
      ([id, x, y]) =>
        window.__TEST__!.command({
          type: 'build',
          player: 0,
          unitIds: [id],
          building: 'fiskehytta',
          x,
          y,
        }),
      [worker!.id, site!.x, site!.y] as const,
    );
    await untilLoaded(page, worker!.id);
    await expect.poll(() => layerOf(page, worker!.id)).toBe('load_fish');
  });
});
