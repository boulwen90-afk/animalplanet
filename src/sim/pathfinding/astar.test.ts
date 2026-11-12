import { describe, expect, it } from 'vitest';
import type { Point } from '../map/iso';
import { canStep, findPath, nearestReachable, type PathGrid } from './astar';

/** Builds a grid from rows of characters: '.' is open, '#' is an obstacle. */
function gridFromRows(rows: string[]): PathGrid {
  const width = (rows[0] as string).length;
  const blocked = new Uint8Array(width * rows.length);
  rows.forEach((row, y) => {
    [...row].forEach((c, x) => {
      if (c === '#') blocked[y * width + x] = 1;
    });
  });
  return { width, height: rows.length, blocked };
}

/** Total length of a path in tiles, counting diagonal steps as sqrt 2. */
function pathLength(from: Point, path: Point[]): number {
  let length = 0;
  let previous = from;
  for (const step of path) {
    length += Math.hypot(step.x - previous.x, step.y - previous.y);
    previous = step;
  }
  return length;
}

/** Checks that every step goes to a neighbour and never cuts an obstacle corner. */
function expectValidPath(grid: PathGrid, from: Point, path: Point[]): void {
  let previous = from;
  for (const step of path) {
    const dx = step.x - previous.x;
    const dy = step.y - previous.y;
    expect(Math.max(Math.abs(dx), Math.abs(dy)), 'steps go to a neighbour').toBe(1);
    expect(canStep(grid, previous.x, previous.y, dx, dy), `step to ${step.x},${step.y}`).toBe(true);
    previous = step;
  }
}

describe('findPath on open ground', () => {
  const grid = gridFromRows(['.....', '.....', '.....', '.....', '.....']);

  it('walks straight along a row', () => {
    const path = findPath(grid, { x: 0, y: 2 }, { x: 4, y: 2 });
    expect(path).toEqual([
      { x: 1, y: 2 },
      { x: 2, y: 2 },
      { x: 3, y: 2 },
      { x: 4, y: 2 },
    ]);
  });

  it('walks straight along a diagonal', () => {
    const path = findPath(grid, { x: 0, y: 0 }, { x: 4, y: 4 });
    expect(path).toEqual([
      { x: 1, y: 1 },
      { x: 2, y: 2 },
      { x: 3, y: 3 },
      { x: 4, y: 4 },
    ]);
  });

  it('uses as many diagonal steps as possible', () => {
    // 4 across and 2 down: two diagonal and two straight steps is the shortest way.
    const from = { x: 0, y: 0 };
    const path = findPath(grid, from, { x: 4, y: 2 });
    expect(path).toHaveLength(4);
    expect(pathLength(from, path)).toBeCloseTo(2 + 2 * Math.SQRT2);
    expect(path.at(-1)).toEqual({ x: 4, y: 2 });
  });

  it('returns an empty path when already at the goal', () => {
    expect(findPath(grid, { x: 2, y: 2 }, { x: 2, y: 2 })).toEqual([]);
  });

  it('does not include the start tile and ends on the goal', () => {
    const path = findPath(grid, { x: 1, y: 1 }, { x: 3, y: 1 });
    expect(path[0]).toEqual({ x: 2, y: 1 });
    expect(path.at(-1)).toEqual({ x: 3, y: 1 });
  });
});

describe('findPath around obstacles', () => {
  it('goes around a wall', () => {
    const grid = gridFromRows(['.....', '.###.', '.....']);
    const from = { x: 2, y: 0 };
    const path = findPath(grid, from, { x: 2, y: 2 });
    expectValidPath(grid, from, path);
    expect(path.at(-1)).toEqual({ x: 2, y: 2 });
    // Around either end of the wall: 2 sideways, 2 down past the corner, 2 back.
    expect(path).toHaveLength(6);
    expect(pathLength(from, path)).toBeCloseTo(6);
  });

  it('takes the shorter way around', () => {
    const grid = gridFromRows(['.......', '.####..', '.......']);
    const from = { x: 4, y: 0 };
    const path = findPath(grid, from, { x: 4, y: 2 });
    expectValidPath(grid, from, path);
    // The right end of the wall is one tile away, the left end four.
    expect(path).toHaveLength(4);
    expect(path.some((p) => p.x === 5 && p.y === 1)).toBe(true);
  });

  it('finds its way through a maze', () => {
    const grid = gridFromRows(['.#.....', '.#.###.', '.#.#...', '.#.#.##', '...#...']);
    const from = { x: 0, y: 0 };
    const path = findPath(grid, from, { x: 6, y: 4 });
    expectValidPath(grid, from, path);
    expect(path.at(-1)).toEqual({ x: 6, y: 4 });
  });

  it('does not cut the corner of an obstacle', () => {
    const grid = gridFromRows(['.#', '..']);
    // The diagonal from (0,0) to (1,1) would clip the obstacle at (1,0).
    expect(findPath(grid, { x: 0, y: 0 }, { x: 1, y: 1 })).toEqual([
      { x: 0, y: 1 },
      { x: 1, y: 1 },
    ]);
  });

  it('does not squeeze diagonally between two obstacles', () => {
    const grid = gridFromRows(['.#.', '#..', '...']);
    expect(findPath(grid, { x: 0, y: 0 }, { x: 2, y: 2 })).toEqual([]);
  });

  it('never cuts corners on a larger map', () => {
    const grid = gridFromRows([
      '........',
      '..##....',
      '..##..#.',
      '......#.',
      '.####.#.',
      '........',
    ]);
    for (const [from, to] of [
      [
        { x: 0, y: 0 },
        { x: 7, y: 5 },
      ],
      [
        { x: 7, y: 0 },
        { x: 0, y: 5 },
      ],
      [
        { x: 1, y: 2 },
        { x: 7, y: 3 },
      ],
      [
        { x: 5, y: 3 },
        { x: 0, y: 5 },
      ],
    ] as const) {
      const path = findPath(grid, from, to);
      expect(path.at(-1)).toEqual(to);
      expectValidPath(grid, from, path);
    }
  });
});

describe('findPath to a blocked goal', () => {
  it('goes to the nearest reachable tile instead', () => {
    const grid = gridFromRows(['.....', '..#..', '.....']);
    const path = findPath(grid, { x: 0, y: 1 }, { x: 2, y: 1 });
    expect(path.at(-1)).toEqual({ x: 1, y: 1 });
  });

  it('stops at the edge of a large obstacle, on the side it can reach', () => {
    const grid = gridFromRows(['..###', '..###', '..###']);
    const from = { x: 0, y: 0 };
    const path = findPath(grid, from, { x: 4, y: 1 });
    expectValidPath(grid, from, path);
    expect(path.at(-1)).toEqual({ x: 1, y: 1 });
  });

  it('stays put when it already stands on the nearest reachable tile', () => {
    const grid = gridFromRows(['.#', '..']);
    expect(findPath(grid, { x: 0, y: 0 }, { x: 1, y: 0 })).toEqual([]);
  });

  it('treats a goal outside the map as blocked', () => {
    const grid = gridFromRows(['...', '...']);
    const path = findPath(grid, { x: 0, y: 0 }, { x: 9, y: 1 });
    expect(path.at(-1)).toEqual({ x: 2, y: 1 });
  });
});

describe('findPath to an unreachable goal', () => {
  it('returns an empty path when the goal is open but completely cut off', () => {
    const grid = gridFromRows(['..#..', '..#..', '..#..']);
    expect(findPath(grid, { x: 0, y: 1 }, { x: 4, y: 1 })).toEqual([]);
  });

  it('returns an empty path when the goal is walled in', () => {
    const grid = gridFromRows(['.....', '.###.', '.#.#.', '.###.', '.....']);
    expect(findPath(grid, { x: 0, y: 0 }, { x: 2, y: 2 })).toEqual([]);
  });
});

describe('findPath from a blocked start', () => {
  it('can leave a tile that has become an obstacle', () => {
    const grid = gridFromRows(['#..']);
    expect(findPath(grid, { x: 0, y: 0 }, { x: 2, y: 0 })).toEqual([
      { x: 1, y: 0 },
      { x: 2, y: 0 },
    ]);
  });
});

describe('findPath is deterministic', () => {
  it('returns the same path every time', () => {
    const grid = gridFromRows(['......', '..##..', '......', '......']);
    const first = findPath(grid, { x: 0, y: 0 }, { x: 5, y: 3 });
    for (let i = 0; i < 5; i++) {
      expect(findPath(grid, { x: 0, y: 0 }, { x: 5, y: 3 })).toEqual(first);
    }
  });
});

describe('nearestReachable', () => {
  it('prefers the side of an obstacle that faces the start', () => {
    const grid = gridFromRows(['.....', '..#..', '.....']);
    const target = { x: 2, y: 1 };
    expect(nearestReachable(grid, { x: 0, y: 1 }, target)).toEqual({ x: 1, y: 1 });
    expect(nearestReachable(grid, { x: 4, y: 1 }, target)).toEqual({ x: 3, y: 1 });
    expect(nearestReachable(grid, { x: 2, y: 0 }, target)).toEqual({ x: 2, y: 0 });
  });

  it('returns the start tile when nothing else is reachable', () => {
    const grid = gridFromRows(['.#.']);
    expect(nearestReachable(grid, { x: 0, y: 0 }, { x: 2, y: 0 })).toEqual({ x: 0, y: 0 });
  });

  it('returns the target itself when it is reachable', () => {
    const grid = gridFromRows(['...']);
    expect(nearestReachable(grid, { x: 0, y: 0 }, { x: 2, y: 0 })).toEqual({ x: 2, y: 0 });
  });
});
