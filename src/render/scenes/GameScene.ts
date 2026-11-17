import { Scene } from 'phaser';
import type { Difficulty } from '../../data/ai';
import { CAMERA_CONFIG } from '../../data/camera';
import { MAP_CONFIG, MAP_GEN_CONFIG } from '../../data/map';
import { STRINGS } from '../../data/strings';
import { UI_CONFIG } from '../../data/ui';
import { SIM_CONFIG, TICK_MS } from '../../data/sim';
import {
  consumeSteps,
  createStepClock,
  createStepTimes,
  recordStep,
  takeStepTime,
  type StepTime,
} from '../../sim/clock';
import { BUILDING_DEFS, BUILD_MENUS, type BuildMenu } from '../../data/buildings';
import { checksum } from '../../sim/checksum';
import { applyCommand, type Command, type CommandResult } from '../../sim/commands';
import {
  buildingCentre,
  createUnit,
  isBuilding,
  isUnit,
  populationRoom,
  reservedPopulation,
} from '../../sim/entities';
import { missingResources } from '../../sim/economy';
import { createGame, setDifficulty } from '../../sim/game';
import { createSession, step, submit, type Session } from '../../sim/lockstep';
import { startStress, stressUnits, type StressMode } from '../../sim/stress';
import { tileToWorld, worldToTileExact } from '../../sim/map/iso';
import { buildPathGrid } from '../../sim/pathfinding/passability';
import type { Building, GameState, PlayerId, SimEvent } from '../../sim/state';
import { workPlacesOf } from '../../sim/systems/gathering';
import {
  isEntityVisibleTo,
  isTileExplored,
  isTileVisible,
  updateVisibility,
  visibleEntities,
} from '../../sim/systems/visibility';
import { installTestApi, type TestApi } from '../../testing/testHooks';
import { BuildingLibrary } from '../buildings/BuildingLibrary';
import { CharacterLibrary } from '../characters/CharacterLibrary';
import { CameraController } from '../input/CameraController';
import { PlacementController } from '../input/PlacementController';
import { builderUnitIds, repairerUnitIds } from '../input/selection';
import { SelectionController } from '../input/SelectionController';
import { TouchController } from '../input/TouchController';
import {
  commandPanelLayout,
  describeCommandPanel,
  type CommandPanelInfo,
} from '../ui/commandPanel';
import { hudButtonRects, rectContains, resourceBarRect, selectionPanelRect } from '../ui/layout';
import { describeSelection, describeStats, type SelectionInfo } from '../ui/selectionInfo';
import { CaveView } from '../views/CaveView';
import { DamageView } from '../views/DamageView';
import { EntityView } from '../views/EntityView';
import { FogView } from '../views/FogView';
import { SceneryLibrary } from '../scenery/SceneryLibrary';
import { MapView } from '../views/MapView';
import { PLAYER_COLORS } from '../views/visuals';
import { PlacementView } from '../views/PlacementView';
import { ProjectileView, landHeight } from '../views/ProjectileView';
import { SelectionView } from '../views/SelectionView';
import { rememberLevel, restartGame } from '../session';
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
  /**
   * How hard the computer plays, unless the player picks another level on
   * the start screen (set with ?level= in test mode).
   */
  difficulty: Difficulty;
  /** Whether the game waits behind the start screen until the player presses "start". */
  startScreen: boolean;
  /**
   * How many extra Samlare the player starts with, to measure how the game
   * runs with many units (set with ?stress=N). 0 for a normal match.
   */
  stress: number;
  /** What the units of a stress run do (set with ?stressmode=). */
  stressMode: StressMode;
  /** The side the person at the screen plays: 0 unless ?side=1 in test mode. */
  side: PlayerId;
  /**
   * How many turns after it is given the player's order is carried out. 0
   * against the computer; set with ?lockstep=N in test mode, to try the
   * delay that a match between two players has.
   */
  delayTurns: number;
}

/** The fishing places on the shore are worked out again every this many frames. */
const FISHING_PLACES_EVERY = 20;
/** The picture the mouse pointer turns into over a building that can be repaired, and the point of it that points: the hammer's head. */
const REPAIR_POINTER = { frame: 'icon_repair', hotspot: { x: 0.8, y: 0.2 } } as const;

export class GameScene extends Scene implements HudSource {
  private state: GameState | undefined;
  /** The side the person at the screen plays, and the other side. */
  private readonly local: PlayerId;
  private readonly opponent: PlayerId;
  /** The turns of the match: every order the player gives goes through it. */
  private session!: Session;
  private readonly stepClock = createStepClock();
  private readonly stepTimes = createStepTimes();
  private cameraController!: CameraController;
  private selectionController!: SelectionController;
  private placementController!: PlacementController;
  private placementView!: PlacementView;
  private touchController!: TouchController;
  /** False while the start screen is showing; the match has not begun. */
  private started: boolean;
  private mapView!: MapView;
  /** Frames since the fishing places were last worked out. */
  private fishingFrames = -1;
  private caveView!: CaveView;
  /** Undefined when the fog of war is off. */
  private fogView: FogView | undefined;
  private entityView!: EntityView;
  private projectileView!: ProjectileView;
  private selectionView!: SelectionView;
  private testApi: TestApi | undefined;
  /** Timestamp of the previous frame, in milliseconds. */
  private lastFrameTime: number | undefined;
  /** Sum of all (capped) frame times processed so far, in milliseconds. */
  private elapsedTotal = 0;
  /** Game time until which the "base under attack" warning shows, and when it was last raised. */
  private alertUntil = 0;
  private lastAlertAt = -Infinity;
  /** What the mouse pointer looks like, and the pointer shown over a building that can be repaired. */
  private pointerShown: 'default' | 'repair' = 'default';
  private repairPointer = 'pointer';
  /** The tab of the build menu that is showing. It stays as it is when the selection changes. */
  private buildMenu: BuildMenu = BUILD_MENUS[0];
  /** How many times the screen has shaken because a building collapsed. */
  private shakeCount = 0;
  /** How many frames have been drawn. */
  private frameCount = 0;
  /** How much of the game's files have been loaded, 0 to 1; undefined once the scene is built. */
  private loadProgress: number | undefined = 0;

  constructor(private readonly options: GameSceneOptions) {
    super('Game');
    this.started = !options.startScreen;
    this.local = options.side;
    this.opponent = options.side === 0 ? 1 : 0;
  }

  preload(): void {
    this.load.on('progress', (share: number) => {
      this.loadProgress = share;
    });
    CharacterLibrary.preload(this);
    BuildingLibrary.preload(this);
    SceneryLibrary.preload(this);
  }

  create(): void {
    const stress = this.options.stress;
    const state = createGame(this.options.seed, MAP_CONFIG, MAP_GEN_CONFIG, {
      fog: this.options.fog,
      ai: this.options.ai ? [this.opponent] : [],
      difficulty: this.options.difficulty,
      extraUnits: stressUnits(stress, this.options.stressMode),
    });
    this.state = state;
    this.session = createSession({
      local: this.local,
      delayTurns: this.options.delayTurns,
      // In test mode copies of the game are kept, so that a match that comes
      // apart can say where.
      trace: this.options.testMode,
    });
    if (stress > 0) startStress(state, this.options.stressMode);

    const scenery = new SceneryLibrary(this, PLAYER_COLORS);
    this.mapView = new MapView(this, state.map, MAP_CONFIG, scenery);
    this.caveView = new CaveView(this, state.map, MAP_CONFIG, scenery);
    if (state.fogEnabled) this.fogView = new FogView(this, state.map, MAP_CONFIG);
    const buildingArt = new BuildingLibrary(this, PLAYER_COLORS);
    this.entityView = new EntityView(
      this,
      MAP_CONFIG,
      new CharacterLibrary(this, PLAYER_COLORS),
      buildingArt,
      new DamageView(this, MAP_CONFIG, scenery.textureKey()),
      this.local,
    );
    this.repairPointer = scenery.pointer(
      this,
      REPAIR_POINTER.frame,
      REPAIR_POINTER.hotspot,
      'pointer',
    );
    this.projectileView = new ProjectileView(this, MAP_CONFIG, (owner) =>
      scenery.textureKey(owner),
    );
    this.selectionView = new SelectionView(this);

    this.cameraController = new CameraController(this, MAP_CONFIG, MAP_CONFIG);
    this.centerCameraOnTile(...this.playerStartTile(state));

    this.selectionController = new SelectionController(this, {
      getState: () => state,
      getVisibleEntities: () => visibleEntities(state, this.local),
      isExplored: (x, y) => isTileExplored(state, this.local, x, y),
      issue: (command) => this.issue(command),
      isOverHud: (x, y) => this.isOverHud(x, y),
      isPlacing: () => this.placementController.active,
      player: this.local,
      tileSize: MAP_CONFIG,
      view: this.selectionView,
    });

    this.placementView = new PlacementView(this, MAP_CONFIG, buildingArt, this.local);
    // Created after the selection controller: see PlacementController.
    this.placementController = new PlacementController(this, {
      getState: () => state,
      issue: (command) => this.issue(command),
      onRefused: (result) => (this.scene.get('Ui') as UiScene).showRefusal(result),
      isOverHud: (x, y) => this.isOverHud(x, y),
      getBuilderIds: (type) =>
        builderUnitIds(this.selectionController.selection, state.entities, this.local, type),
      player: this.local,
      tileSize: MAP_CONFIG,
      view: this.placementView,
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
    // Everything is loaded and built: the loading bar can go.
    this.loadProgress = undefined;
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
    this.frameCount++;

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
    this.updatePointer();

    // Draw units part-way into the next step, so movement looks smooth.
    const alpha = Math.min(this.stepClock.accumulatorMs / TICK_MS, 1);
    const { width } = state.map;
    const { worldView } = this.cameras.main;
    this.mapView.update(
      state.map,
      (index) => isTileExplored(state, this.local, index % width, Math.floor(index / width)),
      worldView,
    );
    this.updateFishingPlaces(state);
    this.caveView.update(
      state.map,
      this.local,
      (cave) => isTileExplored(state, this.local, cave.x, cave.y),
      (cave) => isTileVisible(state, this.local, cave.x, cave.y),
    );
    this.entityView.update(
      state,
      alpha,
      this.selectionController.selection,
      this.elapsedTotal,
      (entity) => isEntityVisibleTo(state, this.local, entity),
    );
    this.projectileView.update(state, alpha, this.elapsedTotal, (x, y) =>
      isTileVisible(state, this.local, x, y),
    );
    const seen = state.players[this.local]?.visibility;
    if (seen) this.fogView?.update(seen);
    this.selectionView.update(elapsed);

    // Ready once the first frame has been simulated with the scene fully built.
    if (this.testApi) this.testApi.ready = true;
  }

  /**
   * The mouse pointer turns into a hammer over a damaged building that the
   * selected units would repair on a right click.
   */
  private updatePointer(): void {
    const next = this.selectionController.repairTarget !== undefined ? 'repair' : 'default';
    if (next === this.pointerShown) return;
    this.pointerShown = next;
    this.input.setDefaultCursor(next === 'repair' ? this.repairPointer : 'default');
  }

  /** Runs simulation steps one at a time, reacting to what happens in each. */
  private runSteps(state: GameState, steps: number): void {
    for (let i = 0; i < steps && state.winner === null; i++) {
      // Only the step itself is timed: what the picture does with it is not.
      const before = performance.now();
      // The orders that are due are carried out, and then the game moves on.
      if (!step(this.session, state)) break;
      recordStep(this.stepTimes, performance.now() - before);
      // An order of the player's that looked fine when it was given but was
      // refused when its turn came: say why, as if it had been refused at once.
      for (const outcome of this.session.outcomes) {
        if (outcome.player === this.local && !outcome.result.ok) {
          (this.scene.get('Ui') as UiScene).showRefusal(outcome.result);
        }
      }
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
          event.owner === this.local &&
          this.elapsedTotal >= this.lastAlertAt + UI_CONFIG.alertCooldownMs
        ) {
          this.lastAlertAt = this.elapsedTotal;
          this.alertUntil = this.elapsedTotal + UI_CONFIG.alertMs;
        }
        break;
      case 'projectileHit':
        // What lands out of sight is not shown.
        if (isTileVisible(state, this.local, Math.floor(event.x), Math.floor(event.y))) {
          this.entityView.flash(event.targetId);
          const target = state.entities.find((entity) => entity.id === event.targetId);
          this.projectileView.showHit(event.x, event.y, landHeight(target));
        }
        break;
      case 'upgradeDone':
        if (event.owner === this.local) {
          const name = STRINGS.hud.upgradeLevel(STRINGS.upgrades[event.upgrade], event.level);
          (this.scene.get('Ui') as UiScene).showMessage(STRINGS.hud.upgradeReady(name));
        }
        break;
      case 'repairPaused':
        if (event.owner === this.local) {
          (this.scene.get('Ui') as UiScene).showRepairPaused();
        }
        break;
      case 'buildingCollapsed':
        // A collapse hidden by the fog of war must not give itself away.
        if (event.owner === this.local || isTileVisible(state, this.local, event.x, event.y)) {
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
    // In a match between two players: their games have come apart and are being set right.
    if (this.session?.stopped) return STRINGS.hud.outOfStep;
    return this.elapsedTotal < this.alertUntil ? STRINGS.hud.baseUnderAttack : undefined;
  }

  getOutcome(): 'victory' | 'defeat' | undefined {
    const winner = this.state?.winner;
    if (winner === null || winner === undefined) return undefined;
    return winner === this.local ? 'victory' : 'defeat';
  }

  restart(): void {
    restartGame();
  }

  isStarted(): boolean {
    return this.started;
  }

  getLoadProgress(): number | undefined {
    return this.loadProgress;
  }

  /**
   * Gives an order from the player. Every order goes this way: through the
   * turns of the match, which carry it out at once against the computer and
   * some turns later against another player. The answer is what happened,
   * or with a delay what would happen if it were carried out now.
   */
  private issue(command: Command): CommandResult {
    if (!this.state) return { ok: false, reason: 'invalid' };
    return submit(this.session, this.state, command);
  }

  getUnitCount(): number {
    return this.state?.entities.filter(isUnit).length ?? 0;
  }

  takeStepTime(): StepTime {
    return takeStepTime(this.stepTimes);
  }

  getDifficulty(): Difficulty {
    return this.state?.players[this.opponent]?.ai?.level ?? this.options.difficulty;
  }

  start(difficulty: Difficulty): void {
    if (this.started) return;
    if (this.state) setDifficulty(this.state, difficulty);
    rememberLevel(difficulty);
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
    return describeSelection(this.state.entities, this.selectionController.selection, this.local);
  }

  getResourceBarInfo(): ResourceBarInfo | undefined {
    const stock = this.state?.players[this.local];
    if (!this.state || !stock) return undefined;
    return {
      food: stock.resources.food,
      wood: stock.resources.wood,
      population: reservedPopulation(this.state, this.local),
      populationRoom: populationRoom(this.state, this.local),
    };
  }

  getCommandPanelInfo(): CommandPanelInfo | undefined {
    if (!this.state) return undefined;
    return describeCommandPanel(
      this.state.entities,
      this.selectionController.selection,
      this.local,
      this.buildMenu,
      this.state.players[this.local]?.upgrades,
    );
  }

  getSelectionStats(): string | undefined {
    if (!this.state) return undefined;
    return describeStats(this.state, this.selectionController.selection, this.local);
  }

  selectCommandTab(index: number): void {
    const tab = this.getCommandPanelInfo()?.tabs?.[index];
    if (tab) this.buildMenu = tab.menu;
  }

  activateButton(index: number): CommandResult {
    const info = this.getCommandPanelInfo();
    const action = info?.buttons[index]?.action;
    const stock = this.state?.players[this.local];
    if (!this.state || !info || !action || !stock) return { ok: false, reason: 'invalid' };

    if (action.kind === 'train') {
      if (info.buildingId === undefined) return { ok: false, reason: 'invalid' };
      return this.issue({
        type: 'train',
        player: this.local,
        buildingId: info.buildingId,
        unit: action.unit,
      });
    }

    if (action.kind === 'research') {
      if (info.buildingId === undefined) return { ok: false, reason: 'invalid' };
      return this.issue({
        type: 'research',
        player: this.local,
        buildingId: info.buildingId,
        upgrade: action.upgrade,
      });
    }

    if (action.kind === 'repair') {
      const target = this.state.entities.find(
        (entity): entity is Building => entity.id === action.buildingId && isBuilding(entity),
      );
      if (!target) return { ok: false, reason: 'invalid' };
      const result = this.issue({
        type: 'repair',
        player: this.local,
        unitIds: repairerUnitIds(
          this.selectionController.selection,
          this.state.entities,
          this.local,
        ),
        buildingId: target.id,
      });
      if (result.ok) {
        const centre = buildingCentre(target);
        const world = tileToWorld(centre.x, centre.y, MAP_CONFIG);
        this.selectionView.addOrderMarker(world.x, world.y);
      }
      return result;
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
    return this.issue({
      // The same press cancels a unit in a queue of units and an upgrade in a queue of upgrades.
      type: info.queueOf === 'upgrades' ? 'cancelResearch' : 'cancelTrain',
      player: this.local,
      buildingId: info.buildingId,
      index,
    });
  }

  /** Centre of the tile the player's main building is centred on. */
  private playerStartTile(state: GameState): [number, number] {
    const start = state.map.startPositions[this.local];
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
        commandPanelLayout(
          width,
          height,
          command.buttons.length,
          command.queue !== undefined,
          command.tabs?.length ?? 0,
        ).panel,
        x,
        y,
      )
    );
  }

  /**
   * Marks the fishing places of the fishing huts the player can see. They
   * change only when a hut is built or lost, or the shore by one is built
   * on, so they are worked out a few times a second, not every frame.
   */
  private updateFishingPlaces(state: GameState): void {
    this.fishingFrames = (this.fishingFrames + 1) % FISHING_PLACES_EVERY;
    if (this.fishingFrames !== 0) return;
    const huts = state.entities.filter(
      (entity): entity is Building =>
        isBuilding(entity) &&
        entity.complete &&
        BUILDING_DEFS[entity.type].work?.places === 'shore' &&
        isEntityVisibleTo(state, this.local, entity),
    );
    if (huts.length === 0) {
      this.mapView.showFishingPlaces([]);
      return;
    }
    const grid = buildPathGrid(state);
    this.mapView.showFishingPlaces(huts.flatMap((hut) => workPlacesOf(state, grid, hut)));
  }

  private installTestApi(state: GameState): void {
    const camera = this.cameras.main;
    this.testApi = installTestApi({
      getElapsedMs: () => this.elapsedTotal,
      getState: () => structuredClone(state),
      getChecksum: () => checksum(state),
      advance: (steps) => this.runSteps(state, steps),
      spawnUnit: (type, owner, tileX, tileY) => {
        const unit = createUnit(state, type, owner, tileX, tileY);
        // Let the new unit see at once, as it would after the next step.
        updateVisibility(state);
        return unit.id;
      },
      setLife: (id, life) => {
        const entity = state.entities.find((candidate) => candidate.id === id);
        if (entity && life > 0) entity.hp = life;
      },
      getAlert: () => (this.scene.get('Ui') as UiScene).getAlertDisplay(),
      getNotice: () => (this.scene.get('Ui') as UiScene).getNoticeDisplay(),
      getOutcome: () => (this.scene.get('Ui') as UiScene).getOutcomeDisplay(),
      getStartScreen: () => (this.scene.get('Ui') as UiScene).getStartScreenDisplay(),
      getDebug: () => (this.scene.get('Ui') as UiScene).getDebugDisplay(),
      getHudButtons: () => (this.scene.get('Ui') as UiScene).getHudButtonsDisplay(),
      getTouchMode: () => this.touchController.mode,
      getShakeCount: () => this.shakeCount,
      getFrameCount: () => this.frameCount,
      getUnitSprite: (id) => this.entityView.describeUnit(id) ?? null,
      getBuildingSprite: (id) => this.entityView.describeBuilding(id) ?? null,
      getBuildingDamage: (id) => this.entityView.describeDamage(id),
      getBuildingProgress: (id) => this.entityView.describeProgress(id) ?? null,
      getHudStats: () => (this.scene.get('Ui') as UiScene).getStatsDisplay(),
      getProjectiles: () => this.projectileView.describe(),
      getRangeRings: () => this.entityView.describeRangeRings(),
      getPointer: () => ({
        shown: this.pointerShown,
        css: this.game.canvas.style.cursor,
        repairTarget: this.selectionController.repairTarget ?? null,
      }),
      getScenery: (tileX, tileY) => this.mapView.describe(tileX, tileY),
      getObjectCount: () => this.mapView.objectCount,
      command: (command) => applyCommand(state, command),
      issue: (command) => this.issue(command),
      getSelection: () => [...this.selectionController.selection],
      getHud: () => (this.scene.get('Ui') as UiScene).getDisplay(),
      getResourceBar: () => (this.scene.get('Ui') as UiScene).getResourceBarDisplay(),
      getFlashing: () => (this.scene.get('Ui') as UiScene).getFlashing(),
      getCommandPanel: () => (this.scene.get('Ui') as UiScene).getCommandPanelDisplay(),
      getPlacement: () => {
        const placement = this.placementController.current;
        return placement ? { ...placement } : null;
      },
      getPlacementPreview: () => this.placementView.describePreview(),
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
