import { expect, type Page } from '@playwright/test';
import { MAP_CONFIG } from '../../src/data/map';
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

/** Opens the game in test mode and waits until it is running. */
export async function openGame(page: Page, query = ''): Promise<void> {
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
export function expectCameraOnMap(camera: TestCameraInfo): void {
  const { centerTile } = camera;
  // A little slack for floating point rounding.
  expect(centerTile.x).toBeGreaterThanOrEqual(-0.01);
  expect(centerTile.y).toBeGreaterThanOrEqual(-0.01);
  expect(centerTile.x).toBeLessThanOrEqual(MAP_CONFIG.width + 0.01);
  expect(centerTile.y).toBeLessThanOrEqual(MAP_CONFIG.height + 0.01);
}
