import { expect, test, type Page } from '@playwright/test';
import { BUILDING_DEFS } from '../../src/data/buildings';
import type { Building, GameState, Unit } from '../../src/sim/state';
import { getSelection, getState, openGame, tileToScreen, trackConsoleErrors } from './helpers';

const building = (page: Page, id: number) =>
  page.evaluate((buildingId) => window.__TEST__!.getBuildingSprite(buildingId), id);
const unit = (page: Page, id: number) =>
  page.evaluate((unitId) => window.__TEST__!.getUnitSprite(unitId), id);
const storideOf = (state: GameState, owner: number) =>
  state.entities.find(
    (e): e is Building => e.kind === 'building' && e.type === 'storide' && e.owner === owner,
  )!;
const workerOf = (state: GameState, owner: number) =>
  state.entities.find(
    (e): e is Unit => e.kind === 'unit' && e.type === 'samlare' && e.owner === owner,
  )!;

test.describe('buildings drawn from pictures', () => {
  test("each side's Storide is the finished main building in its colour", async ({ page }) => {
    const errors = trackConsoleErrors(page);
    await openGame(page, '&ai=0&fog=0');
    const state = await getState(page);
    expect(await building(page, storideOf(state, 0).id)).toEqual({
      frame: 'complete',
      texture: 'building-bear_main-player-0',
    });
    expect(await building(page, storideOf(state, 1).id)).toEqual({
      frame: 'complete',
      texture: 'building-bear_main-player-1',
    });
    expect(errors).toEqual([]);
  });

  test('a Visthus shows its frame, then its walls, then the finished house as it is built', async ({
    page,
  }) => {
    const errors = trackConsoleErrors(page);
    await openGame(page, '&ai=0&fog=0');
    const state = await getState(page);
    const home = storideOf(state, 0);
    const worker = workerOf(state, 0);
    // The first free place for it near the base.
    const placed = await page.evaluate(
      ([id, hx, hy]) => {
        const t = window.__TEST__!;
        for (let r = 4; r < 10; r++) {
          for (let dy = -r; dy <= r; dy++) {
            for (let dx = -r; dx <= r; dx++) {
              const result = t.command({
                type: 'build',
                player: 0,
                unitIds: [id],
                building: 'visthus',
                x: hx + dx,
                y: hy + dy,
              });
              if (result.ok) return true;
            }
          }
        }
        return false;
      },
      [worker.id, home.x, home.y] as const,
    );
    expect(placed).toBe(true);
    const site = (await getState(page)).entities.find(
      (e): e is Building => e.kind === 'building' && e.type === 'visthus',
    )!;
    await page.evaluate(([x, y]) => window.__TEST__!.centerCameraOnTile(x, y), [
      site.x,
      site.y,
    ] as const);
    await expect
      .poll(() => building(page, site.id))
      .toMatchObject({
        frame: 'construction_1',
        texture: 'building-bear_storage-player-0',
      });

    // Step through the build and note each picture it shows.
    const seen = await page.evaluate(async (id) => {
      const t = window.__TEST__!;
      const frames: string[] = [];
      for (let step = 0; step < 1500; step++) {
        t.advance(2);
        // Let the display catch up with the simulation.
        await new Promise((resolve) => requestAnimationFrame(resolve));
        const frame = t.getBuildingSprite(id)?.frame;
        if (frame && frames.at(-1) !== frame) frames.push(frame);
        if (frame === 'complete') break;
      }
      return frames;
    }, site.id);
    expect(seen).toEqual(['construction_1', 'construction_2', 'complete']);
    expect(errors).toEqual([]);
  });

  test('a click on the roof of a building selects it', async ({ page }) => {
    await openGame(page, '&ai=0&fog=0');
    const home = storideOf(await getState(page), 0);
    const half = BUILDING_DEFS.storide.size / 2;
    await page.evaluate(([x, y]) => window.__TEST__!.centerCameraOnTile(x, y), [
      home.x + half,
      home.y + half,
    ] as const);
    const centre = await tileToScreen(page, home.x + half, home.y + half);
    // 70 pixels above the middle of its footprint: on the roof.
    await page.mouse.click(centre.x, centre.y - 70);
    expect(await getSelection(page)).toEqual([home.id]);
    // Far above the roof there is only ground behind the building.
    await page.mouse.click(centre.x, centre.y - 200);
    expect(await getSelection(page)).toEqual([]);
  });

  test('a unit behind a building is drawn faintly on top of it, and normally again in front', async ({
    page,
  }) => {
    await openGame(page, '&ai=0&fog=0');
    const state = await getState(page);
    const home = storideOf(state, 0);
    const worker = workerOf(state, 0);
    await page.evaluate(([x, y]) => window.__TEST__!.centerCameraOnTile(x, y), [
      home.x,
      home.y,
    ] as const);
    expect((await unit(page, worker.id))!.behindBuilding).toBe(false);

    // Just behind the far corner of the footprint.
    await page.evaluate(
      ([id, x, y]) => window.__TEST__!.command({ type: 'move', player: 0, unitIds: [id], x, y }),
      [worker.id, home.x - 1, home.y - 1] as const,
    );
    const arrived = await page.evaluate(
      ([id, x, y]) => {
        const t = window.__TEST__!;
        for (let step = 0; step < 600; step++) {
          t.advance(1);
          const u = t.getState().entities.find((e) => e.id === id);
          if (
            u?.kind === 'unit' &&
            Math.floor(u.x) === x &&
            Math.floor(u.y) === y &&
            !u.path.length
          )
            return true;
        }
        return false;
      },
      [worker.id, home.x - 1, home.y - 1] as const,
    );
    expect(arrived).toBe(true);
    await expect.poll(async () => (await unit(page, worker.id))!.behindBuilding).toBe(true);

    // And out in front again.
    const size = BUILDING_DEFS.storide.size;
    await page.evaluate(
      ([id, x, y]) => window.__TEST__!.command({ type: 'move', player: 0, unitIds: [id], x, y }),
      [worker.id, home.x + size + 1, home.y + size + 1] as const,
    );
    await page.evaluate(() => window.__TEST__!.advance(400));
    await expect.poll(async () => (await unit(page, worker.id))!.behindBuilding).toBe(false);
  });
});
