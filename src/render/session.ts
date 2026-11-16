import { DIFFICULTIES, type Difficulty } from '../data/ai';

/**
 * Starting a new game reloads the page. A note in the session storage tells
 * the reloaded page that the player asked for it, so it can skip the start
 * screen and go straight into the match.
 */

const RESTART_KEY = 'animalplanet.restart';
const LEVEL_KEY = 'animalplanet.level';

/** The level with a name, or undefined if there is none with it. */
export function toDifficulty(name: string | null): Difficulty | undefined {
  return DIFFICULTIES.find((level) => level === name);
}

/**
 * Remembers the level the player chose, for as long as the tab is open, so
 * that "play again" and a reloaded page play on the same one.
 */
export function rememberLevel(level: Difficulty): void {
  try {
    window.sessionStorage.setItem(LEVEL_KEY, level);
  } catch {
    // Without session storage the next game starts on the usual level.
  }
}

/** The level the player chose last in this tab, if any. */
export function rememberedLevel(): Difficulty | undefined {
  try {
    return toDifficulty(window.sessionStorage.getItem(LEVEL_KEY));
  } catch {
    return undefined;
  }
}

/** Reloads the page into a new game without the start screen. */
export function restartGame(): void {
  try {
    window.sessionStorage.setItem(RESTART_KEY, '1');
  } catch {
    // Without session storage the start screen simply shows again.
  }
  window.location.reload();
}

/** True, once, if this page load is a restart asked for by `restartGame`. */
export function takeRestartRequest(): boolean {
  try {
    const requested = window.sessionStorage.getItem(RESTART_KEY) === '1';
    window.sessionStorage.removeItem(RESTART_KEY);
    return requested;
  } catch {
    return false;
  }
}
