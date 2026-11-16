/** Where interface elements sit on the screen, in screen pixels. */

export interface ScreenRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const MARGIN = 12;
/** Room for three lines: the name, the life and what the unit is doing, and what it can do. */
const SELECTION_PANEL = { width: 280, height: 84 };

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

const START_SCREEN = {
  gap: 20,
  button: { width: 200, height: 52 },
  maxTextWidth: 520,
  /** The buttons for the levels, side by side, under a heading `titleHeight` high. */
  level: { width: 112, height: 44, gap: 8, titleHeight: 24 },
};

/** Where the start screen puts its title, its text, its levels and its button. */
export interface StartScreenLayout {
  /** Centre of the title, and its font size in pixels. */
  title: { x: number; y: number; size: number };
  /** Top centre of the text, and the width it wraps at. */
  body: { x: number; y: number; width: number };
  /** Centre of the heading above the levels. */
  levelTitle: { x: number; y: number };
  /** One button for each level, from left to right. */
  levels: ScreenRect[];
  button: ScreenRect;
}

/**
 * The start screen is centred; `bodyHeight` is the height of the wrapped
 * text. The levels are a row of `levelCount` buttons between the text and
 * the start button, narrower on a screen too narrow for their full width.
 * On a screen too low for all of it, such as a phone held sideways, the
 * start button stands to the right of the levels instead of below them.
 */
export function startScreenLayout(
  viewWidth: number,
  viewHeight: number,
  bodyHeight: number,
  levelCount = 3,
): StartScreenLayout {
  const { gap, button, maxTextWidth, level } = START_SCREEN;
  // The title shrinks on narrow screens so it never runs off the sides.
  const size = Math.min(48, Math.floor(viewWidth / 8));
  const room = viewWidth - 32 - (levelCount - 1) * level.gap;
  const levelWidth = Math.min(level.width, Math.floor(room / levelCount));
  const rowWidth = levelCount * levelWidth + (levelCount - 1) * level.gap;
  const above = size + gap + bodyHeight + gap + level.titleHeight;
  const stacked = above + level.height + gap + button.height;
  const beside =
    stacked > viewHeight - 2 * MARGIN && rowWidth + gap + button.width <= viewWidth - 32;
  const total = beside ? above + button.height : stacked;
  const top = Math.max(MARGIN, (viewHeight - total) / 2);
  const bodyTop = top + size + gap;
  const levelsTop = bodyTop + bodyHeight + gap;
  // The row the levels stand on; beside the start button they are centred on it.
  const rowTop = levelsTop + level.titleHeight;
  const left = Math.round((viewWidth - (beside ? rowWidth + gap + button.width : rowWidth)) / 2);
  const levels: ScreenRect[] = [];
  for (let i = 0; i < levelCount; i++) {
    levels.push({
      x: left + i * (levelWidth + level.gap),
      y: rowTop + (beside ? (button.height - level.height) / 2 : 0),
      width: levelWidth,
      height: level.height,
    });
  }
  return {
    title: { x: viewWidth / 2, y: top + size / 2, size },
    body: { x: viewWidth / 2, y: bodyTop, width: Math.min(maxTextWidth, viewWidth - 32) },
    levelTitle: { x: left + rowWidth / 2, y: levelsTop + level.titleHeight / 2 - 2 },
    levels,
    button: {
      x: beside ? left + rowWidth + gap : viewWidth / 2 - button.width / 2,
      y: beside ? rowTop : rowTop + level.height + gap,
      width: button.width,
      height: button.height,
    },
  };
}

export function rectContains(rect: ScreenRect, x: number, y: number): boolean {
  return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
}

/** The loading bar shown before the start screen: the bar itself, and where its text is centred. */
export interface LoadingLayout {
  bar: ScreenRect;
  text: { x: number; y: number };
}

/**
 * The loading bar: 280 pixels wide, or as wide as fits with 24 pixels to
 * spare on each side, 14 high, in the middle of the screen, with its text
 * 26 pixels above.
 */
export function loadingLayout(viewWidth: number, viewHeight: number): LoadingLayout {
  const width = Math.max(40, Math.min(280, viewWidth - 48));
  const bar = {
    x: Math.round((viewWidth - width) / 2),
    y: Math.round(viewHeight / 2),
    width,
    height: 14,
  };
  return { bar, text: { x: viewWidth / 2, y: bar.y - 26 } };
}
