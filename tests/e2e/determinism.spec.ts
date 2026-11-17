import { expect, test, type Page } from '@playwright/test';
import { MAP_CONFIG, MAP_GEN_CONFIG } from '../../src/data/map';
import { checksum } from '../../src/sim/checksum';
import { createGame } from '../../src/sim/game';
import type { GameState } from '../../src/sim/state';
import { startStress, stressUnits, type StressMode } from '../../src/sim/stress';
import { tick } from '../../src/sim/tick';
import { openGame, trackConsoleErrors } from './helpers';

/**
 * Two players each run the simulation in their own browser, so every browser
 * must count the same. Here the browser plays a match and gives a checksum
 * of the whole game state every second of game time, and the test plays the
 * same match in Node and compares. With E2E_ALL_BROWSERS=1 this runs in
 * Chromium, Firefox and WebKit: three JavaScript engines, each against Node.
 */

/** How many steps there are between two checksums: one second of game time. */
const EVERY = 20;

/** The checksums of a match played here, in Node: at the start and after every second. */
function playedInNode(state: GameState, steps: number): number[] {
  const sums = [checksum(state)];
  for (let step = 1; step <= steps; step++) {
    tick(state);
    if (step % EVERY === 0) sums.push(checksum(state));
  }
  return sums;
}

/** The checksums of the match the page has loaded, played in the browser with its picture on. */
async function playedInBrowser(page: Page, steps: number): Promise<number[]> {
  const sums = [await page.evaluate(() => window.__TEST__!.getChecksum())];
  // A minute of game time at a go, so that no single call runs for long.
  for (let done = 0; done < steps; done += 1200) {
    const part = await page.evaluate(
      ([count, every]) => {
        const t = window.__TEST__!;
        const out: number[] = [];
        for (let step = every; step <= count; step += every) {
          t.advance(every);
          out.push(t.getChecksum());
        }
        return out;
      },
      [Math.min(1200, steps - done), EVERY] as const,
    );
    sums.push(...part);
  }
  return sums;
}

/** Says at which second two matches first differ, rather than printing hundreds of numbers. */
function expectSameMatch(browser: number[], node: number[]): void {
  expect(browser).toHaveLength(node.length);
  const first = browser.findIndex((sum, i) => sum !== node[i]);
  expect(first, `the browser and Node differ from second ${first} of the match`).toBe(-1);
}

/** The game a stress run starts, as GameScene makes it. */
function stressGame(seed: number, count: number, mode: StressMode): GameState {
  const state = createGame(seed, MAP_CONFIG, MAP_GEN_CONFIG, {
    ai: [],
    extraUnits: stressUnits(count, mode),
  });
  startStress(state, mode);
  return state;
}

test.describe('every browser counts the same as Node', () => {
  test.slow();

  test('a match against the computer: five minutes of building, training and the first attack', async ({
    page,
  }) => {
    const errors = trackConsoleErrors(page);
    const steps = 5 * 60 * 20;
    // Behind the start screen the match stands still until the test steps it.
    await openGame(page, '&seed=4', { startScreen: true });
    const browser = await playedInBrowser(page, steps);
    const node = playedInNode(createGame(4, MAP_CONFIG, MAP_GEN_CONFIG), steps);
    expectSameMatch(browser, node);
    // The match was a real one: the computer built a base and sent its first wave.
    const state = await page.evaluate(() => window.__TEST__!.getState());
    expect(state.entities.filter((e) => e.owner === 1).length).toBeGreaterThan(20);
    expect(state.players[1]!.ai!.waveTicks.length).toBeGreaterThan(0);
    expect(errors).toEqual([]);
  });

  test('two armies of 60 that march to the middle of the map and fight', async ({ page }) => {
    const errors = trackConsoleErrors(page);
    const steps = 75 * 20;
    await openGame(page, '&seed=3&stress=120&stressmode=fight', { startScreen: true });
    const browser = await playedInBrowser(page, steps);
    const node = playedInNode(stressGame(3, 120, 'fight'), steps);
    expectSameMatch(browser, node);
    // They did meet: by now many are fighting, have given up or are gone into a cave.
    const state = await page.evaluate(() => window.__TEST__!.getState());
    const soldiers = state.entities.filter((e) => e.kind === 'unit' && e.type !== 'samlare');
    const busy = soldiers.filter(
      (u) => u.kind === 'unit' && (u.task.kind === 'attack' || u.task.kind === 'flee'),
    );
    expect(busy.length + (120 - soldiers.length)).toBeGreaterThan(30);
    expect(errors).toEqual([]);
  });

  test('two sides of 50 workers who gather', async ({ page }) => {
    const errors = trackConsoleErrors(page);
    const steps = 60 * 20;
    await openGame(page, '&seed=2&stress=100', { startScreen: true });
    const browser = await playedInBrowser(page, steps);
    const node = playedInNode(stressGame(2, 100, 'gather'), steps);
    expectSameMatch(browser, node);
    const state = await page.evaluate(() => window.__TEST__!.getState());
    expect(state.players[0]!.resources.wood).toBeGreaterThan(300);
    expect(errors).toEqual([]);
  });
});
