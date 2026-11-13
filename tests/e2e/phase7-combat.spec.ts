import { expect, test, type Page } from '@playwright/test';
import { BUILDING_DEFS } from '../../src/data/buildings';
import type { Building, GameState, Unit } from '../../src/sim/state';
import { getSelection, getState, openGame, tileToScreen, trackConsoleErrors } from './helpers';

const advance = (page: Page, steps: number) =>
  page.evaluate((n) => window.__TEST__!.advance(n), steps);
const outcome = (page: Page) => page.evaluate(() => window.__TEST__!.getOutcome());

const storideOf = (state: GameState, owner: number) =>
  state.entities.find(
    (e): e is Building => e.kind === 'building' && e.type === 'storide' && e.owner === owner,
  )!;

/**
 * Tiles around a side's start position that are certain to be open grass:
 * within the four tiles map generation keeps clear, off the Storide (which
 * covers one tile each way from the start position) and off the tiles in
 * front of it where the side's own units start.
 */
function tilesBehindBase(state: GameState, owner: number): { x: number; y: number }[] {
  const start = state.map.startPositions[owner]!;
  return [
    [-3, 0],
    [-3, 1],
    [-3, -1],
    [-2, -3],
    [-1, -3],
    [0, -3],
    [1, -3],
    [2, -3],
  ].map(([dx, dy]) => ({ x: start.x + dx!, y: start.y + dy! }));
}

/**
 * Open grass tiles near `near` with nothing on them, each at least `apart`
 * tiles from every unit of side `awayFrom`, nearest first. Idle soldiers
 * attack enemy units they notice within six tiles, so a test that wants its
 * soldiers to stand still has to put them further away than that.
 */
function quietTiles(
  state: GameState,
  near: { x: number; y: number },
  awayFrom: number,
  apart: number,
  count: number,
): { x: number; y: number }[] {
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
  const others = state.entities.filter((e) => e.kind === 'unit' && e.owner === awayFrom);
  const found: { x: number; y: number; distance: number }[] = [];
  for (let y = 0; y < state.map.height; y++) {
    for (let x = 0; x < state.map.width; x++) {
      if (state.map.terrain[y * state.map.width + x] !== 'grass') continue;
      if (occupied.has(`${x},${y}`)) continue;
      if (others.some((u) => Math.hypot(u.x - (x + 0.5), u.y - (y + 0.5)) < apart)) continue;
      found.push({ x, y, distance: Math.hypot(x - near.x, y - near.y) });
    }
  }
  found.sort((a, b) => a.distance - b.distance);
  expect(found.length).toBeGreaterThanOrEqual(count);
  return found.slice(0, count).map(({ x, y }) => ({ x, y }));
}

/** Puts eight Ramkrigare of `owner` next to the other side's Storide. */
async function spawnArmyAtEnemyBase(page: Page, owner: 0 | 1): Promise<number[]> {
  const state = await getState(page);
  const tiles = tilesBehindBase(state, owner === 0 ? 1 : 0);
  return page.evaluate(
    ([who, where]) => where.map((t) => window.__TEST__!.spawnUnit('ramkrigare', who, t.x, t.y)),
    [owner, tiles] as const,
  );
}

test.describe('phase 7: combat, surrender, victory and defeat', () => {
  test('soldiers ordered onto the enemy Storide with the mouse bring victory', async ({ page }) => {
    const errors = trackConsoleErrors(page);
    // A passive opponent: this test is about the mechanics, not the computer player.
    await openGame(page, '&ai=0');
    const state = await getState(page);
    const enemyStoride = storideOf(state, 1);
    // Eight soldiers near the enemy base, but too far from its workers to go for them unasked.
    const tiles = quietTiles(state, state.map.startPositions[1]!, 1, 8, 8);
    const ids = await page.evaluate(
      (where) => where.map((t) => window.__TEST__!.spawnUnit('ramkrigare', 0, t.x, t.y)),
      tiles,
    );
    await page.evaluate(([x, y]) => window.__TEST__!.centerCameraOnTile(x, y), [
      enemyStoride.x + 1.5,
      enemyStoride.y + 1.5,
    ] as const);
    await page.evaluate(() => window.__TEST__!.advance(5));
    const army = (await getState(page)).entities.filter((e): e is Unit => ids.includes(e.id));
    expect(army.every((u) => u.task.kind === 'idle')).toBe(true);

    // Select the whole army with a drag box.
    const points = await Promise.all(army.map((u) => tileToScreen(page, u.x, u.y)));
    const left = Math.min(...points.map((p) => p.x)) - 25;
    const right = Math.max(...points.map((p) => p.x)) + 25;
    const top = Math.min(...points.map((p) => p.y)) - 30;
    const bottom = Math.max(...points.map((p) => p.y)) + 20;
    await page.mouse.move(left, top);
    await page.mouse.down();
    await page.mouse.move((left + right) / 2, (top + bottom) / 2, { steps: 4 });
    await page.mouse.move(right, bottom, { steps: 4 });
    await page.mouse.up();
    expect(await getSelection(page)).toEqual([...ids].sort((a, b) => a - b));

    // Right-click the roof of the Storide: an attack order with a ring.
    const roof = await tileToScreen(page, enemyStoride.x + 1.5, enemyStoride.y + 1.5);
    await page.mouse.click(roof.x, roof.y - 30, { button: 'right' });
    const ordered = (await getState(page)).entities.filter((e): e is Unit => ids.includes(e.id));
    for (const unit of ordered) {
      expect(unit.task).toMatchObject({ kind: 'attack', targetId: enemyStoride.id });
    }
    expect(await page.evaluate(() => window.__TEST__!.getOrderMarkerCount())).toBe(1);
    expect((await outcome(page)).visible).toBe(false);

    // A walk of some ten tiles, then 1500 life at eight strikes of 10 every 1.2 seconds.
    await advance(page, 1000);

    const won = await getState(page);
    expect(won.winner).toBe(0);
    expect(storideOf(won, 1)).toBeUndefined();
    await expect
      .poll(() => outcome(page))
      .toMatchObject({ visible: true, title: 'Seger', button: { label: 'Spela igen' } });
    // The collapse happened in view, so the screen shook.
    expect(await page.evaluate(() => window.__TEST__!.getShakeCount())).toBe(1);

    // The simulation stands still.
    await advance(page, 50);
    await page.waitForTimeout(300);
    expect((await getState(page)).tick).toBe(won.tick);
    expect(errors).toEqual([]);
  });

  test('"Spela igen" starts a new game', async ({ page }) => {
    await openGame(page);
    const ids = await spawnArmyAtEnemyBase(page, 0);
    const target = storideOf(await getState(page), 1);
    await page.evaluate(
      ([unitIds, targetId]) =>
        window.__TEST__!.command({ type: 'attack', player: 0, unitIds: [...unitIds], targetId }),
      [ids, target.id] as const,
    );
    await advance(page, 700);
    await expect.poll(async () => (await outcome(page)).visible).toBe(true);

    const { button } = await outcome(page);
    await page.mouse.click(button.x, button.y);

    await page.waitForFunction(() => {
      const t = window.__TEST__;
      return t?.ready === true && t.getState().winner === null && !t.getOutcome().visible;
    });
    const fresh = await getState(page);
    expect(storideOf(fresh, 1).hp).toBe(BUILDING_DEFS.storide.hp);
    expect(fresh.entities.filter((e) => e.kind === 'unit' && e.type === 'ramkrigare')).toEqual([]);
  });

  test("enemy soldiers on the player's Storide warn the player and bring defeat", async ({
    page,
  }) => {
    const errors = trackConsoleErrors(page);
    await openGame(page);
    const ids = await spawnArmyAtEnemyBase(page, 1);
    const mine = storideOf(await getState(page), 0);
    expect(await page.evaluate(() => window.__TEST__!.getAlert())).toBe('');

    const result = await page.evaluate(
      ([unitIds, targetId]) =>
        window.__TEST__!.command({ type: 'attack', player: 1, unitIds: [...unitIds], targetId }),
      [ids, mine.id] as const,
    );
    expect(result).toEqual({ ok: true });

    // The first strikes land within a couple of seconds.
    await advance(page, 60);
    expect(storideOf(await getState(page), 0).hp).toBeLessThan(BUILDING_DEFS.storide.hp);
    await expect
      .poll(() => page.evaluate(() => window.__TEST__!.getAlert()))
      .toBe('Din bas anfalls!');

    await advance(page, 700);
    expect((await getState(page)).winner).toBe(1);
    await expect.poll(() => outcome(page)).toMatchObject({ visible: true, title: 'Nederlag' });
    // The camera starts at the player's base, so the collapse was in view.
    expect(await page.evaluate(() => window.__TEST__!.getShakeCount())).toBe(1);
    expect(errors).toEqual([]);
  });

  test("a beaten unit surrenders, walks to its side's cave and goes in", async ({ page }) => {
    const errors = trackConsoleErrors(page);
    // A passive opponent: this test is about the mechanics, not the computer player.
    await openGame(page, '&ai=0');
    const state = await getState(page);
    const victim = state.entities.find((e): e is Unit => e.kind === 'unit' && e.owner === 1)!;
    // One soldier on the open tile beside the enemy worker's Storide.
    const [tile] = tilesBehindBase(state, 1);
    const soldier = await page.evaluate(
      ([x, y]) => window.__TEST__!.spawnUnit('ramkrigare', 0, x, y),
      [tile!.x, tile!.y] as const,
    );
    await page.evaluate(
      ([id, targetId]) =>
        window.__TEST__!.command({ type: 'attack', player: 0, unitIds: [id], targetId }),
      [soldier, victim.id] as const,
    );

    // Four strikes take 73 steps once the soldier has walked round the Storide.
    await advance(page, 250);
    const during = await getState(page);
    const fleeing = during.entities.find((e) => e.id === victim.id) as Unit | undefined;
    // Either still on its way with a white flag, or already inside.
    if (fleeing) {
      expect(fleeing.task.kind).toBe('flee');
      expect(fleeing.hp).toBe(0);
    }

    await advance(page, 900);
    const after = await getState(page);
    expect(after.entities.find((e) => e.id === victim.id)).toBeUndefined();
    // With the first worker beaten the soldier turns on the others it can see,
    // so by now every enemy worker that is gone from the map sits in a cave.
    const left = after.entities.filter((e) => e.kind === 'unit' && e.owner === 1).length;
    const mine = after.map.caves.filter((c) => c.owner === 1);
    const inside = mine.flatMap((c) => c.occupants);
    expect(inside.length).toBeGreaterThanOrEqual(1);
    expect(inside.length).toBe(3 - left);
    expect(inside.every((type) => type === 'samlare')).toBe(true);
    expect(mine.reduce((sum, c) => sum + c.reserved, 0)).toBe(0);
    // Nothing went into the player's caves.
    expect(after.map.caves.filter((c) => c.owner === 0).flatMap((c) => c.occupants)).toEqual([]);
    expect(after.winner).toBeNull();
    expect(errors).toEqual([]);
  });

  test('right-clicking an enemy unit orders an attack', async ({ page }) => {
    // A passive opponent: this test is about the mechanics, not the computer player.
    await openGame(page, '&ai=0');
    const start = (await getState(page)).map.startPositions[0]!;
    // Both on tiles map generation keeps clear, seven tiles apart: too far for
    // the soldier to notice the worker by itself.
    const mineAt = { x: start.x - 3, y: start.y };
    const enemyAt = { x: start.x + 4, y: start.y };
    const mine = await page.evaluate(
      ([x, y]) => window.__TEST__!.spawnUnit('ramkrigare', 0, x, y),
      [mineAt.x, mineAt.y] as const,
    );
    const enemy = await page.evaluate(([x, y]) => window.__TEST__!.spawnUnit('samlare', 1, x, y), [
      enemyAt.x,
      enemyAt.y,
    ] as const);

    const soldierAt = await tileToScreen(page, mineAt.x + 0.5, mineAt.y + 0.5);
    await page.mouse.click(soldierAt.x, soldierAt.y - 4);
    expect(await getSelection(page)).toEqual([mine]);
    await advance(page, 20);
    const idle = (await getState(page)).entities.find((e) => e.id === mine) as Unit;
    expect(idle.task).toEqual({ kind: 'idle' });

    const enemyScreen = await tileToScreen(page, enemyAt.x + 0.5, enemyAt.y + 0.5);
    await page.mouse.click(enemyScreen.x, enemyScreen.y - 4, { button: 'right' });

    const soldier = (await getState(page)).entities.find((e) => e.id === mine) as Unit;
    expect(soldier.task).toMatchObject({ kind: 'attack', targetId: enemy });
    expect(await page.evaluate(() => window.__TEST__!.getOrderMarkerCount())).toBe(1);
    await expect
      .poll(async () => (await page.evaluate(() => window.__TEST__!.getHud())).detail)
      .toBe('Liv 100/100 · Anfaller');
  });

  test('every side has two caves, and the caves start empty', async ({ page }) => {
    await openGame(page);
    const { map } = await getState(page);
    expect(map.caves).toHaveLength(4);
    for (const owner of [0, 1]) {
      const own = map.caves.filter((c) => c.owner === owner);
      expect(own).toHaveLength(2);
      for (const cave of own) {
        expect(map.terrain[cave.y * map.width + cave.x]).toBe('cave');
        expect(cave).toMatchObject({ occupants: [], reserved: 0 });
      }
    }
  });
});
