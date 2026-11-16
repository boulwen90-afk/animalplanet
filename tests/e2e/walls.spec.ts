import { expect, test, type Page } from '@playwright/test';
import { BUILDING_DEFS } from '../../src/data/buildings';
import { SIM_CONFIG } from '../../src/data/sim';
import { START_CONFIG } from '../../src/data/setup';
import type { Building, GameState, Unit } from '../../src/sim/state';
import {
  finger,
  getSelection,
  getState,
  openBuildTab,
  openGame,
  recordFlashes,
  tileToScreen,
  trackConsoleErrors,
} from './helpers';

const WALL = BUILDING_DEFS.palissad;
const GATE = BUILDING_DEFS.port;
const SECOND = SIM_CONFIG.ticksPerSecond;
const START_WOOD = START_CONFIG.resources.wood;

type Tile = { x: number; y: number };

const piecesOf = (state: GameState, type: 'palissad' | 'port' = 'palissad') =>
  state.entities.filter((e): e is Building => e.kind === 'building' && e.type === type);
const unitOf = (state: GameState, id: number) =>
  state.entities.find((e): e is Unit => e.kind === 'unit' && e.id === id);
const workerOf = (state: GameState) =>
  state.entities.find((e): e is Unit => e.kind === 'unit' && e.owner === 0)!;

const commandPanel = (page: Page) => page.evaluate(() => window.__TEST__!.getCommandPanel());
const placement = (page: Page) => page.evaluate(() => window.__TEST__!.getPlacement());
const preview = (page: Page) => page.evaluate(() => window.__TEST__!.getPlacementPreview());
const sprite = (page: Page, id: number) =>
  page.evaluate((buildingId) => window.__TEST__!.getBuildingSprite(buildingId), id);
const advance = (page: Page, steps: number) =>
  page.evaluate((n) => window.__TEST__!.advance(n), steps);
const middleOf = (page: Page, tile: Tile) => tileToScreen(page, tile.x + 0.5, tile.y + 0.5);

/**
 * Open ground near the player's main building to build a wall on: the tile
 * with the lowest x and y of a block of grass `width` by `height` tiles with
 * nothing standing on it or right beside it. The camera is put on its middle.
 */
async function openGround(page: Page, width: number, height: number): Promise<Tile> {
  const corner = await page.evaluate(
    ([w, h]) => {
      const state = window.__TEST__!.getState();
      const home = state.entities.find((e) => e.kind === 'building' && e.owner === 0)!;
      const map = state.map;
      const free = (x: number, y: number) =>
        x >= 0 &&
        y >= 0 &&
        x < map.width &&
        y < map.height &&
        map.terrain[y * map.width + x] === 'grass' &&
        !map.caves.some((cave) => Math.abs(cave.x - x) < 3 && Math.abs(cave.y - y) < 3) &&
        !state.entities.some(
          (e) =>
            Math.abs(e.x - x) < (e.kind === 'building' ? 5 : 2) &&
            Math.abs(e.y - y) < (e.kind === 'building' ? 5 : 2),
        );
      for (let r = 3; r < 24; r++) {
        for (let dy = -r; dy <= r; dy++) {
          for (let dx = -r; dx <= r; dx++) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
            const x = home.x + dx;
            const y = home.y + dy;
            let open = true;
            for (let j = -1; j <= h && open; j++) {
              for (let i = -1; i <= w && open; i++) open = free(x + i, y + j);
            }
            if (open) return { x, y };
          }
        }
      }
      return null;
    },
    [width, height] as const,
  );
  expect(corner, 'open ground for the wall').not.toBeNull();
  await page.evaluate(([x, y]) => window.__TEST__!.centerCameraOnTile(x, y), [
    corner!.x + width / 2,
    corner!.y + height / 2,
  ] as const);
  return corner!;
}

/**
 * Selects a Samlare with a click and picks a building under the tab
 * "Försvar". The camera is put on the Samlare for the click and then back
 * where it was.
 */
async function choose(page: Page, label: string): Promise<Unit> {
  const worker = workerOf(await getState(page));
  const view = await page.evaluate(() => window.__TEST__!.camera.centerTile);
  const look = (x: number, y: number) =>
    page.evaluate(([tx, ty]) => window.__TEST__!.centerCameraOnTile(tx, ty), [x, y] as const);
  await look(worker.x, worker.y);
  const at = await tileToScreen(page, worker.x, worker.y);
  await page.mouse.click(at.x, at.y - 4);
  expect(await getSelection(page)).toEqual([worker.id]);
  await expect.poll(async () => (await commandPanel(page)).visible).toBe(true);
  await openBuildTab(page, 'Försvar');
  const button = (await commandPanel(page)).buttons.find((b) => b.label === label);
  expect(button, `button "${label}"`).toBeDefined();
  await page.mouse.click(button!.x, button!.y);
  await expect.poll(async () => (await placement(page))?.building).toBeDefined();
  await look(view.x, view.y);
  return worker;
}

/** Draws a wall out with the mouse: press on one tile, drag, and let go on another. */
async function drag(page: Page, from: Tile, to: Tile): Promise<void> {
  const a = await middleOf(page, from);
  const b = await middleOf(page, to);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 5 });
}

/** Steps the game on until every piece of wall and every gate of the player's stands finished. */
async function finishWalls(page: Page): Promise<void> {
  const done = await page.evaluate(() => {
    const t = window.__TEST__!;
    const unfinished = () =>
      t.getState().entities.some((e) => e.kind === 'building' && e.owner === 0 && !e.complete);
    for (let i = 0; i < 6000 && unfinished(); i++) t.advance(1);
    return !unfinished();
  });
  expect(done, 'the wall was finished').toBe(true);
}

/** Has the player's Samlare place a line of palisade through the test interface, and finishes it. */
async function buildWall(page: Page, from: Tile, to: Tile): Promise<Building[]> {
  const worker = workerOf(await getState(page));
  const result = await page.evaluate(
    ([id, a, b]) =>
      window.__TEST__!.command({
        type: 'buildLine',
        player: 0,
        unitIds: [id],
        building: 'palissad',
        fromX: a.x,
        fromY: a.y,
        toX: b.x,
        toY: b.y,
      }),
    [worker.id, from, to] as const,
  );
  expect(result).toEqual({ ok: true });
  await finishWalls(page);
  return piecesOf(await getState(page));
}

test.describe('the palisade', () => {
  test('is drawn out with the mouse: press, drag and let go, and a piece is built on every tile', async ({
    page,
  }) => {
    const errors = trackConsoleErrors(page);
    await openGame(page, '&ai=0&fog=0');
    const ground = await openGround(page, 7, 3);
    await choose(page, 'Bygg Palissad');

    // Under the mouse, before the button goes down: a single piece.
    const start = { x: ground.x + 1, y: ground.y + 1 };
    const end = { x: ground.x + 5, y: ground.y + 1 };
    const over = await middleOf(page, start);
    await page.mouse.move(over.x, over.y);
    await expect
      .poll(async () => (await placement(page))?.line?.map((tile) => [tile.x, tile.y, tile.state]))
      .toEqual([[start.x, start.y, 'place']]);
    expect((await placement(page))!.note).toBe('1 del · 6 trä');

    // Dragged out: five pieces in a row along x, and what they cost together.
    await drag(page, start, end);
    await expect.poll(async () => (await placement(page))?.line?.length).toBe(5);
    const drawn = (await placement(page))!;
    expect(drawn).toMatchObject({
      building: 'palissad',
      x: end.x,
      y: end.y,
      valid: true,
      note: '5 delar · 30 trä',
    });
    expect(drawn.line!.map((tile) => [tile.x, tile.y, tile.state, tile.variant])).toEqual(
      [0, 1, 2, 3, 4].map((i) => [start.x + i, start.y, 'place', 'x']),
    );
    await expect
      .poll(() => preview(page))
      .toEqual({
        texture: 'building-bear_wall-player-0',
        red: false,
        frame: 'x_complete',
        pieces: 5,
      });
    // Nothing is placed until the button comes up.
    expect(piecesOf(await getState(page))).toEqual([]);

    await page.mouse.up();
    await expect.poll(async () => piecesOf(await getState(page)).length).toBe(5);
    const state = await getState(page);
    expect(piecesOf(state).map((piece) => [piece.x, piece.y, piece.complete])).toEqual(
      [0, 1, 2, 3, 4].map((i) => [start.x + i, start.y, false]),
    );
    expect(state.players[0]!.resources.wood).toBe(START_WOOD - 5 * WALL.cost.wood!);
    expect(await placement(page)).toBeNull();

    // The Samlare builds them one after another, and each is drawn from its pictures.
    await finishWalls(page);
    const built = piecesOf(await getState(page));
    expect(built.every((piece) => piece.complete && piece.hp === WALL.hp)).toBe(true);
    for (const piece of built) {
      await expect
        .poll(() => sprite(page, piece.id))
        .toEqual({ frame: 'x_complete', texture: 'building-bear_wall-player-0' });
    }
    expect(errors).toEqual([]);
  });

  test('a click places a single piece, drawn as a block of stakes', async ({ page }) => {
    await openGame(page, '&ai=0&fog=0');
    const ground = await openGround(page, 3, 3);
    await choose(page, 'Bygg Palissad');
    const at = await middleOf(page, { x: ground.x + 1, y: ground.y + 1 });
    await page.mouse.click(at.x, at.y);
    await expect.poll(async () => piecesOf(await getState(page)).length).toBe(1);
    expect((await getState(page)).players[0]!.resources.wood).toBe(START_WOOD - WALL.cost.wood!);
    await finishWalls(page);
    const [piece] = piecesOf(await getState(page));
    expect([piece!.x, piece!.y]).toEqual([ground.x + 1, ground.y + 1]);
    await expect.poll(() => sprite(page, piece!.id)).toMatchObject({ frame: 'block_complete' });
  });

  test('two lines that meet are joined by a block at the corner', async ({ page }) => {
    await openGame(page, '&ai=0&fog=0');
    const ground = await openGround(page, 5, 5);
    const corner = { x: ground.x + 3, y: ground.y + 3 };
    await buildWall(page, { x: ground.x, y: corner.y }, corner);
    const pieces = await buildWall(page, corner, { x: corner.x, y: ground.y });
    expect(pieces).toHaveLength(7);
    const frames: Record<string, string> = {};
    for (const piece of pieces)
      frames[`${piece.x},${piece.y}`] = (await sprite(page, piece.id))!.frame;
    expect(frames[`${corner.x},${corner.y}`]).toBe('block_complete');
    expect(frames[`${ground.x},${corner.y}`]).toBe('x_complete');
    expect(frames[`${corner.x - 1},${corner.y}`]).toBe('x_complete');
    expect(frames[`${corner.x},${ground.y}`]).toBe('y_complete');
    expect(frames[`${corner.x},${corner.y - 1}`]).toBe('y_complete');
  });

  test('shows red where something is in the way, and builds around it', async ({ page }) => {
    await openGame(page, '&ai=0&fog=0');
    const ground = await openGround(page, 6, 3);
    // An enemy stands on the line.
    await page.evaluate(([x, y]) => window.__TEST__!.spawnUnit('samlare', 1, x, y), [
      ground.x + 3,
      ground.y + 1,
    ] as const);
    await choose(page, 'Bygg Palissad');
    await drag(page, { x: ground.x + 1, y: ground.y + 1 }, { x: ground.x + 5, y: ground.y + 1 });
    await expect
      .poll(async () => (await placement(page))?.line?.map((tile) => tile.state))
      .toEqual(['place', 'place', 'blocked', 'place', 'place']);
    expect((await placement(page))!.note).toBe('4 delar · 24 trä');
    expect((await preview(page))!.pieces).toBe(4);
    await page.mouse.up();
    await expect.poll(async () => piecesOf(await getState(page)).length).toBe(4);
    expect((await getState(page)).players[0]!.resources.wood).toBe(
      START_WOOD - 4 * WALL.cost.wood!,
    );
  });

  test('is refused with a red wood figure when the line costs more than the player has', async ({
    page,
  }) => {
    await openGame(page, '&ai=0&fog=0');
    const ground = await openGround(page, 20, 2);
    const flashed = await recordFlashes(page);
    await choose(page, 'Bygg Palissad');
    // Twenty pieces at 6 wood, with 100 in stock.
    await drag(page, { x: ground.x, y: ground.y }, { x: ground.x + 19, y: ground.y });
    await expect.poll(async () => (await placement(page))?.note).toBe('20 delar · 120 trä');
    await page.mouse.up();
    await expect.poll(flashed).toEqual(['wood']);
    const state = await getState(page);
    expect(piecesOf(state)).toEqual([]);
    expect(state.players[0]!.resources.wood).toBe(START_WOOD);
    expect(await placement(page)).toBeNull();
  });

  test('right click takes back a wall that is being drawn out', async ({ page }) => {
    await openGame(page, '&ai=0&fog=0');
    const ground = await openGround(page, 6, 3);
    await choose(page, 'Bygg Palissad');
    await drag(page, { x: ground.x + 1, y: ground.y + 1 }, { x: ground.x + 4, y: ground.y + 1 });
    await expect.poll(async () => (await placement(page))?.line?.length).toBe(4);
    // The right button goes down while the left one is still held.
    await page.mouse.down({ button: 'right' });
    await expect.poll(() => placement(page)).toBeNull();
    await page.mouse.up({ button: 'right' });
    await page.mouse.up();
    // Nothing was placed, and nothing paid.
    const state = await getState(page);
    expect(piecesOf(state)).toEqual([]);
    expect(state.players[0]!.resources.wood).toBe(START_WOOD);
  });
});

test.describe('the palisade on a touch screen', () => {
  test.use({ hasTouch: true });

  test('is drawn with taps: one where it starts, one where it ends, and one on the line builds it', async ({
    page,
  }) => {
    await openGame(page, '&ai=0&fog=0');
    const ground = await openGround(page, 6, 4);
    const touch = await finger(page);
    const worker = workerOf(await getState(page));
    const at = await tileToScreen(page, worker.x, worker.y);
    await touch.tap(at.x, at.y - 4);
    await expect.poll(async () => (await commandPanel(page)).visible).toBe(true);
    const tab = (await commandPanel(page)).tabs.find((t) => t.label === 'Försvar')!;
    await touch.tap(tab.x, tab.y);
    await expect.poll(async () => (await commandPanel(page)).tabs[2]!.active).toBe(true);
    const button = (await commandPanel(page)).buttons.find((b) => b.label === 'Bygg Palissad')!;
    await touch.tap(button.x, button.y);

    // Nothing is drawn until the first tap: a few words say what to do.
    await expect
      .poll(() => placement(page))
      .toMatchObject({ building: 'palissad', valid: false, note: 'Tryck där muren ska börja' });
    expect((await placement(page))!.line).toEqual([]);

    const start = { x: ground.x + 1, y: ground.y + 1 };
    const first = { x: ground.x + 3, y: ground.y + 1 };
    const end = { x: ground.x + 4, y: ground.y + 1 };
    const tap = async (tile: Tile) => {
      const on = await middleOf(page, tile);
      await touch.tap(on.x, on.y);
    };
    await tap(start);
    await expect.poll(async () => (await placement(page))?.note).toBe('1 del · 6 trä');
    await tap(first);
    await expect.poll(async () => (await placement(page))?.note).toBe('3 delar · 18 trä');
    // A tap off the line moves its end.
    await tap(end);
    await expect.poll(async () => (await placement(page))?.note).toBe('4 delar · 24 trä');
    expect(piecesOf(await getState(page))).toEqual([]);
    // A tap on the line builds it.
    await tap({ x: ground.x + 2, y: ground.y + 1 });
    await expect.poll(async () => piecesOf(await getState(page)).length).toBe(4);
    expect(await placement(page)).toBeNull();
  });
});

test.describe('the gate', () => {
  test('is put into the wall with a click: the piece there is replaced, and the gate turns with the wall', async ({
    page,
  }) => {
    const errors = trackConsoleErrors(page);
    await openGame(page, '&ai=0&fog=0');
    const ground = await openGround(page, 3, 7);
    const x = ground.x + 1;
    await buildWall(page, { x, y: ground.y }, { x, y: ground.y + 6 });
    const wood = (await getState(page)).players[0]!.resources.wood;

    await choose(page, 'Bygg Port');
    const spot = { x, y: ground.y + 3 };
    const on = await middleOf(page, spot);
    await page.mouse.move(on.x, on.y);
    // It may stand on the piece of the player's own wall: green, and turned to stand in a wall along y.
    await expect
      .poll(() => placement(page))
      .toMatchObject({ building: 'port', x: spot.x, y: spot.y, valid: true, variant: 'y' });
    await expect
      .poll(() => preview(page))
      .toMatchObject({ texture: 'building-bear_gate-player-0', red: false, frame: 'y_complete' });
    await page.mouse.click(on.x, on.y);
    await expect.poll(async () => piecesOf(await getState(page), 'port').length).toBe(1);

    const state = await getState(page);
    expect(piecesOf(state)).toHaveLength(6);
    expect(piecesOf(state).some((piece) => piece.y === spot.y)).toBe(false);
    expect(state.players[0]!.resources.wood).toBe(wood - GATE.cost.wood!);
    await finishWalls(page);
    const [gate] = piecesOf(await getState(page), 'port');
    expect(gate).toMatchObject({ x: spot.x, y: spot.y, complete: true, hp: GATE.hp });
    await expect
      .poll(() => sprite(page, gate!.id))
      .toEqual({ frame: 'y_complete', texture: 'building-bear_gate-player-0' });
    expect(errors).toEqual([]);
  });

  test('lets the player`s own soldier through and keeps the enemy`s out', async ({ page }) => {
    await openGame(page, '&ai=0&fog=0');
    const ground = await openGround(page, 9, 7);
    const x = ground.x + 4;
    const row = ground.y + 3;
    await buildWall(page, { x, y: ground.y }, { x, y: ground.y + 6 });
    const worker = workerOf(await getState(page));
    const placed = await page.evaluate(
      ([id, gx, gy]) =>
        window.__TEST__!.command({
          type: 'build',
          player: 0,
          unitIds: [id],
          building: 'port',
          x: gx,
          y: gy,
        }),
      [worker.id, x, row] as const,
    );
    expect(placed).toEqual({ ok: true });
    await finishWalls(page);

    // One soldier of each side on the same side of the wall, sent straight across it.
    const ids = await page.evaluate(
      ([gx, gy, wx]) => {
        const t = window.__TEST__!;
        const own = t.spawnUnit('ramkrigare', 0, gx + 1, gy + 2);
        const foe = t.spawnUnit('ramkrigare', 1, gx + 1, gy + 4);
        t.command({ type: 'move', player: 0, unitIds: [own], x: wx + 3, y: gy + 3 });
        t.command({ type: 'move', player: 1, unitIds: [foe], x: wx + 3, y: gy + 3 });
        // Which of the two is ever on the gate's tile.
        const through: number[] = [];
        for (let i = 0; i < 200; i++) {
          t.advance(1);
          for (const unit of t.getState().entities) {
            if (unit.id !== own && unit.id !== foe) continue;
            if (Math.floor(unit.x) === wx && Math.floor(unit.y) === gy + 3) through.push(unit.id);
          }
        }
        return { own, foe, through: [...new Set(through)] };
      },
      [ground.x, ground.y, x] as const,
    );
    const state = await getState(page);
    // The player's soldier went through the gate and is across.
    expect(ids.through).toEqual([ids.own]);
    expect(unitOf(state, ids.own)!.x).toBeGreaterThan(x + 1);
    // The enemy's did not: it is still on the side it came from, or on its way round the wall.
    const foe = unitOf(state, ids.foe)!;
    expect(Math.floor(foe.x) === x && Math.floor(foe.y) === row).toBe(false);
  });
});

test.describe('walls and the way units walk', () => {
  test('a soldier whose way is walled off while it walks goes round the wall, never through it', async ({
    page,
  }) => {
    await openGame(page, '&ai=0&fog=0');
    const ground = await openGround(page, 11, 9);
    const row = ground.y + 4;
    const x = ground.x + 5;
    const worker = workerOf(await getState(page));
    const walk = await page.evaluate(
      ([gx, gy, wx, id]) => {
        const t = window.__TEST__!;
        const soldier = t.spawnUnit('ramkrigare', 0, gx, gy);
        t.command({ type: 'move', player: 0, unitIds: [soldier], x: gx + 10, y: gy });
        t.advance(10);
        // A wall right across its way, open at both ends of the open ground.
        const result = t.command({
          type: 'buildLine',
          player: 0,
          unitIds: [id],
          building: 'palissad',
          fromX: wx,
          fromY: gy - 3,
          toX: wx,
          toY: gy + 3,
        });
        const walls = new Set(
          t
            .getState()
            .entities.filter((e) => e.type === 'palissad')
            .map((e) => `${e.x},${e.y}`),
        );
        let inside = false;
        for (let i = 0; i < 400; i++) {
          t.advance(1);
          const unit = t.getState().entities.find((e) => e.id === soldier)!;
          if (walls.has(`${Math.floor(unit.x)},${Math.floor(unit.y)}`)) inside = true;
        }
        const unit = t.getState().entities.find((e) => e.id === soldier)!;
        return { result, pieces: walls.size, inside, x: unit.x, y: unit.y, soldier };
      },
      [ground.x, row, x, worker.id] as const,
    );
    expect(walk.result).toEqual({ ok: true });
    expect(walk.pieces).toBe(7);
    expect(walk.inside).toBe(false);
    // It got to where it was sent, on the far side of the wall.
    expect([Math.floor(walk.x), Math.floor(walk.y)]).toEqual([ground.x + 10, row]);
  });

  test('a piece of wall that is attacked smokes, falls, and leaves the way open', async ({
    page,
  }) => {
    await openGame(page, '&ai=0&fog=0');
    const ground = await openGround(page, 7, 5);
    const x = ground.x + 3;
    const pieces = await buildWall(page, { x, y: ground.y }, { x, y: ground.y + 4 });
    const target = pieces.find((piece) => piece.y === ground.y + 2)!;
    await page.evaluate(([id, life]) => window.__TEST__!.setLife(id, life), [
      target.id,
      WALL.hp * 0.4,
    ] as const);
    await expect
      .poll(() => page.evaluate((id) => window.__TEST__!.getBuildingDamage(id), target.id))
      .toMatchObject({ level: 'smoke' });
    const foe = await page.evaluate(
      ([fx, fy, id]) => {
        const t = window.__TEST__!;
        const unit = t.spawnUnit('ramkrigare', 1, fx, fy);
        t.command({ type: 'attack', player: 1, unitIds: [unit], targetId: id });
        return unit;
      },
      [x + 2, ground.y + 2, target.id] as const,
    );
    await advance(page, 20 * SECOND);
    const state = await getState(page);
    expect(piecesOf(state)).toHaveLength(4);
    expect(piecesOf(state).some((piece) => piece.id === target.id)).toBe(false);
    // The pieces on either side of the hole are ends of a row now, and still rows.
    expect(unitOf(state, foe)).toBeDefined();
  });
});
