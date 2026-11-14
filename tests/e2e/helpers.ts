import { expect, type Page } from '@playwright/test';
import type { BuildingType } from '../../src/data/buildings';
import { MAP_CONFIG } from '../../src/data/map';
import type { GameState } from '../../src/sim/state';
import type { TestCameraInfo } from '../../src/testing/testHooks';

/** Collects console errors and uncaught exceptions for the lifetime of the page. */
export function trackConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(String(error)));
  return errors;
}

/**
 * Slows the browser down by the factor in E2E_CPU_THROTTLE, to reproduce the
 * low frame rates of CI machines: `E2E_CPU_THROTTLE=8 npm run e2e`.
 */
async function throttleCpu(page: Page): Promise<void> {
  const rate = Number(process.env.E2E_CPU_THROTTLE ?? 1);
  if (!(rate > 1)) return;
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate });
}

/**
 * Opens the game in test mode and waits until it is running. The start
 * screen is skipped unless `startScreen` is set.
 */
export async function openGame(
  page: Page,
  query = '',
  options: { startScreen?: boolean } = {},
): Promise<void> {
  await throttleCpu(page);
  await page.goto(`./?test=1${options.startScreen ? '' : '&start=0'}${query}`);
  await page.waitForFunction(() => window.__TEST__?.ready === true);
}

export async function getCamera(page: Page): Promise<TestCameraInfo> {
  const camera = await page.evaluate(() => {
    const c = window.__TEST__?.camera;
    return c ? { ...c, centerTile: { ...c.centerTile } } : undefined;
  });
  expect(camera, 'window.__TEST__.camera').toBeDefined();
  return camera as TestCameraInfo;
}

/** The centre of the view must always be on the map. */
/** A copy of the complete game state. */
export async function getState(page: Page): Promise<GameState> {
  return page.evaluate(() => window.__TEST__!.getState());
}

/**
 * Moves the camera to the middle of the map, where there is room to pan in
 * every direction. The game itself starts at the player's base, near a corner.
 */
export async function centerCameraOnMapMiddle(page: Page): Promise<void> {
  await page.evaluate(([x, y]) => window.__TEST__!.centerCameraOnTile(x, y), [
    MAP_CONFIG.width / 2,
    MAP_CONFIG.height / 2,
  ] as const);
}

/** Screen position of a point in tile coordinates (see TestApi.tileToScreen). */
export async function tileToScreen(
  page: Page,
  tileX: number,
  tileY: number,
): Promise<{ x: number; y: number }> {
  return page.evaluate(([x, y]) => window.__TEST__!.tileToScreen(x, y), [tileX, tileY] as const);
}

export async function getSelection(page: Page): Promise<number[]> {
  const ids = await page.evaluate(() => window.__TEST__!.getSelection());
  return ids.sort((a, b) => a - b);
}

export function expectCameraOnMap(camera: TestCameraInfo): void {
  const { centerTile } = camera;
  // A little slack for floating point rounding.
  expect(centerTile.x).toBeGreaterThanOrEqual(-0.01);
  expect(centerTile.y).toBeGreaterThanOrEqual(-0.01);
  expect(centerTile.x).toBeLessThanOrEqual(MAP_CONFIG.width + 0.01);
  expect(centerTile.y).toBeLessThanOrEqual(MAP_CONFIG.height + 0.01);
}

/**
 * Measures how fast the camera is moving right now, in pixels per second of
 * game time. Call it while a pan input is held. Because it compares against
 * the game's own clock, the result does not depend on the machine's frame rate.
 */
export async function measurePanSpeed(page: Page): Promise<{ x: number; y: number }> {
  const sample = () =>
    page.evaluate(() => {
      const t = window.__TEST__!;
      return { x: t.camera.x, y: t.camera.y, elapsedMs: t.elapsedMs };
    });

  // Wait until the pan is under way, so both samples are taken while it is held.
  const idle = await sample();
  await page.waitForFunction((s) => {
    const c = window.__TEST__!.camera;
    return c.x !== s.x || c.y !== s.y;
  }, idle);

  const start = await sample();
  await page.waitForFunction((t) => window.__TEST__!.elapsedMs >= t + 300, start.elapsedMs);
  const end = await sample();

  const seconds = (end.elapsedMs - start.elapsedMs) / 1000;
  return { x: (end.x - start.x) / seconds, y: (end.y - start.y) / seconds };
}

/** One emulated finger. Needs `test.use({ hasTouch: true })`. */
export interface Finger {
  down(x: number, y: number): Promise<void>;
  move(x: number, y: number): Promise<void>;
  up(): Promise<void>;
  /** Puts the finger down and lifts it at once. */
  tap(x: number, y: number): Promise<void>;
}

export async function finger(page: Page): Promise<Finger> {
  const cdp = await page.context().newCDPSession(page);
  const send = (type: 'touchStart' | 'touchMove' | 'touchEnd', x?: number, y?: number) =>
    cdp.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: x === undefined || y === undefined ? [] : [{ x, y }],
    });
  const self: Finger = {
    down: async (x, y) => void (await send('touchStart', x, y)),
    move: async (x, y) => void (await send('touchMove', x, y)),
    up: async () => void (await send('touchEnd')),
    tap: async (x, y) => {
      await self.down(x, y);
      await self.up();
    },
  };
  return self;
}

/**
 * Has one of the player's workers build a building on the first free place
 * near the main building, and steps the game on until it stands finished.
 * The player pays for it as usual. Returns the building and the worker.
 *
 * @param side Where to look first: behind the main building as seen on the
 * screen, or in front of it. A low building behind the main building is
 * partly hidden by it, and a click there hits the main building instead.
 */
export async function buildNearHome(
  page: Page,
  building: BuildingType,
  side: 'behind' | 'front' = 'behind',
): Promise<{ buildingId: number; workerId: number }> {
  const built = await page.evaluate(
    ([type, front]) => {
      const t = window.__TEST__!;
      const state = t.getState();
      const home = state.entities.find((e) => e.kind === 'building' && e.owner === 0);
      const worker = state.entities.find((e) => e.kind === 'unit' && e.owner === 0);
      if (!home || !worker) return null;
      for (let r = 4; r < 12; r++) {
        for (let i = 0; i <= 2 * r; i++) {
          for (let j = 0; j <= 2 * r; j++) {
            // Larger tile coordinates are nearer the viewer.
            const dy = front ? r - i : i - r;
            const dx = front ? r - j : j - r;
            const result = t.command({
              type: 'build',
              player: 0,
              unitIds: [worker.id],
              building: type,
              x: home.x + dx,
              y: home.y + dy,
            });
            if (!result.ok) continue;
            for (let step = 0; step < 3000; step++) {
              t.advance(1);
              // The player's own: the computer player may build one too.
              const site = t
                .getState()
                .entities.find((e) => e.kind === 'building' && e.type === type && e.owner === 0);
              if (site?.kind === 'building' && site.complete) {
                return { buildingId: site.id, workerId: worker.id };
              }
            }
            return null;
          }
        }
      }
      return null;
    },
    [building, side === 'front'] as const,
  );
  expect(built, `a building of type ${building} was built`).not.toBeNull();
  return built!;
}

/**
 * Has one of the player's workers build an Ide near the main building: room
 * for five more units. It costs the player 30 wood, like any Ide.
 */
export async function buildHouse(page: Page): Promise<void> {
  await buildNearHome(page, 'ide');
}

/**
 * Starts noting, frame by frame inside the page, which numbers of the
 * resource bar flash red. A flash for a refused order lasts 300 ms, and on
 * a slow machine a question from the test can arrive after it has ended:
 * what was noted in the page does not depend on how fast the test gets
 * there. Returns a function that gives everything that has flashed since.
 */
export async function recordFlashes(page: Page): Promise<() => Promise<string[]>> {
  await page.evaluate(() => {
    const seen = new Set<string>();
    (window as unknown as { __flashes: Set<string> }).__flashes = seen;
    const note = () => {
      for (const key of window.__TEST__!.getFlashing()) seen.add(key);
      requestAnimationFrame(note);
    };
    requestAnimationFrame(note);
  });
  return () =>
    page.evaluate(() => [...(window as unknown as { __flashes: Set<string> }).__flashes].sort());
}
