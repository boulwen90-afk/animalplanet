import type { GameObjects, Scene } from 'phaser';
import { CAVE_CONFIG } from '../../data/map';
import { STRINGS } from '../../data/strings';
import type { Cave, GameMap } from '../../sim/map/grid';
import { tileCenterToWorld, type TileSize } from '../../sim/map/iso';
import { CAVE_COLORS, CAVE_VISUAL, PLAYER_COLORS } from './visuals';

/**
 * Draws each cave as a mound with a dark opening, outlined in its side's
 * colour, with the number of units inside written above it.
 */
export class CaveView {
  private readonly labels = new Map<number, { text: GameObjects.Text; shown: string }>();

  constructor(scene: Scene, map: GameMap, size: TileSize) {
    for (const cave of map.caves) {
      const centre = tileCenterToWorld(cave.x, cave.y, size);
      const base = centre.y + size.tileHeight / 4;
      scene.add
        .image(centre.x, base, caveTexture(scene, cave))
        .setOrigin(0.5, 1)
        .setDepth(centre.y);
      const text = scene.add
        .text(centre.x, base - CAVE_VISUAL.height - 2, '', {
          fontFamily: 'sans-serif',
          fontSize: '13px',
          fontStyle: 'bold',
          color: '#ffffff',
          stroke: '#10141a',
          strokeThickness: 3,
        })
        .setOrigin(0.5, 1)
        .setDepth(centre.y + 0.01);
      this.labels.set(cave.id, { text, shown: '' });
    }
    this.update(map);
  }

  /** Updates the numbers above the caves. */
  update(map: GameMap): void {
    for (const cave of map.caves) {
      const label = this.labels.get(cave.id);
      if (!label) continue;
      const next = STRINGS.hud.caveCount(cave.occupants.length, CAVE_CONFIG.capacity);
      if (next === label.shown) continue;
      label.text.setText(next);
      label.shown = next;
    }
  }
}

function caveTexture(scene: Scene, cave: Cave): string {
  const key = `cave-${cave.owner}`;
  if (scene.textures.exists(key)) return key;
  const { width: w, height: h } = CAVE_VISUAL;
  const g = scene.make.graphics({}, false);
  // The mound: the upper half of an ellipse standing on the ground.
  g.fillStyle(CAVE_COLORS.rock, 1);
  g.slice(w / 2, h, w / 2 - 1, Math.PI, 0, false);
  g.fillPath();
  g.fillRect(1, h - 6, w - 2, 6);
  g.lineStyle(3, PLAYER_COLORS[cave.owner as 0 | 1] ?? 0xffffff, 1);
  g.beginPath();
  g.arc(w / 2, h, w / 2 - 2, Math.PI, 0, false);
  g.strokePath();
  // The opening.
  g.fillStyle(CAVE_COLORS.opening, 1);
  g.slice(w / 2, h, w / 4, Math.PI, 0, false);
  g.fillPath();
  g.generateTexture(key, w, h);
  g.destroy();
  return key;
}
