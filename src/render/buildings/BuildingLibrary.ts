import type { Scene } from 'phaser';
import type { BuildingType } from '../../data/types';
import { parseHexColor, recolorPixels } from '../characters/recolor';
import { BUILDING_ART, type BuildingSource } from './buildings';

/** The part of a building's atlas file the game reads besides the pictures. */
interface AtlasFile {
  frames: Record<string, unknown>;
  meta: {
    /** How many times larger than game pixels the pictures are. */
    scale: number;
    /** The grey the team-coloured parts are rendered in, as "#rrggbb". */
    neutral: string;
    building: {
      /** From the ground to the top of the roof, in game pixels. */
      roofHeight: number;
      /** To the top of the tallest part, a banner or pennant included. */
      height: number;
    };
  };
}

/** A building ready to draw: one texture per player, and how tall it is. */
export interface BuildingSheet {
  name: string;
  /** Scale to draw the pictures at so that they have their size in game pixels. */
  displayScale: number;
  /** From the ground to the top of the roof, in game pixels. */
  roofHeight: number;
  /** Key of the texture in a player's colour. */
  textureKey(owner: number): string;
}

const key = (source: BuildingSource, part: string) => `building-${source.name}-${part}`;

/**
 * Loads the building atlases and colours them for each player, in the same
 * way as CharacterLibrary does for the figures: one copy of the atlas per
 * player, made once when the game starts.
 */
export class BuildingLibrary {
  private readonly sheets = new Map<BuildingType, BuildingSheet>();

  /** Queues the files. Call from a scene's preload. */
  static preload(scene: Scene): void {
    for (const source of Object.values(BUILDING_ART)) {
      scene.load.json(key(source, 'atlas'), source.atlasUrl);
      scene.load.image(key(source, 'base'), source.baseUrl);
      scene.load.image(key(source, 'mask'), source.maskUrl);
    }
  }

  /** Builds one coloured texture per player colour. Call from a scene's create, after preload. */
  constructor(scene: Scene, playerColors: readonly number[]) {
    for (const [type, source] of Object.entries(BUILDING_ART) as [BuildingType, BuildingSource][]) {
      const atlas = scene.cache.json.get(key(source, 'atlas')) as AtlasFile;
      const base = scene.textures.get(key(source, 'base')).getSourceImage() as HTMLImageElement;
      const mask = scene.textures.get(key(source, 'mask')).getSourceImage() as HTMLImageElement;
      const { width, height } = base;
      const basePixels = readPixels(base, width, height);
      const maskPixels = readPixels(mask, width, height);
      const neutral = parseHexColor(atlas.meta.neutral);

      playerColors.forEach((color, owner) => {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('No 2D canvas to colour the buildings on');
        const colored = recolorPixels(basePixels, maskPixels, color, neutral);
        context.putImageData(new ImageData(colored, width, height), 0, 0);
        // Phaser takes a canvas wherever it takes an image.
        scene.textures.addAtlas(
          key(source, `player-${owner}`),
          canvas as unknown as HTMLImageElement,
          atlas,
        );
      });

      // The uncoloured pictures are not drawn, so their textures can go.
      scene.textures.remove(key(source, 'base'));
      scene.textures.remove(key(source, 'mask'));

      this.sheets.set(type, {
        name: source.name,
        displayScale: 1 / atlas.meta.scale,
        roofHeight: atlas.meta.building.roofHeight,
        textureKey: (owner) => key(source, `player-${owner}`),
      });
    }
  }

  /** The pictures a building type is drawn from, or undefined if it is still a placeholder block. */
  get(type: BuildingType): BuildingSheet | undefined {
    return this.sheets.get(type);
  }
}

function readPixels(image: HTMLImageElement, width: number, height: number): Uint8ClampedArray {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('No 2D canvas to read the buildings from');
  context.drawImage(image, 0, 0);
  return context.getImageData(0, 0, width, height).data;
}
