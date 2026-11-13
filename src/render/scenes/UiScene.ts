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
import {
  alertTop,
  hudButtonRects,
  outcomeLayout,
  rectContains,
  resourceBarRect,
  selectionPanelRect,
  loadingLayout,
  startScreenLayout,
  type ScreenRect,
} from '../ui/layout';
import type { SelectionInfo } from '../ui/selectionInfo';

/** The numbers shown in the resource bar. */
export interface ResourceBarInfo {
  food: number;
  wood: number;
  population: number;
  populationCap: number;
}

export type HudButtonId = 'base' | 'deselect';

/** A button under the resource bar. */
export interface HudButton {
  id: HudButtonId;
  label: string;
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
  /** False while the match waits behind the start screen. */
  isStarted(): boolean;
  /** Leaves the start screen and begins the match. */
  start(): void;
  /** The buttons to show under the resource bar; the first is drawn rightmost. */
  getHudButtons(): HudButton[];
  /** Presses one of those buttons. */
  pressHudButton(id: HudButtonId): void;
  /** How much of the game's files have been loaded, from 0 to 1; undefined once all are in. */
  getLoadProgress(): number | undefined;
  /** How many units there are on the map. */
  getUnitCount(): number;
}

export interface UiSceneOptions {
  /** Show how many frames a second the game draws (on with ?debug=1). */
  debug: boolean;
}

/** What the loading bar shows. */
export interface LoadingDisplay {
  visible: boolean;
  percent: number;
  text: string;
}

/** What the frame counter shows. */
export interface DebugDisplay {
  visible: boolean;
  text: string;
  fps: number;
}

/** What the start screen shows, with the screen position of the button's centre. */
export interface StartScreenDisplay {
  visible: boolean;
  title: string;
  help: string;
  button: { label: string; x: number; y: number };
}

/** A button under the resource bar as it is drawn: its centre and its size. */
export interface HudButtonDisplay {
  id: HudButtonId;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
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

  private hudButtons!: GameObjects.Graphics;
  private readonly hudButtonTexts: GameObjects.Text[] = [];
  private hudButtonsShown: HudButton[] = [];

  private startScreen!: GameObjects.Graphics;
  private startTitle!: GameObjects.Text;
  private startHelp!: GameObjects.Text;
  private startButton!: GameObjects.Text;
  private startShown = false;
  private startButtonRect: ScreenRect = { x: 0, y: 0, width: 0, height: 0 };

  private loading!: GameObjects.Graphics;
  private loadingText!: GameObjects.Text;
  /** Whole percent loaded while the loading bar shows; undefined when it does not. */
  private loadingShown: number | undefined;

  private debugText: GameObjects.Text | undefined;
  /** Frames drawn since the counter was last written, and when that was. */
  private debugFrames = 0;
  private debugSince = 0;
  private debugFps = 0;

  constructor(
    private readonly source: HudSource,
    private readonly options: UiSceneOptions = { debug: false },
  ) {
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

    this.hudButtons = this.add.graphics();

    // The loading bar covers everything, the start screen too, until the game's files are in.
    this.loading = this.add.graphics().setDepth(110).setVisible(false);
    this.loadingText = this.add
      .text(0, 0, '', { fontFamily: 'sans-serif', fontSize: '18px', color: TEXT_COLOR })
      .setOrigin(0.5)
      .setDepth(111)
      .setVisible(false);

    if (this.options.debug) {
      this.debugText = this.add
        .text(8, 0, '', {
          fontFamily: 'monospace',
          fontSize: '14px',
          color: '#ffe066',
          backgroundColor: '#10141acc',
          padding: { x: 6, y: 3 },
        })
        .setDepth(90);
    }

    // The start screen lies on top of everything else, like the end-of-game screen.
    this.startShown = !this.source.isStarted();
    this.startScreen = this.add.graphics().setDepth(100).setVisible(this.startShown);
    this.startTitle = this.add
      .text(0, 0, STRINGS.start.title, {
        fontFamily: 'sans-serif',
        fontSize: '48px',
        fontStyle: 'bold',
        color: TEXT_COLOR,
      })
      .setOrigin(0.5)
      .setDepth(101)
      .setVisible(this.startShown);
    this.startHelp = this.add
      .text(0, 0, STRINGS.start.help, {
        fontFamily: 'sans-serif',
        fontSize: '16px',
        color: '#e2e8f0',
        align: 'center',
        lineSpacing: 4,
      })
      .setOrigin(0.5, 0)
      .setDepth(101)
      .setVisible(this.startShown);
    this.startButton = this.add
      .text(0, 0, STRINGS.start.button, {
        fontFamily: 'sans-serif',
        fontSize: '22px',
        fontStyle: 'bold',
        color: TEXT_COLOR,
      })
      .setOrigin(0.5)
      .setDepth(101)
      .setVisible(this.startShown);

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
    this.updateLoading();
    this.updateDebug(time);
    this.updateResourceBar();
    this.updateCommandPanel();
    this.updateHudButtons();
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

  /** What the loading bar shows right now. */
  getLoadingDisplay(): LoadingDisplay {
    const percent = this.loadingShown ?? 100;
    return {
      visible: this.loadingShown !== undefined,
      percent,
      text: this.loadingShown === undefined ? '' : STRINGS.loading(percent),
    };
  }

  /** What the frame counter shows right now. */
  getDebugDisplay(): DebugDisplay {
    return {
      visible: this.debugText !== undefined,
      text: this.debugText?.text ?? '',
      fps: this.debugFps,
    };
  }

  /** What the start screen shows right now. */
  getStartScreenDisplay(): StartScreenDisplay {
    const button = this.startButtonRect;
    return {
      visible: this.startShown && this.loadingShown === undefined,
      title: STRINGS.start.title,
      help: STRINGS.start.help,
      button: {
        label: STRINGS.start.button,
        x: button.x + button.width / 2,
        y: button.y + button.height / 2,
      },
    };
  }

  /** The buttons under the resource bar as they are drawn right now. */
  getHudButtonsDisplay(): HudButtonDisplay[] {
    if (this.startShown) return [];
    const rects = hudButtonRects(this.scale.width, this.hudButtonsShown.length);
    return this.hudButtonsShown.map((button, i) => {
      const rect = rects[i] as ScreenRect;
      return {
        ...button,
        x: rect.x + rect.width / 2,
        y: rect.y + rect.height / 2,
        width: rect.width,
        height: rect.height,
      };
    });
  }

  private updateHudButtons(): void {
    const next = this.startShown ? [] : this.source.getHudButtons();
    const shown = this.hudButtonsShown;
    const same =
      next.length === shown.length &&
      next.every((button, i) => button.id === shown[i]?.id && button.label === shown[i]?.label);
    if (same) return;
    this.hudButtonsShown = next;
    this.drawHudButtons();
  }

  private drawHudButtons(): void {
    const buttons = this.hudButtonsShown;
    const rects = hudButtonRects(this.scale.width, buttons.length);
    const g = this.hudButtons;
    g.clear();
    buttons.forEach((button, i) => {
      const rect = rects[i] as ScreenRect;
      g.fillStyle(BUTTON_COLOR, 0.92);
      g.fillRoundedRect(rect.x, rect.y, rect.width, rect.height, 4);
      g.lineStyle(1, PANEL_EDGE, 1);
      g.strokeRoundedRect(rect.x, rect.y, rect.width, rect.height, 4);
      let text = this.hudButtonTexts[i];
      if (!text) {
        text = this.add
          .text(0, 0, '', {
            fontFamily: 'sans-serif',
            fontSize: '15px',
            fontStyle: 'bold',
            color: TEXT_COLOR,
          })
          .setOrigin(0.5);
        this.hudButtonTexts[i] = text;
      }
      text
        .setVisible(true)
        .setText(button.label)
        .setPosition(rect.x + rect.width / 2, rect.y + rect.height / 2);
    });
    this.hudButtonTexts.slice(buttons.length).forEach((text) => text.setVisible(false));
  }

  /** Shows the loading bar while the game's files come in, with how far it has got in percent. */
  private updateLoading(): void {
    const progress = this.source.getLoadProgress();
    const next = progress === undefined ? undefined : Math.floor(progress * 100);
    if (next === this.loadingShown) return;
    this.loadingShown = next;
    const visible = next !== undefined;
    this.loading.setVisible(visible);
    this.loadingText.setVisible(visible);
    if (visible) this.drawLoading();
  }

  private drawLoading(): void {
    const percent = this.loadingShown;
    if (percent === undefined) return;
    const { width, height } = this.scale;
    const { bar, text } = loadingLayout(width, height);
    const g = this.loading;
    g.clear();
    g.fillStyle(PANEL_COLOR, 1);
    g.fillRect(0, 0, width, height);
    g.fillStyle(BUTTON_COLOR, 1);
    g.fillRoundedRect(bar.x, bar.y, bar.width, bar.height, 4);
    g.fillStyle(PROGRESS_COLOR, 1);
    g.fillRoundedRect(bar.x, bar.y, Math.max(8, (bar.width * percent) / 100), bar.height, 4);
    g.lineStyle(2, PANEL_EDGE, 1);
    g.strokeRoundedRect(bar.x, bar.y, bar.width, bar.height, 4);
    this.loadingText.setText(STRINGS.loading(percent)).setPosition(text.x, text.y);
  }

  /** Counts the frames drawn and writes the rate twice a second. */
  private updateDebug(time: number): void {
    if (!this.debugText) return;
    this.debugFrames++;
    const elapsed = time - this.debugSince;
    if (elapsed < UI_CONFIG.debugIntervalMs) return;
    this.debugFps = Math.round((this.debugFrames * 1000) / elapsed);
    this.debugFrames = 0;
    this.debugSince = time;
    this.debugText.setText(STRINGS.debug.fps(this.debugFps, this.source.getUnitCount()));
  }

  private hideStartScreen(): void {
    this.startShown = false;
    this.startScreen.setVisible(false);
    this.startTitle.setVisible(false);
    this.startHelp.setVisible(false);
    this.startButton.setVisible(false);
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
    const pressed = pointer.wasTouch || pointer.leftButtonDown();

    // Nothing responds while the game is loading.
    if (this.loadingShown !== undefined) return;

    // On the start screen only the "start" button responds.
    if (this.startShown) {
      if (pressed && rectContains(this.startButtonRect, pointer.x, pointer.y)) {
        this.claimPress();
        this.hideStartScreen();
        this.source.start();
      }
      return;
    }

    // Once the game is over only the "play again" button responds.
    if (this.outcomeShown !== undefined) {
      const { button } = outcomeLayout(this.scale.width, this.scale.height);
      if (pressed && rectContains(button, pointer.x, pointer.y)) this.source.restart();
      return;
    }

    if (pressed) {
      const rects = hudButtonRects(this.scale.width, this.hudButtonsShown.length);
      const index = rects.findIndex((rect) => rectContains(rect, pointer.x, pointer.y));
      const button = this.hudButtonsShown[index];
      if (button) {
        this.claimPress();
        this.source.pressHudButton(button.id);
        return;
      }
    }

    const info = this.commandInfo;
    const layout = this.commandLayout;
    if (!info || !layout) return;
    if (!pressed) return;
    const hit = commandPanelHit(layout, pointer.x, pointer.y);
    if (!hit) return;
    this.claimPress();

    if (hit.kind === 'button') {
      if (hit.index < info.buttons.length) {
        this.showRefusal(this.source.activateButton(hit.index));
      }
    } else if (hit.index < (info.queue?.length ?? 0)) {
      this.source.cancelQueuedUnit(hit.index);
    }
  }

  /**
   * Keeps a press the interface acts on away from the map. Acting on it can
   * take the pressed button off the screen, and the game scene, which sees
   * the press afterwards, would then take it for a press on the ground.
   */
  private claimPress(): void {
    this.input.stopPropagation();
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

    this.alert.setPosition(this.scale.width / 2, alertTop(this.scale.width));
    this.drawHudButtons();
    this.layoutStartScreen();
    this.drawLoading();
    this.debugText?.setPosition(8, resourceBarRect(this.scale.width).height + 8);

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

  private layoutStartScreen(): void {
    const { width, height } = this.scale;
    // The text is wrapped first, because the button goes below however many lines that gives.
    const wrapWidth = startScreenLayout(width, height, 0).body.width;
    this.startHelp.setWordWrapWidth(wrapWidth);
    const layout = startScreenLayout(width, height, this.startHelp.height);
    this.startButtonRect = layout.button;

    this.startTitle.setFontSize(layout.title.size).setPosition(layout.title.x, layout.title.y);
    this.startHelp.setPosition(layout.body.x, layout.body.y);
    const { button } = layout;
    this.startButton.setPosition(button.x + button.width / 2, button.y + button.height / 2);

    const g = this.startScreen;
    g.clear();
    g.fillStyle(PANEL_COLOR, 0.8);
    g.fillRect(0, 0, width, height);
    g.fillStyle(BUTTON_COLOR, 1);
    g.fillRoundedRect(button.x, button.y, button.width, button.height, 6);
    g.lineStyle(2, PANEL_EDGE, 1);
    g.strokeRoundedRect(button.x, button.y, button.width, button.height, 6);
  }
}
