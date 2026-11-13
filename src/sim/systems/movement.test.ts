import { describe, expect, it } from 'vitest';
import { SIM_CONFIG } from '../../data/sim';
import { UNIT_DEFS } from '../../data/units';
import { applyCommand } from '../commands';
import { createUnit, unitTile } from '../entities';
import { openState, stateFromRows } from '../testUtils';
import { advance, tick } from '../tick';
import { moveUnits } from './movement';

/** Tiles a Samlare covers per simulation step. */
const STEP = UNIT_DEFS.samlare.speed / SIM_CONFIG.ticksPerSecond;

describe('moveUnits', () => {
  it('leaves a unit without a path where it is', () => {
    const state = openState(5, 5);
    const unit = createUnit(state, 'samlare', 0, 2, 2);
    moveUnits(state);
    expect([unit.x, unit.y]).toEqual([2.5, 2.5]);
  });

  it('moves a unit by its speed each step', () => {
    const state = openState(10, 3);
    const unit = createUnit(state, 'samlare', 0, 0, 1);
    unit.path = [{ x: 5, y: 1 }];
    moveUnits(state);
    expect(unit.x).toBeCloseTo(0.5 + STEP);
    expect(unit.y).toBe(1.5);
  });

  it('a unit that gets an order is on its way within 100 ms', () => {
    // GDD section 11: an order shows on the unit within 100 ms, which is two steps.
    const state = openState(12, 3);
    const unit = createUnit(state, 'ramkrigare', 0, 0, 1);
    applyCommand(state, { type: 'move', player: 0, unitIds: [unit.id], x: 10, y: 1 });
    advance(state, (100 / 1000) * SIM_CONFIG.ticksPerSecond);
    expect(unit.x).toBeGreaterThan(0.5);
  });

  it('stands on the target tile after exactly the expected number of steps', () => {
    // 10 tiles straight at 2.5 tiles/s is 4 s, which is 80 steps.
    const state = openState(12, 3);
    const unit = createUnit(state, 'samlare', 0, 0, 1);
    applyCommand(state, { type: 'move', player: 0, unitIds: [unit.id], x: 10, y: 1 });
    const expected = Math.ceil(10 / STEP);
    expect(expected).toBe(80);

    advance(state, expected - 1);
    expect(unit.path).not.toEqual([]);
    expect(unit.x).toBeLessThan(10.5);

    tick(state);
    expect([unit.x, unit.y]).toEqual([10.5, 1.5]);
    expect(unit.path).toEqual([]);
    expect(unitTile(unit)).toEqual({ x: 10, y: 1 });
  });

  it('takes longer along a diagonal, by a factor of sqrt 2', () => {
    const state = openState(12, 12);
    const unit = createUnit(state, 'samlare', 0, 0, 0);
    applyCommand(state, { type: 'move', player: 0, unitIds: [unit.id], x: 10, y: 10 });
    const expected = Math.ceil((10 * Math.SQRT2) / STEP);

    advance(state, expected - 1);
    expect(unit.path).not.toEqual([]);
    tick(state);
    expect([unit.x, unit.y]).toEqual([10.5, 10.5]);
  });

  it('keeps a constant speed through the corners of its path', () => {
    const state = stateFromRows(['.....', '.TTT.', '.....']);
    const unit = createUnit(state, 'samlare', 0, 2, 0);
    applyCommand(state, { type: 'move', player: 0, unitIds: [unit.id], x: 2, y: 2 });
    while (unit.path.length > 0) {
      const before = { x: unit.x, y: unit.y };
      const stepsLeft = unit.path.length;
      tick(state);
      const moved = Math.hypot(unit.x - before.x, unit.y - before.y);
      // Every step but the last covers the full distance, measured along the path.
      if (unit.path.length > 0 && unit.path.length === stepsLeft) {
        expect(moved).toBeCloseTo(STEP);
      }
      expect(moved).toBeLessThanOrEqual(STEP + 1e-9);
    }
    expect(unitTile(unit)).toEqual({ x: 2, y: 2 });
  });

  it('stays on walkable ground the whole way', () => {
    const state = stateFromRows(['......', '.TTTT.', '.T....', '.T.TT.', '...T..']);
    const unit = createUnit(state, 'samlare', 0, 0, 0);
    applyCommand(state, { type: 'move', player: 0, unitIds: [unit.id], x: 5, y: 4 });
    for (let i = 0; i < 400 && unit.path.length > 0; i++) {
      tick(state);
      const tile = unitTile(unit);
      expect(state.map.terrain[tile.y * state.map.width + tile.x]).toBe('grass');
    }
    expect(unitTile(unit)).toEqual({ x: 5, y: 4 });
  });

  it('remembers the position before the step, for interpolation', () => {
    const state = openState(10, 3);
    const unit = createUnit(state, 'samlare', 0, 0, 1);
    unit.path = [{ x: 5, y: 1 }];
    moveUnits(state);
    expect(unit.prevX).toBe(0.5);
    moveUnits(state);
    expect(unit.prevX).toBeCloseTo(0.5 + STEP);
    expect(unit.x).toBeCloseTo(0.5 + 2 * STEP);
  });

  it('sets the previous position equal to the current one when standing still', () => {
    const state = openState(10, 3);
    const unit = createUnit(state, 'samlare', 0, 0, 1);
    unit.path = [{ x: 1, y: 1 }];
    advance(state, 20);
    expect(unit.path).toEqual([]);
    expect([unit.prevX, unit.prevY]).toEqual([unit.x, unit.y]);
  });
});
