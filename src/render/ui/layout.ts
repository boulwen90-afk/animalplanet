/** Where interface elements sit on the screen, in screen pixels. */

export interface ScreenRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const MARGIN = 12;
const SELECTION_PANEL = { width: 280, height: 64 };

/** The selection panel sits in the bottom-left corner. */
export function selectionPanelRect(viewWidth: number, viewHeight: number): ScreenRect {
  return {
    x: MARGIN,
    y: viewHeight - MARGIN - SELECTION_PANEL.height,
    width: Math.min(SELECTION_PANEL.width, viewWidth - 2 * MARGIN),
    height: SELECTION_PANEL.height,
  };
}

/** The resource bar runs along the top of the screen. */
export function resourceBarRect(viewWidth: number): ScreenRect {
  return { x: 0, y: 0, width: viewWidth, height: 32 };
}

/** Where the end-of-game screen puts its title and its button. */
export function outcomeLayout(
  viewWidth: number,
  viewHeight: number,
): { title: { x: number; y: number }; button: ScreenRect } {
  const button = { width: 200, height: 52 };
  return {
    title: { x: viewWidth / 2, y: viewHeight / 2 - 50 },
    button: {
      x: viewWidth / 2 - button.width / 2,
      y: viewHeight / 2 + 20,
      width: button.width,
      height: button.height,
    },
  };
}

const HUD_BUTTON = { width: 110, height: 44, gap: 8 };

/**
 * The row of buttons under the right end of the resource bar. The first
 * button is the rightmost. They are 44 px high so a finger can hit them.
 */
export function hudButtonRects(viewWidth: number, count: number): ScreenRect[] {
  const top = resourceBarRect(viewWidth).height + 8;
  return Array.from({ length: count }, (_, i) => ({
    x: viewWidth - MARGIN - HUD_BUTTON.width - i * (HUD_BUTTON.width + HUD_BUTTON.gap),
    y: top,
    width: HUD_BUTTON.width,
    height: HUD_BUTTON.height,
  }));
}

/** Half the width kept free for the warning text in the middle of the screen. */
const ALERT_HALF_WIDTH = 120;

/**
 * Top of the warning text: just under the resource bar, or under the
 * buttons where the screen is too narrow to hold both side by side.
 */
export function alertTop(viewWidth: number): number {
  const leftmost = hudButtonRects(viewWidth, 2)[1] as ScreenRect;
  const fitsBeside = leftmost.x >= viewWidth / 2 + ALERT_HALF_WIDTH;
  return fitsBeside ? resourceBarRect(viewWidth).height + 10 : leftmost.y + leftmost.height + 8;
}

const START_SCREEN = { gap: 20, button: { width: 200, height: 52 }, maxTextWidth: 520 };

/** Where the start screen puts its title, its text and its button. */
export interface StartScreenLayout {
  /** Centre of the title, and its font size in pixels. */
  title: { x: number; y: number; size: number };
  /** Top centre of the text, and the width it wraps at. */
  body: { x: number; y: number; width: number };
  button: ScreenRect;
}

/** The start screen is centred; `bodyHeight` is the height of the wrapped text. */
export function startScreenLayout(
  viewWidth: number,
  viewHeight: number,
  bodyHeight: number,
): StartScreenLayout {
  const { gap, button, maxTextWidth } = START_SCREEN;
  // The title shrinks on narrow screens so it never runs off the sides.
  const size = Math.min(48, Math.floor(viewWidth / 8));
  const total = size + gap + bodyHeight + gap + button.height;
  const top = Math.max(MARGIN, (viewHeight - total) / 2);
  const bodyTop = top + size + gap;
  return {
    title: { x: viewWidth / 2, y: top + size / 2, size },
    body: { x: viewWidth / 2, y: bodyTop, width: Math.min(maxTextWidth, viewWidth - 32) },
    button: {
      x: viewWidth / 2 - button.width / 2,
      y: bodyTop + bodyHeight + gap,
      width: button.width,
      height: button.height,
    },
  };
}

export function rectContains(rect: ScreenRect, x: number, y: number): boolean {
  return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
}
