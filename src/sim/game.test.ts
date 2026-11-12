import { describe, expect, it } from 'vitest';
import { MAP_GEN_CONFIG } from '../data/map';
import { createGame } from './game';
import { advance, tick } from './tick';

describe('createGame', () => {
  it('starts at tick 0 with the given seed', () => {
    const state = createGame(5);
    expect(state.seed).toBe(5);
    expect(state.tick).toBe(0);
    expect(state.map.startPositions).toEqual(MAP_GEN_CONFIG.startPositions);
  });

  it('gives an identical state for the same seed', () => {
    expect(createGame(11)).toEqual(createGame(11));
  });

  it('gives different maps for different seeds', () => {
    expect(createGame(1).map.terrain).not.toEqual(createGame(2).map.terrain);
  });

  it('is plain data that survives a JSON round trip', () => {
    const state = createGame(3);
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });
});

describe('tick', () => {
  it('advances the tick counter by one', () => {
    const state = createGame(1);
    tick(state);
    expect(state.tick).toBe(1);
  });

  it('advance runs the given number of steps', () => {
    const state = createGame(1);
    advance(state, 40);
    expect(state.tick).toBe(40);
    advance(state, 0);
    expect(state.tick).toBe(40);
  });

  it('two games with the same seed stay identical as they advance', () => {
    const a = createGame(8);
    const b = createGame(8);
    advance(a, 100);
    advance(b, 100);
    expect(a).toEqual(b);
  });
});
