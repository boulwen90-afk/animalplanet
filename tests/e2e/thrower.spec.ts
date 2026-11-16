import { expect, test, type Page } from '@playwright/test';
import { BUILDING_DEFS } from '../../src/data/buildings';
import { SIM_CONFIG } from '../../src/data/sim';
import { UNIT_DEFS } from '../../src/data/units';
import type { Building, GameState, Unit } from '../../src/sim/state';
import {
  getSelection,
  getState,
  openBuildTab,
  openGame,
  tileToScreen,
  trackConsoleErrors,
} from './helpers';

const RANGE = BUILDING_DEFS.kastbana;
const THROWER = UNIT_DEFS.ramkastare;
const RANGED = THROWER.ranged!;
const SECOND = SIM_CONFIG.ticksPerSecond;

const rangeOf = (state: GameState) =>
  state.entities.find((e): e is Building => e.kind === 'building' && e.type === 'kastbana')!;
const unitOf = (state: GameState, id: number) =>
  state.entities.find((e): e is Unit => e.kind === 'unit' && e.id === id);
const homeOf = (state: GameState, owner: number) =>
  state.entities.find(
    (e): e is Building => e.kind === 'building' && e.type === 'storide' && e.owner === owner,
  )!;

const commandPanel = (page: Page) => page.evaluate(() => window.__TEST__!.getCommandPanel());
const projectiles = (page: Page) => page.evaluate(() => window.__TEST__!.getProjectiles());
const unitSprite = (page: Page, id: number) =>
  page.evaluate((unitId) => window.__TEST__!.getUnitSprite(unitId), id);
const advance = (page: Page, steps: number) =>
  page.evaluate((n) => window.__TEST__!.advance(n), steps);
const spawn = (
  page: Page,
  type: 'ramkastare' | 'samlare' | 'ramkrigare',
  owner: 0 | 1,
  x: number,
  y: number,
) =>
  page.evaluate(([t, o, tx, ty]) => window.__TEST__!.spawnUnit(t, o, tx, ty), [
    type,
    owner,
    x,
    y,
  ] as const);

/**
 * A stretch of open ground east of the player's main building to fight on:
 * the tile where it starts. The row is `length` tiles of grass with nothing
 * standing on it or beside it, and the camera is put on its middle.
 */
async function openRow(page: Page, length: number): Promise<{ x: number; y: number }> {
  const row = await page.evaluate((tiles) => {
    const state = window.__TEST__!.getState();
    const home = state.entities.find((e) => e.kind === 'building' && e.owner === 0)!;
    const { width, height, terrain } = state.map;
    const free = (x: number, y: number) =>
      x >= 0 &&
      y >= 0 &&
      x < width &&
      y < height &&
      terrain[y * width + x] === 'grass' &&
      // Clear of every building, and of the units that stand about the main building.
      !state.entities.some(
        (e) => Math.abs(e.x - x) < 4 && Math.abs(e.y - y) < 4 && e.kind === 'building',
      ) &&
      !state.entities.some(
        (e) => e.kind === 'unit' && Math.abs(e.x - x) < 2 && Math.abs(e.y - y) < 3,
      );
    for (let r = 4; r < 20; r++) {
      for (let dy = -r; dy <= r; dy++) {
        const x = home.x + r;
        const y = home.y + dy;
        let open = true;
        // The rows beside it too, so that nobody has to walk round a tree.
        for (let i = 0; i < tiles && open; i++) {
          open = free(x + i, y) && free(x + i, y - 1) && free(x + i, y + 1);
        }
        if (open) return { x, y };
      }
    }
    return null;
  }, length);
  expect(row, 'open ground for the fight').not.toBeNull();
  await page.evaluate(([x, y]) => window.__TEST__!.centerCameraOnTile(x, y), [
    row!.x + length / 2,
    row!.y + 0.5,
  ] as const);
  return row!;
}

/**
 * Has the player's Samlare chop wood until there is enough for a Kastbana
 * and `spare` more, build one by the main building and step the game on
 * until it stands. The Samlare are then sent back to the main building.
 */
async function buildRange(page: Page, spare = 0): Promise<Building> {
  const placed = await page.evaluate((wood) => {
    const t = window.__TEST__!;
    const state = t.getState();
    const home = state.entities.find((e) => e.kind === 'building' && e.owner === 0)!;
    const ids = state.entities.filter((e) => e.kind === 'unit' && e.owner === 0).map((e) => e.id);
    let tree: { x: number; y: number } | undefined;
    let nearest = Infinity;
    for (let y = 0; y < state.map.height; y++) {
      for (let x = 0; x < state.map.width; x++) {
        if (state.map.terrain[y * state.map.width + x] !== 'tree') continue;
        const distance = Math.hypot(x - home.x, y - home.y);
        if (distance < nearest) {
          nearest = distance;
          tree = { x, y };
        }
      }
    }
    t.command({ type: 'gather', player: 0, unitIds: ids, x: tree!.x, y: tree!.y });
    for (let i = 0; i < 9000 && t.getState().players[0]!.resources.wood < wood; i++) t.advance(1);
    // On open ground in front of the main building.
    for (let r = 5; r < 10; r++) {
      for (let dy = 0; dy <= r; dy++) {
        const result = t.command({
          type: 'build',
          player: 0,
          unitIds: ids,
          building: 'kastbana',
          x: home.x + r,
          y: home.y + dy,
        });
        if (!result.ok) continue;
        for (let i = 0; i < 6000; i++) {
          t.advance(1);
          const range = t.getState().entities.find((e) => e.type === 'kastbana');
          if (range?.kind === 'building' && range.complete) break;
        }
        t.command({ type: 'move', player: 0, unitIds: ids, x: home.x - 1, y: home.y + 4 });
        t.advance(120);
        return true;
      }
    }
    return false;
  }, RANGE.cost.wood! + spare);
  expect(placed).toBe(true);
  const range = rangeOf(await getState(page));
  expect(range.complete).toBe(true);
  await page.evaluate(([x, y]) => window.__TEST__!.centerCameraOnTile(x, y), [
    range.x + 1,
    range.y + 1,
  ] as const);
  return range;
}

test.describe('the throwing range', () => {
  test('is in the build menu under "Armé", with its price and what it does', async ({ page }) => {
    await openGame(page, '&ai=0&fog=0');
    const state = await getState(page);
    const worker = state.entities.find((e) => e.kind === 'unit' && e.owner === 0)!;
    const on = await tileToScreen(page, worker.x, worker.y);
    await page.mouse.click(on.x, on.y - 8);
    await expect.poll(async () => (await commandPanel(page)).visible).toBe(true);
    await openBuildTab(page, 'Armé');
    const button = (await commandPanel(page)).buttons.find((b) => b.label === 'Bygg Kastbana');
    expect([button?.cost, button?.info]).toEqual(['130 trä', 'Tränar Ramkastare']);
  });

  test('is built from its pictures, and trains a Ramkastare for 50 food and 40 wood in 20 seconds', async ({
    page,
  }) => {
    const errors = trackConsoleErrors(page);
    await openGame(page, '&ai=0&fog=0');
    const range = await buildRange(page, THROWER.cost.wood);
    await expect
      .poll(() => page.evaluate((id) => window.__TEST__!.getBuildingSprite(id), range.id))
      .toEqual({ frame: 'complete', texture: 'building-bear_range-player-0' });

    // Selected with a click on its wall: one button, to train a Ramkastare.
    const at = await tileToScreen(page, range.x + 1, range.y + 1);
    await page.mouse.click(at.x, at.y - 20);
    expect(await getSelection(page)).toEqual([range.id]);
    await expect.poll(async () => (await commandPanel(page)).visible).toBe(true);
    const panel = await commandPanel(page);
    expect(panel.buttons.map((b) => [b.label, b.cost, b.info])).toEqual([
      ['Träna Ramkastare', '50 mat, 40 trä', 'Kastar spjut på avstånd'],
    ]);
    const before = (await getState(page)).players[0]!.resources;
    await page.mouse.click(panel.buttons[0]!.x, panel.buttons[0]!.y);
    await expect.poll(async () => rangeOf(await getState(page)).queue).toEqual(['ramkastare']);
    const paid = (await getState(page)).players[0]!.resources;
    expect([before.food - paid.food, before.wood - paid.wood]).toEqual([50, 40]);

    await advance(page, THROWER.trainTime * SECOND + 2);
    const state = await getState(page);
    const thrower = state.entities.find((e) => e.kind === 'unit' && e.type === 'ramkastare')!;
    expect(thrower).toMatchObject({ owner: 0, hp: THROWER.hp });
    expect(rangeOf(state).queue).toEqual([]);
    // It is drawn as its own figure, in the player's colour.
    await expect
      .poll(() => unitSprite(page, thrower.id))
      .toMatchObject({ animation: 'idle', texture: 'character-bear_thrower-player-0' });
    expect(errors).toEqual([]);
  });
});

test.describe('the javelin thrower', () => {
  test('throws a javelin at an enemy within 7 tiles: it flies, lands with a burst and takes 8 life', async ({
    page,
  }) => {
    const errors = trackConsoleErrors(page);
    // The page's clock is the test's to stop; until it does, time runs as usual.
    await page.clock.install();
    await openGame(page, '&ai=0&fog=0');
    const row = await openRow(page, 9);
    expect((await projectiles(page)).projectiles).toEqual([]);

    // Time is held still from here on and let on one frame at a time, so
    // that what the test sees of the javelin does not depend on how fast
    // the machine is. The first frame takes up the jump in time.
    await page.clock.pauseAt(new Date(Date.now() + 2000));
    await page.clock.runFor(100);

    const thrower = await spawn(page, 'ramkastare', 0, row.x, row.y);
    // A Samlare of the enemy's six tiles away: it does not fight back.
    const enemy = await spawn(page, 'samlare', 1, row.x + 6, row.y);
    const drawn: Awaited<ReturnType<typeof projectiles>>['projectiles'] = [];
    const animations = new Set<string>();
    for (let step = 0; step < 16; step++) {
      await advance(page, 1);
      await page.clock.runFor(17);
      // The first javelin only, all its way.
      const first = drawn[0]?.id;
      const javelin = (await projectiles(page)).projectiles.find(
        (candidate) => first === undefined || candidate.id === first,
      );
      if (javelin) drawn.push(javelin);
      animations.add((await unitSprite(page, thrower))!.animation);
    }
    const after = await projectiles(page);
    const sprite = await unitSprite(page, thrower);
    await page.clock.resume();

    // It threw on its own, at once: the enemy was within the 7 tiles it notices enemies at.
    expect(drawn.length).toBeGreaterThanOrEqual(6);
    expect(new Set(drawn.map((javelin) => javelin.id)).size).toBe(1);
    // A javelin, not an arrow, with the binding of the side that threw it.
    expect(drawn[0]).toMatchObject({ frame: 'javelin', texture: 'scenery-player-0' });
    // East on the map is down to the right on the screen: it flies away from the thrower.
    const first = drawn[0]!;
    const last = drawn.at(-1)!;
    expect(last.x).toBeGreaterThan(first.x + 60);
    expect(last.y).toBeGreaterThan(first.y + 20);
    // The thrower is drawn throwing, turned towards its target.
    expect(animations).toContain('throw');
    expect(sprite).toMatchObject({
      animation: 'throw',
      direction: 'se',
      texture: 'character-bear_thrower-player-0',
    });
    // It has landed: a burst where it hit, and the Samlare has lost 8.
    expect(after.burstsShown).toBe(1);
    expect(unitOf(await getState(page), enemy)!.hp).toBe(UNIT_DEFS.samlare.hp - RANGED.damage);
    await expect.poll(async () => (await projectiles(page)).bursts).toBe(0);
    expect(errors).toEqual([]);
  });

  test('walks up to an enemy that is further away, stops at 7 tiles and throws from there', async ({
    page,
  }) => {
    await openGame(page, '&ai=0&fog=0');
    const row = await openRow(page, 14);
    const thrower = await spawn(page, 'ramkastare', 0, row.x, row.y);
    const enemy = await spawn(page, 'samlare', 1, row.x + 12, row.y);
    await advance(page, SECOND);
    // Too far away to notice: it stands where it is until it is ordered.
    expect(unitOf(await getState(page), thrower)).toMatchObject({ x: row.x + 0.5 });
    const result = await page.evaluate(
      ([unitId, targetId]) =>
        window.__TEST__!.command({ type: 'attack', player: 0, unitIds: [unitId], targetId }),
      [thrower, enemy] as const,
    );
    expect(result).toEqual({ ok: true });
    await advance(page, 6 * SECOND);
    const state = await getState(page);
    const at = unitOf(state, thrower)!;
    const target = unitOf(state, enemy)!;
    const distance = Math.hypot(target.x - at.x, target.y - at.y);
    expect(distance).toBeLessThanOrEqual(RANGED.range);
    expect(distance).toBeGreaterThan(RANGED.range - 0.5);
    expect(at.path).toEqual([]);
    expect(target.hp).toBeLessThan(UNIT_DEFS.samlare.hp);
  });

  test('strikes with a thrust for 3 when the enemy stands next to it, and throws nothing', async ({
    page,
  }) => {
    await openGame(page, '&ai=0&fog=0');
    const row = await openRow(page, 4);
    const thrower = await spawn(page, 'ramkastare', 0, row.x, row.y);
    const enemy = await spawn(page, 'samlare', 1, row.x + 1, row.y);
    await advance(page, 4);
    await expect.poll(() => unitSprite(page, thrower)).toMatchObject({ animation: 'jab' });
    const state = await getState(page);
    expect(state.projectiles).toEqual([]);
    expect(unitOf(state, enemy)!.hp).toBe(UNIT_DEFS.samlare.hp - THROWER.damage);
    expect((await projectiles(page)).burstsShown).toBe(0);
  });

  test('loses to a Ramkrigare that gets up to it', async ({ page }) => {
    await openGame(page, '&ai=0&fog=0');
    const row = await openRow(page, 10);
    const thrower = await spawn(page, 'ramkastare', 0, row.x, row.y);
    const warrior = await spawn(page, 'ramkrigare', 1, row.x + 7, row.y);
    await advance(page, 25 * SECOND);
    const state = await getState(page);
    const beaten = unitOf(state, thrower);
    expect(beaten === undefined || beaten.task.kind === 'flee').toBe(true);
    const winner = unitOf(state, warrior)!;
    expect(winner.task.kind).not.toBe('flee');
    // It took a few javelins on its way and a few thrusts: most of its life is left.
    expect(winner.hp).toBeGreaterThanOrEqual(70);
    expect(winner.hp).toBeLessThan(UNIT_DEFS.ramkrigare.hp);
  });

  test('throws at buildings too: an enemy thrower sets off the warning that the base is attacked', async ({
    page,
  }) => {
    const errors = trackConsoleErrors(page);
    await openGame(page, '&ai=0&fog=0');
    const row = await openRow(page, 4);
    const home = homeOf(await getState(page), 0);
    const enemy = await spawn(page, 'ramkastare', 1, row.x + 3, row.y);
    const result = await page.evaluate(
      ([unitId, targetId]) =>
        window.__TEST__!.command({ type: 'attack', player: 1, unitIds: [unitId], targetId }),
      [enemy, home.id] as const,
    );
    expect(result).toEqual({ ok: true });
    await advance(page, 6 * SECOND);
    const state = await getState(page);
    const lost = BUILDING_DEFS.storide.hp - homeOf(state, 0).hp;
    expect(lost).toBeGreaterThanOrEqual(RANGED.damage);
    expect(lost % RANGED.damage).toBe(0);
    // It threw from a distance: it does not stand by the wall.
    const at = unitOf(state, enemy)!;
    expect(Math.abs(at.x - (home.x + 1.5))).toBeGreaterThan(3);
    expect((await projectiles(page)).burstsShown).toBeGreaterThanOrEqual(1);
    await expect
      .poll(() => page.evaluate(() => window.__TEST__!.getAlert()))
      .toBe('Din bas anfalls!');
    expect(errors).toEqual([]);
  });

  test('shows its throw, its range, its strike and its armour when it is selected', async ({
    page,
  }) => {
    await openGame(page, '&ai=0&fog=0');
    const row = await openRow(page, 4);
    const thrower = await spawn(page, 'ramkastare', 0, row.x + 1, row.y);
    await advance(page, 2);
    const on = await tileToScreen(page, row.x + 1.5, row.y + 0.5);
    await page.mouse.click(on.x, on.y - 14);
    expect(await getSelection(page)).toEqual([thrower]);
    await expect
      .poll(() => page.evaluate(() => window.__TEST__!.getHud()))
      .toMatchObject({ title: 'Ramkastare', detail: 'Liv 60/60' });
    await expect
      .poll(() => page.evaluate(() => window.__TEST__!.getHudStats()))
      .toBe('Kast 8 · Räckvidd 7 · Slag 3 · Rustning 0');
  });
});
