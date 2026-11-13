import type { Scene } from 'phaser';
import type { UnitType } from '../../data/types';
import type { AnimationInfo, CharacterAnimation } from './animation';
import { CHARACTERS, type CharacterSource } from './characters';
import { parseHexColor, recolorPixels } from './recolor';

/** The part of an atlas file the game reads besides the pictures. */
interface AtlasFile {
  frames: Record<string, unknown>;
  meta: {
    /** How many times larger than game pixels the pictures are. */
    scale: number;
    /** The grey the team-coloured parts are rendered in, as "#rrggbb". */
    neutral: string;
    animations: Record<string, AnimationInfo>;
  };
}

/** A character ready to draw: one texture per player, and what its animations are. */
export interface CharacterSheet {
  name: string;
  /** Scale to draw the pictures at so that they have their size in game pixels. */
  displayScale: number;
  animations: Record<CharacterAnimation, AnimationInfo>;
  /** Key of the texture in a player's colour. */
  textureKey(owner: number): string;
}

const key = (source: CharacterSource, part: string) => `character-${source.name}-${part}`;

/**
 * Loads the character atlases and colours them for each player.
 *
 * The team colour is put on once, when the game starts: for every player a
 * copy of the atlas is made with the team-coloured parts in that player's
 * colour (see recolor.ts). Each unit is then a single picture from its
 * player's copy, so drawing costs nothing extra however many units there are.
 */
export class CharacterLibrary {
  private readonly sheets = new Map<UnitType, CharacterSheet>();

  /** Queues the files. Call from a scene's preload. */
  static preload(scene: Scene): void {
    for (const source of Object.values(CHARACTERS)) {
      scene.load.json(key(source, 'atlas'), source.atlasUrl);
      scene.load.image(key(source, 'base'), source.baseUrl);
      scene.load.image(key(source, 'mask'), source.maskUrl);
    }
  }

  /** Builds one coloured texture per player colour. Call from a scene's create, after preload. */
  constructor(scene: Scene, playerColors: readonly number[]) {
    for (const [unitType, source] of Object.entries(CHARACTERS) as [UnitType, CharacterSource][]) {
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
        if (!context) throw new Error('No 2D canvas to colour the characters on');
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

      this.sheets.set(unitType, {
        name: source.name,
        displayScale: 1 / atlas.meta.scale,
        animations: atlas.meta.animations as Record<CharacterAnimation, AnimationInfo>,
        textureKey: (owner) => key(source, `player-${owner}`),
      });
    }
  }

  /** The character a unit type is drawn as, or undefined if it is still a placeholder shape. */
  get(unitType: UnitType): CharacterSheet | undefined {
    return this.sheets.get(unitType);
  }
}

function readPixels(image: HTMLImageElement, width: number, height: number): Uint8ClampedArray {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('No 2D canvas to read the characters from');
  context.drawImage(image, 0, 0);
  return context.getImageData(0, 0, width, height).data;
}
