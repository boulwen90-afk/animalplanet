import type { GameObjects, Scene } from 'phaser';
import { CAVE_CONFIG } from '../../data/map';
import { STRINGS } from '../../data/strings';
import type { Cave, GameMap } from '../../sim/map/grid';
import { tileCenterToWorld, type TileSize } from '../../sim/map/iso';
import type { SceneryLibrary } from '../scenery/SceneryLibrary';
import { CAVE_FRAME } from '../scenery/scenery';

/**
 * Draws each cave: a mound of rock with a dark opening and a pennant in its
 * side's colour, with the number of units inside written above it.
 */
export class CaveView {
  private readonly caves = new Map<
    number,
    { image: GameObjects.Image; text: GameObjects.Text; shown: string }
  >();

  constructor(scene: Scene, map: GameMap, size: TileSize, scenery: SceneryLibrary) {
    for (const cave of map.caves) {
      const centre = tileCenterToWorld(cave.x, cave.y, size);
      const image = scene.add
        .image(centre.x, centre.y, scenery.textureKey(cave.owner), CAVE_FRAME)
        .setDepth(centre.y);
      const text = scene.add
        .text(centre.x, centre.y - scenery.heightOf(CAVE_FRAME) - 2, '', {
          fontFamily: 'sans-serif',
          fontSize: '13px',
          fontStyle: 'bold',
          color: '#ffffff',
          stroke: '#10141a',
          strokeThickness: 3,
        })
        .setOrigin(0.5, 1)
        .setDepth(centre.y + 0.01);
      this.caves.set(cave.id, { image, text, shown: '' });
    }
  }

  /**
   * Updates the numbers above the caves. A cave is drawn once the player has
   * seen its tile; the number inside shows for the player's own caves and
   * for other caves while they are in sight.
   */
  update(
    map: GameMap,
    viewer: number,
    isExplored: (cave: Cave) => boolean,
    isVisible: (cave: Cave) => boolean,
  ): void {
    for (const cave of map.caves) {
      const drawn = this.caves.get(cave.id);
      if (!drawn) continue;
      const explored = isExplored(cave);
      if (drawn.image.visible !== explored) drawn.image.setVisible(explored);
      const showCount = cave.owner === viewer ? explored : isVisible(cave);
      if (drawn.text.visible !== showCount) drawn.text.setVisible(showCount);

      const next = STRINGS.hud.caveCount(cave.occupants.length, CAVE_CONFIG.capacity);
      if (next === drawn.shown) continue;
      drawn.text.setText(next);
      drawn.shown = next;
    }
  }
}
