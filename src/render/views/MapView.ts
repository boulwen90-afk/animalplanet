import type { GameObjects, Scene } from 'phaser';
import type { Terrain } from '../../data/terrain';
import type { GameMap } from '../../sim/map/grid';
import { tileCenterToWorld, tileToWorld, type TileSize } from '../../sim/map/iso';
import { TERRAIN_OBJECT_VISUALS } from './visuals';

/** Depth of the flat ground layer. Everything standing on the map is drawn above it. */
const GROUND_DEPTH = -1;

const COLORS = {
  grassFill: 0x5a8f3c,
  grassEdge: 0x3f6b2a,
  waterFill: 0x2f6fb5,
  waterEdge: 0x245a94,
  treeLeaves: 0x1f5c2a,
  treeLeavesEdge: 0x143d1c,
  treeTrunk: 0x6b4423,
  bushLeaves: 0x2f6b2f,
  berries: 0xc8243a,
  berriesEdge: 0x7d1322,
  rockTop: 0x9a9a9a,
  rockLeft: 0x6f6f6f,
  rockRight: 0x565656,
} as const;

/** Flat ground texture drawn under each terrain type. */
const GROUND_TEXTURE: Record<Terrain, string> = {
  grass: 'tile-grass',
  tree: 'tile-grass',
  berries: 'tile-grass',
  rock: 'tile-grass',
  water: 'tile-water',
  // The cave itself is drawn by CaveView.
  cave: 'tile-grass',
};

/** Texture of the object standing on a tile, for terrain that has one. */
const OBJECT_TEXTURE: Partial<Record<Terrain, string>> = {
  tree: 'obj-tree',
  berries: 'obj-berries',
  rock: 'obj-rock',
};

/**
 * Draws the map: a flat ground layer, and on top of it the trees, berry
 * bushes and rocks, sorted so that objects further down the screen cover
 * the ones behind them.
 */
export class MapView {
  /** The object drawn on each tile that has one, by tile index. */
  private readonly objects = new Map<number, { image: GameObjects.Image; terrain: Terrain }>();

  constructor(scene: Scene, map: GameMap, size: TileSize) {
    createTextures(scene, size);

    // One Blitter per ground texture draws all its tiles in a single call.
    const blitters = new Map<string, GameObjects.Blitter>();
    for (let ty = 0; ty < map.height; ty++) {
      for (let tx = 0; tx < map.width; tx++) {
        const index = ty * map.width + tx;
        const terrain = map.terrain[index] as Terrain;

        const key = GROUND_TEXTURE[terrain];
        let blitter = blitters.get(key);
        if (!blitter) {
          blitter = scene.add.blitter(0, 0, key).setDepth(GROUND_DEPTH);
          blitters.set(key, blitter);
        }
        const top = tileToWorld(tx, ty, size);
        blitter.create(top.x - size.tileWidth / 2, top.y);

        const objectKey = OBJECT_TEXTURE[terrain];
        if (objectKey) {
          // Objects stand on the lower part of their tile and are sorted by
          // the screen height of their tile's centre.
          const centre = tileCenterToWorld(tx, ty, size);
          const image = scene.add
            .image(centre.x, centre.y + size.tileHeight / 4, objectKey)
            .setOrigin(0.5, 1)
            .setDepth(centre.y);
          this.objects.set(index, { image, terrain });
        }
      }
    }
  }

  /**
   * Removes the objects of tiles whose terrain has changed, such as trees and
   * berry bushes that have been emptied. The ground under them is already grass.
   *
   * `isExplored` says whether the player has seen a tile. Objects on unseen
   * tiles are hidden altogether: they are taller than a tile and would
   * otherwise stick up out of the fog.
   */
  update(map: GameMap, isExplored: (index: number) => boolean): void {
    for (const [index, object] of this.objects) {
      if (map.terrain[index] !== object.terrain) {
        object.image.destroy();
        this.objects.delete(index);
        continue;
      }
      const explored = isExplored(index);
      if (object.image.visible !== explored) object.image.setVisible(explored);
    }
  }
}

function objectSize(terrain: Terrain): { width: number; height: number } {
  const size = TERRAIN_OBJECT_VISUALS[terrain];
  if (!size) throw new Error(`No object is drawn for terrain '${terrain}'`);
  return size;
}

function createTextures(scene: Scene, size: TileSize): void {
  if (scene.textures.exists('tile-grass')) return;
  const w = size.tileWidth;
  const h = size.tileHeight;
  const g = scene.make.graphics({}, false);

  const diamond = [
    { x: w / 2, y: 0.5 },
    { x: w - 0.5, y: h / 2 },
    { x: w / 2, y: h - 0.5 },
    { x: 0.5, y: h / 2 },
  ];
  const ground = (key: string, fill: number, edge: number) => {
    g.clear();
    g.fillStyle(fill, 1);
    g.fillPoints(diamond, true);
    g.lineStyle(1, edge, 1);
    g.strokePoints(diamond, true);
    g.generateTexture(key, w, h);
  };
  ground('tile-grass', COLORS.grassFill, COLORS.grassEdge);
  ground('tile-water', COLORS.waterFill, COLORS.waterEdge);

  // Tree: a green triangle on a short trunk, taller than a tile.
  const { width: treeW, height: treeH } = objectSize('tree');
  const trunkH = Math.round(h * 0.3);
  g.clear();
  g.fillStyle(COLORS.treeTrunk, 1);
  g.fillRect(treeW / 2 - 3, treeH - trunkH - 1, 6, trunkH);
  g.fillStyle(COLORS.treeLeaves, 1);
  g.lineStyle(1, COLORS.treeLeavesEdge, 1);
  const crown = [
    { x: treeW / 2, y: 1 },
    { x: treeW - 1, y: treeH - trunkH },
    { x: 1, y: treeH - trunkH },
  ];
  g.fillPoints(crown, true);
  g.strokePoints(crown, true);
  g.generateTexture('obj-tree', treeW, treeH);

  // Berry bush: a red circle on a low green bush.
  const { width: bushW, height: bushH } = objectSize('berries');
  g.clear();
  g.fillStyle(COLORS.bushLeaves, 1);
  g.fillEllipse(bushW / 2, bushH - bushH * 0.3, bushW - 2, bushH * 0.6 - 1);
  g.fillStyle(COLORS.berries, 1);
  g.lineStyle(1, COLORS.berriesEdge, 1);
  g.fillCircle(bushW / 2, bushH * 0.4, bushH * 0.36);
  g.strokeCircle(bushW / 2, bushH * 0.4, bushH * 0.36);
  g.generateTexture('obj-berries', bushW, bushH);

  // Rock: a grey block the size of a tile, raised above the ground.
  const lift = Math.round(h * 0.5);
  g.clear();
  g.fillStyle(COLORS.rockLeft, 1);
  g.fillPoints(
    [
      { x: 0, y: h / 2 },
      { x: w / 2, y: h },
      { x: w / 2, y: h + lift },
      { x: 0, y: h / 2 + lift },
    ],
    true,
  );
  g.fillStyle(COLORS.rockRight, 1);
  g.fillPoints(
    [
      { x: w / 2, y: h },
      { x: w, y: h / 2 },
      { x: w, y: h / 2 + lift },
      { x: w / 2, y: h + lift },
    ],
    true,
  );
  g.fillStyle(COLORS.rockTop, 1);
  g.fillPoints(
    [
      { x: w / 2, y: 0 },
      { x: w, y: h / 2 },
      { x: w / 2, y: h },
      { x: 0, y: h / 2 },
    ],
    true,
  );
  g.generateTexture('obj-rock', w, h + lift);

  g.destroy();
}
