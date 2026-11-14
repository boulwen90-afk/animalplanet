import { describe, expect, it } from 'vitest';
import { applyCommand } from './commands';
import { createBuilding, createUnit, unitDestination, unitTile } from './entities';
import { createGame } from './game';
import type { Unit } from './state';
import { openState, stateFromRows } from './testUtils';
import { advance, tick } from './tick';

function tilesOf(units: Unit[]): string[] {
  return units.map((unit) => {
    const tile = unitTile(unit);
    return `${tile.x},${tile.y}`;
  });
}

describe('move command', () => {
  it('sends a unit to the target tile', () => {
    const state = openState(8, 8);
    const unit = createUnit(state, 'samlare', 0, 1, 1);
    applyCommand(state, { type: 'move', player: 0, unitIds: [unit.id], x: 6, y: 5 });
    expect(unitDestination(unit)).toEqual({ x: 6, y: 5 });
    advance(state, 200);
    expect(unitTile(unit)).toEqual({ x: 6, y: 5 });
  });

  it('only moves the units named in the command', () => {
    const state = openState(8, 8);
    const a = createUnit(state, 'samlare', 0, 1, 1);
    const b = createUnit(state, 'samlare', 0, 2, 1);
    applyCommand(state, { type: 'move', player: 0, unitIds: [a.id], x: 6, y: 5 });
    expect(a.path).not.toEqual([]);
    expect(b.path).toEqual([]);
  });

  it("does not move another player's units", () => {
    const state = openState(8, 8);
    const enemy = createUnit(state, 'samlare', 1, 1, 1);
    applyCommand(state, { type: 'move', player: 0, unitIds: [enemy.id], x: 6, y: 5 });
    expect(enemy.path).toEqual([]);
  });

  it("an order for the opponent's unit changes nothing, also while the computer player runs", () => {
    // Two copies of the same match against the computer player. In one of
    // them the player tries to move one of the opponent's units every second.
    // The computer player gives its units orders of its own from the first
    // step, so the unit does get a path; what matters is that both matches
    // stay identical, step for step.
    const untouched = createGame(1);
    const meddled = createGame(1);
    const enemy = meddled.entities.find((e) => e.kind === 'unit' && e.owner === 1)!;
    for (let step = 0; step < 200; step++) {
      if (step % 20 === 0) {
        applyCommand(meddled, { type: 'move', player: 0, unitIds: [enemy.id], x: 30, y: 30 });
      }
      tick(untouched);
      tick(meddled);
    }
    expect(meddled).toEqual(untouched);
    // And the unit was given work meanwhile, by the computer player: it
    // gathers, or raises the house the computer player starts with.
    const now = meddled.entities.find((e) => e.id === enemy.id) as Unit;
    expect(['gather', 'build']).toContain(now.task.kind);
    expect(unitDestination(now)).not.toEqual({ x: 30, y: 30 });
  });

  it('ignores ids that do not exist or are buildings', () => {
    const state = openState(12, 12);
    const building = createBuilding(state, 'storide', 0, 2, 2);
    expect(() =>
      applyCommand(state, { type: 'move', player: 0, unitIds: [building.id, 999], x: 9, y: 9 }),
    ).not.toThrow();
    expect([building.x, building.y]).toEqual([2, 2]);
  });

  it('spreads a group over separate tiles next to the target', () => {
    const state = openState(12, 12);
    const group = [
      createUnit(state, 'samlare', 0, 1, 1),
      createUnit(state, 'samlare', 0, 2, 1),
      createUnit(state, 'samlare', 0, 1, 2),
    ];
    applyCommand(state, {
      type: 'move',
      player: 0,
      unitIds: group.map((u) => u.id),
      x: 8,
      y: 8,
    });
    advance(state, 400);

    const tiles = tilesOf(group);
    expect(new Set(tiles).size).toBe(3);
    expect(tiles).toContain('8,8');
    for (const unit of group) {
      const tile = unitTile(unit);
      expect(Math.max(Math.abs(tile.x - 8), Math.abs(tile.y - 8))).toBeLessThanOrEqual(1);
      expect(unit.path).toEqual([]);
    }
  });

  it('lines a group up on every other tile, so that its units stand clear of each other', () => {
    const state = openState(24, 24);
    const group = Array.from({ length: 12 }, (_, i) =>
      createUnit(state, 'ramkrigare', 0, 2 + (i % 4), 2 + Math.floor(i / 4)),
    );
    applyCommand(state, {
      type: 'move',
      player: 0,
      unitIds: group.map((u) => u.id),
      x: 14,
      y: 14,
    });
    advance(state, 400);
    expect(group.every((u) => u.path.length === 0)).toBe(true);
    // Like the dark squares of a chessboard: nobody has a neighbour straight beside it.
    for (const unit of group) {
      const tile = unitTile(unit);
      expect((tile.x + tile.y) % 2).toBe(0);
    }
    let nearest = Infinity;
    for (const a of group) {
      for (const b of group) {
        if (a !== b) nearest = Math.min(nearest, Math.hypot(a.x - b.x, a.y - b.y));
      }
    }
    expect(nearest).toBeCloseTo(Math.SQRT2, 5);
    // And still gathered round the place they were sent to.
    for (const unit of group) {
      expect(Math.hypot(unit.x - 14.5, unit.y - 14.5)).toBeLessThan(4.5);
    }
  });

  it('fills the tiles in between when there is no room to stand apart', () => {
    // A room of six open tiles for four units.
    const state = stateFromRows(['RRRRRRR', 'R.....R', 'R...RRR', 'RRRRRRR']);
    const group = [1, 2, 3, 4].map((x) => createUnit(state, 'samlare', 0, x, 1));
    applyCommand(state, { type: 'move', player: 0, unitIds: group.map((u) => u.id), x: 2, y: 2 });
    advance(state, 200);
    expect(group.every((u) => u.path.length === 0)).toBe(true);
    expect(new Set(tilesOf(group)).size).toBe(4);
  });

  it('does not send a unit onto a tile where another unit stands', () => {
    const state = openState(8, 8);
    const standing = createUnit(state, 'samlare', 0, 5, 5);
    const walker = createUnit(state, 'samlare', 0, 1, 1);
    applyCommand(state, { type: 'move', player: 0, unitIds: [walker.id], x: 5, y: 5 });
    advance(state, 200);

    const tile = unitTile(walker);
    expect(tile).not.toEqual(unitTile(standing));
    expect(Math.max(Math.abs(tile.x - 5), Math.abs(tile.y - 5))).toBe(1);
  });

  it('does not send a unit onto a tile another unit is heading for', () => {
    const state = openState(10, 10);
    const first = createUnit(state, 'samlare', 0, 1, 1);
    const second = createUnit(state, 'samlare', 0, 8, 1);
    applyCommand(state, { type: 'move', player: 0, unitIds: [first.id], x: 5, y: 8 });
    applyCommand(state, { type: 'move', player: 0, unitIds: [second.id], x: 5, y: 8 });
    expect(unitDestination(second)).not.toEqual(unitDestination(first));
    advance(state, 300);
    expect(unitTile(second)).not.toEqual(unitTile(first));
  });

  it('goes to the nearest reachable tile when the target is an obstacle', () => {
    const state = stateFromRows(['......', '...T..', '......']);
    const unit = createUnit(state, 'samlare', 0, 0, 1);
    applyCommand(state, { type: 'move', player: 0, unitIds: [unit.id], x: 3, y: 1 });
    advance(state, 200);
    expect(unitTile(unit)).toEqual({ x: 2, y: 1 });
  });

  it('walks around a building', () => {
    const state = openState(12, 7);
    createBuilding(state, 'storide', 0, 4, 2);
    const unit = createUnit(state, 'samlare', 0, 1, 3);
    applyCommand(state, { type: 'move', player: 0, unitIds: [unit.id], x: 10, y: 3 });

    for (let i = 0; i < 400 && unit.path.length > 0; i++) {
      advance(state, 1);
      const tile = unitTile(unit);
      const inside = tile.x >= 4 && tile.x <= 6 && tile.y >= 2 && tile.y <= 4;
      expect(inside, `inside the building at ${tile.x},${tile.y}`).toBe(false);
    }
    expect(unitTile(unit)).toEqual({ x: 10, y: 3 });
  });

  it('gathers next to a building when the target is the building', () => {
    const state = openState(12, 9);
    createBuilding(state, 'storide', 0, 5, 3);
    const unit = createUnit(state, 'samlare', 0, 1, 4);
    applyCommand(state, { type: 'move', player: 0, unitIds: [unit.id], x: 6, y: 4 });
    advance(state, 300);
    expect(unitTile(unit)).toEqual({ x: 4, y: 4 });
  });

  it('does not move when the target is open ground that cannot be reached', () => {
    const state = stateFromRows(['..W..', '..W..', '..W..']);
    const unit = createUnit(state, 'samlare', 0, 0, 1);
    applyCommand(state, { type: 'move', player: 0, unitIds: [unit.id], x: 4, y: 1 });
    expect(unit.path).toEqual([]);
    advance(state, 50);
    expect(unitTile(unit)).toEqual({ x: 0, y: 1 });
  });

  it('clamps a target outside the map to the map edge', () => {
    const state = openState(6, 6);
    const unit = createUnit(state, 'samlare', 0, 1, 1);
    applyCommand(state, { type: 'move', player: 0, unitIds: [unit.id], x: 50, y: -3 });
    expect(unitDestination(unit)).toEqual({ x: 5, y: 0 });
  });

  it('replaces an earlier order', () => {
    const state = openState(10, 10);
    const unit = createUnit(state, 'samlare', 0, 1, 1);
    applyCommand(state, { type: 'move', player: 0, unitIds: [unit.id], x: 8, y: 1 });
    advance(state, 10);
    applyCommand(state, { type: 'move', player: 0, unitIds: [unit.id], x: 1, y: 8 });
    advance(state, 300);
    expect(unitTile(unit)).toEqual({ x: 1, y: 8 });
  });

  it('gives the same result for the same commands', () => {
    const run = () => {
      const state = openState(12, 12);
      const ids = [0, 1, 2].map((i) => createUnit(state, 'samlare', 0, 1 + i, 1).id);
      applyCommand(state, { type: 'move', player: 0, unitIds: ids, x: 9, y: 7 });
      advance(state, 120);
      return state;
    };
    expect(run()).toEqual(run());
  });
});
