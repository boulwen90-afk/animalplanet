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

const TOWER = BUILDING_DEFS.vakttorn;
const ATTACK = TOWER.attack!;
const SECOND = SIM_CONFIG.ticksPerSecond;

const towerOf = (state: GameState) =>
  state.entities.find((e): e is Building => e.kind === 'building' && e.type === 'vakttorn')!;
const unitOf = (state: GameState, id: number) =>
  state.entities.find((e): e is Unit => e.kind === 'unit' && e.id === id);
const workersOf = (state: GameState) =>
  state.entities.filter((e): e is Unit => e.kind === 'unit' && e.owner === 0);

const projectiles = (page: Page) => page.evaluate(() => window.__TEST__!.getProjectiles());
const buildingSprite = (page: Page, id: number) =>
  page.evaluate((buildingId) => window.__TEST__!.getBuildingSprite(buildingId), id);
const advance = (page: Page, steps: number) =>
  page.evaluate((n) => window.__TEST__!.advance(n), steps);

/**
 * Has the player's Samlare chop the wood a tower costs, build one near the
 * main building and step the game on until it stands. The Samlare are then
 * sent back to the main building, out of the way.
 */
async function buildTower(page: Page): Promise<Building> {
  const placed = await page.evaluate((price) => {
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
    for (let i = 0; i < 6000 && t.getState().players[0]!.resources.wood < price; i++) t.advance(1);
    // On open ground in front of the main building.
    for (let r = 5; r < 10; r++) {
      for (let dy = 0; dy <= r; dy++) {
        const result = t.command({
          type: 'build',
          player: 0,
          unitIds: ids,
          building: 'vakttorn',
          x: home.x + r,
          y: home.y + dy,
        });
        if (!result.ok) continue;
        for (let i = 0; i < 6000; i++) {
          t.advance(1);
          const tower = t.getState().entities.find((e) => e.type === 'vakttorn');
          if (tower?.kind === 'building' && tower.complete) break;
        }
        t.command({ type: 'move', player: 0, unitIds: ids, x: home.x - 1, y: home.y + 4 });
        t.advance(120);
        return true;
      }
    }
    return false;
    // A little more than the tower costs, so that there is wood left to repair it with.
  }, TOWER.cost.wood! + 30);
  expect(placed).toBe(true);
  const tower = towerOf(await getState(page));
  expect(tower.complete).toBe(true);
  await page.evaluate(([x, y]) => window.__TEST__!.centerCameraOnTile(x, y), [
    tower.x + 0.5,
    tower.y + 0.5,
  ] as const);
  return tower;
}

test.describe('the watchtower', () => {
  test('is in the build menu with its price and what it does', async ({ page }) => {
    await openGame(page, '&ai=0&fog=0');
    const [worker] = workersOf(await getState(page));
    const on = await tileToScreen(page, worker!.x, worker!.y);
    await page.mouse.click(on.x, on.y - 8);
    await expect
      .poll(async () => (await page.evaluate(() => window.__TEST__!.getCommandPanel())).visible)
      .toBe(true);
    await openBuildTab(page, 'Försvar');
    const panel = await page.evaluate(() => window.__TEST__!.getCommandPanel());
    const button = panel.buttons.find((b) => b.label === 'Bygg Vakttorn');
    expect([button?.cost, button?.info]).toEqual(['120 trä', 'Skjuter på fiender']);
  });

  test('is built and drawn from its pictures, in the player`s colour', async ({ page }) => {
    const errors = trackConsoleErrors(page);
    await openGame(page, '&ai=0&fog=0');
    const tower = await buildTower(page);
    await expect
      .poll(() => buildingSprite(page, tower.id))
      .toEqual({ frame: 'complete', texture: 'building-bear_tower-player-0' });
    expect(errors).toEqual([]);
  });

  test('shoots an arrow at an enemy that comes within its range: it flies, lands with a burst, and takes life', async ({
    page,
  }) => {
    const errors = trackConsoleErrors(page);
    // The page's clock is the test's to stop; until it does, time runs as usual.
    await page.clock.install();
    await openGame(page, '&ai=0&fog=0');
    const tower = await buildTower(page);
    expect((await projectiles(page)).projectiles).toEqual([]);

    // Time is held still from here on and let on one frame at a time, so
    // that how many pictures of the arrow the test gets does not depend on
    // how fast the machine is. The first frame takes up the jump in time.
    await page.clock.pauseAt(new Date(Date.now() + 2000));
    await page.clock.runFor(100);

    // A Samlare of the enemy's five tiles away: it does not fight back.
    const enemy = await page.evaluate(
      ([x, y]) => window.__TEST__!.spawnUnit('samlare', 1, x + 5, y),
      [tower.x, tower.y] as const,
    );
    // Step by step, noting what is drawn on the way.
    const seen: { drawn: Awaited<ReturnType<typeof projectiles>>['projectiles'] } = { drawn: [] };
    for (let step = 0; step < 14; step++) {
      await advance(page, 1);
      await page.clock.runFor(17);
      // The first arrow only, all its way: the tower may get a second one off before the loop ends.
      const first = seen.drawn[0]?.id;
      const arrow = (await projectiles(page)).projectiles.find(
        (candidate) => first === undefined || candidate.id === first,
      );
      if (arrow) seen.drawn.push(arrow);
    }
    const after = await projectiles(page);
    await page.clock.resume();
    expect(seen.drawn.length).toBeGreaterThanOrEqual(4);
    expect(new Set(seen.drawn.map((arrow) => arrow.id)).size).toBe(1);
    // The arrow has the feathers of the side that shot it, and flies away from the tower.
    expect(seen.drawn[0]!.texture).toBe('scenery-player-0');
    const first = seen.drawn[0]!;
    const last = seen.drawn.at(-1)!;
    expect(last.x).toBeGreaterThan(first.x + 40);
    // It comes down from the platform of the tower to the unit.
    expect(last.y).toBeGreaterThan(first.y + 20);
    // It has landed: a burst where it hit, and the unit has lost life. The
    // game runs on between the steps, so a second arrow may have landed too.
    expect(after.burstsShown).toBeGreaterThanOrEqual(1);
    const hit = unitOf(await getState(page), enemy)!;
    expect(hit.hp).toBeLessThanOrEqual(UNIT_DEFS.samlare.hp - ATTACK.damage);
    expect((UNIT_DEFS.samlare.hp - hit.hp) % ATTACK.damage).toBe(0);
    // The burst is gone again a moment later.
    await expect.poll(async () => (await projectiles(page)).bursts).toBe(0);
    expect(errors).toEqual([]);
  });

  test('goes on shooting every 1.5 s until the enemy surrenders, and then stops', async ({
    page,
  }) => {
    await openGame(page, '&ai=0&fog=0');
    const tower = await buildTower(page);
    const enemy = await page.evaluate(
      ([x, y]) => window.__TEST__!.spawnUnit('samlare', 1, x + 4, y + 1),
      [tower.x, tower.y] as const,
    );
    await advance(page, 10 * SECOND);
    const state = await getState(page);
    const unit = unitOf(state, enemy);
    // Five shots take all its life: it gives up and leaves, or has left already.
    expect(unit === undefined || unit.task.kind === 'flee').toBe(true);
    expect((await projectiles(page)).burstsShown).toBe(
      Math.ceil(UNIT_DEFS.samlare.hp / ATTACK.damage),
    );
    await advance(page, 3 * SECOND);
    expect(await getState(page).then((s) => s.projectiles)).toEqual([]);
  });

  test('leaves an enemy outside its range alone', async ({ page }) => {
    await openGame(page, '&ai=0&fog=0');
    const tower = await buildTower(page);
    const enemy = await page.evaluate(
      ([x, y, far]) => window.__TEST__!.spawnUnit('samlare', 1, x + far, y),
      [tower.x, tower.y, ATTACK.range + 2] as const,
    );
    await advance(page, 5 * SECOND);
    expect((await projectiles(page)).burstsShown).toBe(0);
    expect(unitOf(await getState(page), enemy)!.hp).toBe(UNIT_DEFS.samlare.hp);
  });

  test('shows what it does and how far it shoots when it is selected', async ({ page }) => {
    await openGame(page, '&ai=0&fog=0');
    const tower = await buildTower(page);
    expect(await page.evaluate(() => window.__TEST__!.getRangeRings())).toEqual([]);
    const at = await tileToScreen(page, tower.x + 0.5, tower.y + 0.5);
    await page.mouse.click(at.x, at.y - 40);
    expect(await getSelection(page)).toEqual([tower.id]);
    await expect
      .poll(() => page.evaluate(() => window.__TEST__!.getHud()))
      .toMatchObject({ title: 'Vakttorn', detail: 'Liv 500/500 · Skada 9 · Räckvidd 6' });
    await expect
      .poll(() => page.evaluate(() => window.__TEST__!.getRangeRings()))
      .toEqual([tower.id]);
    await page.keyboard.press('Escape');
    await expect.poll(() => page.evaluate(() => window.__TEST__!.getRangeRings())).toEqual([]);
  });

  test('can be repaired like other buildings, and smokes when it is damaged', async ({ page }) => {
    await openGame(page, '&ai=0&fog=0');
    const tower = await buildTower(page);
    await page.evaluate(([id, life]) => window.__TEST__!.setLife(id, life), [
      tower.id,
      TOWER.hp * 0.4,
    ] as const);
    await expect
      .poll(() => page.evaluate((id) => window.__TEST__!.getBuildingDamage(id), tower.id))
      .toMatchObject({ level: 'smoke' });
    const [worker] = workersOf(await getState(page));
    const result = await page.evaluate(
      ([unitId, buildingId]) =>
        window.__TEST__!.command({ type: 'repair', player: 0, unitIds: [unitId], buildingId }),
      [worker!.id, tower.id] as const,
    );
    expect(result).toEqual({ ok: true });
    await advance(page, 20 * SECOND);
    expect(towerOf(await getState(page)).hp).toBeGreaterThan(TOWER.hp * 0.4);
  });
});
