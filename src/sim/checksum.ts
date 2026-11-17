/**
 * A checksum of the game state, for two players who each run the simulation
 * and must find out at once if their games have come apart, and for the
 * tests that show that they do not. See determinism.test.ts.
 */

const float = new Float64Array(1);
const halves = new Uint32Array(float.buffer);
const textSums = new Map<string, number>();

/** One round of MurmurHash3's mixing. */
function mix(hash: number, value: number): number {
  let k = Math.imul(value, 0xcc9e2d51);
  k = (k << 15) | (k >>> 17);
  k = Math.imul(k, 0x1b873593);
  let h = hash ^ k;
  h = (h << 13) | (h >>> 19);
  return (Math.imul(h, 5) + 0xe6546b64) | 0;
}

function textSum(text: string): number {
  let sum = textSums.get(text);
  if (sum === undefined) {
    sum = text.length;
    for (let i = 0; i < text.length; i++) sum = mix(sum, text.charCodeAt(i));
    textSums.set(text, sum);
  }
  return sum;
}

/**
 * A 32-bit checksum of a value and everything in it. Numbers go in bit for
 * bit, so two positions that differ in the last decimal give different sums.
 * A property that is `undefined` counts as missing, which is what it becomes
 * when the state is sent as JSON. Properties named in `skip` are left out.
 */
export function checksum(value: unknown, skip?: string, hash = 0): number {
  if (typeof value === 'number') {
    if (value === (value | 0) && (value !== 0 || 1 / value > 0)) return mix(mix(hash, 1), value);
    float[0] = value;
    return mix(mix(mix(hash, 2), halves[0] as number), halves[1] as number);
  }
  if (typeof value === 'string') return mix(mix(hash, 3), textSum(value));
  if (typeof value === 'boolean') return mix(hash, value ? 5 : 4);
  if (value === null) return mix(hash, 6);
  if (value === undefined) return mix(hash, 7);
  if (Array.isArray(value) || ArrayBuffer.isView(value)) {
    const items = value as ArrayLike<unknown>;
    let h = mix(mix(hash, 8), items.length);
    for (let i = 0; i < items.length; i++) h = checksum(items[i], skip, h);
    return h;
  }
  if (typeof value !== 'object') throw new Error(`cannot be checksummed: ${typeof value}`);
  let h = mix(hash, 9);
  const record = value as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    const item = record[key];
    if (item === undefined || key === skip) continue;
    h = checksum(item, skip, mix(h, textSum(key)));
  }
  return mix(h, 10);
}

/** Where two values first differ, as a path with both values, or undefined if they are alike. */
export function firstDifference(a: unknown, b: unknown, path = 'state'): string | undefined {
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) {
    return Object.is(a, b) ? undefined : `${path}: ${String(a)} against ${String(b)}`;
  }
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    const found = firstDifference(
      (a as Record<string, unknown>)[key],
      (b as Record<string, unknown>)[key],
      `${path}.${key}`,
    );
    if (found) return found;
  }
  return undefined;
}
