import { expect, type Page } from '@playwright/test';
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

/** Opens the game in test mode and waits until it is running. */
export async function openGame(page: Page, query = ''): Promise<void> {
  await throttleCpu(page);
  await page.goto(`./?test=1${query}`);
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
