/**
 * Arithmetic that gives the same answer in every JavaScript engine.
 *
 * In a match between two players each of them runs the simulation, and only
 * their orders are sent. The two games stay alike only if every number comes
 * out the same, down to the last bit, in both browsers. Adding, subtracting,
 * multiplying, dividing and `Math.sqrt` are fixed by the language standard.
 * `Math.hypot`, `Math.sin`, `Math.cos`, `Math.atan2` and their like are not:
 * an engine may round their last digit as it pleases. The simulation uses the
 * functions here instead, which are built from the fixed ones only. A lint
 * rule keeps the others out of `src/sim/`.
 */

/** The length of a vector. Use this where `Math.hypot` would have been used. */
export function length(dx: number, dy: number): number {
  return Math.sqrt(dx * dx + dy * dy);
}

const HALF_TURN = Math.PI;
const FULL_TURN = 2 * Math.PI;
const QUARTER_TURN = Math.PI / 2;

/**
 * An angle brought to within a quarter turn of zero, and whether that took
 * a turn-about: the sine of the result is the sine of the angle, and its
 * cosine is the angle's cosine with the sign changed if `flipped`.
 */
function reduced(angle: number): { x: number; flipped: boolean } {
  // The remainder is exact, so this too is the same everywhere.
  let x = angle % FULL_TURN;
  if (x > HALF_TURN) x -= FULL_TURN;
  else if (x < -HALF_TURN) x += FULL_TURN;
  if (x > QUARTER_TURN) return { x: HALF_TURN - x, flipped: true };
  if (x < -QUARTER_TURN) return { x: -HALF_TURN - x, flipped: true };
  return { x, flipped: false };
}

/**
 * The sine of an angle in radians, to about fifteen digits: the angle is
 * brought to within a quarter turn of zero and the sine summed from its
 * power series, twelve terms of it.
 */
export function sin(angle: number): number {
  const { x } = reduced(angle);
  const square = x * x;
  // x - x^3/3! + x^5/5! - ... - x^23/23!, from the innermost bracket outwards.
  let sum = 1;
  for (let n = 22; n >= 2; n -= 2) sum = 1 - (square / (n * (n + 1))) * sum;
  return x * sum;
}

/** The cosine of an angle in radians, to about fifteen digits, the same way. */
export function cos(angle: number): number {
  const { x, flipped } = reduced(angle);
  const square = x * x;
  // 1 - x^2/2! + x^4/4! - ... + x^24/24!.
  let sum = 1;
  for (let n = 23; n >= 1; n -= 2) sum = 1 - (square / (n * (n + 1))) * sum;
  return flipped ? -sum : sum;
}
