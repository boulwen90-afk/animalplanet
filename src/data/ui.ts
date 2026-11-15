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
  /**
   * How long the message that explains a refused order stays on the screen,
   * in milliseconds. The population number stays red as long.
   */
  noticeMs: 2500,
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
  /**
   * A beaten unit catches up with its real place over this time, in
   * milliseconds, after it has knelt where it was beaten.
   */
  defeatCatchUpMs: 600,
  /** How often the frame counter (?debug=1) is written, in milliseconds. */
  debugIntervalMs: 500,
  /**
   * Damage shown on a finished building. With less than `smokeBelow` of its
   * life it smokes, and with less than `fireBelow` it burns as well.
   */
  damage: {
    smokeBelow: 0.5,
    fireBelow: 0.25,
    /**
     * Where on a building it smokes: one place per tile of its side, within
     * `spread` of the footprint counted from its middle, and between
     * `lowest` and `highest` of the way up to the top of the roof.
     */
    sources: { spread: 0.6, lowest: 0.3, highest: 0.55 },
    /** Puffs in each column of smoke. */
    puffs: 3,
    /** How long a puff takes from the roof until it is gone, in milliseconds. */
    puffMs: 2200,
    /** How far a puff rises in that time, and how far it drifts to the right, in pixels. */
    risePx: 44,
    driftPx: 8,
    /** How solid a puff is at its thickest; it thins to nothing as it rises. */
    puffAlpha: 0.9,
    /** A puff grows from this size to that as it rises; 1 is the size of its picture. */
    puffScale: { start: 0.7, end: 1.5 },
    /** How long each of the four pictures of a fire shows, in milliseconds. */
    flameMs: 110,
    /** How large a fire is drawn; 1 is the size of its picture. */
    flameScale: 1.3,
    /** How far above its fire a column of smoke starts, in pixels. */
    smokeAboveFire: 12,
  },
  /** What a building shoots, as it is drawn. */
  projectile: {
    /** How high above the straight line it flies at the top of its arc, in pixels for each tile it has to go. */
    arcPxPerTile: 4,
    /** How far above the ground it lands on its target, in pixels: about the chest of a unit. */
    targetHeightPx: 14,
    /** How long the burst where it lands shows, in milliseconds, and how it grows meanwhile; 1 is the size of its picture. */
    hitMs: 220,
    hitScale: { start: 0.7, end: 1.6 },
  },
  /** The ring that shows how far a selected or about-to-be-placed building shoots: its colour and how solid it is. */
  rangeRing: { color: 0xffd166, alpha: 0.7, width: 2 },
  /** Touch: how far, in pixels, a finger may move and still count as a tap. */
  touchSlopPx: 10,
  /** Touch: how long a finger must rest before dragging it draws a selection box instead of moving the camera, in milliseconds. */
  touchHoldMs: 300,
  /** Touch: radius, in pixels, of the ring shown under a finger that has rested long enough. */
  touchHoldRingRadius: 28,
} as const;
