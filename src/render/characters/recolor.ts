/**
 * Gives the team-coloured parts of a character atlas a colour.
 *
 * The atlas is rendered with those parts in a neutral grey. A second atlas
 * with the same layout, the mask, holds only those parts: shaded grey, with
 * their coverage as alpha. For every pixel the light from the grey parts is
 * replaced by the same light scaled from grey to the team colour. The sums
 * are done on amounts of light, not on stored colour values, which is what
 * the renderer that made the pictures does. tools/blender/lib/export.py has
 * the same calculation.
 */

/** Stored colour value (0..255) to amount of light (0..1). */
const TO_LIGHT = new Float32Array(256);
for (let value = 0; value < 256; value++) {
  const c = value / 255;
  TO_LIGHT[value] = c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** Amount of light, in 4096 steps from 0 to 1, back to a stored colour value. */
const LIGHT_STEPS = 4095;
const TO_STORED = new Uint8Array(LIGHT_STEPS + 1);
for (let step = 0; step <= LIGHT_STEPS; step++) {
  const light = step / LIGHT_STEPS;
  const c = light <= 0.0031308 ? light * 12.92 : 1.055 * light ** (1 / 2.4) - 0.055;
  TO_STORED[step] = Math.round(c * 255);
}

function channels(color: number): [number, number, number] {
  return [(color >> 16) & 0xff, (color >> 8) & 0xff, color & 0xff];
}

/**
 * Returns the pixels of `base` with its team-coloured parts in `color`.
 * `base` and `mask` are RGBA pixels of pictures of the same size, with
 * colour not multiplied by alpha. `color` and `neutral` are 0xRRGGBB.
 */
export function recolorPixels(
  base: Uint8ClampedArray,
  mask: Uint8ClampedArray,
  color: number,
  neutral: number,
): Uint8ClampedArray<ArrayBuffer> {
  const result = new Uint8ClampedArray(base);
  const to = channels(color);
  const from = channels(neutral);
  // How much of the grey light each channel loses on its way to the team colour.
  const loss = [0, 1, 2].map(
    (c) => 1 - (TO_LIGHT[to[c] as number] as number) / (TO_LIGHT[from[c] as number] as number),
  );

  for (let i = 0; i < base.length; i += 4) {
    const coverage = mask[i + 3] as number;
    const alpha = base[i + 3] as number;
    if (coverage === 0 || alpha === 0) continue;
    const share = coverage / alpha;
    for (let c = 0; c < 3; c++) {
      const light =
        (TO_LIGHT[base[i + c] as number] as number) -
        (TO_LIGHT[mask[i + c] as number] as number) * share * (loss[c] as number);
      const step = Math.round(Math.min(1, Math.max(0, light)) * LIGHT_STEPS);
      result[i + c] = TO_STORED[step] as number;
    }
  }
  return result;
}

/** A colour written as "#rrggbb" as a number. */
export function parseHexColor(text: string): number {
  const value = Number.parseInt(text.replace('#', ''), 16);
  if (text.replace('#', '').length !== 6 || Number.isNaN(value)) {
    throw new Error(`Expected a colour like #a1b2c3, got "${text}"`);
  }
  return value;
}
