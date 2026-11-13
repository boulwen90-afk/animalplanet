import { expect, test, type Page } from '@playwright/test';
import type { Building, GameState, Unit } from '../../src/sim/state';
import { getSelection, getState, openGame, tileToScreen, trackConsoleErrors } from './helpers';

// The three states a tile can be in for a side; see src/sim/state.ts.
const UNEXPLORED = 0;
const EXPLORED = 1;
const VISIBLE = 2;

const advance = (page: Page, steps: number) =>
  page.evaluate((n) => window.__TEST__!.advance(n), steps);

const seenBy = (state: GameState, player: number, x: number, y: number) =>
  state.players[player]!.visibility[y * state.map.width + x];

const storideOf = (state: GameState, owner: number) =>
  state.entities.find(
    (e): e is Building => e.kind === 'building' && e.type === 'storide' && e.owner === owner,
  )!;

test.describe('phase 8: fog of war', () => {
  test("at the start the player sees its own base and not the enemy's", async ({ page }) => {
    const errors = trackConsoleErrors(page);
    await openGame(page);
    const state = await getState(page);
    const [mine, theirs] = state.map.startPositions as [
      { x: number; y: number },
      { x: number; y: number },
    ];

    expect(state.fogEnabled).toBe(true);
    expect(seenBy(state, 0, mine.x, mine.y)).toBe(VISIBLE);
    expect(seenBy(state, 0, theirs.x, theirs.y)).toBe(UNEXPLORED);
    // The middle of the map is far from both bases.
    expect(seenBy(state, 0, 32, 32)).toBe(UNEXPLORED);
    // Most of the map is unknown.
    const known = state.players[0]!.visibility.filter((v) => v !== UNEXPLORED).length;
    expect(known).toBeLessThan(state.map.width * state.map.height * 0.15);
    expect(errors).toEqual([]);
  });

  test('a unit that walks to the enemy base makes it visible', async ({ page }) => {
    const errors = trackConsoleErrors(page);
    await openGame(page);
    const before = await getState(page);
    const theirs = before.map.startPositions[1]!;
    const scout = before.entities.find((e): e is Unit => e.kind === 'unit' && e.owner === 0)!;

    await page.evaluate(
      ([id, x, y]) => window.__TEST__!.command({ type: 'move', player: 0, unitIds: [id], x, y }),
      [scout.id, theirs.x, theirs.y + 3] as const,
    );
    // A minute and a half of walking across the map.
    await advance(page, 1800);

    const after = await getState(page);
    expect(seenBy(after, 0, theirs.x, theirs.y)).toBe(VISIBLE);
    // Where the scout set out from is still in sight of the Storide there.
    const mine = after.map.startPositions[0]!;
    expect(seenBy(after, 0, mine.x, mine.y)).toBe(VISIBLE);
    // The ground it crossed is remembered but no longer in sight.
    expect(seenBy(after, 0, 32, 32)).not.toBe(VISIBLE);
    const explored = after.players[0]!.visibility.filter((v) => v === EXPLORED).length;
    expect(explored).toBeGreaterThan(300);
    expect(errors).toEqual([]);
  });

  test('an enemy unit out of sight cannot be selected; one in sight can', async ({ page }) => {
    await openGame(page);
    const state = await getState(page);
    const enemyStoride = storideOf(state, 1);
    await page.evaluate(([x, y]) => window.__TEST__!.centerCameraOnTile(x, y), [
      enemyStoride.x + 1.5,
      enemyStoride.y + 1.5,
    ] as const);
    const at = await tileToScreen(page, enemyStoride.x + 1.5, enemyStoride.y + 1.5);

    // Hidden in the fog: the click finds nothing.
    await page.mouse.click(at.x, at.y);
    expect(await getSelection(page)).toEqual([]);

    // A unit of the player's next to it lifts the fog.
    const start = state.map.startPositions[1]!;
    await page.evaluate(([x, y]) => window.__TEST__!.spawnUnit('samlare', 0, x, y), [
      start.x - 3,
      start.y,
    ] as const);
    await page.mouse.click(at.x, at.y);
    expect(await getSelection(page)).toEqual([enemyStoride.id]);
    await expect
      .poll(async () => (await page.evaluate(() => window.__TEST__!.getHud())).title)
      .toBe('Storide (Fiende)');
  });

  test('a selected enemy is deselected when it slips out of sight', async ({ page }) => {
    await openGame(page);
    const state = await getState(page);
    const start = state.map.startPositions[1]!;
    const enemyStoride = storideOf(state, 1);
    const scout = await page.evaluate(([x, y]) => window.__TEST__!.spawnUnit('samlare', 0, x, y), [
      start.x - 3,
      start.y,
    ] as const);
    await page.evaluate(([x, y]) => window.__TEST__!.centerCameraOnTile(x, y), [
      enemyStoride.x + 1.5,
      enemyStoride.y + 1.5,
    ] as const);
    const at = await tileToScreen(page, enemyStoride.x + 1.5, enemyStoride.y + 1.5);
    await page.mouse.click(at.x, at.y);
    expect(await getSelection(page)).toEqual([enemyStoride.id]);

    // Send the scout far away; the Storide disappears into the fog again.
    await page.evaluate(
      (id) => window.__TEST__!.command({ type: 'move', player: 0, unitIds: [id], x: 32, y: 32 }),
      scout,
    );
    await advance(page, 600);
    await expect.poll(() => getSelection(page)).toEqual([]);
  });

  test('a building cannot be placed on unexplored ground', async ({ page }) => {
    await openGame(page);
    const state = await getState(page);
    const [worker] = state.entities.filter((e): e is Unit => e.kind === 'unit' && e.owner === 0);
    const at = await tileToScreen(page, worker!.x, worker!.y);
    await page.mouse.click(at.x, at.y - 4);
    await expect
      .poll(async () => (await page.evaluate(() => window.__TEST__!.getCommandPanel())).visible)
      .toBe(true);
    const panel = await page.evaluate(() => window.__TEST__!.getCommandPanel());
    const button = panel.buttons.find((b) => b.label === 'Bygg Visthus')!;
    await page.mouse.click(button.x, button.y);

    // The middle of the map: unexplored. The outline is red there.
    await page.evaluate(() => window.__TEST__!.centerCameraOnTile(32, 32));
    const viewport = page.viewportSize()!;
    await page.mouse.move(viewport.width / 2, viewport.height / 2);
    await expect
      .poll(() => page.evaluate(() => window.__TEST__!.getPlacement()))
      .toMatchObject({ building: 'visthus', valid: false });

    // The same order through the test interface is refused as well.
    const result = await page.evaluate(
      (id) =>
        window.__TEST__!.command({
          type: 'build',
          player: 0,
          unitIds: [id],
          building: 'visthus',
          x: 32,
          y: 32,
        }),
      worker!.id,
    );
    expect(result).toEqual({ ok: false, reason: 'invalidPlacement' });
  });

  test('?fog=0 turns the fog of war off in test mode', async ({ page }) => {
    await openGame(page, '&fog=0');
    const state = await getState(page);
    expect(state.fogEnabled).toBe(false);

    // The enemy Storide can be selected from the start.
    const enemyStoride = storideOf(state, 1);
    await page.evaluate(([x, y]) => window.__TEST__!.centerCameraOnTile(x, y), [
      enemyStoride.x + 1.5,
      enemyStoride.y + 1.5,
    ] as const);
    const at = await tileToScreen(page, enemyStoride.x + 1.5, enemyStoride.y + 1.5);
    await page.mouse.click(at.x, at.y);
    expect(await getSelection(page)).toEqual([enemyStoride.id]);
  });

  test('?fog=0 has no effect outside test mode', async ({ page }) => {
    // Without ?test=1 there is no test interface to ask, so the picture has to
    // tell: with the fog on, far less of the screen shows the green ground.
    const greenShare = async (url: string): Promise<number> => {
      await page.goto(url);
      await expect(page.locator('#game canvas')).toBeVisible();
      await page.waitForTimeout(800);
      const shot = await page.screenshot();
      return page.evaluate(async (base64) => {
        const image = new Image();
        image.src = `data:image/png;base64,${base64}`;
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        const context = canvas.getContext('2d')!;
        context.drawImage(image, 0, 0);
        const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
        let green = 0;
        for (let i = 0; i < data.length; i += 4) {
          // The bright grass green of ground in sight.
          if (
            data[i + 1]! > 120 &&
            data[i + 1]! > data[i]! + 30 &&
            data[i + 1]! > data[i + 2]! + 30
          ) {
            green++;
          }
        }
        return green / (data.length / 4);
      }, shot.toString('base64'));
    };

    const withoutFog = await greenShare('./?test=1&fog=0');
    const ignored = await greenShare('./?fog=0');
    expect(await page.evaluate(() => window.__TEST__)).toBeUndefined();
    const withFog = await greenShare('./?test=1');

    expect(withoutFog).toBeGreaterThan(0.4);
    // Outside test mode ?fog=0 changes nothing: the picture matches the foggy one.
    expect(ignored).toBeLessThan(withoutFog * 0.6);
    expect(Math.abs(ignored - withFog)).toBeLessThan(0.03);
  });
});
