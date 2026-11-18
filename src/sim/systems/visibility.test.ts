import { describe, expect, it, vi } from 'vitest';
import { BUILDING_DEFS, CONSTRUCTION_CONFIG } from '../../data/buildings';
import { UNIT_DEFS } from '../../data/units';
import { applyCommand } from '../commands';
import { createBuilding, createUnit, unitTile } from '../entities';
import { createGame } from '../game';
import { EXPLORED, UNEXPLORED, VISIBLE, type GameState } from '../state';
import { startStress, stressUnits } from '../stress';
import { addCave, openState } from '../testUtils';
import { advance, tick } from '../tick';
import { canPlaceBuilding, placementProblem } from './construction';
import {
  isEntityVisibleTo,
  isTileExplored,
  isTileVisible,
  updateVisibility,
  visibilityAt,
  visibleEntities,
} from './visibility';

/** An open map with the fog of war turned on. */
function foggyState(width: number, height: number): GameState {
  const state = openState(width, height);
  state.fogEnabled = true;
  return state;
}

const seen = (state: GameState, player: 0 | 1, x: number, y: number) =>
  visibilityAt(state, player, x, y);

describe('what a unit sees', () => {
  it('a Samlare sees exactly the tiles within 6 tiles of its own', () => {
    const state = foggyState(30, 30);
    createUnit(state, 'samlare', 0, 15, 15);
    updateVisibility(state);
    expect(UNIT_DEFS.samlare.sight).toBe(6);

    for (let y = 0; y < 30; y++) {
      for (let x = 0; x < 30; x++) {
        const inSight = Math.hypot(x - 15, y - 15) <= 6;
        expect(seen(state, 0, x, y), `${x},${y}`).toBe(inSight ? VISIBLE : UNEXPLORED);
      }
    }
    // Six tiles straight out is seen, seven is not; the circle is cut at the corners.
    expect(isTileVisible(state, 0, 21, 15)).toBe(true);
    expect(isTileVisible(state, 0, 22, 15)).toBe(false);
    expect(isTileVisible(state, 0, 19, 19)).toBe(true);
    expect(isTileVisible(state, 0, 20, 19)).toBe(false);
  });

  it('a Ramkrigare sees one tile further', () => {
    const state = foggyState(30, 30);
    createUnit(state, 'ramkrigare', 0, 15, 15);
    updateVisibility(state);
    expect(isTileVisible(state, 0, 22, 15)).toBe(true);
    expect(isTileVisible(state, 0, 23, 15)).toBe(false);
  });

  it('sees only for its own side', () => {
    const state = foggyState(30, 30);
    createUnit(state, 'samlare', 0, 15, 15);
    updateVisibility(state);
    expect(isTileVisible(state, 0, 15, 15)).toBe(true);
    expect(seen(state, 1, 15, 15)).toBe(UNEXPLORED);
  });

  it('does not see past the edge of the map, and nothing breaks there', () => {
    const state = foggyState(10, 10);
    createUnit(state, 'samlare', 0, 0, 0);
    expect(() => updateVisibility(state)).not.toThrow();
    expect(isTileVisible(state, 0, 0, 0)).toBe(true);
    expect(seen(state, 0, -1, 0)).toBe(UNEXPLORED);
    expect(seen(state, 0, 10, 10)).toBe(UNEXPLORED);
    expect(state.players[0]!.visibility).toHaveLength(100);
  });

  it('terrain does not block sight', () => {
    const state = foggyState(20, 5);
    for (let y = 0; y < 5; y++) state.map.terrain[y * 20 + 8] = 'rock';
    createUnit(state, 'samlare', 0, 5, 2);
    updateVisibility(state);
    expect(isTileVisible(state, 0, 10, 2)).toBe(true);
  });
});

describe('explored tiles', () => {
  it('tiles a unit walks away from stay explored and do not turn unexplored', () => {
    const state = foggyState(40, 5);
    const unit = createUnit(state, 'samlare', 0, 3, 2);
    updateVisibility(state);
    expect(seen(state, 0, 0, 2)).toBe(VISIBLE);

    applyCommand(state, { type: 'move', player: 0, unitIds: [unit.id], x: 30, y: 2 });
    advance(state, 300);
    expect(unitTile(unit)).toEqual({ x: 30, y: 2 });
    // Where it started is out of sight now, but remembered.
    expect(seen(state, 0, 0, 2)).toBe(EXPLORED);
    expect(isTileExplored(state, 0, 0, 2)).toBe(true);
    expect(isTileVisible(state, 0, 0, 2)).toBe(false);
    // Everything along the way was seen in passing.
    for (let x = 0; x <= 36; x++) expect(isTileExplored(state, 0, x, 2), `x ${x}`).toBe(true);
    expect(seen(state, 0, 30, 2)).toBe(VISIBLE);
    expect(seen(state, 0, 39, 2)).toBe(UNEXPLORED);
  });

  it('visibility follows a moving unit step by step', () => {
    const state = foggyState(40, 5);
    const unit = createUnit(state, 'samlare', 0, 3, 2);
    applyCommand(state, { type: 'move', player: 0, unitIds: [unit.id], x: 30, y: 2 });
    for (let i = 0; i < 100; i++) {
      tick(state);
      const here = unitTile(unit);
      expect(isTileVisible(state, 0, here.x, here.y)).toBe(true);
      expect(isTileVisible(state, 0, here.x + 6, here.y)).toBe(true);
      expect(isTileVisible(state, 0, here.x + 7, here.y)).toBe(false);
    }
  });

  it('a unit that has surrendered no longer sees for its side', () => {
    const state = foggyState(30, 10);
    addCave(state, 0, 28, 5);
    const unit = createUnit(state, 'samlare', 0, 5, 5);
    updateVisibility(state);
    expect(isTileVisible(state, 0, 5, 5)).toBe(true);
    unit.task = { kind: 'flee', caveId: 1 };
    updateVisibility(state);
    expect(seen(state, 0, 5, 5)).toBe(EXPLORED);
  });
});

describe('what a building sees', () => {
  it('a finished building sees its sight radius from its centre', () => {
    const state = foggyState(40, 40);
    createBuilding(state, 'storide', 0, 19, 19);
    updateVisibility(state);
    expect(BUILDING_DEFS.storide.sight).toBe(9);
    // Centre at (20.5, 20.5): the tile nine away is seen, the tenth is not.
    expect(isTileVisible(state, 0, 29, 20)).toBe(true);
    expect(isTileVisible(state, 0, 30, 20)).toBe(false);
    expect(isTileVisible(state, 0, 11, 20)).toBe(true);
    expect(isTileVisible(state, 0, 10, 20)).toBe(false);
  });

  it('a building under construction sees only its surroundings', () => {
    const state = foggyState(40, 40);
    const site = createBuilding(state, 'storide', 0, 19, 19);
    site.complete = false;
    updateVisibility(state);
    expect(CONSTRUCTION_CONFIG.sight).toBe(2);
    expect(isTileVisible(state, 0, 22, 20)).toBe(true);
    expect(isTileVisible(state, 0, 23, 20)).toBe(false);
  });
});

describe('seeing the other side', () => {
  function standoff(distance: number) {
    const state = foggyState(40, 10);
    const mine = createUnit(state, 'samlare', 0, 5, 5);
    const theirs = createUnit(state, 'samlare', 1, 5 + distance, 5);
    updateVisibility(state);
    return { state, mine, theirs };
  }

  it('an enemy outside sight is not among the entities the side can see', () => {
    const { state, mine, theirs } = standoff(7);
    expect(isEntityVisibleTo(state, 0, theirs)).toBe(false);
    expect(visibleEntities(state, 0)).toEqual([mine]);
    // Each side always sees its own.
    expect(visibleEntities(state, 1)).toEqual([theirs]);
  });

  it('an enemy within sight is', () => {
    const { state, mine, theirs } = standoff(6);
    expect(isEntityVisibleTo(state, 0, theirs)).toBe(true);
    expect(visibleEntities(state, 0)).toEqual([mine, theirs]);
  });

  it('an enemy on an explored tile that is out of sight is hidden again', () => {
    const state = foggyState(40, 10);
    const scout = createUnit(state, 'samlare', 0, 5, 5);
    const theirs = createUnit(state, 'samlare', 1, 9, 5);
    updateVisibility(state);
    expect(isEntityVisibleTo(state, 0, theirs)).toBe(true);
    applyCommand(state, { type: 'move', player: 0, unitIds: [scout.id], x: 30, y: 5 });
    advance(state, 300);
    expect(seen(state, 0, 9, 5)).toBe(EXPLORED);
    expect(isEntityVisibleTo(state, 0, theirs)).toBe(false);
  });

  it('a building is seen as soon as any of its tiles is in sight', () => {
    const state = foggyState(40, 12);
    createUnit(state, 'samlare', 0, 5, 5);
    // Footprint x 11..13: only its nearest column is within six tiles.
    const building = createBuilding(state, 'storide', 1, 11, 4);
    updateVisibility(state);
    expect(isTileVisible(state, 0, 11, 5)).toBe(true);
    expect(isTileVisible(state, 0, 12, 5)).toBe(false);
    expect(isEntityVisibleTo(state, 0, building)).toBe(true);
  });

  it('with the fog of war off, everything is seen', () => {
    const state = openState(40, 10);
    createUnit(state, 'samlare', 0, 2, 2);
    const theirs = createUnit(state, 'samlare', 1, 38, 8);
    expect(state.fogEnabled).toBe(false);
    expect(isEntityVisibleTo(state, 0, theirs)).toBe(true);
    expect(visibilityAt(state, 0, 39, 9)).toBe(VISIBLE);
    expect(isTileExplored(state, 0, 39, 9)).toBe(true);
  });
});

describe('fog of war and orders', () => {
  it('refuses to build on unexplored ground, and allows it once explored', () => {
    const state = foggyState(40, 10);
    const builder = createUnit(state, 'samlare', 0, 5, 5);
    updateVisibility(state);
    const order = (x: number) =>
      applyCommand(state, {
        type: 'build',
        player: 0,
        unitIds: [builder.id],
        building: 'visthus',
        x,
        y: 5,
      });

    expect(canPlaceBuilding(state, 'visthus', 20, 5, 0)).toBe(false);
    expect(order(20)).toEqual({
      ok: false,
      reason: 'invalidPlacement',
      problem: 'unexplored',
    });
    // Partly explored is not enough: the footprint's far column is still unseen.
    expect(isTileExplored(state, 0, 11, 5)).toBe(true);
    expect(isTileExplored(state, 0, 12, 5)).toBe(false);
    expect(canPlaceBuilding(state, 'visthus', 11, 5, 0)).toBe(false);
    // Ground in sight is fine.
    expect(canPlaceBuilding(state, 'visthus', 8, 5, 0)).toBe(true);

    applyCommand(state, { type: 'move', player: 0, unitIds: [builder.id], x: 18, y: 5 });
    advance(state, 200);
    applyCommand(state, { type: 'move', player: 0, unitIds: [builder.id], x: 5, y: 5 });
    advance(state, 200);
    // Explored but no longer in sight: building there is allowed.
    expect(visibilityAt(state, 0, 20, 5)).toBe(EXPLORED);
    expect(order(20)).toEqual({ ok: true });
  });

  it('does not tell what stands on ground that has never been seen', () => {
    const state = foggyState(40, 10);
    createUnit(state, 'samlare', 0, 5, 5);
    // A rock far out in the dark, and a tree in sight.
    state.map.terrain[5 * state.map.width + 30] = 'rock';
    state.map.terrain[5 * state.map.width + 7] = 'tree';
    updateVisibility(state);

    // On the unseen rock the answer is the same as on unseen open ground beside it.
    expect(placementProblem(state, 'visthus', 30, 5, 0)).toBe('unexplored');
    expect(placementProblem(state, 'visthus', 33, 5, 0)).toBe('unexplored');
    // A fishing hut too: whether there is water there is not given away.
    expect(placementProblem(state, 'fiskehytta', 30, 5, 0)).toBe('unexplored');
    // In sight, the tree is what is in the way.
    expect(placementProblem(state, 'visthus', 7, 5, 0)).toBe('blocked');
    // Off the map is simply not a place.
    expect(placementProblem(state, 'visthus', 39, 5, 0)).toBe('blocked');
  });

  it('the other side having explored the ground does not help', () => {
    const state = foggyState(40, 10);
    createUnit(state, 'samlare', 1, 20, 5);
    updateVisibility(state);
    expect(canPlaceBuilding(state, 'visthus', 20, 6, 1)).toBe(true);
    expect(canPlaceBuilding(state, 'visthus', 20, 6, 0)).toBe(false);
  });

  it('refuses to attack a target that is out of sight', () => {
    const state = foggyState(40, 10);
    const soldier = createUnit(state, 'ramkrigare', 0, 5, 5);
    const far = createUnit(state, 'samlare', 1, 20, 5);
    updateVisibility(state);
    expect(
      applyCommand(state, { type: 'attack', player: 0, unitIds: [soldier.id], targetId: far.id }),
    ).toEqual({ ok: false, reason: 'invalid' });
  });

  it('an attacker gives up when its target slips into the fog', () => {
    const state = foggyState(60, 10);
    addCave(state, 1, 58, 8);
    const soldier = createUnit(state, 'ramkrigare', 0, 5, 5);
    const runner = createUnit(state, 'samlare', 1, 10, 5);
    updateVisibility(state);
    expect(
      applyCommand(state, {
        type: 'attack',
        player: 0,
        unitIds: [soldier.id],
        targetId: runner.id,
      }),
    ).toEqual({ ok: true });
    // The Samlare is faster and runs far away.
    applyCommand(state, { type: 'move', player: 1, unitIds: [runner.id], x: 55, y: 5 });
    advance(state, 400);
    expect(soldier.task).toEqual({ kind: 'idle' });
    expect(runner.hp).toBe(UNIT_DEFS.samlare.hp);
    // The soldier stopped where it lost sight of the runner, well short of it.
    expect(unitTile(soldier).x).toBeLessThan(40);
  });
});

describe('fog of war in a real game', () => {
  it('is on from the start, and each side sees its own base but not the other', () => {
    // Two sides played by people; a computer opponent is not bound by the fog.
    const state = createGame(1, undefined, undefined, { ai: [] });
    expect(state.fogEnabled).toBe(true);
    const [mine, theirs] = state.map.startPositions as [
      { x: number; y: number },
      { x: number; y: number },
    ];
    expect(isTileVisible(state, 0, mine.x, mine.y)).toBe(true);
    expect(visibilityAt(state, 0, theirs.x, theirs.y)).toBe(UNEXPLORED);
    expect(isTileVisible(state, 1, theirs.x, theirs.y)).toBe(true);
    expect(visibilityAt(state, 1, mine.x, mine.y)).toBe(UNEXPLORED);

    const enemyThings = state.entities.filter((e) => e.owner === 1);
    expect(enemyThings.length).toBeGreaterThan(0);
    for (const entity of enemyThings) expect(isEntityVisibleTo(state, 0, entity)).toBe(false);
    expect(visibleEntities(state, 0).every((e) => e.owner === 0)).toBe(true);
  });

  it('both sides see equally much at the start', () => {
    for (const seed of [1, 2, 3]) {
      const state = createGame(seed);
      const count = (player: number) =>
        state.players[player]!.visibility.filter((v) => v === VISIBLE).length;
      // The bases mirror each other; the units in front of them break the mirror by a few tiles.
      expect(Math.abs(count(0) - count(1))).toBeLessThan(40);
      expect(count(0)).toBeGreaterThan(200);
    }
  });

  it('can be turned off', () => {
    const state = createGame(1, undefined, undefined, { fog: false });
    expect(state.fogEnabled).toBe(false);
    const theirs = state.map.startPositions[1]!;
    expect(isTileVisible(state, 0, theirs.x, theirs.y)).toBe(true);
  });

  it('a scout that walks to the enemy base sees it', () => {
    const state = createGame(1);
    const scout = state.entities.find((e) => e.kind === 'unit' && e.owner === 0)!;
    const theirs = state.map.startPositions[1]!;
    applyCommand(state, {
      type: 'move',
      player: 0,
      unitIds: [scout.id],
      x: theirs.x,
      y: theirs.y + 3,
    });
    // Up to a minute and a half of walking across the map.
    advance(state, 1800);
    const storide = state.entities.find((e) => e.kind === 'building' && e.owner === 1)!;
    expect(isEntityVisibleTo(state, 0, storide)).toBe(true);
    expect(isTileVisible(state, 0, theirs.x, theirs.y)).toBe(true);
  });
});

describe('the sight of many units', () => {
  // Minutes of three matches are played here; that takes seconds.
  vi.setConfig({ testTimeout: 120_000 });

  /** What each side sees, worked out tile by tile around every unit and building: what the answer must be. */
  const tileByTile = (state: GameState): number[][] =>
    state.players.map((player, owner) => {
      const tiles = player.visibility.map((v) => (v === VISIBLE ? EXPLORED : v));
      const { width, height } = state.map;
      for (const entity of state.entities) {
        if (entity.owner !== owner) continue;
        let x: number;
        let y: number;
        let radius: number;
        if (entity.kind === 'unit') {
          if (entity.task.kind === 'flee') continue;
          x = Math.floor(entity.x) + 0.5;
          y = Math.floor(entity.y) + 0.5;
          radius = UNIT_DEFS[entity.type].sight;
        } else {
          const size = BUILDING_DEFS[entity.type].size;
          x = entity.x + size / 2;
          y = entity.y + size / 2;
          radius = entity.complete ? BUILDING_DEFS[entity.type].sight : CONSTRUCTION_CONFIG.sight;
        }
        for (let ty = Math.floor(y - radius); ty <= Math.ceil(y + radius); ty++) {
          for (let tx = Math.floor(x - radius); tx <= Math.ceil(x + radius); tx++) {
            if (tx < 0 || ty < 0 || tx >= width || ty >= height) continue;
            const dx = tx + 0.5 - x;
            const dy = ty + 0.5 - y;
            if (dx * dx + dy * dy <= radius * radius) tiles[ty * width + tx] = VISIBLE;
          }
        }
      }
      return tiles;
    });

  it('is the same, tile for tile, as looking at every tile around every unit and building', () => {
    // A match against the computer, and two armies that meet: buildings of
    // every size, sites, units by the edge of the map and units that have surrendered.
    const games = [
      createGame(1),
      createGame(4, undefined, undefined, { ai: [0, 1] }),
      createGame(2, undefined, undefined, { ai: [], extraUnits: stressUnits(120, 'fight') }),
    ];
    startStress(games[2]!, 'fight');
    let compared = 0;
    for (const state of games) {
      for (let i = 0; i < 5 * 60 * 20 && state.winner === null; i++) {
        tick(state);
        if (i % 37 !== 0) continue;
        // The step has already worked the sight out. Doing it over the old
        // way and the new way from there must give the same.
        const want = tileByTile(state);
        updateVisibility(state);
        state.players.forEach((player, owner) => {
          expect(player.visibility, `step ${state.tick}, side ${owner}`).toEqual(want[owner]);
        });
        compared++;
      }
    }
    expect(compared).toBeGreaterThan(300);
    // The matches got somewhere: there were surrendered units and many buildings.
    expect(games[1]!.entities.filter((e) => e.kind === 'building').length).toBeGreaterThan(15);
  });

  it('sees a circle: a unit in the open sees the same tiles as before, at the rim too', () => {
    const state = openState(40, 40);
    createUnit(state, 'samlare', 0, 20, 20);
    updateVisibility(state);
    const sight = UNIT_DEFS.samlare.sight;
    const seen = (x: number, y: number) => state.players[0]!.visibility[y * 40 + x] === VISIBLE;
    // Straight out to the full sight and no further; the corners of the square are not seen.
    expect(seen(20 + sight, 20)).toBe(true);
    expect(seen(20 + sight + 1, 20)).toBe(false);
    expect(seen(20, 20 - sight)).toBe(true);
    expect(seen(20, 20 - sight - 1)).toBe(false);
    expect(seen(20 + sight, 20 + sight)).toBe(false);
    // As many tiles as have their middle within the circle.
    let want = 0;
    for (let dy = -sight; dy <= sight; dy++) {
      for (let dx = -sight; dx <= sight; dx++) if (dx * dx + dy * dy <= sight * sight) want++;
    }
    expect(state.players[0]!.visibility.filter((v) => v === VISIBLE)).toHaveLength(want);
  });
});
