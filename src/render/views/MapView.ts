import type { Scene } from 'phaser';
import { tileToWorld, type MapSize, type TileSize } from '../../sim/map/iso';

const GRASS_TEXTURE = 'tile-grass';
const GRASS_FILL = 0x5a8f3c;
const GRASS_EDGE = 0x3f6b2a;

/** Draws the ground tiles. Phase 1: every tile is grass. */
export class MapView {
  constructor(scene: Scene, map: MapSize, size: TileSize) {
    createDiamondTexture(scene, GRASS_TEXTURE, size, GRASS_FILL, GRASS_EDGE);

    // A Blitter draws many copies of one texture cheaply.
    const blitter = scene.add.blitter(0, 0, GRASS_TEXTURE);
    for (let ty = 0; ty < map.height; ty++) {
      for (let tx = 0; tx < map.width; tx++) {
        const top = tileToWorld(tx, ty, size);
        blitter.create(top.x - size.tileWidth / 2, top.y);
      }
    }
  }
}

function createDiamondTexture(
  scene: Scene,
  key: string,
  size: TileSize,
  fill: number,
  edge: number,
): void {
  if (scene.textures.exists(key)) return;
  const w = size.tileWidth;
  const h = size.tileHeight;
  const points = [
    { x: w / 2, y: 0.5 },
    { x: w - 0.5, y: h / 2 },
    { x: w / 2, y: h - 0.5 },
    { x: 0.5, y: h / 2 },
  ];
  const graphics = scene.make.graphics({}, false);
  graphics.fillStyle(fill, 1);
  graphics.fillPoints(points, true);
  graphics.lineStyle(1, edge, 1);
  graphics.strokePoints(points, true);
  graphics.generateTexture(key, w, h);
  graphics.destroy();
}
