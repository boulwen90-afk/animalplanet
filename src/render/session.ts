/**
 * Starting a new game reloads the page. A note in the session storage tells
 * the reloaded page that the player asked for it, so it can skip the start
 * screen and go straight into the match.
 */

const RESTART_KEY = 'animalplanet.restart';

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
