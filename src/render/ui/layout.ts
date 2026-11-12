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

export function rectContains(rect: ScreenRect, x: number, y: number): boolean {
  return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
}
