import type { Point } from '../map/iso';

/** Which tiles can be walked on. `blocked[y * width + x]` is 1 for an obstacle. */
export interface PathGrid {
  width: number;
  height: number;
  blocked: Uint8Array;
}

/** Cost of a step to an edge neighbour and to a diagonal neighbour (about 10 * sqrt 2). */
const STRAIGHT = 10;
const DIAGONAL = 14;

const STEPS: readonly (readonly [number, number, number])[] = [
  [1, 0, STRAIGHT],
  [-1, 0, STRAIGHT],
  [0, 1, STRAIGHT],
  [0, -1, STRAIGHT],
  [1, 1, DIAGONAL],
  [1, -1, DIAGONAL],
  [-1, 1, DIAGONAL],
  [-1, -1, DIAGONAL],
];

export function isPassable(grid: PathGrid, x: number, y: number): boolean {
  return (
    x >= 0 && y >= 0 && x < grid.width && y < grid.height && grid.blocked[y * grid.width + x] === 0
  );
}

/**
 * True if a unit may step from (x, y) to the neighbour at (x + dx, y + dy).
 * A diagonal step needs both tiles it passes between to be open, so units
 * never cut across the corner of an obstacle.
 */
export function canStep(grid: PathGrid, x: number, y: number, dx: number, dy: number): boolean {
  if (!isPassable(grid, x + dx, y + dy)) return false;
  if (dx !== 0 && dy !== 0) return isPassable(grid, x + dx, y) && isPassable(grid, x, y + dy);
  return true;
}

/** Walking cost between two tiles on an empty map; never more than the real cost. */
function estimate(ax: number, ay: number, bx: number, by: number): number {
  const dx = Math.abs(ax - bx);
  const dy = Math.abs(ay - by);
  return STRAIGHT * (dx + dy) + (DIAGONAL - 2 * STRAIGHT) * Math.min(dx, dy);
}

/**
 * Shortest path from `from` to `to` in eight directions.
 *
 * Returns the tiles to walk through, ending with the goal and not including
 * `from`. The result is empty if the unit is already there or cannot get there.
 * If `to` is an obstacle or outside the map, the path leads to the reachable
 * tile closest to it instead. The start tile itself may be blocked.
 */
export function findPath(grid: PathGrid, from: Point, to: Point): Point[] {
  let goal = to;
  if (!isPassable(grid, to.x, to.y)) {
    const nearest = nearestReachable(grid, from, to);
    if (!nearest) return [];
    goal = nearest;
  }
  if (goal.x === from.x && goal.y === from.y) return [];
  return search(grid, from, goal);
}

/**
 * The tile reachable from `from` that lies closest to `target` in a straight
 * line; `from` itself counts. Among tiles equally close to the target, the
 * one fewest steps from `from` wins, so a unit sent to an obstacle stops on
 * the side it comes from.
 */
export function nearestReachable(grid: PathGrid, from: Point, target: Point): Point | undefined {
  if (from.x < 0 || from.y < 0 || from.x >= grid.width || from.y >= grid.height) return undefined;
  const visited = new Uint8Array(grid.width * grid.height);
  const queue: number[] = [from.y * grid.width + from.x];
  visited[queue[0] as number] = 1;

  let best = -1;
  let bestDistance = Infinity;
  for (let head = 0; head < queue.length; head++) {
    const index = queue[head] as number;
    const x = index % grid.width;
    const y = (index - x) / grid.width;
    const distance = (x - target.x) ** 2 + (y - target.y) ** 2;
    // The search visits tiles in order of steps from the start, so the first
    // tile found at a given distance is the one nearest to the start.
    if (distance < bestDistance) {
      best = index;
      bestDistance = distance;
    }
    for (const [dx, dy] of STEPS) {
      if (!canStep(grid, x, y, dx, dy)) continue;
      const next = (y + dy) * grid.width + (x + dx);
      if (visited[next]) continue;
      visited[next] = 1;
      queue.push(next);
    }
  }
  if (best < 0) return undefined;
  const bx = best % grid.width;
  return { x: bx, y: (best - bx) / grid.width };
}

/** A* over the grid. `goal` must be passable. */
function search(grid: PathGrid, from: Point, goal: Point): Point[] {
  const size = grid.width * grid.height;
  const start = from.y * grid.width + from.x;
  const target = goal.y * grid.width + goal.x;

  const cost = new Int32Array(size).fill(-1);
  const cameFrom = new Int32Array(size).fill(-1);
  const closed = new Uint8Array(size);
  const open = new MinHeap();
  cost[start] = 0;
  open.push(start, estimate(from.x, from.y, goal.x, goal.y));

  for (let current = open.pop(); current !== undefined; current = open.pop()) {
    if (current === target) return buildPath(cameFrom, target, start, grid.width);
    if (closed[current]) continue;
    closed[current] = 1;

    const x = current % grid.width;
    const y = (current - x) / grid.width;
    for (const [dx, dy, stepCost] of STEPS) {
      if (!canStep(grid, x, y, dx, dy)) continue;
      const next = (y + dy) * grid.width + (x + dx);
      if (closed[next]) continue;
      const nextCost = (cost[current] as number) + stepCost;
      const known = cost[next] as number;
      if (known !== -1 && known <= nextCost) continue;
      cost[next] = nextCost;
      cameFrom[next] = current;
      open.push(next, nextCost + estimate(x + dx, y + dy, goal.x, goal.y));
    }
  }
  return [];
}

function buildPath(cameFrom: Int32Array, target: number, start: number, width: number): Point[] {
  const path: Point[] = [];
  for (let index = target; index !== start; index = cameFrom[index] as number) {
    const x = index % width;
    path.push({ x, y: (index - x) / width });
  }
  return path.reverse();
}

/**
 * Binary heap of tile indices ordered by priority. Equal priorities come out
 * in the order they were pushed, so the search is fully deterministic.
 */
class MinHeap {
  private readonly items: { index: number; priority: number; order: number }[] = [];
  private pushed = 0;

  push(index: number, priority: number): void {
    const items = this.items;
    items.push({ index, priority, order: this.pushed++ });
    let i = items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (!this.before(i, parent)) break;
      this.swap(i, parent);
      i = parent;
    }
  }

  pop(): number | undefined {
    const items = this.items;
    const top = items[0];
    const last = items.pop();
    if (top === undefined || last === undefined) return undefined;
    if (items.length > 0) {
      items[0] = last;
      let i = 0;
      for (;;) {
        const left = 2 * i + 1;
        const right = left + 1;
        let smallest = i;
        if (left < items.length && this.before(left, smallest)) smallest = left;
        if (right < items.length && this.before(right, smallest)) smallest = right;
        if (smallest === i) break;
        this.swap(i, smallest);
        i = smallest;
      }
    }
    return top.index;
  }

  private before(a: number, b: number): boolean {
    const x = this.items[a]!;
    const y = this.items[b]!;
    return x.priority < y.priority || (x.priority === y.priority && x.order < y.order);
  }

  private swap(a: number, b: number): void {
    const items = this.items;
    const tmp = items[a]!;
    items[a] = items[b]!;
    items[b] = tmp;
  }
}
