import { describe, expect, it } from 'vitest';
import { parseHexColor, recolorPixels } from './recolor';

const NEUTRAL = 0xbcbcbc;
const BLUE = 0x3b7de0;
const RED = 0xd0453a;

const pixels = (...rgba: number[]) => new Uint8ClampedArray(rgba);

describe('recolorPixels', () => {
  it('leaves pixels outside the mask as they are', () => {
    const base = pixels(120, 80, 40, 255, 10, 20, 30, 128);
    const mask = pixels(0, 0, 0, 0, 0, 0, 0, 0);
    expect([...recolorPixels(base, mask, BLUE, NEUTRAL)]).toEqual([...base]);
  });

  it('turns a fully lit grey team pixel into the team colour', () => {
    const base = pixels(0xbc, 0xbc, 0xbc, 255);
    const mask = pixels(0xbc, 0xbc, 0xbc, 255);
    const [r, g, b, a] = recolorPixels(base, mask, BLUE, NEUTRAL);
    expect(Math.abs(r! - 0x3b)).toBeLessThanOrEqual(1);
    expect(Math.abs(g! - 0x7d)).toBeLessThanOrEqual(1);
    expect(Math.abs(b! - 0xe0)).toBeLessThanOrEqual(1);
    expect(a).toBe(255);
  });

  it('keeps the shading: a darker grey gives a darker team colour', () => {
    const lit = recolorPixels(pixels(188, 188, 188, 255), pixels(188, 188, 188, 255), RED, NEUTRAL);
    const shaded = recolorPixels(pixels(94, 94, 94, 255), pixels(94, 94, 94, 255), RED, NEUTRAL);
    for (let c = 0; c < 3; c++) expect(shaded[c]!).toBeLessThan(lit[c]!);
    // Red stays the strongest channel in the shade.
    expect(shaded[0]!).toBeGreaterThan(shaded[1]!);
    expect(shaded[0]!).toBeGreaterThan(shaded[2]!);
  });

  it('colours only the covered share of a pixel on the edge of a team part', () => {
    // Half of the pixel is grey team cloth, half is something darker.
    const base = pixels(140, 140, 140, 255);
    const mask = pixels(188, 188, 188, 128);
    const [r, g, b] = recolorPixels(base, mask, BLUE, NEUTRAL);
    // Blue: red light is taken away, blue light is added.
    expect(r!).toBeLessThan(140);
    expect(b!).toBeGreaterThan(140);
    expect(g!).toBeLessThan(140);
    // But not as far as a fully covered pixel would go.
    const full = recolorPixels(base, pixels(188, 188, 188, 255), BLUE, NEUTRAL);
    expect(r!).toBeGreaterThan(full[0]!);
  });

  it('does not change the alpha, and returns a new array', () => {
    const base = pixels(188, 188, 188, 200);
    const result = recolorPixels(base, pixels(188, 188, 188, 200), RED, NEUTRAL);
    expect(result[3]).toBe(200);
    expect(result).not.toBe(base);
    expect(base[0]).toBe(188);
  });

  it('gives back the neutral grey when the team colour is that grey', () => {
    const base = pixels(100, 150, 200, 255);
    const mask = pixels(100, 150, 200, 255);
    const result = recolorPixels(base, mask, NEUTRAL, NEUTRAL);
    for (let c = 0; c < 3; c++) expect(Math.abs(result[c]! - base[c]!)).toBeLessThanOrEqual(1);
  });
});

describe('parseHexColor', () => {
  it('reads "#rrggbb"', () => {
    expect(parseHexColor('#bcbcbc')).toBe(0xbcbcbc);
    expect(parseHexColor('3b7de0')).toBe(0x3b7de0);
  });

  it('refuses anything else', () => {
    expect(() => parseHexColor('#fff')).toThrow();
    expect(() => parseHexColor('blue')).toThrow();
  });
});
