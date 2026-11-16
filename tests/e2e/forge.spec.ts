import { expect, test, type Page } from '@playwright/test';
import { BUILDING_DEFS } from '../../src/data/buildings';
import { SIM_CONFIG } from '../../src/data/sim';
import { UPGRADE_DEFS } from '../../src/data/upgrades';
import type { Building, GameState } from '../../src/sim/state';
import {
  getSelection,
  getState,
  openBuildTab,
  openGame,
  recordFlashes,
  recordNotices,
  tileToScreen,
  trackConsoleErrors,
} from './helpers';

const FORGE = BUILDING_DEFS.smedja;
const WEAPONS = UPGRADE_DEFS.weapons.levels;
const SECOND = SIM_CONFIG.ticksPerSecond;

const forgeOf = (state: GameState) =>
  state.entities.find((e): e is Building => e.kind === 'building' && e.type === 'smedja')!;
const stock = (state: GameState) => state.players[0]!.resources;

const commandPanel = (page: Page) => page.evaluate(() => window.__TEST__!.getCommandPanel());
const advance = (page: Page, steps: number) =>
  page.evaluate((n) => window.__TEST__!.advance(n), steps);
const progressOn = (page: Page, id: number) =>
  page.evaluate((buildingId) => window.__TEST__!.getBuildingProgress(buildingId), id);

/**
 * Has the player's Samlare chop wood until there is enough for a Smedja and
 * `spare` more, build one by the main building and step the game on until
 * it stands. The Samlare are then sent back to the main building.
 */
async function buildForge(page: Page, spare = 0): Promise<Building> {
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
          building: 'smedja',
          x: home.x + r,
          y: home.y + dy,
        });
        if (!result.ok) continue;
        for (let i = 0; i < 6000; i++) {
          t.advance(1);
          const forge = t.getState().entities.find((e) => e.type === 'smedja');
          if (forge?.kind === 'building' && forge.complete) break;
        }
        t.command({ type: 'move', player: 0, unitIds: ids, x: home.x - 1, y: home.y + 4 });
        t.advance(120);
        return true;
      }
    }
    return false;
  }, FORGE.cost.wood! + spare);
  expect(placed).toBe(true);
  const forge = forgeOf(await getState(page));
  expect(forge.complete).toBe(true);
  await page.evaluate(([x, y]) => window.__TEST__!.centerCameraOnTile(x, y), [
    forge.x + 1,
    forge.y + 1,
  ] as const);
  return forge;
}

/** Selects the Smedja with a click on its walls and waits for its panel. */
async function selectForge(page: Page, forge: Building): Promise<void> {
  const at = await tileToScreen(page, forge.x + 1, forge.y + 1);
  await page.mouse.click(at.x, at.y - 20);
  expect(await getSelection(page)).toEqual([forge.id]);
  await expect.poll(async () => (await commandPanel(page)).visible).toBe(true);
}

test.describe('the smithy', () => {
  test('is in the build menu under "Armé", with its price and what it does', async ({ page }) => {
    await openGame(page, '&ai=0&fog=0');
    const state = await getState(page);
    const worker = state.entities.find((e) => e.kind === 'unit' && e.owner === 0)!;
    const on = await tileToScreen(page, worker.x, worker.y);
    await page.mouse.click(on.x, on.y - 8);
    await expect.poll(async () => (await commandPanel(page)).visible).toBe(true);
    await openBuildTab(page, 'Armé');
    const button = (await commandPanel(page)).buttons.find((b) => b.label === 'Bygg Smedja');
    expect([button?.cost, button?.info]).toEqual(['150 trä', 'Uppgraderar enheter']);
  });

  test('is drawn from its pictures, and offers the three upgrades when it is selected', async ({
    page,
  }) => {
    const errors = trackConsoleErrors(page);
    await openGame(page, '&ai=0&fog=0');
    const forge = await buildForge(page);
    expect(await page.evaluate((id) => window.__TEST__!.getBuildingSprite(id), forge.id)).toEqual({
      frame: 'complete',
      texture: 'building-bear_forge-player-0',
    });
    await selectForge(page, forge);
    const panel = await commandPanel(page);
    expect(panel.buttons.map((b) => [b.label, b.cost, b.info])).toEqual([
      ['Vapen I', '100 mat, 50 trä', '+2 skada, soldater'],
      ['Rustning I', '75 mat, 75 trä', '+1 rustning, alla'],
      ['Verktyg I', '100 mat, 50 trä', '+20 % fart, Samlare'],
    ]);
    expect(panel.tabs).toEqual([]);
    expect(panel.queue).toEqual([]);
    expect(await progressOn(page, forge.id)).toBeNull();
    expect(errors).toEqual([]);
  });

  test('works out an upgrade: it is paid for, shows in the queue and over the building, and then holds for the units', async ({
    page,
  }) => {
    const errors = trackConsoleErrors(page);
    await openGame(page, '&ai=0&fog=0');
    const forge = await buildForge(page, WEAPONS[0]!.cost.wood!);
    const soldier = await page.evaluate(
      ([x, y]) => window.__TEST__!.spawnUnit('ramkrigare', 0, x - 2, y + 3),
      [forge.x, forge.y] as const,
    );
    await selectForge(page, forge);
    const before = stock(await getState(page));
    const notices = await recordNotices(page);

    const [weapons] = (await commandPanel(page)).buttons;
    await page.mouse.click(weapons!.x, weapons!.y);
    const paid = stock(await getState(page));
    expect(paid.food).toBe(before.food - WEAPONS[0]!.cost.food!);
    expect(paid.wood).toBe(before.wood - WEAPONS[0]!.cost.wood!);
    // It is in the queue, its button is dimmed, and the Smedja is still the one selected.
    await expect
      .poll(async () => (await commandPanel(page)).queue.map((q) => q.label))
      .toEqual(['Va']);
    const working = (await commandPanel(page)).buttons[0]!;
    expect([working.label, working.cost, working.info, working.disabled]).toEqual([
      'Vapen I',
      '',
      'Pågår',
      true,
    ]);
    expect(await getSelection(page)).toEqual([forge.id]);

    // Half-way: the bar in the panel and the bar over the building both say so.
    await advance(page, (WEAPONS[0]!.time * SECOND) / 2);
    await expect.poll(async () => (await commandPanel(page)).progress).toBeGreaterThan(0.45);
    const over = await progressOn(page, forge.id);
    expect(over).not.toBeNull();
    expect(over!).toBeGreaterThan(0.45);
    expect(over!).toBeLessThan(0.7);

    await advance(page, (WEAPONS[0]!.time * SECOND) / 2 + 2);
    expect((await getState(page)).players[0]!.upgrades).toEqual({
      weapons: 1,
      armor: 0,
      gathering: 0,
    });
    await expect.poll(notices).toEqual(['Vapen I är klar']);
    // The queue is empty, the bar is gone, and the button offers the second level.
    await expect.poll(async () => (await commandPanel(page)).queue).toEqual([]);
    await expect.poll(() => progressOn(page, forge.id)).toBeNull();
    const next = (await commandPanel(page)).buttons[0]!;
    expect([next.label, next.cost, next.info]).toEqual([
      'Vapen II',
      '175 mat, 100 trä',
      '+2 skada, soldater',
    ]);

    // The upgrade shows on the unit: a Ramkrigare strikes for 12 now.
    const unit = (await getState(page)).entities.find((e) => e.id === soldier)!;
    if (unit.kind !== 'unit') throw new Error('not a unit');
    const on = await tileToScreen(page, unit.x, unit.y);
    await page.mouse.click(on.x, on.y - 16);
    expect(await getSelection(page)).toEqual([soldier]);
    await expect
      .poll(() => page.evaluate(() => window.__TEST__!.getHudStats()))
      .toBe('Skada 12 (+2) · Rustning 1');
    expect(errors).toEqual([]);
  });

  test('a click on a place in the queue cancels that upgrade and gives its price back', async ({
    page,
  }) => {
    await openGame(page, '&ai=0&fog=0');
    const forge = await buildForge(page, 150);
    await selectForge(page, forge);
    const before = { ...stock(await getState(page)) };
    const buttons = (await commandPanel(page)).buttons;
    await page.mouse.click(buttons[0]!.x, buttons[0]!.y);
    await page.mouse.click(buttons[2]!.x, buttons[2]!.y);
    await expect
      .poll(async () => (await commandPanel(page)).queue.map((q) => q.label))
      .toEqual(['Va', 'Ve']);
    expect(forgeOf(await getState(page)).research).toEqual(['weapons', 'gathering']);

    await advance(page, 5 * SECOND);
    const [first] = (await commandPanel(page)).queue;
    await page.mouse.click(first!.x, first!.y);
    // The one that waited is now the one being worked out, from the start.
    await expect.poll(async () => forgeOf(await getState(page)).research).toEqual(['gathering']);
    const after = stock(await getState(page));
    expect(after.food).toBe(before.food - UPGRADE_DEFS.gathering.levels[0]!.cost.food!);
    expect(after.wood).toBe(before.wood - UPGRADE_DEFS.gathering.levels[0]!.cost.wood!);
    expect(forgeOf(await getState(page)).researchTicks).toBeLessThan(SECOND);
  });

  test('an upgrade that cannot be paid for flashes what is missing and is not ordered', async ({
    page,
  }) => {
    await openGame(page, '&ai=0&fog=0');
    // No wood to spare after the Smedja itself.
    const forge = await buildForge(page);
    await selectForge(page, forge);
    expect(stock(await getState(page)).wood).toBeLessThan(WEAPONS[0]!.cost.wood!);
    const flashes = await recordFlashes(page);
    const [weapons] = (await commandPanel(page)).buttons;
    await page.mouse.click(weapons!.x, weapons!.y);
    await expect.poll(flashes).toEqual(['wood']);
    expect(forgeOf(await getState(page)).research).toEqual([]);
  });
});

test.describe('what a unit can do', () => {
  test('shows under its life in the selection panel', async ({ page }) => {
    await openGame(page, '&ai=0&fog=0');
    const state = await getState(page);
    const worker = state.entities.find((e) => e.kind === 'unit' && e.owner === 0)!;
    const on = await tileToScreen(page, worker.x, worker.y);
    await page.mouse.click(on.x, on.y - 8);
    await expect
      .poll(() => page.evaluate(() => window.__TEST__!.getHudStats()))
      .toBe('Samlar 1/s · Rustning 0');
    // Nothing selected: nothing shown.
    await page.keyboard.press('Escape');
    await expect.poll(() => page.evaluate(() => window.__TEST__!.getHudStats())).toBe('');
  });
});
