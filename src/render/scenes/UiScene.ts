import { Scene, type GameObjects } from 'phaser';
import { STRINGS } from '../../data/strings';
import { resourceBarRect, selectionPanelRect } from '../ui/layout';
import type { SelectionInfo } from '../ui/selectionInfo';

/** The numbers shown in the resource bar. */
export interface ResourceBarInfo {
  food: number;
  wood: number;
  population: number;
  populationCap: number;
}

/** Where the interface gets what it shows. */
export interface HudSource {
  /** Text for the selection panel, or undefined when nothing is selected. */
  getSelectionInfo(): SelectionInfo | undefined;
  /** The player's stock and population, or undefined before the game has started. */
  getResourceBarInfo(): ResourceBarInfo | undefined;
}

/** What the selection panel currently shows. */
export interface HudDisplay {
  visible: boolean;
  title: string;
  detail: string;
}

/** The texts the resource bar currently shows. */
export interface ResourceBarDisplay {
  food: string;
  wood: string;
  population: string;
}

const PANEL_COLOR = 0x10141a;
const PANEL_EDGE = 0x4a5568;
const BAR_TEXT_SPACING = 130;

/**
 * The interface, drawn on top of the game scene with its own camera so it
 * stays in place when the map scrolls: the resource bar along the top and
 * the selection panel in the bottom-left corner.
 */
export class UiScene extends Scene {
  private panel!: GameObjects.Graphics;
  private title!: GameObjects.Text;
  private detail!: GameObjects.Text;
  private shown: HudDisplay = { visible: false, title: '', detail: '' };

  private bar!: GameObjects.Graphics;
  private barTexts!: Record<keyof ResourceBarDisplay, GameObjects.Text>;
  private barShown: ResourceBarDisplay = { food: '', wood: '', population: '' };

  constructor(private readonly source: HudSource) {
    super({ key: 'Ui', active: true });
  }

  create(): void {
    this.bar = this.add.graphics();
    const barStyle = { fontFamily: 'sans-serif', fontSize: '16px', color: '#ffffff' };
    this.barTexts = {
      food: this.add.text(0, 0, '', barStyle),
      wood: this.add.text(0, 0, '', barStyle),
      population: this.add.text(0, 0, '', barStyle),
    };

    this.panel = this.add.graphics();
    this.title = this.add.text(0, 0, '', {
      fontFamily: 'sans-serif',
      fontSize: '18px',
      fontStyle: 'bold',
      color: '#ffffff',
    });
    this.detail = this.add.text(0, 0, '', {
      fontFamily: 'sans-serif',
      fontSize: '14px',
      color: '#cbd5e0',
    });
    this.layout();
    this.scale.on('resize', this.layout, this);
    this.apply({ visible: false, title: '', detail: '' });
  }

  override update(): void {
    this.updateResourceBar();

    const info = this.source.getSelectionInfo();
    const next: HudDisplay = info
      ? { visible: true, title: info.title, detail: info.detail }
      : { visible: false, title: '', detail: '' };
    const shown = this.shown;
    if (
      next.visible !== shown.visible ||
      next.title !== shown.title ||
      next.detail !== shown.detail
    ) {
      this.apply(next);
    }
  }

  /** What the selection panel shows right now. */
  getDisplay(): HudDisplay {
    return { ...this.shown };
  }

  /** The texts the resource bar shows right now. */
  getResourceBarDisplay(): ResourceBarDisplay {
    return { ...this.barShown };
  }

  private updateResourceBar(): void {
    const info = this.source.getResourceBarInfo();
    if (!info) return;
    const next: ResourceBarDisplay = {
      food: `${STRINGS.resources.food} ${info.food}`,
      wood: `${STRINGS.resources.wood} ${info.wood}`,
      population: `${STRINGS.hud.population} ${STRINGS.hud.populationCount(
        info.population,
        info.populationCap,
      )}`,
    };
    for (const key of ['food', 'wood', 'population'] as const) {
      if (next[key] === this.barShown[key]) continue;
      this.barTexts[key].setText(next[key]);
      this.barShown[key] = next[key];
    }
  }

  private apply(next: HudDisplay): void {
    this.shown = next;
    this.panel.setVisible(next.visible);
    this.title.setVisible(next.visible).setText(next.title);
    this.detail.setVisible(next.visible).setText(next.detail);
  }

  private layout(): void {
    const bar = resourceBarRect(this.scale.width);
    this.bar.clear();
    this.bar.fillStyle(PANEL_COLOR, 0.85);
    this.bar.fillRect(bar.x, bar.y, bar.width, bar.height);
    this.bar.lineStyle(1, PANEL_EDGE, 1);
    this.bar.lineBetween(bar.x, bar.height, bar.width, bar.height);
    (['food', 'wood', 'population'] as const).forEach((key, i) => {
      this.barTexts[key].setPosition(12 + i * BAR_TEXT_SPACING, 7);
    });

    const rect = selectionPanelRect(this.scale.width, this.scale.height);
    this.panel.clear();
    this.panel.fillStyle(PANEL_COLOR, 0.85);
    this.panel.fillRoundedRect(rect.x, rect.y, rect.width, rect.height, 6);
    this.panel.lineStyle(1, PANEL_EDGE, 1);
    this.panel.strokeRoundedRect(rect.x, rect.y, rect.width, rect.height, 6);
    this.title.setPosition(rect.x + 12, rect.y + 10);
    this.detail.setPosition(rect.x + 12, rect.y + 36);
  }
}
