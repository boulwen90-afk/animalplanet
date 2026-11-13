import { Scene } from 'phaser';
import { CAMERA_CONFIG } from '../../data/camera';
import { MAP_CONFIG, MAP_GEN_CONFIG } from '../../data/map';
import { STRINGS } from '../../data/strings';
import { UI_CONFIG } from '../../data/ui';
import { START_CONFIG } from '../../data/setup';
import { SIM_CONFIG, TICK_MS } from '../../data/sim';
import { consumeSteps, createStepClock } from '../../sim/clock';
import { BUILDING_DEFS } from '../../data/buildings';
import { applyCommand, type CommandResult } from '../../sim/commands';
import { createUnit, populationOf } from '../../sim/entities';
import { missingResources } from '../../sim/economy';
import { createGame } from '../../sim/game';
import { tileToWorld, worldToTileExact } from '../../sim/map/iso';
import type { GameState, PlayerId, SimEvent } from '../../sim/state';
import {
  isEntityVisibleTo,
  isTileExplored,
  isTileVisible,
  updateVisibility,
  visibleEntities,
} from '../../sim/systems/visibility';
import { tick } from '../../sim/tick';
import { installTestApi, type TestApi } from '../../testing/testHooks';
import { CameraController } from '../input/CameraController';
import { PlacementController } from '../input/PlacementController';
import { builderUnitIds } from '../input/selection';
import { SelectionController } from '../input/SelectionController';
import { TouchController } from '../input/TouchController';
import {
  commandPanelLayout,
  describeCommandPanel,
  type CommandPanelInfo,
} from '../ui/commandPanel';
import { hudButtonRects, rectContains, resourceBarRect, selectionPanelRect } from '../ui/layout';
import { describeSelection, type SelectionInfo } from '../ui/selectionInfo';
import { CaveView } from '../views/CaveView';
import { EntityView } from '../views/EntityView';
import { FogView } from '../views/FogView';
import { MapView } from '../views/MapView';
import { PlacementView } from '../views/PlacementView';
import { SelectionView } from '../views/SelectionView';
import { restartGame } from '../session';
import type { HudButton, HudButtonId, HudSource, ResourceBarInfo, UiScene } from './UiScene';

export interface GameSceneOptions {
  /** Expose window.__TEST__ (enabled with ?test=1). */
  testMode: boolean;
  /** Seed for all randomness in the game (set with ?seed=N). */
  seed: number;
  /** Whether the fog of war is on. Off only with ?fog=0 in test mode. */
  fog: boolean;
  /** Whether the computer plays the opponent. Off only with ?ai=0 in test mode. */
  ai: boolean;
  /** Whether the game waits behind the start screen until the player presses "start". */
  startScreen: boolean;
}

/** The side the person at the screen plays. */
const LOCAL_PLAYER: PlayerId = 0;
/** The side the computer plays. */
const OPPONENT: PlayerId = 1;

export class GameScene extends Scene implements HudSource {
  private state: GameState | undefined;
  private readonly stepClock = createStepClock();
  private cameraController!: CameraController;
  private selectionController!: SelectionController;
  private placementController!: PlacementController;
  private touchController!: TouchController;
  /** False while the start screen is showing; the match has not begun. */
  private started: boolean;
  private mapView!: MapView;
  private caveView!: CaveView;
  /** Undefined when the fog of war is off. */
  private fogView: FogView | undefined;
  private entityView!: EntityView;
  private selectionView!: SelectionView;
  private testApi: TestApi | undefined;
  /** Timestamp of the previous frame, in milliseconds. */
  private lastFrameTime: number | undefined;
  /** Sum of all (capped) frame times processed so far, in milliseconds. */
  private elapsedTotal = 0;
  /** Game time until which the "base under attack" warning shows, and when it was last raised. */
  private alertUntil = 0;
  private lastAlertAt = -Infinity;
  /** How many times the screen has shaken because a building collapsed. */
  private shakeCount = 0;

  constructor(private readonly options: GameSceneOptions) {
    super('Game');
    this.started = !options.startScreen;
  }

  create(): void {
    const state = createGame(this.options.seed, MAP_CONFIG, MAP_GEN_CONFIG, {
      fog: this.options.fog,
      ai: this.options.ai ? [OPPONENT] : [],
    });
    this.state = state;

    this.mapView = new MapView(this, state.map, MAP_CONFIG);
    this.caveView = new CaveView(this, state.map, MAP_CONFIG);
    if (state.fogEnabled) this.fogView = new FogView(this, state.map, MAP_CONFIG);
    this.entityView = new EntityView(this, MAP_CONFIG);
    this.selectionView = new SelectionView(this);

    this.cameraController = new CameraController(this, MAP_CONFIG, MAP_CONFIG);
    this.centerCameraOnTile(...this.playerStartTile(state));

    this.selectionController = new SelectionController(this, {
      getState: () => state,
      getVisibleEntities: () => visibleEntities(state, LOCAL_PLAYER),
      isExplored: (x, y) => isTileExplored(state, LOCAL_PLAYER, x, y),
      issue: (command) => applyCommand(state, command),
      isOverHud: (x, y) => this.isOverHud(x, y),
      isPlacing: () => this.placementController.active,
      player: LOCAL_PLAYER,
      tileSize: MAP_CONFIG,
      view: this.selectionView,
    });

    // Created after the selection controller: see PlacementController.
    this.placementController = new PlacementController(this, {
      getState: () => state,
      issue: (command) => applyCommand(state, command),
      onRefused: (result) => (this.scene.get('Ui') as UiScene).showRefusal(result),
      isOverHud: (x, y) => this.isOverHud(x, y),
      getBuilderIds: (type) =>
        builderUnitIds(this.selectionController.selection, state.entities, LOCAL_PLAYER, type),
      player: LOCAL_PLAYER,
      tileSize: MAP_CONFIG,
      view: new PlacementView(this, MAP_CONFIG),
    });

    this.touchController = new TouchController(this, {
      isOverHud: (x, y) => this.isOverHud(x, y),
      canBox: () => !this.placementController.active,
      pan: (dx, dy) => this.cameraController.panBy(dx, dy),
      tap: (x, y) => {
        if (this.placementController.active) this.placementController.tapAt(x, y);
        else this.selectionController.tapAt(x, y);
      },
      box: (start, end) => this.selectionController.selectBox(start, end),
      view: this.selectionView,
    });

    this.input.keyboard?.on('keydown-H', () => this.jumpToBase());

    if (this.options.testMode) this.installTestApi(state);
  }

  override update(time: number): void {
    const state = this.state;
    if (!state) return;

    // Phaser's own delta is smoothed and capped at 1/60 s while the game warms
    // up or lacks focus, which would slow the game down at low frame rates.
    // Measure real elapsed time instead.
    const elapsed =
      this.lastFrameTime === undefined
        ? 0
        : Math.min(time - this.lastFrameTime, CAMERA_CONFIG.maxFrameMs);
    this.lastFrameTime = time;
    this.elapsedTotal += elapsed;

    // Behind the start screen the match stands still.
    if (this.started) {
      // The simulation runs in fixed steps, however long the frame took.
      this.runSteps(
        state,
        consumeSteps(this.stepClock, elapsed, TICK_MS, SIM_CONFIG.maxTicksPerFrame),
      );
      this.cameraController.update(elapsed);
      this.touchController.update(elapsed);
    }
    this.selectionController.update();
    this.placementController.update();

    // Draw units part-way into the next step, so movement looks smooth.
    const alpha = Math.min(this.stepClock.accumulatorMs / TICK_MS, 1);
    const { width } = state.map;
    this.mapView.update(state.map, (index) =>
      isTileExplored(state, LOCAL_PLAYER, index % width, Math.floor(index / width)),
    );
    this.caveView.update(
      state.map,
      LOCAL_PLAYER,
      (cave) => isTileExplored(state, LOCAL_PLAYER, cave.x, cave.y),
      (cave) => isTileVisible(state, LOCAL_PLAYER, cave.x, cave.y),
    );
    this.entityView.update(
      state,
      alpha,
      this.selectionController.selection,
      this.elapsedTotal,
      (entity) => isEntityVisibleTo(state, LOCAL_PLAYER, entity),
    );
    const seen = state.players[LOCAL_PLAYER]?.visibility;
    if (seen) this.fogView?.update(seen);
    this.selectionView.update(elapsed);

    // Ready once the first frame has been simulated with the scene fully built.
    if (this.testApi) this.testApi.ready = true;
  }

  /** Runs simulation steps one at a time, reacting to what happens in each. */
  private runSteps(state: GameState, steps: number): void {
    for (let i = 0; i < steps && state.winner === null; i++) {
      tick(state);
      for (const event of state.events) this.onSimEvent(state, event);
    }
  }

  private onSimEvent(state: GameState, event: SimEvent): void {
    switch (event.type) {
      case 'hit':
        this.entityView.showHit(state, event.attackerId, event.targetId);
        break;
      case 'buildingAttacked':
        // Warn the player, but not more often than the cooldown allows.
        if (
          event.owner === LOCAL_PLAYER &&
          this.elapsedTotal >= this.lastAlertAt + UI_CONFIG.alertCooldownMs
        ) {
          this.lastAlertAt = this.elapsedTotal;
          this.alertUntil = this.elapsedTotal + UI_CONFIG.alertMs;
        }
        break;
      case 'buildingCollapsed':
        // A collapse hidden by the fog of war must not give itself away.
        if (event.owner === LOCAL_PLAYER || isTileVisible(state, LOCAL_PLAYER, event.x, event.y)) {
          this.shakeIfOnScreen(event.x, event.y);
        }
        break;
      default:
        break;
    }
  }

  /** Shakes the screen if the tile a building stood on is in view. */
  private shakeIfOnScreen(tileX: number, tileY: number): void {
    const camera = this.cameras.main;
    const world = tileToWorld(tileX, tileY, MAP_CONFIG);
    const inView =
      world.x >= camera.scrollX &&
      world.x <= camera.scrollX + camera.width &&
      world.y >= camera.scrollY &&
      world.y <= camera.scrollY + camera.height;
    if (!inView) return;
    this.shakeCount++;
    // Phaser measures the shake as a share of the screen size.
    camera.shake(UI_CONFIG.collapseShakeMs, UI_CONFIG.collapseShakePx / camera.width);
  }

  getAlert(): string | undefined {
    return this.elapsedTotal < this.alertUntil ? STRINGS.hud.baseUnderAttack : undefined;
  }

  getOutcome(): 'victory' | 'defeat' | undefined {
    const winner = this.state?.winner;
    if (winner === null || winner === undefined) return undefined;
    return winner === LOCAL_PLAYER ? 'victory' : 'defeat';
  }

  restart(): void {
    restartGame();
  }

  isStarted(): boolean {
    return this.started;
  }

  start(): void {
    this.started = true;
  }

  getHudButtons(): HudButton[] {
    if (!this.state) return [];
    const buttons: HudButton[] = [{ id: 'base', label: STRINGS.hud.toBase }];
    if (this.placementController.active) {
      buttons.push({ id: 'deselect', label: STRINGS.hud.cancelPlacement });
    } else if (this.selectionController.selection.size > 0) {
      buttons.push({ id: 'deselect', label: STRINGS.hud.deselect });
    }
    return buttons;
  }

  pressHudButton(id: HudButtonId): void {
    if (id === 'base') {
      this.jumpToBase();
    } else if (this.placementController.active) {
      // While a building is being placed the button cancels that instead.
      this.placementController.cancel();
    } else {
      this.selectionController.clear();
    }
  }

  /** Centres the view on the player's main building. */
  private jumpToBase(): void {
    if (!this.state || !this.started) return;
    this.centerCameraOnTile(...this.playerStartTile(this.state));
  }

  getSelectionInfo(): SelectionInfo | undefined {
    if (!this.state) return undefined;
    return describeSelection(this.state.entities, this.selectionController.selection, LOCAL_PLAYER);
  }

  getResourceBarInfo(): ResourceBarInfo | undefined {
    const stock = this.state?.players[LOCAL_PLAYER];
    if (!this.state || !stock) return undefined;
    return {
      food: stock.resources.food,
      wood: stock.resources.wood,
      population: populationOf(this.state, LOCAL_PLAYER),
      populationCap: START_CONFIG.populationCap,
    };
  }

  getCommandPanelInfo(): CommandPanelInfo | undefined {
    if (!this.state) return undefined;
    return describeCommandPanel(
      this.state.entities,
      this.selectionController.selection,
      LOCAL_PLAYER,
    );
  }

  activateButton(index: number): CommandResult {
    const info = this.getCommandPanelInfo();
    const action = info?.buttons[index]?.action;
    const stock = this.state?.players[LOCAL_PLAYER];
    if (!this.state || !info || !action || !stock) return { ok: false, reason: 'invalid' };

    if (action.kind === 'train') {
      if (info.buildingId === undefined) return { ok: false, reason: 'invalid' };
      return applyCommand(this.state, {
        type: 'train',
        player: LOCAL_PLAYER,
        buildingId: info.buildingId,
        unit: action.unit,
      });
    }

    // Building: say so at once if it cannot be afforded, otherwise let the player pick a place.
    const missing = missingResources(stock, BUILDING_DEFS[action.building].cost);
    if (missing.length > 0) return { ok: false, reason: 'insufficientResources', missing };
    this.placementController.start(action.building);
    return { ok: true };
  }

  cancelQueuedUnit(index: number): CommandResult {
    const info = this.getCommandPanelInfo();
    if (!this.state || info?.buildingId === undefined) return { ok: false, reason: 'invalid' };
    return applyCommand(this.state, {
      type: 'cancelTrain',
      player: LOCAL_PLAYER,
      buildingId: info.buildingId,
      index,
    });
  }

  /** Centre of the tile the player's main building is centred on. */
  private playerStartTile(state: GameState): [number, number] {
    const start = state.map.startPositions[LOCAL_PLAYER];
    return start ? [start.x + 0.5, start.y + 0.5] : [MAP_CONFIG.width / 2, MAP_CONFIG.height / 2];
  }

  /** Centres the view on a position in (possibly fractional) tile coordinates. */
  private centerCameraOnTile(tileX: number, tileY: number): void {
    const world = tileToWorld(tileX, tileY, MAP_CONFIG);
    this.cameraController.centerOn(world.x, world.y);
  }

  /** True if a screen position is on the resource bar, or on a panel that is showing. */
  private isOverHud(x: number, y: number): boolean {
    // The start screen and the end-of-game screen cover everything.
    if (!this.started || this.state?.winner !== null) return true;
    const { width, height } = this.scale;
    if (rectContains(resourceBarRect(width), x, y)) return true;
    const buttons = hudButtonRects(width, this.getHudButtons().length);
    if (buttons.some((rect) => rectContains(rect, x, y))) return true;
    if (this.selectionController.selection.size === 0) return false;
    if (rectContains(selectionPanelRect(width, height), x, y)) return true;
    const command = this.getCommandPanelInfo();
    return (
      command !== undefined &&
      rectContains(
        commandPanelLayout(width, height, command.buttons.length, command.queue !== undefined)
          .panel,
        x,
        y,
      )
    );
  }

  private installTestApi(state: GameState): void {
    const camera = this.cameras.main;
    this.testApi = installTestApi({
      getElapsedMs: () => this.elapsedTotal,
      getState: () => structuredClone(state),
      advance: (steps) => this.runSteps(state, steps),
      spawnUnit: (type, owner, tileX, tileY) => {
        const unit = createUnit(state, type, owner, tileX, tileY);
        // Let the new unit see at once, as it would after the next step.
        updateVisibility(state);
        return unit.id;
      },
      getAlert: () => (this.scene.get('Ui') as UiScene).getAlertDisplay(),
      getOutcome: () => (this.scene.get('Ui') as UiScene).getOutcomeDisplay(),
      getStartScreen: () => (this.scene.get('Ui') as UiScene).getStartScreenDisplay(),
      getHudButtons: () => (this.scene.get('Ui') as UiScene).getHudButtonsDisplay(),
      getTouchMode: () => this.touchController.mode,
      getShakeCount: () => this.shakeCount,
      command: (command) => applyCommand(state, command),
      getSelection: () => [...this.selectionController.selection],
      getHud: () => (this.scene.get('Ui') as UiScene).getDisplay(),
      getResourceBar: () => (this.scene.get('Ui') as UiScene).getResourceBarDisplay(),
      getFlashing: () => (this.scene.get('Ui') as UiScene).getFlashing(),
      getCommandPanel: () => (this.scene.get('Ui') as UiScene).getCommandPanelDisplay(),
      getPlacement: () => {
        const placement = this.placementController.current;
        return placement ? { ...placement } : null;
      },
      getOrderMarkerCount: () => this.selectionView.orderMarkerCount,
      tileToScreen: (tileX, tileY) => {
        const world = tileToWorld(tileX, tileY, MAP_CONFIG);
        return { x: world.x - camera.scrollX, y: world.y - camera.scrollY };
      },
      centerCameraOnTile: (tileX, tileY) => this.centerCameraOnTile(tileX, tileY),
      getCamera: () => ({
        x: camera.scrollX,
        y: camera.scrollY,
        width: camera.width,
        height: camera.height,
        centerTile: worldToTileExact(
          camera.scrollX + camera.width / 2,
          camera.scrollY + camera.height / 2,
          MAP_CONFIG,
        ),
      }),
    });
  }
}
