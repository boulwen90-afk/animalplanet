import type { Input, Scene } from 'phaser';
import { UI_CONFIG } from '../../data/ui';
import type { Point } from '../../sim/map/iso';
import type { SelectionView } from '../views/SelectionView';
import { rectFromPoints } from './picking';
import {
  ageGesture,
  endGesture,
  moveGesture,
  startGesture,
  type TouchGesture,
  type TouchMode,
} from './touchGesture';

export interface TouchControllerDeps {
  /** True if a screen position is covered by the interface rather than the map. */
  isOverHud(screenX: number, screenY: number): boolean;
  /** False when a rested finger should not draw a selection box, as while placing a building. */
  canBox(): boolean;
  /** Moves the camera by a number of pixels. */
  pan(dx: number, dy: number): void;
  /** A finger was put down and lifted without moving. */
  tap(screenX: number, screenY: number): void;
  /** A finger rested, was dragged and lifted: select what is between the two world positions. */
  box(startWorld: Point, endWorld: Point): void;
  view: SelectionView;
}

/**
 * One finger on the map: a tap selects or gives an order, a drag moves the
 * camera, and a drag that starts after the finger has rested for
 * UI_CONFIG.touchHoldMs draws a selection box. A ring under the finger shows
 * when it has rested long enough. A touch that starts on the interface is
 * left to the interface.
 */
export class TouchController {
  private pointerId: number | undefined;
  private gesture: TouchGesture | undefined;
  private startWorld: Point = { x: 0, y: 0 };
  private lastX = 0;
  private lastY = 0;

  constructor(
    private readonly scene: Scene,
    private readonly deps: TouchControllerDeps,
  ) {
    scene.input.on('pointerdown', this.onPointerDown, this);
    scene.input.on('pointermove', this.onPointerMove, this);
    scene.input.on('pointerup', this.onPointerUp, this);
    scene.input.on('pointerupoutside', this.onPointerUp, this);
  }

  /** What the finger on the map is doing, or 'none' when there is none. */
  get mode(): TouchMode | 'none' {
    return this.gesture?.mode ?? 'none';
  }

  /** Lets a resting finger's time pass. Call once per frame. */
  update(elapsedMs: number): void {
    const gesture = this.gesture;
    if (!gesture) return;
    ageGesture(gesture, elapsedMs, this.deps.canBox(), UI_CONFIG);
    this.deps.view.setHoldRing(gesture.mode === 'held' ? this.startWorld : undefined);
  }

  private worldPoint(pointer: Input.Pointer): Point {
    const point = this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
    return { x: point.x, y: point.y };
  }

  private onPointerDown(pointer: Input.Pointer): void {
    if (!pointer.wasTouch || this.gesture) return;
    if (this.deps.isOverHud(pointer.x, pointer.y)) return;
    this.pointerId = pointer.id;
    this.gesture = startGesture(pointer.x, pointer.y);
    this.startWorld = this.worldPoint(pointer);
    this.lastX = pointer.x;
    this.lastY = pointer.y;
  }

  private onPointerMove(pointer: Input.Pointer): void {
    const gesture = this.gesture;
    if (!gesture || pointer.id !== this.pointerId) return;
    moveGesture(gesture, pointer.x, pointer.y, UI_CONFIG);

    if (gesture.mode === 'pan') {
      // Dragging moves the world with the finger, so the camera scrolls the other way.
      this.deps.pan(this.lastX - pointer.x, this.lastY - pointer.y);
      this.lastX = pointer.x;
      this.lastY = pointer.y;
    } else if (gesture.mode === 'box') {
      this.deps.view.setHoldRing(undefined);
      this.deps.view.setDragBox(rectFromPoints(this.startWorld, this.worldPoint(pointer)));
    }
  }

  private onPointerUp(pointer: Input.Pointer): void {
    const gesture = this.gesture;
    if (!gesture || pointer.id !== this.pointerId) return;
    this.gesture = undefined;
    this.pointerId = undefined;
    this.deps.view.setHoldRing(undefined);
    this.deps.view.setDragBox(undefined);

    const outcome = endGesture(gesture);
    if (outcome === 'tap') this.deps.tap(gesture.startX, gesture.startY);
    else if (outcome === 'box') this.deps.box(this.startWorld, this.worldPoint(pointer));
  }
}
