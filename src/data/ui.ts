/** Interface feel. See GDD sections 4 and 11. */
export const UI_CONFIG = {
  /** How far, in pixels, the pointer must move with the button held before a click becomes a drag box. */
  dragThresholdPx: 4,
  /** Lifetime of the ring shown at an order's target, in milliseconds. */
  orderMarkerMs: 400,
  /** Radius of the order ring when it appears and when it has faded out, in pixels. */
  orderMarkerStartRadius: 22,
  orderMarkerEndRadius: 6,
} as const;
