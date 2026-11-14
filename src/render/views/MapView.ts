import type { GameObjects, Scene } from 'phaser';
import { RESOURCE_DEFS } from '../../data/resources';
import { TERRAIN_DEFS, type Terrain } from '../../data/terrain';
import type { GameMap } from '../../sim/map/grid';
import { tileCenterToWorld, tileToWorld, type Point, type TileSize } from '../../sim/map/iso';
import type { SceneryLibrary } from '../scenery/SceneryLibrary';
import { FISHING_PLACE_FRAME, objectFrame, remainsFrame, waterFrames } from '../scenery/scenery';

/** Depth of the flat ground layer. Everything standing on the map is drawn above it. */
const GROUND_DEPTH = -1;
/** Depth of the water and the shore: on the grass, since the sand of a shore lies over the grass beside it. */
const WATER_DEPTH = -0.95;
/**
 * Depth of what lies on the ground: stumps, bare bushes and the marks of
 * fishing places. Under fields, selection marks, shadows and everything that stands.
 */
const REMAINS_DEPTH = -0.7;

/**
 * How far a standing object reaches from the middle of its tile, in pixels:
 * to either side, down to its foot and shadow, and up to the top of the
 * tallest tree. An object this far outside the view cannot be seen.
 */
const OBJECT_REACH = { side: 48, below: 24, above: 100 } as const;

/** The part of the world a camera shows, in world pixels. */
export interface WorldView {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

const COLORS = { grassFill: 0x5a8f3c, grassEdge: 0x3f6b2a } as const;
const GRASS_TEXTURE = 'tile-grass';

/** What is drawn on a tile, for tests. */
export interface SceneryInfo {
  /** The picture of what stands on the tile: a tree, a bush or a rock. */
  object: string | null;
  /** The pictures lying on the tile's ground: a stump, a bare bush, the marks of a fishing place. */
  lying: string[];
  /** The pictures the tile's water is made of: the water and its pieces of shore. Empty on land. */
  water: string[];
}

interface StandingObject {
  image: GameObjects.Image;
  terrain: Terrain;
  frame: string;
  x: number;
  y: number;
}

/**
 * Draws the map: grass everywhere, water with a shore where it meets land,
 * and on top of that the trees, berry bushes and rocks, sorted so that
 * objects further down the screen cover the ones behind them. A source that
 * has been emptied leaves something on the ground: a stump or a bare bush.
 */
export class MapView {
  /** The object standing on each tile that has one, by tile index. */
  private readonly objects = new Map<number, StandingObject>();
  /** What an emptied source has left on a tile, by tile index. */
  private readonly remains = new Map<number, { bob: GameObjects.Bob; frame: string }>();
  /** The marks of fishing places, by tile index. */
  private readonly fishing = new Map<number, GameObjects.Bob>();
  /** The pictures each water tile is made of, by tile index. */
  private readonly water = new Map<number, string[]>();
  private readonly lying: GameObjects.Blitter;
  private readonly width: number;

  constructor(
    scene: Scene,
    map: GameMap,
    private readonly size: TileSize,
    private readonly scenery: SceneryLibrary,
  ) {
    createGrassTexture(scene, size);
    this.width = map.width;
    const texture = scenery.textureKey();
    // A blitter draws all its pictures in a single call. Its pictures are
    // drawn in the order they were made: every tile of water first, then
    // the shore, which lies over water and grass alike.
    const grass = scene.add.blitter(0, 0, GRASS_TEXTURE).setDepth(GROUND_DEPTH);
    const waters = scene.add.blitter(0, 0, texture).setDepth(WATER_DEPTH);
    this.lying = scene.add.blitter(0, 0, texture).setDepth(REMAINS_DEPTH);

    const isWater = (x: number, y: number) =>
      x < 0 || y < 0 || x >= map.width || y >= map.height
        ? true
        : map.terrain[y * map.width + x] === 'water';
    const shore: { x: number; y: number; frame: string }[] = [];

    for (let ty = 0; ty < map.height; ty++) {
      for (let tx = 0; tx < map.width; tx++) {
        const index = ty * map.width + tx;
        const terrain = map.terrain[index] as Terrain;
        const top = tileToWorld(tx, ty, size);
        grass.create(top.x - size.tileWidth / 2, top.y);

        if (terrain === 'water') {
          const [first, ...rest] = waterFrames(isWater, tx, ty);
          const at = this.cornerOf(tx, ty);
          if (first) waters.create(at.x, at.y, first);
          for (const frame of rest) shore.push({ ...at, frame });
          this.water.set(index, first ? [first, ...rest] : rest);
        }

        const frame = objectFrame(terrain, tx, ty, this.shareLeft(map, index, terrain));
        if (frame) {
          // An object stands on the middle of its tile and is sorted by that point's height on the screen.
          const centre = tileCenterToWorld(tx, ty, size);
          const image = scene.add.image(centre.x, centre.y, texture, frame).setDepth(centre.y);
          this.objects.set(index, { image, terrain, frame, x: tx, y: ty });
        }
      }
    }
    for (const piece of shore) waters.create(piece.x, piece.y, piece.frame);
  }

  /**
   * Follows what happens to the sources: a berry bush shows fewer berries
   * as it is picked, and a tree or a bush that has been emptied is taken
   * away and leaves a stump or a bare bush on the ground.
   *
   * `isExplored` says whether the player has seen a tile. Objects on unseen
   * tiles are hidden altogether: they are taller than a tile and would
   * otherwise stick up out of the fog.
   *
   * `view` is the part of the world the camera shows. Objects outside it are
   * not drawn: there are hundreds on a map and a screen shows a fraction.
   */
  update(map: GameMap, isExplored: (index: number) => boolean, view?: WorldView): void {
    for (const [index, object] of this.objects) {
      if (map.terrain[index] !== object.terrain) {
        object.image.destroy();
        this.objects.delete(index);
        const left = remainsFrame(object.terrain);
        if (left) {
          const at = this.cornerOf(object.x, object.y);
          this.remains.set(index, { bob: this.lying.create(at.x, at.y, left), frame: left });
        }
        continue;
      }
      if (object.terrain === 'berries') {
        const frame = objectFrame(
          'berries',
          object.x,
          object.y,
          this.shareLeft(map, index, 'berries'),
        );
        if (frame && frame !== object.frame) {
          object.image.setFrame(frame);
          object.frame = frame;
        }
      }
      const { image } = object;
      const inView =
        view === undefined ||
        (image.x >= view.left - OBJECT_REACH.side &&
          image.x <= view.right + OBJECT_REACH.side &&
          image.y >= view.top - OBJECT_REACH.below &&
          image.y <= view.bottom + OBJECT_REACH.above);
      const shown = inView && isExplored(index);
      if (image.visible !== shown) image.setVisible(shown);
    }
  }

  /** Marks the tiles where fishers stand, or would stand, by the fishing huts in sight. */
  showFishingPlaces(tiles: readonly Point[]): void {
    const wanted = new Set(tiles.map((tile) => tile.y * this.width + tile.x));
    for (const [index, bob] of this.fishing) {
      if (wanted.has(index)) continue;
      bob.destroy();
      this.fishing.delete(index);
    }
    for (const tile of tiles) {
      const index = tile.y * this.width + tile.x;
      if (this.fishing.has(index)) continue;
      const at = this.cornerOf(tile.x, tile.y);
      this.fishing.set(index, this.lying.create(at.x, at.y, FISHING_PLACE_FRAME));
    }
  }

  /** What is drawn on a tile right now. */
  describe(tileX: number, tileY: number): SceneryInfo {
    const index = tileY * this.width + tileX;
    const lying: string[] = [];
    const left = this.remains.get(index);
    if (left) lying.push(left.frame);
    if (this.fishing.has(index)) lying.push(FISHING_PLACE_FRAME);
    return {
      object: this.objects.get(index)?.frame ?? null,
      lying,
      water: this.water.get(index) ?? [],
    };
  }

  /** How many things stand on the map: the pictures that are sorted and drawn one by one. */
  get objectCount(): number {
    return this.objects.size;
  }

  /** Where the corner of a picture goes for the middle of a tile to land on the tile's middle. */
  private cornerOf(tileX: number, tileY: number): Point {
    const centre = tileCenterToWorld(tileX, tileY, this.size);
    return { x: centre.x - this.scenery.anchor.x, y: centre.y - this.scenery.anchor.y };
  }

  /** What is left in a tile's source, as a share of what it started with; 1 for terrain without one. */
  private shareLeft(map: GameMap, index: number, terrain: Terrain): number {
    const resource = TERRAIN_DEFS[terrain].resource;
    if (!resource) return 1;
    return (map.resourceAmount[index] ?? 0) / RESOURCE_DEFS[resource].amountPerNode;
  }
}

/** The grass: a flat diamond with a darker line round it, made once. */
function createGrassTexture(scene: Scene, size: TileSize): void {
  if (scene.textures.exists(GRASS_TEXTURE)) return;
  const w = size.tileWidth;
  const h = size.tileHeight;
  const g = scene.make.graphics({}, false);
  const diamond = [
    { x: w / 2, y: 0.5 },
    { x: w - 0.5, y: h / 2 },
    { x: w / 2, y: h - 0.5 },
    { x: 0.5, y: h / 2 },
  ];
  g.fillStyle(COLORS.grassFill, 1);
  g.fillPoints(diamond, true);
  g.lineStyle(1, COLORS.grassEdge, 1);
  g.strokePoints(diamond, true);
  g.generateTexture(GRASS_TEXTURE, w, h);
  g.destroy();
}
