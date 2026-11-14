import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MAP_CONFIG } from '../../data/map';
import { SCENERY_PICK } from '../views/visuals';
import {
  BUSH_FEW_SHARE,
  CAVE_FRAME,
  FISHING_PLACE_FRAME,
  ROCK_FRAMES,
  TREE_FRAMES,
  WATER_FRAMES,
  objectFrame,
  remainsFrame,
  variantOf,
  waterFrames,
} from './scenery';

/** A small map from rows of characters: '~' is water, anything else land. */
const waterIn = (rows: string[]) => (x: number, y: number) =>
  x < 0 || y < 0 || y >= rows.length || x >= rows[0]!.length ? true : rows[y]![x] === '~';

describe('variantOf', () => {
  it('gives the same picture for the same tile every time', () => {
    expect(variantOf(12, 40, 3)).toBe(variantOf(12, 40, 3));
    expect(variantOf(0, 0, 3)).toBe(variantOf(0, 0, 3));
  });

  it('uses every picture, about equally often, over a map', () => {
    const counts = [0, 0, 0];
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) counts[variantOf(x, y, 3)]!++;
    for (const count of counts) {
      expect(count).toBeGreaterThan(4096 / 3 - 250);
      expect(count).toBeLessThan(4096 / 3 + 250);
    }
  });

  it('seldom gives two neighbours the same picture more than chance would', () => {
    let same = 0;
    let pairs = 0;
    for (let y = 0; y < 64; y++) {
      for (let x = 0; x < 63; x++) {
        pairs++;
        if (variantOf(x, y, 3) === variantOf(x + 1, y, 3)) same++;
      }
    }
    // By chance a third of the pairs match.
    expect(same / pairs).toBeLessThan(0.4);
  });
});

describe('objectFrame', () => {
  it('gives a tree one of three pictures and a rock one of three, by its tile', () => {
    expect(TREE_FRAMES).toHaveLength(3);
    expect(ROCK_FRAMES).toHaveLength(3);
    const trees = new Set<string>();
    const rocks = new Set<string>();
    for (let x = 0; x < 30; x++) {
      trees.add(objectFrame('tree', x, 7)!);
      rocks.add(objectFrame('rock', x, 7)!);
    }
    expect([...trees].sort()).toEqual([...TREE_FRAMES]);
    expect([...rocks].sort()).toEqual([...ROCK_FRAMES]);
  });

  it('shows a berry bush full, and with few berries once half of them are picked', () => {
    expect(objectFrame('berries', 3, 3, 1)).toBe('bush_full');
    expect(objectFrame('berries', 3, 3, BUSH_FEW_SHARE + 0.01)).toBe('bush_full');
    expect(objectFrame('berries', 3, 3, BUSH_FEW_SHARE)).toBe('bush_few');
    expect(objectFrame('berries', 3, 3, 0.01)).toBe('bush_few');
  });

  it('draws nothing standing on grass, water or a cave tile', () => {
    expect(objectFrame('grass', 1, 1)).toBeUndefined();
    expect(objectFrame('water', 1, 1)).toBeUndefined();
    expect(objectFrame('cave', 1, 1)).toBeUndefined();
  });
});

describe('remainsFrame', () => {
  it('leaves a stump after a tree and a bare bush after a berry bush', () => {
    expect(remainsFrame('tree')).toBe('stump');
    expect(remainsFrame('berries')).toBe('bush_bare');
    expect(remainsFrame('rock')).toBeUndefined();
    expect(remainsFrame('grass')).toBeUndefined();
  });
});

describe('waterFrames', () => {
  it('is only water in the middle of a lake', () => {
    const lake = waterIn(['~~~', '~~~', '~~~']);
    const frames = waterFrames(lake, 1, 1);
    expect(frames).toHaveLength(1);
    expect(WATER_FRAMES).toContain(frames[0]);
  });

  it('has a shore along each side with land on it', () => {
    // Land to the right of the middle tile only: larger x.
    expect(waterFrames(waterIn(['~~~', '~~.', '~~~']), 1, 1).slice(1)).toEqual(['shore_x+']);
    expect(waterFrames(waterIn(['~.~', '~~~', '~~~']), 1, 1).slice(1)).toEqual(['shore_y-']);
  });

  it('rounds off a corner between two sides with land on them', () => {
    const frames = waterFrames(waterIn(['~~~', '~~.', '~..']), 1, 1).slice(1);
    expect(frames).toEqual(['shore_x+', 'shore_y+', 'shore_out_x+y+']);
  });

  it('goes round the tip of land that touches only by a corner', () => {
    const frames = waterFrames(waterIn(['~~~', '~~~', '~~.']), 1, 1).slice(1);
    expect(frames).toEqual(['shore_in_x+y+']);
  });

  it('gives a pond of one tile a shore all round', () => {
    const frames = waterFrames(waterIn(['...', '.~.', '...']), 1, 1).slice(1);
    expect(frames).toEqual([
      'shore_x+',
      'shore_x-',
      'shore_y+',
      'shore_y-',
      'shore_out_x+y+',
      'shore_out_x+y-',
      'shore_out_x-y+',
      'shore_out_x-y-',
    ]);
  });

  it('has no shore towards the edge of the map: the water runs on', () => {
    expect(waterFrames(waterIn(['~~', '~~']), 0, 0)).toHaveLength(1);
  });
});

describe('the scenery atlas', () => {
  const atlas = JSON.parse(readFileSync('assets/scenery/scenery.json', 'utf8')) as {
    frames: Record<
      string,
      { anchor: { x: number; y: number }; sourceSize: { w: number; h: number } }
    >;
    meta: {
      size: { w: number; h: number };
      scenery: {
        frame: number;
        items: Record<string, { kind: string; height: number }>;
        allowed: Record<string, [number, number]>;
      };
    };
  };

  it('has every picture the game asks for', () => {
    const wanted = [
      ...TREE_FRAMES,
      ...ROCK_FRAMES,
      ...WATER_FRAMES,
      'bush_full',
      'bush_few',
      'bush_bare',
      'stump',
      CAVE_FRAME,
      FISHING_PLACE_FRAME,
    ];
    for (const side of ['x+', 'x-', 'y+', 'y-']) wanted.push(`shore_${side}`);
    for (const corner of ['x+y+', 'x+y-', 'x-y+', 'x-y-']) {
      wanted.push(`shore_out_${corner}`, `shore_in_${corner}`);
    }
    for (const frame of wanted) expect(atlas.frames[frame], frame).toBeDefined();
  });

  it('stands every picture on the same point: the middle of its tile', () => {
    const anchors = new Set(Object.values(atlas.frames).map((f) => `${f.anchor.x},${f.anchor.y}`));
    expect(anchors.size).toBe(1);
    for (const frame of Object.values(atlas.frames)) {
      expect(frame.sourceSize).toEqual({
        w: atlas.meta.scenery.frame,
        h: atlas.meta.scenery.frame,
      });
    }
  });

  it('follows the size standard: each kind is as tall as it is allowed to be', () => {
    const { items, allowed } = atlas.meta.scenery;
    for (const [name, item] of Object.entries(items)) {
      const [low, high] = allowed[item.kind]!;
      expect(item.height, name).toBeGreaterThanOrEqual(low);
      expect(item.height, name).toBeLessThanOrEqual(high);
    }
    // A tree is about as tall as a small house, a bush lower than a worker.
    const worker = JSON.parse(
      readFileSync('assets/characters/bear_worker/bear_worker.json', 'utf8'),
    ) as { meta: { figure: { height: number } } };
    for (const tree of TREE_FRAMES) {
      expect(items[tree]!.height).toBeGreaterThan(MAP_CONFIG.tileWidth * 0.9);
    }
    expect(items.bush_full!.height).toBeLessThan(worker.meta.figure.height);
  });

  it('has a click box for each tree and bush that is a little lower than its picture', () => {
    const { items } = atlas.meta.scenery;
    // The box stands a quarter of a tile below the middle of the tile the picture stands on.
    const below = MAP_CONFIG.tileHeight / 4;
    for (const [frame, box] of Object.entries(SCENERY_PICK)) {
      const reach = box.height - below;
      expect(reach, frame).toBeLessThanOrEqual(items[frame]!.height);
      expect(reach, frame).toBeGreaterThanOrEqual(items[frame]!.height * 0.8);
    }
    for (const frame of [...TREE_FRAMES, 'bush_full', 'bush_few']) {
      expect(SCENERY_PICK[frame], frame).toBeDefined();
    }
  });

  it('stays small: the whole of it fits in 512 by 256 pixels', () => {
    expect(atlas.meta.size.w).toBeLessThanOrEqual(512);
    expect(atlas.meta.size.h).toBeLessThanOrEqual(256);
  });
});
