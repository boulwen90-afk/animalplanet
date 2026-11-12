import type { Cameras, Input, Scene } from 'phaser';
import { CAMERA_CONFIG } from '../../data/camera';
import { clampWorldToMap, type MapSize, type TileSize } from '../../sim/map/iso';

type PanKeys = Record<'up' | 'down' | 'left' | 'right' | 'w' | 'a' | 's' | 'd', Input.Keyboard.Key>;

/**
 * Moves the main camera: arrow keys / WASD, mouse at the screen edge,
 * middle-button drag and one-finger touch drag. The centre of the view always
 * stays on the map, so the map can never be scrolled out of sight.
 */
export class CameraController {
  private readonly camera: Cameras.Scene2D.Camera;
  private readonly keys: PanKeys | undefined;
  /** Id of the pointer currently dragging the camera, if any. */
  private dragPointerId: number | undefined;
  private dragLastX = 0;
  private dragLastY = 0;
  /** Edge panning waits for real mouse movement, so it never starts on touch devices. */
  private mouseSeen = false;

  constructor(
    private readonly scene: Scene,
    private readonly map: MapSize,
    private readonly tileSize: TileSize,
  ) {
    this.camera = scene.cameras.main;

    this.keys = scene.input.keyboard?.addKeys({
      up: 'UP',
      down: 'DOWN',
      left: 'LEFT',
      right: 'RIGHT',
      w: 'W',
      a: 'A',
      s: 'S',
      d: 'D',
    }) as PanKeys | undefined;

    scene.input.on('pointerdown', this.onPointerDown, this);
    scene.input.on('pointermove', this.onPointerMove, this);
    scene.input.on('pointerup', this.onPointerUp, this);
    scene.input.on('pointerupoutside', this.onPointerUp, this);
  }

  /** Centres the view on a world position (clamped to the map). */
  centerOn(worldX: number, worldY: number): void {
    this.setScroll(worldX - this.camera.width / 2, worldY - this.camera.height / 2);
  }

  update(deltaMs: number): void {
    const seconds = deltaMs / 1000;
    let dx = 0;
    let dy = 0;

    const keys = this.keys;
    if (keys) {
      const step = CAMERA_CONFIG.keyPanSpeed * seconds;
      if (keys.left.isDown || keys.a.isDown) dx -= step;
      if (keys.right.isDown || keys.d.isDown) dx += step;
      if (keys.up.isDown || keys.w.isDown) dy -= step;
      if (keys.down.isDown || keys.s.isDown) dy += step;
    }

    if (this.canEdgePan()) {
      const pointer = this.scene.input.activePointer;
      const margin = CAMERA_CONFIG.edgePanMargin;
      const step = CAMERA_CONFIG.edgePanSpeed * seconds;
      if (pointer.x <= margin) dx -= step;
      if (pointer.x >= this.camera.width - margin) dx += step;
      if (pointer.y <= margin) dy -= step;
      if (pointer.y >= this.camera.height - margin) dy += step;
    }

    // Always re-clamp, so the view stays valid when the window is resized.
    this.setScroll(this.camera.scrollX + dx, this.camera.scrollY + dy);
  }

  private canEdgePan(): boolean {
    const input = this.scene.input;
    return (
      this.mouseSeen &&
      this.dragPointerId === undefined &&
      input.isOver &&
      !input.activePointer.wasTouch
    );
  }

  private onPointerDown(pointer: Input.Pointer): void {
    if (this.dragPointerId !== undefined) return;
    if (pointer.wasTouch || pointer.middleButtonDown()) {
      this.dragPointerId = pointer.id;
      this.dragLastX = pointer.x;
      this.dragLastY = pointer.y;
    }
  }

  private onPointerMove(pointer: Input.Pointer): void {
    if (!pointer.wasTouch) this.mouseSeen = true;
    if (pointer.id !== this.dragPointerId) return;
    // Dragging moves the world with the pointer, so the camera scrolls the other way.
    this.setScroll(
      this.camera.scrollX - (pointer.x - this.dragLastX),
      this.camera.scrollY - (pointer.y - this.dragLastY),
    );
    this.dragLastX = pointer.x;
    this.dragLastY = pointer.y;
  }

  private onPointerUp(pointer: Input.Pointer): void {
    if (pointer.id === this.dragPointerId) this.dragPointerId = undefined;
  }

  private setScroll(x: number, y: number): void {
    const { camera } = this;
    const halfWidth = camera.width / 2;
    const halfHeight = camera.height / 2;
    const centre = clampWorldToMap(x + halfWidth, y + halfHeight, this.map, this.tileSize);
    camera.scrollX = centre.x - halfWidth;
    camera.scrollY = centre.y - halfHeight;
  }
}
