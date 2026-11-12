import { Scene, type GameObjects, type Input } from 'phaser';
import { PRODUCTION_CONFIG } from '../../data/production';
import { STRINGS } from '../../data/strings';
import { UI_CONFIG } from '../../data/ui';
import type { CommandResult } from '../../sim/commands';
import {
  commandPanelHit,
  commandPanelLayout,
  type CommandPanelInfo,
  type CommandPanelLayout,
} from '../ui/commandPanel';
import { outcomeLayout, rectContains, resourceBarRect, selectionPanelRect } from '../ui/layout';
import type { SelectionInfo } from '../ui/selectionInfo';

/** The numbers shown in the resource bar. */
export interface ResourceBarInfo {
  food: number;
  wood: number;
  population: number;
  populationCap: number;
}

/** Where the interface gets what it shows, and where its buttons send their orders. */
export interface HudSource {
  /** Text for the selection panel, or undefined when nothing is selected. */
  getSelectionInfo(): SelectionInfo | undefined;
  /** The player's stock and population, or undefined before the game has started. */
  getResourceBarInfo(): ResourceBarInfo | undefined;
  /** The command panel for the selected building, or undefined when it should not show. */
  getCommandPanelInfo(): CommandPanelInfo | undefined;
  /** Presses the command panel button at an index: trains a unit or starts placing a building. */
  activateButton(index: number): CommandResult;
  /** Cancels the unit at a position in the selected building's queue. */
  cancelQueuedUnit(index: number): CommandResult;
  /** A warning to show at the top of the screen, or undefined. */
  getAlert(): string | undefined;
  /** How the game ended for the player, or undefined while it is still going. */
  getOutcome(): 'victory' | 'defeat' | undefined;
  /** Starts a new game. */
  restart(): void;
}

/** What the end-of-game screen shows, with the screen position of the button's centre. */
export interface OutcomeDisplay {
  visible: boolean;
  title: string;
  button: { label: string; x: number; y: number };
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

type BarKey = keyof ResourceBarDisplay;
const BAR_KEYS: readonly BarKey[] = ['food', 'wood', 'population'];

/** What the command panel currently shows, with the screen position of each part's centre. */
export interface CommandPanelDisplay {
  visible: boolean;
  buttons: { label: string; cost: string; x: number; y: number }[];
  queue: { label: string; x: number; y: number }[];
  progress: number;
}

const PANEL_COLOR = 0x10141a;
const PANEL_EDGE = 0x4a5568;
const BUTTON_COLOR = 0x2d3748;
const SLOT_COLOR = 0x1a202c;
const SLOT_FILLED_COLOR = 0x3b7de0;
const PROGRESS_COLOR = 0x35e06a;
const TEXT_COLOR = '#ffffff';
const FLASH_COLOR = '#ff5a5a';
const ALERT_COLOR = '#ffd166';
const BAR_TEXT_SPACING = 130;

/**
 * The interface, drawn on top of the game scene with its own camera so it
 * stays in place when the map scrolls: the resource bar along the top, the
 * selection panel in the bottom-left corner and the command panel beside it.
 */
export class UiScene extends Scene {
  private panel!: GameObjects.Graphics;
  private title!: GameObjects.Text;
  private detail!: GameObjects.Text;
  private shown: HudDisplay = { visible: false, title: '', detail: '' };

  private bar!: GameObjects.Graphics;
  private barTexts!: Record<BarKey, GameObjects.Text>;
  private barShown: ResourceBarDisplay = { food: '', wood: '', population: '' };
  /** Frame time until which each resource bar text is shown in the warning colour. */
  private readonly flashUntil: Record<BarKey, number> = { food: 0, wood: 0, population: 0 };
  /** Whether each resource bar text is currently drawn in the warning colour. */
  private readonly barFlashing: Record<BarKey, boolean> = {
    food: false,
    wood: false,
    population: false,
  };
  /** Frame time of the latest update, in milliseconds. */
  private now = 0;

  private command!: GameObjects.Graphics;
  private readonly buttonTexts: { label: GameObjects.Text; cost: GameObjects.Text }[] = [];
  private slotTexts: GameObjects.Text[] = [];
  private commandInfo: CommandPanelInfo | undefined;
  private commandLayout: CommandPanelLayout | undefined;

  private alert!: GameObjects.Text;
  private alertShown = '';

  private outcome!: GameObjects.Graphics;
  private outcomeTitle!: GameObjects.Text;
  private outcomeButton!: GameObjects.Text;
  private outcomeShown: 'victory' | 'defeat' | undefined;

  constructor(private readonly source: HudSource) {
    super({ key: 'Ui', active: true });
  }

  create(): void {
    this.bar = this.add.graphics();
    const barStyle = { fontFamily: 'sans-serif', fontSize: '16px', color: TEXT_COLOR };
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
      color: TEXT_COLOR,
    });
    this.detail = this.add.text(0, 0, '', {
      fontFamily: 'sans-serif',
      fontSize: '14px',
      color: '#cbd5e0',
    });

    this.command = this.add.graphics();
    this.slotTexts = Array.from({ length: PRODUCTION_CONFIG.maxQueue }, () =>
      this.add
        .text(0, 0, '', {
          fontFamily: 'sans-serif',
          fontSize: '20px',
          fontStyle: 'bold',
          color: TEXT_COLOR,
        })
        .setOrigin(0.5),
    );

    this.alert = this.add
      .text(0, 0, '', {
        fontFamily: 'sans-serif',
        fontSize: '20px',
        fontStyle: 'bold',
        color: ALERT_COLOR,
        stroke: '#10141a',
        strokeThickness: 4,
      })
      .setOrigin(0.5, 0)
      .setVisible(false);

    // The end-of-game screen lies on top of everything else.
    this.outcome = this.add.graphics().setDepth(100).setVisible(false);
    this.outcomeTitle = this.add
      .text(0, 0, '', {
        fontFamily: 'sans-serif',
        fontSize: '56px',
        fontStyle: 'bold',
        color: TEXT_COLOR,
      })
      .setOrigin(0.5)
      .setDepth(101)
      .setVisible(false);
    this.outcomeButton = this.add
      .text(0, 0, STRINGS.hud.playAgain, {
        fontFamily: 'sans-serif',
        fontSize: '22px',
        fontStyle: 'bold',
        color: TEXT_COLOR,
      })
      .setOrigin(0.5)
      .setDepth(101)
      .setVisible(false);

    this.layout();
    this.scale.on('resize', this.layout, this);
    this.apply({ visible: false, title: '', detail: '' });
    this.input.on('pointerdown', this.onPointerDown, this);
  }

  override update(time: number): void {
    this.now = time;
    this.updateResourceBar();
    this.updateCommandPanel();
    this.updateAlert();
    this.updateOutcome();

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

  /** The resource bar texts that are flashing in the warning colour right now. */
  getFlashing(): BarKey[] {
    return BAR_KEYS.filter((key) => this.now < this.flashUntil[key]);
  }

  /** What the command panel shows right now. */
  getCommandPanelDisplay(): CommandPanelDisplay {
    const info = this.commandInfo;
    const layout = this.commandLayout;
    if (!info || !layout) return { visible: false, buttons: [], queue: [], progress: 0 };
    const centre = (rect: { x: number; y: number; width: number; height: number }) => ({
      x: rect.x + rect.width / 2,
      y: rect.y + rect.height / 2,
    });
    return {
      visible: true,
      buttons: info.buttons.map((button, i) => ({
        label: button.label,
        cost: button.cost,
        ...centre(layout.buttons[i]!),
      })),
      queue: (info.queue ?? []).map((entry, i) => ({
        label: entry.label,
        ...centre(layout.slots[i]!),
      })),
      progress: info.progress,
    };
  }

  /** What the warning at the top of the screen says right now; empty when there is none. */
  getAlertDisplay(): string {
    return this.alertShown;
  }

  /** What the end-of-game screen shows right now. */
  getOutcomeDisplay(): OutcomeDisplay {
    const { button } = outcomeLayout(this.scale.width, this.scale.height);
    return {
      visible: this.outcomeShown !== undefined,
      title: this.outcomeShown ? STRINGS.hud[this.outcomeShown] : '',
      button: {
        label: STRINGS.hud.playAgain,
        x: button.x + button.width / 2,
        y: button.y + button.height / 2,
      },
    };
  }

  private updateAlert(): void {
    const next = this.source.getAlert() ?? '';
    if (next === this.alertShown) return;
    this.alertShown = next;
    this.alert.setText(next).setVisible(next !== '');
  }

  private updateOutcome(): void {
    const next = this.source.getOutcome();
    if (next === this.outcomeShown) return;
    this.outcomeShown = next;
    const visible = next !== undefined;
    this.outcome.setVisible(visible);
    this.outcomeTitle.setVisible(visible).setText(next ? STRINGS.hud[next] : '');
    this.outcomeButton.setVisible(visible);
    this.layout();
  }

  private onPointerDown(pointer: Input.Pointer): void {
    // Once the game is over only the "play again" button responds.
    if (this.outcomeShown !== undefined) {
      const { button } = outcomeLayout(this.scale.width, this.scale.height);
      const pressed = pointer.wasTouch || pointer.leftButtonDown();
      if (pressed && rectContains(button, pointer.x, pointer.y)) this.source.restart();
      return;
    }

    const info = this.commandInfo;
    const layout = this.commandLayout;
    if (!info || !layout) return;
    if (!pointer.wasTouch && !pointer.leftButtonDown()) return;
    const hit = commandPanelHit(layout, pointer.x, pointer.y);
    if (!hit) return;

    if (hit.kind === 'button') {
      if (hit.index < info.buttons.length) {
        this.showRefusal(this.source.activateButton(hit.index));
      }
    } else if (hit.index < (info.queue?.length ?? 0)) {
      this.source.cancelQueuedUnit(hit.index);
    }
  }

  /** Flashes the resource bar texts that explain why an order was refused. */
  showRefusal(result: CommandResult): void {
    if (result.ok) return;
    const until = this.now + UI_CONFIG.refusalFlashMs;
    if (result.reason === 'insufficientResources') {
      for (const resource of result.missing) this.flashUntil[resource] = until;
    } else if (result.reason === 'populationCap') {
      this.flashUntil.population = until;
    }
  }

  private updateResourceBar(): void {
    // Changing a text's colour redraws it, so only do it when the flash starts or ends.
    for (const key of BAR_KEYS) {
      const flashing = this.now < this.flashUntil[key];
      if (flashing === this.barFlashing[key]) continue;
      this.barFlashing[key] = flashing;
      this.barTexts[key].setColor(flashing ? FLASH_COLOR : TEXT_COLOR);
    }

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
    for (const key of BAR_KEYS) {
      if (next[key] === this.barShown[key]) continue;
      this.barTexts[key].setText(next[key]);
      this.barShown[key] = next[key];
    }
  }

  private updateCommandPanel(): void {
    const info = this.source.getCommandPanelInfo();
    this.commandInfo = info;
    this.command.clear();
    if (!info) {
      this.commandLayout = undefined;
      for (const text of this.slotTexts) text.setVisible(false);
      for (const texts of this.buttonTexts) {
        texts.label.setVisible(false);
        texts.cost.setVisible(false);
      }
      return;
    }

    const layout = commandPanelLayout(
      this.scale.width,
      this.scale.height,
      info.buttons.length,
      info.queue !== undefined,
    );
    this.commandLayout = layout;
    const g = this.command;
    const { panel } = layout;
    g.fillStyle(PANEL_COLOR, 0.85);
    g.fillRoundedRect(panel.x, panel.y, panel.width, panel.height, 6);
    g.lineStyle(1, PANEL_EDGE, 1);
    g.strokeRoundedRect(panel.x, panel.y, panel.width, panel.height, 6);

    info.buttons.forEach((button, i) => {
      const rect = layout.buttons[i]!;
      g.fillStyle(BUTTON_COLOR, 1);
      g.fillRoundedRect(rect.x, rect.y, rect.width, rect.height, 4);
      g.lineStyle(1, PANEL_EDGE, 1);
      g.strokeRoundedRect(rect.x, rect.y, rect.width, rect.height, 4);
      const texts = this.buttonTextsAt(i);
      texts.label
        .setVisible(true)
        .setText(button.label)
        .setPosition(rect.x + 10, rect.y + 6);
      texts.cost
        .setVisible(true)
        .setText(button.cost)
        .setPosition(rect.x + 10, rect.y + 27);
    });
    this.buttonTexts.slice(info.buttons.length).forEach((texts) => {
      texts.label.setVisible(false);
      texts.cost.setVisible(false);
    });

    this.slotTexts.slice(layout.slots.length).forEach((text) => text.setVisible(false));
    layout.slots.forEach((rect, i) => {
      const entry = info.queue?.[i];
      g.fillStyle(entry ? SLOT_FILLED_COLOR : SLOT_COLOR, 1);
      g.fillRect(rect.x, rect.y, rect.width, rect.height);
      g.lineStyle(1, PANEL_EDGE, 1);
      g.strokeRect(rect.x, rect.y, rect.width, rect.height);
      this.slotTexts[i]
        ?.setVisible(entry !== undefined)
        .setText(entry?.label ?? '')
        .setPosition(rect.x + rect.width / 2, rect.y + rect.height / 2);
    });

    const bar = layout.progressBar;
    if (bar.width === 0) return;
    g.fillStyle(SLOT_COLOR, 1);
    g.fillRect(bar.x, bar.y, bar.width, bar.height);
    if (info.progress > 0) {
      g.fillStyle(PROGRESS_COLOR, 1);
      g.fillRect(bar.x, bar.y, bar.width * info.progress, bar.height);
    }
  }

  /** The label and cost texts of the train button at an index, created on first use. */
  private buttonTextsAt(index: number): { label: GameObjects.Text; cost: GameObjects.Text } {
    let texts = this.buttonTexts[index];
    if (!texts) {
      texts = {
        label: this.add.text(0, 0, '', {
          fontFamily: 'sans-serif',
          fontSize: '15px',
          fontStyle: 'bold',
          color: TEXT_COLOR,
        }),
        cost: this.add.text(0, 0, '', {
          fontFamily: 'sans-serif',
          fontSize: '13px',
          color: '#cbd5e0',
        }),
      };
      this.buttonTexts[index] = texts;
    }
    return texts;
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
    BAR_KEYS.forEach((key, i) => {
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

    this.alert.setPosition(this.scale.width / 2, bar.height + 10);

    const end = outcomeLayout(this.scale.width, this.scale.height);
    this.outcome.clear();
    this.outcome.fillStyle(PANEL_COLOR, 0.7);
    this.outcome.fillRect(0, 0, this.scale.width, this.scale.height);
    this.outcome.fillStyle(BUTTON_COLOR, 1);
    this.outcome.fillRoundedRect(
      end.button.x,
      end.button.y,
      end.button.width,
      end.button.height,
      6,
    );
    this.outcome.lineStyle(2, PANEL_EDGE, 1);
    this.outcome.strokeRoundedRect(
      end.button.x,
      end.button.y,
      end.button.width,
      end.button.height,
      6,
    );
    this.outcomeTitle.setPosition(end.title.x, end.title.y);
    this.outcomeButton.setPosition(
      end.button.x + end.button.width / 2,
      end.button.y + end.button.height / 2,
    );
  }
}
