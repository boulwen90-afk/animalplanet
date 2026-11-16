import { describe, expect, it } from 'vitest';
import {
  alertTop,
  hudButtonRects,
  rectContains,
  resourceBarRect,
  startScreenLayout,
  loadingLayout,
} from './layout';

describe('hudButtonRects', () => {
  it('lays the buttons out from the right, under the resource bar, without overlap', () => {
    const [first, second] = hudButtonRects(1280, 2);
    expect(first!.x + first!.width).toBeLessThanOrEqual(1280);
    expect(second!.x + second!.width).toBeLessThanOrEqual(first!.x);
    expect(first!.y).toBeGreaterThanOrEqual(resourceBarRect(1280).height);
    expect(second!.y).toBe(first!.y);
  });

  it.each([320, 390, 1280])('makes buttons at least 44×44 px on a %i px wide screen', (width) => {
    for (const rect of hudButtonRects(width, 2)) {
      expect(rect.width).toBeGreaterThanOrEqual(44);
      expect(rect.height).toBeGreaterThanOrEqual(44);
      expect(rect.x).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('alertTop', () => {
  it('is just under the resource bar on a wide screen', () => {
    expect(alertTop(1280)).toBe(resourceBarRect(1280).height + 10);
  });

  it('moves under the buttons on a narrow screen', () => {
    const buttons = hudButtonRects(390, 2);
    expect(alertTop(390)).toBeGreaterThanOrEqual(buttons[0]!.y + buttons[0]!.height);
  });
});

describe('startScreenLayout', () => {
  it.each([
    [1280, 720, 120],
    [390, 844, 260],
    [844, 390, 140],
  ])('keeps title, text and button in order on a %i×%i screen', (width, height, bodyHeight) => {
    const layout = startScreenLayout(width, height, bodyHeight);
    expect(layout.title.y - layout.title.size / 2).toBeGreaterThanOrEqual(0);
    expect(layout.body.y).toBeGreaterThanOrEqual(layout.title.y + layout.title.size / 2);
    expect(layout.button.y).toBeGreaterThanOrEqual(layout.body.y + bodyHeight);
    expect(layout.button.y + layout.button.height).toBeLessThanOrEqual(height);
    expect(layout.body.width).toBeLessThanOrEqual(width - 32);
    expect(rectContains({ x: 0, y: 0, width, height }, layout.button.x, layout.button.y)).toBe(
      true,
    );
    expect(layout.button.width).toBeGreaterThanOrEqual(44);
    expect(layout.button.height).toBeGreaterThanOrEqual(44);
  });

  it.each([
    [1280, 720, 120],
    [390, 844, 260],
    [320, 568, 180],
  ])(
    'puts the three levels side by side between the text and the button on a %i×%i screen',
    (width, height, bodyHeight) => {
      const layout = startScreenLayout(width, height, bodyHeight);
      expect(layout.levels).toHaveLength(3);
      const [first, second, third] = layout.levels;
      // The heading is below the text and above the levels.
      expect(layout.levelTitle.x).toBe(width / 2);
      expect(layout.button.y + layout.button.height).toBeLessThanOrEqual(height);
      expect(layout.levelTitle.y).toBeGreaterThan(layout.body.y + bodyHeight);
      expect(layout.levelTitle.y).toBeLessThan(first!.y);
      for (const rect of layout.levels) {
        expect(rect.y).toBe(first!.y);
        expect(rect.width).toBeGreaterThanOrEqual(44);
        expect(rect.height).toBeGreaterThanOrEqual(44);
        expect(rect.x).toBeGreaterThanOrEqual(16);
        expect(rect.x + rect.width).toBeLessThanOrEqual(width - 16);
        expect(rect.y + rect.height).toBeLessThanOrEqual(layout.button.y);
      }
      // No two overlap, and the row is centred.
      expect(second!.x).toBeGreaterThanOrEqual(first!.x + first!.width + 8);
      expect(third!.x).toBeGreaterThanOrEqual(second!.x + second!.width + 8);
      const middle = (first!.x + third!.x + third!.width) / 2;
      expect(Math.abs(middle - width / 2)).toBeLessThanOrEqual(1);
    },
  );

  it('narrows the levels on a screen too narrow for their full width', () => {
    expect(startScreenLayout(1280, 720, 120).levels[0]!.width).toBe(112);
    expect(startScreenLayout(320, 568, 180).levels[0]!.width).toBe(90);
  });

  it('puts the start button beside the levels on a screen too low to stack them', () => {
    // A phone held sideways, where the text takes 180 of the 390 pixels.
    const layout = startScreenLayout(844, 390, 180);
    const [first, , third] = layout.levels;
    expect(layout.button.x).toBeGreaterThanOrEqual(third!.x + third!.width + 8);
    expect(layout.button.x + layout.button.width).toBeLessThanOrEqual(844 - 16);
    // The levels are centred on the button's row, and the heading on the levels.
    for (const rect of layout.levels) {
      expect(rect.y + rect.height / 2).toBe(layout.button.y + layout.button.height / 2);
    }
    expect(layout.levelTitle.x).toBe((first!.x + third!.x + third!.width) / 2);
    expect(layout.levelTitle.y).toBeLessThan(first!.y);
    expect(layout.levelTitle.y).toBeGreaterThan(layout.body.y + 180);
    // Levels and button together are centred, and all of it is on the screen.
    expect((first!.x + layout.button.x + layout.button.width) / 2).toBe(422);
    expect(layout.title.y - layout.title.size / 2).toBeGreaterThanOrEqual(0);
    expect(layout.button.y + layout.button.height).toBeLessThanOrEqual(390);
  });

  it('stacks them again where there is height for it', () => {
    const layout = startScreenLayout(844, 600, 180);
    expect(layout.button.y).toBeGreaterThanOrEqual(layout.levels[0]!.y + 44);
    expect(layout.button.x).toBe(322);
  });
});

describe('loadingLayout', () => {
  it('puts a bar 280 pixels wide in the middle of a wide screen, with its text above', () => {
    const { bar, text } = loadingLayout(1280, 720);
    expect(bar).toEqual({ x: 500, y: 360, width: 280, height: 14 });
    expect(text).toEqual({ x: 640, y: 334 });
  });

  it('narrows the bar on a phone held upright, with 24 pixels to spare on each side', () => {
    const { bar } = loadingLayout(300, 640);
    expect(bar.width).toBe(252);
    expect(bar.x).toBe(24);
  });
});
