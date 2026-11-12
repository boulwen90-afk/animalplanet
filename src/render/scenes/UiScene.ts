import { Scene, type GameObjects } from 'phaser';
import { selectionPanelRect } from '../ui/layout';
import type { SelectionInfo } from '../ui/selectionInfo';

/** Where the interface gets what it shows. */
export interface HudSource {
  /** Text for the selection panel, or undefined when nothing is selected. */
  getSelectionInfo(): SelectionInfo | undefined;
}

/** What the selection panel currently shows. */
export interface HudDisplay {
  visible: boolean;
  title: string;
  detail: string;
}

const PANEL_COLOR = 0x10141a;
const PANEL_EDGE = 0x4a5568;

/**
 * The interface, drawn on top of the game scene with its own camera so it
 * stays in place when the map scrolls. Phase 3: the selection panel.
 */
export class UiScene extends Scene {
  private panel!: GameObjects.Graphics;
  private title!: GameObjects.Text;
  private detail!: GameObjects.Text;
  private shown: HudDisplay = { visible: false, title: '', detail: '' };

  constructor(private readonly source: HudSource) {
    super({ key: 'Ui', active: true });
  }

  create(): void {
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

  private apply(next: HudDisplay): void {
    this.shown = next;
    this.panel.setVisible(next.visible);
    this.title.setVisible(next.visible).setText(next.title);
    this.detail.setVisible(next.visible).setText(next.detail);
  }

  private layout(): void {
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
