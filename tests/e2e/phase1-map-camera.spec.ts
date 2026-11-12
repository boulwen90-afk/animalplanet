import { expect, test } from '@playwright/test';
import { MAP_CONFIG } from '../../src/data/map';
import { expectCameraOnMap, getCamera, openGame, trackConsoleErrors } from './helpers';

test.describe('phase 1: scrollable isometric map', () => {
  test('starts without console errors and reports ready', async ({ page }) => {
    const errors = trackConsoleErrors(page);
    await openGame(page);

    await expect(page.locator('#game canvas')).toBeVisible();
    const camera = await getCamera(page);
    expect(camera.width).toBeGreaterThan(0);
    expect(camera.height).toBeGreaterThan(0);
    expectCameraOnMap(camera);
    // The game starts centred on the middle of the map.
    expect(camera.centerTile.x).toBeCloseTo(MAP_CONFIG.width / 2, 1);
    expect(camera.centerTile.y).toBeCloseTo(MAP_CONFIG.height / 2, 1);
    expect(errors).toEqual([]);
  });

  test('does not expose the test interface outside test mode', async ({ page }) => {
    const errors = trackConsoleErrors(page);
    await page.goto('./');
    await expect(page.locator('#game canvas')).toBeVisible();
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => window.__TEST__)).toBeUndefined();
    expect(errors).toEqual([]);
  });

  test('holding the right arrow for 500 ms moves the camera right', async ({ page }) => {
    await openGame(page);
    const before = await getCamera(page);

    await page.keyboard.down('ArrowRight');
    await page.waitForTimeout(500);
    await page.keyboard.up('ArrowRight');

    // 500 ms at 900 px/s is 450 px; allow for frame timing.
    const after = await getCamera(page);
    expect(after.x).toBeGreaterThan(before.x + 300);
    expect(after.x).toBeLessThan(before.x + 650);
    expect(after.y).toBeCloseTo(before.y, 3);
  });

  test('WASD pans the camera', async ({ page }) => {
    await openGame(page);
    const before = await getCamera(page);

    await page.keyboard.down('a');
    await page.keyboard.down('w');
    await page.waitForTimeout(300);
    await page.keyboard.up('a');
    await page.keyboard.up('w');

    const after = await getCamera(page);
    // 300 ms at 900 px/s is 270 px.
    expect(after.x).toBeLessThan(before.x - 150);
    expect(after.y).toBeLessThan(before.y - 150);
  });

  // Panning in one direction ends in the map corner that lies in that direction.
  const directions = [
    { key: 'ArrowRight', name: 'right', corner: { x: MAP_CONFIG.width, y: 0 } },
    { key: 'ArrowLeft', name: 'left', corner: { x: 0, y: MAP_CONFIG.height } },
    { key: 'ArrowDown', name: 'down', corner: { x: MAP_CONFIG.width, y: MAP_CONFIG.height } },
    { key: 'ArrowUp', name: 'up', corner: { x: 0, y: 0 } },
  ] as const;

  for (const { key, name, corner } of directions) {
    test(`panning ${name} for 10 s stops at the map edge`, async ({ page }) => {
      test.setTimeout(30_000);
      await openGame(page);

      await page.keyboard.down(key);
      await page.waitForTimeout(10_000);
      await page.keyboard.up(key);

      // 10 s at 900 px/s is further than the map is wide.
      const camera = await getCamera(page);
      expectCameraOnMap(camera);
      expect(camera.centerTile.x).toBeCloseTo(corner.x, 1);
      expect(camera.centerTile.y).toBeCloseTo(corner.y, 1);
    });
  }

  test('the mouse at the screen edge pans the camera', async ({ page }) => {
    await openGame(page);
    const viewport = page.viewportSize()!;
    await page.mouse.move(viewport.width / 2, viewport.height / 2);
    await page.waitForTimeout(200);
    const before = await getCamera(page);

    // Resting in the middle of the screen does nothing.
    await page.waitForTimeout(200);
    expect((await getCamera(page)).x).toBeCloseTo(before.x, 3);

    await page.mouse.move(viewport.width - 5, viewport.height / 2);
    await page.waitForTimeout(500);
    await page.mouse.move(viewport.width / 2, viewport.height / 2);

    // 500 ms at 900 px/s is 450 px; allow for frame timing.
    const after = await getCamera(page);
    expect(after.x).toBeGreaterThan(before.x + 300);
    expect(after.x).toBeLessThan(before.x + 650);
    expect(after.y).toBeCloseTo(before.y, 3);
  });

  test('dragging with the middle mouse button moves the map with the pointer', async ({ page }) => {
    await openGame(page);
    const before = await getCamera(page);

    await page.mouse.move(400, 300);
    await page.mouse.down({ button: 'middle' });
    await page.mouse.move(340, 270, { steps: 5 });
    await page.mouse.move(250, 220, { steps: 5 });
    await page.mouse.up({ button: 'middle' });

    // The pointer moved 150 px left and 80 px up, so the view moved the opposite way.
    const after = await getCamera(page);
    expect(after.x).toBeCloseTo(before.x + 150, 0);
    expect(after.y).toBeCloseTo(before.y + 80, 0);
  });

  test('dragging with the left mouse button does not move the camera', async ({ page }) => {
    await openGame(page);
    const before = await getCamera(page);

    await page.mouse.move(400, 300);
    await page.mouse.down();
    await page.mouse.move(250, 220, { steps: 5 });
    await page.mouse.up();

    const after = await getCamera(page);
    expect(after.x).toBeCloseTo(before.x, 3);
    expect(after.y).toBeCloseTo(before.y, 3);
  });
});

test.describe('phase 1: touch', () => {
  test.use({ hasTouch: true });

  test('dragging with one finger moves the map with the finger', async ({ page }) => {
    const errors = trackConsoleErrors(page);
    await openGame(page);
    const before = await getCamera(page);

    const cdp = await page.context().newCDPSession(page);
    const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', x?: number, y?: number) =>
      cdp.send('Input.dispatchTouchEvent', {
        type,
        touchPoints: x === undefined || y === undefined ? [] : [{ x, y }],
      });

    await touch('touchStart', 400, 300);
    for (let i = 1; i <= 10; i++) {
      await touch('touchMove', 400 - i * 12, 300 - i * 6);
    }
    await touch('touchEnd');

    // The finger moved 120 px left and 60 px up.
    const after = await getCamera(page);
    expect(after.x).toBeCloseTo(before.x + 120, 0);
    expect(after.y).toBeCloseTo(before.y + 60, 0);
    expect(errors).toEqual([]);
  });
});
