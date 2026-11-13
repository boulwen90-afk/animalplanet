import type { GameObjects, Scene } from 'phaser';
import { tileToWorld, type MapSize, type TileSize } from '../../sim/map/iso';
import { EXPLORED, UNEXPLORED, VISIBLE } from '../../sim/state';
import { FOG_VISUAL } from './visuals';

const FOG_TEXTURE = 'tile-fog';
/** Depth of the fog: over everything on the map, under life bars and other marks. */
const FOG_DEPTH = 800_000;

/**
 * Draws the fog of war as one dark diamond per tile: solid over tiles the
 * player has never seen, half see-through over tiles seen before but out of
 * sight now, and nothing over tiles in sight.
 */
export class FogView {
  private readonly bobs: GameObjects.Bob[] = [];
  /** What each tile's diamond was last drawn for, so that only changes are redrawn. */
  private readonly shown: number[];

  constructor(scene: Scene, map: MapSize, size: TileSize) {
    // Each diamond is a pixel larger than its tile all round. Without the
    // overlap, thin gaps between the diamonds let the tile edges show through
    // the fog, which would give away lakes in unexplored land.
    const bleed = FOG_VISUAL.bleed;
    const w = size.tileWidth + 2 * bleed;
    const h = size.tileHeight + 2 * bleed;
    if (!scene.textures.exists(FOG_TEXTURE)) {
      const g = scene.make.graphics({}, false);
      g.fillStyle(FOG_VISUAL.color, 1);
      g.fillPoints(
        [
          { x: w / 2, y: 0 },
          { x: w, y: h / 2 },
          { x: w / 2, y: h },
          { x: 0, y: h / 2 },
        ],
        true,
      );
      g.generateTexture(FOG_TEXTURE, w, h);
      g.destroy();
    }

    const blitter = scene.add.blitter(0, 0, FOG_TEXTURE).setDepth(FOG_DEPTH);
    for (let ty = 0; ty < map.height; ty++) {
      for (let tx = 0; tx < map.width; tx++) {
        const top = tileToWorld(tx, ty, size);
        this.bobs.push(blitter.create(top.x - w / 2, top.y - bleed));
      }
    }
    // Everything starts out covered, as if unexplored.
    this.shown = new Array<number>(this.bobs.length).fill(UNEXPLORED);
  }

  /** Redraws the tiles whose state has changed. */
  update(visibility: readonly number[]): void {
    for (let i = 0; i < this.bobs.length; i++) {
      const state = visibility[i] ?? UNEXPLORED;
      if (state === this.shown[i]) continue;
      this.shown[i] = state;
      const bob = this.bobs[i] as GameObjects.Bob;
      bob.setVisible(state !== VISIBLE);
      bob.setAlpha(state === EXPLORED ? FOG_VISUAL.exploredAlpha : 1);
    }
  }
}
