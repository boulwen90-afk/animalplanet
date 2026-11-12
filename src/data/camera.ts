/** Camera feel. See GDD section 11. */
export const CAMERA_CONFIG = {
  /** Pan speed with arrow keys / WASD, in pixels per second. */
  keyPanSpeed: 900,
  /** Pan speed when the mouse rests at the screen edge, in pixels per second. */
  edgePanSpeed: 900,
  /** Distance from the screen edge, in pixels, where edge panning starts. */
  edgePanMargin: 20,
  /**
   * Longest time, in milliseconds, one frame may move the camera. Keeps the
   * view from jumping after a long pause, such as switching browser tabs.
   */
  maxFrameMs: 100,
} as const;
