/** Interface feel. See GDD sections 4 and 11. */
export const UI_CONFIG = {
  /** How far, in pixels, the pointer must move with the button held before a click becomes a drag box. */
  dragThresholdPx: 4,
  /** Lifetime of the ring shown at an order's target, in milliseconds. */
  orderMarkerMs: 400,
  /** Radius of the order ring when it appears and when it has faded out, in pixels. */
  orderMarkerStartRadius: 22,
  orderMarkerEndRadius: 6,
  /** How long a resource bar number stays red when an order is refused for lack of it, in milliseconds. */
  refusalFlashMs: 300,
  /** How long a struck unit or building is drawn white, in milliseconds. */
  hitFlashMs: 80,
  /** How far, in pixels, and for how long an attacker lunges at its target when it strikes. */
  lungePx: 4,
  lungeMs: 100,
  /** How long a unit takes to fade away when it enters a cave or vanishes, in milliseconds. */
  fadeOutMs: 300,
  /** Screen shake when a building on screen collapses: duration in milliseconds and size in pixels. */
  collapseShakeMs: 150,
  collapseShakePx: 4,
  /** How long the "base under attack" warning shows, and the shortest time between two warnings, in milliseconds. */
  alertMs: 3000,
  alertCooldownMs: 10000,
} as const;
