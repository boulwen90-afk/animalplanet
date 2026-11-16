import type { GameObjects, Scene } from 'phaser';
import { BUILDING_DEFS, type BuildingType } from '../../data/buildings';
import { tileCenterToWorld, tileToWorld, type Point, type TileSize } from '../../sim/map/iso';
import type { PlacementProblem } from '../../sim/systems/construction';
import { UI_CONFIG } from '../../data/ui';
import type { BuildingLibrary } from '../buildings/BuildingLibrary';
import { frameOf } from '../buildings/stage';
import { groundCircle } from '../effects/projectiles';
import { PLACEMENT_COLORS, PLACEMENT_PREVIEW } from './visuals';

/** Depth of the outline: on the ground, below everything standing on the map. */
const GROUND_MARK_DEPTH = -0.3;
/** Depth of the explanation: in front of everything in the world. */
const NOTE_DEPTH = 900_001;

/** Where a building is about to be placed, and whether it may stand there. */
export interface Placement {
  building: BuildingType;
  /** Tile of the footprint corner with the lowest x and y. */
  x: number;
  y: number;
  valid: boolean;
  /** Why it may not stand there; left out when it may. */
  problem?: PlacementProblem;
  /**
   * The few words shown under the outline: why it may not stand there, or
   * for a building whose workers work around it, how many places they get.
   */
  note?: string;
  /** The tiles its workers would stand on around it, such as fishing places on the shore. */
  places?: Point[];
  /** Which of its looks the building would have there, for one that has several: a gate in a wall. */
  variant?: string;
  /**
   * For a wall that is drawn out in a line: every tile of the line. `x` and
   * `y` above are then the tile the line ends on.
   */
  line?: LineTile[];
}

/** One tile of a wall being drawn out. */
export interface LineTile {
  x: number;
  y: number;
  /**
   * `place`: a piece will be placed here. `blocked`: something is in the
   * way, and the wall is built around it. `standing`: a piece of the
   * player's own wall already stands here.
   */
  state: 'place' | 'blocked' | 'standing';
  /** The look the piece would have here, by what stands beside it. */
  variant?: string;
}

/** How the picture of the building being placed is shown, for tests. */
export interface PlacementPreviewInfo {
  texture: string;
  /** True when the picture is tinted red: the building may not stand there. */
  red: boolean;
  /** The name of the picture in its atlas. */
  frame: string;
  /** For a wall drawn out in a line: how many pieces of it are shown. */
  pieces: number;
}

/**
 * Draws a building being placed: its footprint and, for a building that has
 * pictures, the finished building see-through on it. Both are green or plain
 * where it may stand and red where not, and where it may not stand a few
 * words under the footprint say why.
 */
export class PlacementView {
  private readonly graphics: GameObjects.Graphics;
  private readonly note: GameObjects.Text;
  /** The picture of the building, made when one is first placed. */
  private preview?: GameObjects.Image;
  private previewRed = false;
  /** The pictures of the pieces of a wall being drawn out; as many are shown as the line has pieces. */
  private readonly pieces: GameObjects.Image[] = [];
  private piecesShown = 0;

  /**
   * @param art The pictures of the buildings. Without it, and for building
   * types without pictures, only the footprint is drawn.
   * @param player Whose colours the building is shown in.
   */
  constructor(
    private readonly scene: Scene,
    private readonly size: TileSize,
    private readonly art?: BuildingLibrary,
    private readonly player = 0,
  ) {
    this.graphics = scene.add.graphics().setDepth(GROUND_MARK_DEPTH);
    this.note = scene.add
      .text(0, 0, '', {
        fontFamily: 'sans-serif',
        fontSize: '14px',
        fontStyle: 'bold',
        color: '#ffffff',
        stroke: '#10141a',
        strokeThickness: 4,
      })
      .setOrigin(0.5, 0)
      .setDepth(NOTE_DEPTH)
      .setVisible(false);
  }

  update(placement: Placement | undefined): void {
    this.graphics.clear();
    if (!placement) {
      this.note.setVisible(false);
      this.preview?.setVisible(false);
      this.showPieces(undefined);
      return;
    }
    if (placement.line) {
      this.preview?.setVisible(false);
      this.updateLine(placement, placement.line);
      return;
    }
    this.showPieces(undefined);
    const n = BUILDING_DEFS[placement.building].size;
    const color = placement.valid ? PLACEMENT_COLORS.valid : PLACEMENT_COLORS.invalid;
    const corners = [
      tileToWorld(placement.x, placement.y, this.size),
      tileToWorld(placement.x + n, placement.y, this.size),
      tileToWorld(placement.x + n, placement.y + n, this.size),
      tileToWorld(placement.x, placement.y + n, this.size),
    ];
    this.graphics.fillStyle(color, 0.45);
    this.graphics.fillPoints(corners, true);
    this.graphics.lineStyle(2, color, 1);
    this.graphics.strokePoints(corners, true);

    // Where its workers would stand: a ring on each tile.
    this.graphics.lineStyle(2, PLACEMENT_PREVIEW.placeColor, 1);
    for (const place of placement.places ?? []) {
      const at = tileCenterToWorld(place.x, place.y, this.size);
      this.graphics.strokeEllipse(
        at.x,
        at.y,
        PLACEMENT_PREVIEW.placeWidth,
        PLACEMENT_PREVIEW.placeWidth / 2,
      );
    }

    // How far it would shoot from there: a ring on the ground round it.
    const attack = BUILDING_DEFS[placement.building].attack;
    if (attack) {
      const middle = tileToWorld(placement.x + n / 2, placement.y + n / 2, this.size);
      const { rx, ry } = groundCircle(attack.range, this.size);
      const { color, alpha, width } = UI_CONFIG.rangeRing;
      this.graphics.lineStyle(width, color, alpha);
      this.graphics.strokeEllipse(middle.x, middle.y, rx * 2, ry * 2);
    }

    this.updatePreview(placement, n);

    // The explanation sits just under the nearest corner of the footprint.
    const nearest = corners[2] ?? { x: 0, y: 0 };
    const text = placement.note ?? '';
    if (this.note.text !== text) this.note.setText(text);
    this.note.setVisible(text !== '').setPosition(nearest.x, nearest.y + PLACEMENT_PREVIEW.noteGap);
  }

  /** How the picture of the building is shown right now; null when there is none. */
  describePreview(): PlacementPreviewInfo | null {
    const [piece] = this.pieces;
    if (this.piecesShown > 0 && piece) {
      return {
        texture: piece.texture.key,
        red: false,
        frame: piece.frame.name,
        pieces: this.piecesShown,
      };
    }
    if (!this.preview?.visible) return null;
    return {
      texture: this.preview.texture.key,
      red: this.previewRed,
      frame: this.preview.frame.name,
      pieces: 0,
    };
  }

  /**
   * Draws a wall being drawn out: a green tile and the piece, see-through,
   * where one will be placed, a red tile where something is in the way,
   * and under the end of the line how many pieces it is and what they cost.
   */
  private updateLine(placement: Placement, line: readonly LineTile[]): void {
    for (const tile of line) {
      if (tile.state === 'standing') continue;
      const color = tile.state === 'place' ? PLACEMENT_COLORS.valid : PLACEMENT_COLORS.invalid;
      const corners = [
        tileToWorld(tile.x, tile.y, this.size),
        tileToWorld(tile.x + 1, tile.y, this.size),
        tileToWorld(tile.x + 1, tile.y + 1, this.size),
        tileToWorld(tile.x, tile.y + 1, this.size),
      ];
      this.graphics.fillStyle(color, 0.45);
      this.graphics.fillPoints(corners, true);
      this.graphics.lineStyle(2, color, 1);
      this.graphics.strokePoints(corners, true);
    }
    this.showPieces(placement);

    const end = tileToWorld(placement.x + 1, placement.y + 1, this.size);
    const text = placement.note ?? '';
    if (this.note.text !== text) this.note.setText(text);
    this.note.setVisible(text !== '').setPosition(end.x, end.y + PLACEMENT_PREVIEW.noteGap);
  }

  /** Shows a picture of each piece of a wall being drawn out; none with no line. */
  private showPieces(placement: Placement | undefined): void {
    const sheet = placement && this.art?.get(placement.building);
    const tiles = sheet ? (placement.line ?? []).filter((tile) => tile.state === 'place') : [];
    tiles.forEach((tile, i) => {
      if (!sheet) return;
      const centre = tileToWorld(tile.x + 0.5, tile.y + 0.5, this.size);
      const texture = sheet.textureKey(this.player);
      const frame = frameOf('complete', tile.variant);
      let image = this.pieces[i];
      if (!image) {
        image = this.scene.add.image(0, 0, texture, frame);
        this.pieces[i] = image;
      }
      if (image.texture.key !== texture || image.frame.name !== frame) {
        image.setTexture(texture, frame);
      }
      image
        .setVisible(true)
        .setScale(sheet.displayScale)
        .setPosition(centre.x, centre.y)
        .setDepth(centre.y)
        .setAlpha(PLACEMENT_PREVIEW.alpha);
    });
    for (let i = tiles.length; i < this.pieces.length; i++) this.pieces[i]?.setVisible(false);
    this.piecesShown = tiles.length;
  }

  /** Shows the finished building, see-through, standing on the footprint. */
  private updatePreview(placement: Placement, side: number): void {
    const sheet = this.art?.get(placement.building);
    if (!sheet) {
      this.preview?.setVisible(false);
      return;
    }
    const centre = tileToWorld(placement.x + side / 2, placement.y + side / 2, this.size);
    const texture = sheet.textureKey(this.player);
    const frame = frameOf('complete', placement.variant ?? sheet.variants[0]);
    this.preview ??= this.scene.add.image(0, 0, texture, frame);
    if (this.preview.texture.key !== texture || this.preview.frame.name !== frame) {
      this.preview.setTexture(texture, frame);
    }
    this.previewRed = !placement.valid;
    this.preview
      .setVisible(true)
      .setScale(sheet.displayScale)
      .setPosition(centre.x, centre.y)
      .setDepth(centre.y)
      .setAlpha(PLACEMENT_PREVIEW.alpha)
      .setTint(placement.valid ? PLACEMENT_PREVIEW.validTint : PLACEMENT_PREVIEW.invalidTint);
  }
}
