import type { Scene } from 'phaser';
import { parseHexColor, recolorPixels } from '../characters/recolor';
import { SCENERY_SOURCE } from './assets';

/** The part of the scenery's atlas file the game reads besides the pictures. */
interface AtlasFile {
  frames: Record<string, unknown>;
  meta: {
    /** How many times larger than game pixels the pictures are. */
    scale: number;
    /** The grey the team-coloured parts are rendered in, as "#rrggbb". */
    neutral: string;
    scenery: {
      /** Every picture is this many pixels square before the empty space round it is trimmed away. */
      frame: number;
      /** How tall each standing item is on the screen, in game pixels. */
      items: Record<string, { kind: string; height: number }>;
    };
  };
}

const key = (part: string) => `scenery-${part}`;

/**
 * Loads the scenery's atlas and colours it for each player, as the building
 * and character atlases are: a cave flies its side's colour. Trees and the
 * rest have no team colour and look the same in every copy; the first is
 * used for them.
 */
export class SceneryLibrary {
  /** Side of a picture before trimming, in game pixels, and where in it the middle of the tile is. */
  readonly frame: number;
  readonly anchor: { x: number; y: number };
  private readonly heights: Record<string, { kind: string; height: number }>;

  /** Queues the files. Call from a scene's preload. */
  static preload(scene: Scene): void {
    scene.load.json(key('atlas'), SCENERY_SOURCE.atlasUrl);
    scene.load.image(key('base'), SCENERY_SOURCE.baseUrl);
    scene.load.image(key('mask'), SCENERY_SOURCE.maskUrl);
  }

  /** Builds one coloured texture per player colour. Call from a scene's create, after preload. */
  constructor(scene: Scene, playerColors: readonly number[]) {
    const atlas = scene.cache.json.get(key('atlas')) as AtlasFile;
    const base = scene.textures.get(key('base')).getSourceImage() as HTMLImageElement;
    const mask = scene.textures.get(key('mask')).getSourceImage() as HTMLImageElement;
    const { width, height } = base;
    const basePixels = readPixels(base, width, height);
    const maskPixels = readPixels(mask, width, height);
    const neutral = parseHexColor(atlas.meta.neutral);

    playerColors.forEach((color, owner) => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('No 2D canvas to colour the scenery on');
      const colored = recolorPixels(basePixels, maskPixels, color, neutral);
      context.putImageData(new ImageData(colored, width, height), 0, 0);
      // Phaser takes a canvas wherever it takes an image.
      scene.textures.addAtlas(key(`player-${owner}`), canvas as unknown as HTMLImageElement, atlas);
    });
    scene.textures.remove(key('base'));
    scene.textures.remove(key('mask'));

    const frame = atlas.meta.scenery.frame / atlas.meta.scale;
    const first = Object.values(atlas.frames)[0] as { anchor: { x: number; y: number } };
    this.frame = frame;
    this.anchor = { x: first.anchor.x * frame, y: first.anchor.y * frame };
    this.heights = atlas.meta.scenery.items;
  }

  /** Key of the texture in a player's colour. Without a player: the first, for what has no team colour. */
  textureKey(owner = 0): string {
    return key(`player-${owner}`);
  }

  /**
   * A picture as a mouse pointer for the game's canvas: the picture itself,
   * with the point that points at `hotspot` of the way across and down it.
   * Where the picture cannot be read it is the given standard pointer.
   */
  pointer(
    scene: Scene,
    frame: string,
    hotspot: { x: number; y: number },
    fallback: string,
  ): string {
    const picture = scene.textures.getFrame(this.textureKey(), frame);
    if (!picture) return fallback;
    const url = scene.textures.getBase64(this.textureKey(), frame);
    if (!url) return fallback;
    const x = Math.round(picture.cutWidth * hotspot.x);
    const y = Math.round(picture.cutHeight * hotspot.y);
    return `url(${url}) ${x} ${y}, ${fallback}`;
  }

  /** How tall a standing item is on the screen, in game pixels; 0 for a picture that lies flat. */
  heightOf(frame: string): number {
    return this.heights[frame]?.height ?? 0;
  }
}

function readPixels(image: HTMLImageElement, width: number, height: number): Uint8ClampedArray {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('No 2D canvas to read the scenery from');
  context.drawImage(image, 0, 0);
  return context.getImageData(0, 0, width, height).data;
}
