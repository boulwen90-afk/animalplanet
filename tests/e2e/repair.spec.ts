import { expect, test, type Page } from '@playwright/test';
import { BUILDING_DEFS } from '../../src/data/buildings';
import { SIM_CONFIG } from '../../src/data/sim';
import { STRINGS } from '../../src/data/strings';
import type { Building, GameState, Unit } from '../../src/sim/state';
import { costToMend } from '../../src/sim/systems/repair';
import {
  finger,
  getSelection,
  getState,
  openGame,
  recordFlashes,
  recordNotices,
  tileToScreen,
  trackConsoleErrors,
} from './helpers';

const STORIDE = BUILDING_DEFS.storide;
const SECOND = SIM_CONFIG.ticksPerSecond;

const storideOf = (state: GameState) =>
  state.entities.find(
    (e): e is Building => e.kind === 'building' && e.owner === 0 && e.type === 'storide',
  )!;
const workersOf = (state: GameState) =>
  state.entities.filter((e): e is Unit => e.kind === 'unit' && e.owner === 0);
const unitOf = (state: GameState, id: number) =>
  state.entities.find((e): e is Unit => e.kind === 'unit' && e.id === id)!;
const wood = (state: GameState) => state.players[0]!.resources.wood;

const damageOn = (page: Page, id: number) =>
  page.evaluate((buildingId) => window.__TEST__!.getBuildingDamage(buildingId), id);
const pointer = (page: Page) => page.evaluate(() => window.__TEST__!.getPointer());
const commandPanel = (page: Page) => page.evaluate(() => window.__TEST__!.getCommandPanel());
const sprite = (page: Page, id: number) =>
  page.evaluate((unitId) => window.__TEST__!.getUnitSprite(unitId), id);
const advance = (page: Page, steps: number) =>
  page.evaluate((n) => window.__TEST__!.advance(n), steps);

/** Sets the life of the player's main building to a share of all it can have. */
async function damage(page: Page, share: number): Promise<Building> {
  const home = storideOf(await getState(page));
  await page.evaluate(([id, life]) => window.__TEST__!.setLife(id, life), [
    home.id,
    STORIDE.hp * share,
  ] as const);
  return home;
}

/** A point on the screen in the middle of the main building's walls. */
async function onBuilding(page: Page, building: Building): Promise<{ x: number; y: number }> {
  const side = BUILDING_DEFS[building.type].size;
  const at = await tileToScreen(page, building.x + side / 2, building.y + side / 2);
  return { x: at.x, y: at.y - 30 };
}

/** Selects all of the player's Samlare with a box round them. */
async function selectWorkers(page: Page): Promise<number[]> {
  const workers = workersOf(await getState(page));
  const points = await Promise.all(workers.map((unit) => tileToScreen(page, unit.x, unit.y)));
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  await page.mouse.move(Math.min(...xs) - 30, Math.min(...ys) - 50);
  await page.mouse.down();
  await page.mouse.move(Math.max(...xs) + 30, Math.max(...ys) + 20, { steps: 5 });
  await page.mouse.up();
  const ids = workers.map((unit) => unit.id).sort((a, b) => a - b);
  expect(await getSelection(page)).toEqual(ids);
  return ids;
}

const repairers = (state: GameState, building: Building) =>
  workersOf(state).filter(
    (unit) => unit.task.kind === 'repair' && unit.task.buildingId === building.id,
  );

test.describe('damage shows on a building', () => {
  test('it smokes below half its life and burns below a quarter', async ({ page }) => {
    const errors = trackConsoleErrors(page);
    await openGame(page, '&ai=0&fog=0');
    const home = storideOf(await getState(page));
    expect(await damageOn(page, home.id)).toEqual({ level: 'none', puffs: 0, flames: 0 });

    await damage(page, 0.6);
    await expect.poll(() => damageOn(page, home.id)).toMatchObject({ level: 'none' });

    await damage(page, 0.45);
    // Three columns of smoke on a building three tiles across, three puffs in each.
    await expect
      .poll(() => damageOn(page, home.id))
      .toEqual({ level: 'smoke', puffs: 9, flames: 0 });

    await damage(page, 0.2);
    await expect
      .poll(() => damageOn(page, home.id))
      .toEqual({ level: 'fire', puffs: 9, flames: 3 });

    // Mended above half again, it is as it was.
    await damage(page, 0.8);
    await expect
      .poll(() => damageOn(page, home.id))
      .toEqual({ level: 'none', puffs: 0, flames: 0 });
    expect(errors).toEqual([]);
  });

  test('a building under construction shows none, though it has little life', async ({ page }) => {
    await openGame(page, '&ai=0&fog=0');
    const state = await getState(page);
    const home = storideOf(state);
    const [worker] = workersOf(state);
    const site = await page.evaluate(
      ([id, hx, hy]) => {
        const t = window.__TEST__!;
        for (let r = 4; r < 10; r++) {
          for (let dy = -r; dy <= r; dy++) {
            for (let dx = -r; dx <= r; dx++) {
              const result = t.command({
                type: 'build',
                player: 0,
                unitIds: [id],
                building: 'ide',
                x: hx + dx,
                y: hy + dy,
              });
              if (result.ok) return t.getState().entities.find((e) => e.type === 'ide')!.id;
            }
          }
        }
        return -1;
      },
      [worker!.id, home.x, home.y] as const,
    );
    expect(site).toBeGreaterThan(0);
    await page.waitForTimeout(200);
    const built = (await getState(page)).entities.find((e) => e.id === site) as Building;
    expect(built.complete).toBe(false);
    expect(built.hp).toBeLessThan(BUILDING_DEFS.ide.hp * 0.25);
    expect(await damageOn(page, site)).toMatchObject({ level: 'none' });
  });
});

test.describe('repairing with the mouse', () => {
  test('a right click on a damaged building sends the selected Samlare to mend it', async ({
    page,
  }) => {
    const errors = trackConsoleErrors(page);
    await openGame(page, '&ai=0&fog=0');
    const home = await damage(page, 0.4);
    const ids = await selectWorkers(page);
    const before = await getState(page);

    const at = await onBuilding(page, home);
    await page.mouse.click(at.x, at.y, { button: 'right' });
    const ordered = repairers(await getState(page), home);
    expect(ordered.map((unit) => unit.id).sort((a, b) => a - b)).toEqual(ids);
    // Each has a place of its own right next to the building.
    const places = ordered.map((unit) =>
      unit.task.kind === 'repair' ? `${unit.task.place.x},${unit.task.place.y}` : '',
    );
    expect(new Set(places).size).toBe(ids.length);
    // The order shows where it was given, and the Samlare stay selected.
    expect(await page.evaluate(() => window.__TEST__!.getOrderMarkerCount())).toBe(1);
    expect(await getSelection(page)).toEqual(ids);

    await advance(page, 6 * SECOND);
    // They stand by the building and swing their hammers.
    for (const id of ids) {
      await expect.poll(async () => (await sprite(page, id))?.animation).toBe('hammer');
    }
    const after = await getState(page);
    const mended = storideOf(after).hp - storideOf(before).hp;
    expect(mended).toBeGreaterThan(20);
    // The wood goes as the life comes: ten life for each unit of wood.
    expect(wood(before) - wood(after)).toBeGreaterThanOrEqual(Math.floor(mended / 10));
    expect(wood(before) - wood(after)).toBeLessThanOrEqual(Math.ceil(mended / 10) + 1);
    expect(await page.evaluate(() => window.__TEST__!.getHud())).toMatchObject({
      title: '3 enheter markerade',
    });
    expect(errors).toEqual([]);
  });

  test('a single repairer is shown as repairing in the selection panel', async ({ page }) => {
    await openGame(page, '&ai=0&fog=0');
    const home = await damage(page, 0.4);
    const [worker] = workersOf(await getState(page));
    await page.evaluate(
      ([unitId, buildingId]) =>
        window.__TEST__!.command({ type: 'repair', player: 0, unitIds: [unitId], buildingId }),
      [worker!.id, home.id] as const,
    );
    await advance(page, 4 * SECOND);
    const unit = unitOf(await getState(page), worker!.id);
    const on = await tileToScreen(page, unit.x, unit.y);
    await page.mouse.click(on.x, on.y - 8);
    expect(await getSelection(page)).toEqual([worker!.id]);
    await expect
      .poll(async () => (await page.evaluate(() => window.__TEST__!.getHud())).detail)
      .toBe(`Liv 40/40 · ${STRINGS.hud.repairing('Storide')}`);
  });

  test('the pointer turns into a hammer over a damaged building while Samlare are selected, and only then', async ({
    page,
  }) => {
    await openGame(page, '&ai=0&fog=0');
    const home = storideOf(await getState(page));
    const at = await onBuilding(page, home);

    // A whole building, with Samlare selected: the usual pointer.
    await selectWorkers(page);
    await page.mouse.move(at.x, at.y);
    await page.waitForTimeout(150);
    expect(await pointer(page)).toMatchObject({ shown: 'default', repairTarget: null });

    // Damaged: the hammer, made from the pipeline's picture of one.
    await damage(page, 0.7);
    await expect.poll(async () => (await pointer(page)).shown).toBe('repair');
    const shown = await pointer(page);
    expect(shown.repairTarget).toBe(home.id);
    expect(shown.css).toMatch(/^url\("data:image\/png;base64,.+"\) \d+ \d+, pointer$/);

    // Off the building it is the usual pointer again.
    await page.mouse.move(at.x + 260, at.y + 40);
    await expect.poll(async () => (await pointer(page)).shown).toBe('default');
    expect((await pointer(page)).css).toBe('default');

    // With nothing selected a right click would do nothing: no hammer.
    await page.keyboard.press('Escape');
    await page.mouse.move(at.x, at.y);
    await page.waitForTimeout(150);
    expect(await pointer(page)).toMatchObject({ shown: 'default', repairTarget: null });
  });

  test('the Laga button is dimmed while nothing is damaged, and names the building and the cost when something is', async ({
    page,
  }) => {
    await openGame(page, '&ai=0&fog=0');
    const ids = await selectWorkers(page);
    await expect.poll(async () => (await commandPanel(page)).visible).toBe(true);
    const whole = (await commandPanel(page)).buttons.at(-1)!;
    expect([whole.label, whole.cost, whole.info, whole.disabled]).toEqual([
      STRINGS.hud.repair,
      '',
      STRINGS.hud.nothingToRepair,
      true,
    ]);
    // Pressing it does nothing.
    await page.mouse.click(whole.x, whole.y);
    expect(workersOf(await getState(page)).every((unit) => unit.task.kind === 'idle')).toBe(true);

    const home = await damage(page, 0.5);
    const cost = costToMend({ ...home, hp: STORIDE.hp * 0.5 });
    await expect
      .poll(async () => {
        const button = (await commandPanel(page)).buttons.at(-1)!;
        return [button.label, button.cost, button.info, button.disabled];
      })
      .toEqual([STRINGS.hud.repair, `ca ${cost} trä`, 'Storide, 50 % liv', undefined]);
    expect(cost).toBe(75);

    const button = (await commandPanel(page)).buttons.at(-1)!;
    await page.mouse.click(button.x, button.y);
    expect(
      repairers(await getState(page), home)
        .map((unit) => unit.id)
        .sort((a, b) => a - b),
    ).toEqual(ids);
    expect(await page.evaluate(() => window.__TEST__!.getOrderMarkerCount())).toBe(1);
  });

  test('with no wood left the repair waits and says so, and goes on when wood comes in', async ({
    page,
  }) => {
    const errors = trackConsoleErrors(page);
    await openGame(page, '&ai=0&fog=0');
    // Mending this much costs more wood than the side starts with.
    const home = await damage(page, 0.1);
    const start = await getState(page);
    expect(costToMend({ ...home, hp: STORIDE.hp * 0.1 })).toBeGreaterThan(wood(start));
    const ids = await selectWorkers(page);
    const at = await onBuilding(page, home);
    await page.mouse.click(at.x, at.y, { button: 'right' });
    const flashes = await recordFlashes(page);
    const notices = await recordNotices(page);

    // Step on until the wood is gone and the work has stopped.
    await page.evaluate(() => {
      const t = window.__TEST__!;
      for (let step = 0; step < 6000; step++) {
        t.advance(1);
        const units = t.getState().entities.filter((e) => e.kind === 'unit' && e.owner === 0);
        if (units.some((e) => e.kind === 'unit' && e.task.kind === 'repair' && e.task.waiting)) {
          return;
        }
      }
    });
    const stopped = await getState(page);
    expect(wood(stopped)).toBe(0);
    expect(storideOf(stopped).hp).toBeLessThan(STORIDE.hp);
    await expect.poll(notices).toEqual([STRINGS.hud.repairPaused]);
    await expect.poll(flashes).toContain('wood');
    // The Samlare stand by the building with their hammers still.
    for (const id of ids) {
      await expect.poll(async () => (await sprite(page, id))?.animation).toBe('idle');
    }

    // One of them goes for wood; when it comes home the others take up the work.
    const [fetcher, ...rest] = ids;
    await page.evaluate((unitId) => {
      const t = window.__TEST__!;
      const state = t.getState();
      const unit = state.entities.find((e) => e.id === unitId)!;
      let best: { x: number; y: number } | undefined;
      let bestDistance = Infinity;
      for (let y = 0; y < state.map.height; y++) {
        for (let x = 0; x < state.map.width; x++) {
          if (state.map.terrain[y * state.map.width + x] !== 'tree') continue;
          const distance = Math.hypot(x - unit.x, y - unit.y);
          if (distance < bestDistance) {
            best = { x, y };
            bestDistance = distance;
          }
        }
      }
      t.command({ type: 'gather', player: 0, unitIds: [unitId], x: best!.x, y: best!.y });
      for (let step = 0; step < 2000; step++) {
        t.advance(1);
        const hp = t.getState().entities.find((e) => e.type === 'storide' && e.owner === 0)!.hp;
        if (hp > state.entities.find((e) => e.type === 'storide' && e.owner === 0)!.hp) return;
      }
    }, fetcher!);
    const resumed = await getState(page);
    expect(storideOf(resumed).hp).toBeGreaterThan(storideOf(stopped).hp);
    for (const id of rest) {
      expect(unitOf(resumed, id).task).toMatchObject({ kind: 'repair', waiting: false });
    }
    expect(errors).toEqual([]);
  });
});

test.describe('repairing on a touch screen', () => {
  test.use({ hasTouch: true });

  test('a tap on a damaged building sends the selected Samlare to mend it', async ({ page }) => {
    await openGame(page, '&ai=0&fog=0');
    const home = await damage(page, 0.4);
    const [worker] = workersOf(await getState(page));
    const touch = await finger(page);
    const on = await tileToScreen(page, worker!.x, worker!.y);
    await touch.tap(on.x, on.y - 8);
    expect(await getSelection(page)).toEqual([worker!.id]);

    const at = await onBuilding(page, home);
    await touch.tap(at.x, at.y);
    expect(repairers(await getState(page), home).map((unit) => unit.id)).toEqual([worker!.id]);
    // The Samlare is still the one selected: the tap gave an order, it did not select the building.
    expect(await getSelection(page)).toEqual([worker!.id]);
  });

  test('a tap on a whole building selects it, as before', async ({ page }) => {
    await openGame(page, '&ai=0&fog=0');
    const home = storideOf(await getState(page));
    const [worker] = workersOf(await getState(page));
    const touch = await finger(page);
    const on = await tileToScreen(page, worker!.x, worker!.y);
    await touch.tap(on.x, on.y - 8);
    const at = await onBuilding(page, home);
    await touch.tap(at.x, at.y);
    expect(await getSelection(page)).toEqual([home.id]);
  });
});
