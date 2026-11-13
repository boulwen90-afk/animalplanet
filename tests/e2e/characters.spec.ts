import { expect, test, type Page } from '@playwright/test';
import { BUILDING_DEFS } from '../../src/data/buildings';
import { DIRECTIONS, facingOf } from '../../src/render/characters/animation';
import type { GameState, Unit } from '../../src/sim/state';
import { getState, openGame, trackConsoleErrors } from './helpers';

const sprite = (page: Page, id: number) =>
  page.evaluate((unitId) => window.__TEST__!.getUnitSprite(unitId), id);
const spawn = (page: Page, owner: 0 | 1, x: number, y: number) =>
  page.evaluate(([who, tx, ty]) => window.__TEST__!.spawnUnit('ramkrigare', who, tx, ty), [
    owner,
    x,
    y,
  ] as const);
const spawnWorker = (page: Page, owner: 0 | 1, x: number, y: number) =>
  page.evaluate(([who, tx, ty]) => window.__TEST__!.spawnUnit('samlare', who, tx, ty), [
    owner,
    x,
    y,
  ] as const);
const unitOf = async (page: Page, id: number) =>
  (await getState(page)).entities.find((e): e is Unit => e.kind === 'unit' && e.id === id)!;
/** The way a unit at `from` faces when it looks at `to`, as the atlas names it. */
const towards = (from: { x: number; y: number }, to: { x: number; y: number }) =>
  DIRECTIONS[facingOf(to.x - from.x, to.y - from.y)!];
const advance = (page: Page, steps: number) =>
  page.evaluate((n) => window.__TEST__!.advance(n), steps);

/**
 * The start of a row of `length` open grass tiles, side by side along the tile
 * x axis, with nothing standing on or next to them. It is looked up in the
 * state, because only four tiles around a start position are sure to be clear.
 */
function freeRow(state: GameState, length: number): { x: number; y: number } {
  const taken = new Set<string>();
  for (const entity of state.entities) {
    if (entity.kind === 'unit') {
      taken.add(`${Math.floor(entity.x)},${Math.floor(entity.y)}`);
    } else {
      const side = BUILDING_DEFS[entity.type].size;
      for (let y = entity.y; y < entity.y + side; y++) {
        for (let x = entity.x; x < entity.x + side; x++) taken.add(`${x},${y}`);
      }
    }
  }
  const { width, height, terrain } = state.map;
  const open = (x: number, y: number) =>
    x >= 0 &&
    y >= 0 &&
    x < width &&
    y < height &&
    terrain[y * width + x] === 'grass' &&
    !taken.has(`${x},${y}`);
  const middle = { x: width / 2, y: height / 2 };
  let best: { x: number; y: number } | undefined;
  let bestDistance = Infinity;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - length - 1; x++) {
      let clear = true;
      // The row itself and the tiles around it, so that paths along it are straight.
      for (let dy = -1; dy <= 1 && clear; dy++) {
        for (let dx = -1; dx <= length && clear; dx++) clear = open(x + dx, y + dy);
      }
      const distance = Math.hypot(x - middle.x, y - middle.y);
      if (clear && distance < bestDistance) {
        best = { x, y };
        bestDistance = distance;
      }
    }
  }
  expect(best, `a free row of ${length} tiles`).toBeDefined();
  return best!;
}

async function lookAt(page: Page, x: number, y: number): Promise<void> {
  await page.evaluate(([tx, ty]) => window.__TEST__!.centerCameraOnTile(tx, ty), [x, y] as const);
}

test.describe('characters: the bear warrior', () => {
  test("warriors are drawn as characters in their side's colour, standing idle", async ({
    page,
  }) => {
    const errors = trackConsoleErrors(page);
    await openGame(page, '&ai=0&fog=0');
    const row = freeRow(await getState(page), 12);
    await lookAt(page, row.x + 6, row.y);
    // Far enough apart that neither goes for the other.
    const blue = await spawn(page, 0, row.x, row.y);
    const red = await spawn(page, 1, row.x + 11, row.y);

    await expect
      .poll(() => sprite(page, blue))
      .toMatchObject({ animation: 'idle', texture: 'character-bear_warrior-player-0' });
    await expect
      .poll(() => sprite(page, red))
      .toMatchObject({ animation: 'idle', texture: 'character-bear_warrior-player-1' });
    expect((await sprite(page, blue))!.frame).toMatch(/^idle_s_\d$/);
    expect(errors).toEqual([]);
  });

  test('a warrior on the move plays the walk animation and faces the way it goes', async ({
    page,
  }) => {
    await openGame(page, '&ai=0&fog=0');
    const row = freeRow(await getState(page), 8);
    await lookAt(page, row.x + 4, row.y);
    const id = await spawn(page, 0, row.x, row.y);
    await expect.poll(() => sprite(page, id)).toMatchObject({ animation: 'idle' });

    // Along the tile x axis, which runs down to the right on the screen.
    await page.evaluate(
      ([unitId, x, y]) =>
        window.__TEST__!.command({ type: 'move', player: 0, unitIds: [unitId], x, y }),
      [id, row.x + 7, row.y] as const,
    );
    await expect.poll(() => sprite(page, id)).toMatchObject({ animation: 'walk', direction: 'se' });
    expect((await sprite(page, id))!.frame).toMatch(/^walk_se_\d$/);

    // When it has arrived it stands idle, still facing the way it came.
    await advance(page, 120);
    await expect.poll(() => sprite(page, id)).toMatchObject({ animation: 'idle', direction: 'se' });

    // And back again, up to the left.
    await page.evaluate(
      ([unitId, x, y]) =>
        window.__TEST__!.command({ type: 'move', player: 0, unitIds: [unitId], x, y }),
      [id, row.x, row.y] as const,
    );
    await expect.poll(() => sprite(page, id)).toMatchObject({ animation: 'walk', direction: 'nw' });
  });

  test('warriors that fight play the attack animation facing each other', async ({ page }) => {
    const errors = trackConsoleErrors(page);
    await openGame(page, '&ai=0&fog=0');
    const row = freeRow(await getState(page), 4);
    await lookAt(page, row.x + 2, row.y);
    const blue = await spawn(page, 0, row.x + 1, row.y);
    const red = await spawn(page, 1, row.x + 2, row.y);

    // Standing side by side they notice each other and strike.
    await expect
      .poll(() => sprite(page, blue))
      .toMatchObject({ animation: 'attack', direction: 'se' });
    await expect
      .poll(() => sprite(page, red))
      .toMatchObject({ animation: 'attack', direction: 'nw' });
    expect((await sprite(page, blue))!.frame).toMatch(/^attack_se_\d$/);
    expect(errors).toEqual([]);
  });

  test('a beaten warrior kneels where it fell and then walks away', async ({ page }) => {
    await openGame(page, '&ai=0&fog=0');
    const row = freeRow(await getState(page), 5);
    await lookAt(page, row.x + 2, row.y);
    // Three against one: the one is beaten.
    const red = await spawn(page, 1, row.x + 2, row.y);
    for (const dx of [1, 3]) await spawn(page, 0, row.x + dx, row.y);
    await spawn(page, 0, row.x + 2, row.y + 1);

    // Step forward, in one go, until the red warrior has surrendered. The
    // kneeling lasts well under a second, so the test must look right after.
    const beaten = await page.evaluate((id) => {
      const t = window.__TEST__!;
      for (let step = 0; step < 2000; step++) {
        t.advance(1);
        const unit = t.getState().entities.find((e) => e.id === id);
        if (unit?.kind === 'unit' && unit.task.kind === 'flee') return true;
      }
      return false;
    }, red);
    expect(beaten).toBe(true);

    await expect
      .poll(() => sprite(page, red), { intervals: [20] })
      .toMatchObject({ animation: 'defeat' });
    expect((await sprite(page, red))!.frame).toMatch(/^defeat_[a-z]+_\d$/);
    await expect.poll(() => sprite(page, red)).toMatchObject({ animation: 'walk' });
  });

  test('120 warriors are drawn at once without errors', async ({ page }) => {
    const errors = trackConsoleErrors(page);
    await openGame(page, '&ai=0&fog=0');
    const state = await getState(page);
    const { width, height, terrain } = state.map;
    // The 120 open tiles nearest the middle of the map, shared between the two sides.
    const tiles: { x: number; y: number; d: number }[] = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (terrain[y * width + x] !== 'grass') continue;
        tiles.push({ x, y, d: Math.hypot(x - width / 2, y - height / 2) });
      }
    }
    tiles.sort((a, b) => a.d - b.d);
    const chosen = tiles.slice(0, 120);
    await lookAt(page, width / 2, height / 2);
    const ids = await page.evaluate(
      (where) =>
        where.map((t, i) =>
          window.__TEST__!.spawnUnit('ramkrigare', i % 2 === 0 ? 0 : 1, t.x, t.y),
        ),
      chosen,
    );
    expect(ids).toHaveLength(120);

    // Let them fight for a while, and count the frames drawn meanwhile.
    const before = await page.evaluate(() => window.__TEST__!.getFrameCount());
    await page.waitForFunction((t) => window.__TEST__!.elapsedMs >= t + 1500, 0);
    const drawn = await page.evaluate(
      (list) => list.filter((id) => window.__TEST__!.getUnitSprite(id) !== null).length,
      ids,
    );
    const frames = (await page.evaluate(() => window.__TEST__!.getFrameCount())) - before;
    // Some have surrendered and left by now, but most are still drawn.
    expect(drawn).toBeGreaterThan(80);
    expect(frames).toBeGreaterThan(0);
    expect(errors).toEqual([]);
  });
});

test.describe('characters: the bear worker', () => {
  test("workers are drawn as characters in their side's colour, smaller than warriors", async ({
    page,
  }) => {
    const errors = trackConsoleErrors(page);
    await openGame(page, '&ai=0&fog=0');
    const state = await getState(page);
    const workers = state.entities.filter(
      (e): e is Unit => e.kind === 'unit' && e.type === 'samlare',
    );
    const blue = workers.find((w) => w.owner === 0)!;
    const red = workers.find((w) => w.owner === 1)!;

    await expect
      .poll(() => sprite(page, blue.id))
      .toMatchObject({ animation: 'idle', texture: 'character-bear_worker-player-0' });
    await expect
      .poll(() => sprite(page, red.id))
      .toMatchObject({ animation: 'idle', texture: 'character-bear_worker-player-1' });
    expect((await sprite(page, blue.id))!.frame).toMatch(/^idle_s_\d$/);
    expect(errors).toEqual([]);
  });

  test('a worker sent to a tree runs there and then swings its tool at it', async ({ page }) => {
    const errors = trackConsoleErrors(page);
    await openGame(page, '&ai=0&fog=0');
    const state = await getState(page);
    const worker = state.entities.find(
      (e): e is Unit => e.kind === 'unit' && e.type === 'samlare' && e.owner === 0,
    )!;
    const { width, terrain } = state.map;
    // The tree nearest the worker.
    let tree = { x: 0, y: 0 };
    let nearest = Infinity;
    terrain.forEach((kind, index) => {
      if (kind !== 'tree') return;
      const at = { x: index % width, y: Math.floor(index / width) };
      const distance = Math.hypot(at.x - worker.x, at.y - worker.y);
      if (distance < nearest) [tree, nearest] = [at, distance];
    });
    await lookAt(page, tree.x, tree.y);

    await page.evaluate(
      ([id, x, y]) => window.__TEST__!.command({ type: 'gather', player: 0, unitIds: [id], x, y }),
      [worker.id, tree.x, tree.y] as const,
    );
    await expect.poll(() => sprite(page, worker.id)).toMatchObject({ animation: 'walk' });

    // Step until it stands by the tree and works.
    const working = await page.evaluate((id) => {
      const t = window.__TEST__!;
      for (let step = 0; step < 1200; step++) {
        t.advance(1);
        const unit = t.getState().entities.find((e) => e.id === id);
        if (unit?.kind === 'unit' && unit.task.kind === 'gather' && unit.task.phase === 'gathering')
          return true;
      }
      return false;
    }, worker.id);
    expect(working).toBe(true);

    const there = await unitOf(page, worker.id);
    const facing = towards(there, { x: tree.x + 0.5, y: tree.y + 0.5 });
    await expect
      .poll(() => sprite(page, worker.id))
      .toMatchObject({ animation: 'gather', direction: facing });
    expect((await sprite(page, worker.id))!.frame).toMatch(/^gather_[a-z]+_\d$/);

    // With a full load it runs back with it.
    await advance(page, 220);
    await expect.poll(async () => (await unitOf(page, worker.id)).carryAmount).toBeGreaterThan(0);
    expect(errors).toEqual([]);
  });

  test('a worker that raises a building swings its tool facing the site', async ({ page }) => {
    await openGame(page, '&ai=0&fog=0');
    const row = freeRow(await getState(page), 6);
    await lookAt(page, row.x + 3, row.y);
    const id = await spawnWorker(page, 0, row.x, row.y);
    const result = await page.evaluate(
      ([unitId, x, y]) =>
        window.__TEST__!.command({
          type: 'build',
          player: 0,
          unitIds: [unitId],
          building: 'visthus',
          x,
          y,
        }),
      [id, row.x + 3, row.y] as const,
    );
    expect(result.ok).toBe(true);

    await expect.poll(() => sprite(page, id)).toMatchObject({ animation: 'gather' });
    const builder = await unitOf(page, id);
    const side = BUILDING_DEFS.visthus.size;
    const centre = { x: row.x + 3 + side / 2, y: row.y + side / 2 };
    expect((await sprite(page, id))!.direction).toBe(towards(builder, centre));
  });

  test('a worker ordered to fight strikes with its tool, facing its target', async ({ page }) => {
    const errors = trackConsoleErrors(page);
    await openGame(page, '&ai=0&fog=0');
    const row = freeRow(await getState(page), 4);
    await lookAt(page, row.x + 2, row.y);
    const blue = await spawnWorker(page, 0, row.x + 1, row.y);
    const red = await spawnWorker(page, 1, row.x + 2, row.y);
    await page.evaluate(
      ([unitId, targetId]) =>
        window.__TEST__!.command({ type: 'attack', player: 0, unitIds: [unitId], targetId }),
      [blue, red] as const,
    );
    // It has no attack animation of its own, so it shows the swing it works with.
    await expect
      .poll(() => sprite(page, blue))
      .toMatchObject({ animation: 'gather', direction: 'se' });
    expect(errors).toEqual([]);
  });
});
