import type { GameObjects, Scene } from 'phaser';
import { UI_CONFIG } from '../../data/ui';
import type { WorldRect } from '../input/picking';
import { SELECTION_COLOR } from './visuals';

/** Depth of marks drawn on the ground. */
const GROUND_MARK_DEPTH = -0.4;
/** Depth of the drag box: in front of everything in the world. */
const OVERLAY_DEPTH = 1_000_000;

interface OrderMarker {
  x: number;
  y: number;
  ageMs: number;
}

/** Draws the drag box and the rings that confirm move orders. */
export class SelectionView {
  private readonly ground: GameObjects.Graphics;
  private readonly overlay: GameObjects.Graphics;
  private readonly markers: OrderMarker[] = [];
  private dragBox: WorldRect | undefined;

  constructor(scene: Scene) {
    this.ground = scene.add.graphics().setDepth(GROUND_MARK_DEPTH);
    this.overlay = scene.add.graphics().setDepth(OVERLAY_DEPTH);
  }

  /** Shows the drag box, in world coordinates, or hides it. */
  setDragBox(rect: WorldRect | undefined): void {
    this.dragBox = rect;
  }

  /** Starts a ring at a world position that shrinks and fades away. */
  addOrderMarker(x: number, y: number): void {
    this.markers.push({ x, y, ageMs: 0 });
  }

  /** Number of order rings currently visible. */
  get orderMarkerCount(): number {
    return this.markers.length;
  }

  update(elapsedMs: number): void {
    this.overlay.clear();
    if (this.dragBox) {
      const { x, y, width, height } = this.dragBox;
      this.overlay.fillStyle(SELECTION_COLOR, 0.2);
      this.overlay.fillRect(x, y, width, height);
      this.overlay.lineStyle(1, SELECTION_COLOR, 1);
      this.overlay.strokeRect(x, y, width, height);
    }

    this.ground.clear();
    for (let i = this.markers.length - 1; i >= 0; i--) {
      const marker = this.markers[i] as OrderMarker;
      marker.ageMs += elapsedMs;
      const t = marker.ageMs / UI_CONFIG.orderMarkerMs;
      if (t >= 1) {
        this.markers.splice(i, 1);
        continue;
      }
      const radius =
        UI_CONFIG.orderMarkerStartRadius +
        (UI_CONFIG.orderMarkerEndRadius - UI_CONFIG.orderMarkerStartRadius) * t;
      this.ground.lineStyle(2, SELECTION_COLOR, 1 - t);
      // Flattened to lie on the ground in the isometric view.
      this.ground.strokeEllipse(marker.x, marker.y, radius * 2, radius);
    }
  }
}
