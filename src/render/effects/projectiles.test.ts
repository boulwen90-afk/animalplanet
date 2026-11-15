import { describe, expect, it } from 'vitest';
import { BUILDING_DEFS } from '../../data/buildings';
import { UI_CONFIG } from '../../data/ui';
import sceneryAtlas from '../../../assets/scenery/scenery.json';
import towerAtlas from '../../../assets/buildings/bear_tower/bear_tower.json';
import { tileToWorld } from '../../sim/map/iso';
import { MUZZLE_HEIGHT } from '../views/visuals';
import {
  flightHeight,
  flightProgress,
  groundCircle,
  hitBurstAt,
  projectilePose,
} from './projectiles';

const TILE = { tileWidth: 64, tileHeight: 32 };
const { projectile } = UI_CONFIG;
const MUZZLE = 72;

describe('flightProgress', () => {
  it('is 0 where it was shot and 1 at its target', () => {
    const start = { x: 2, y: 2 };
    const target = { x: 8, y: 2 };
    expect(flightProgress(start, start, target)).toBe(0);
    expect(flightProgress(start, { x: 5, y: 2 }, target)).toBeCloseTo(0.5, 9);
    expect(flightProgress(start, target, target)).toBe(1);
  });

  it('counts a projectile that is on its target from the start as arrived', () => {
    const at = { x: 3, y: 3 };
    expect(flightProgress(at, at, at)).toBe(1);
  });
});

describe('flightHeight', () => {
  it('starts at the height it was let go from and lands at chest height', () => {
    expect(flightHeight(0, 5, MUZZLE)).toBeCloseTo(MUZZLE, 9);
    expect(flightHeight(1, 5, MUZZLE)).toBeCloseTo(projectile.targetHeightPx, 9);
  });

  it('flies in an arc: half-way it is 4 pixels above the straight line for each tile it has to go', () => {
    expect(projectile.arcPxPerTile).toBe(4);
    const straight = (MUZZLE + projectile.targetHeightPx) / 2;
    expect(flightHeight(0.5, 5, MUZZLE)).toBeCloseTo(straight + 20, 9);
    expect(flightHeight(0.5, 1, MUZZLE)).toBeCloseTo(straight + 4, 9);
  });
});

describe('projectilePose', () => {
  const start = { x: 10.5, y: 10.5 };

  it('is drawn at the top of the tower when it has just been shot', () => {
    const pose = projectilePose(start, start, { x: 15.5, y: 10.5 }, MUZZLE, TILE);
    const ground = tileToWorld(start.x, start.y, TILE);
    expect(pose.x).toBeCloseTo(ground.x, 6);
    expect(pose.y).toBeCloseTo(ground.y - MUZZLE, 6);
  });

  it('is drawn on its target when it lands', () => {
    const target = { x: 15.5, y: 10.5 };
    const pose = projectilePose(start, target, target, MUZZLE, TILE);
    const ground = tileToWorld(target.x, target.y, TILE);
    expect(pose.x).toBeCloseTo(ground.x, 6);
    expect(pose.y).toBeCloseTo(ground.y - projectile.targetHeightPx, 6);
  });

  it('points the way it flies: to the right on the screen, and down as it comes in', () => {
    // Towards +x, -y in tiles is straight to the right on the screen.
    const target = { x: 14.5, y: 6.5 };
    const late = projectilePose(start, { x: 14.1, y: 6.9 }, target, MUZZLE, TILE);
    expect(Math.cos(late.rotation)).toBeGreaterThan(0);
    expect(Math.sin(late.rotation)).toBeGreaterThan(0);
    // Shot the other way it points to the left.
    const left = projectilePose(start, { x: 7, y: 14 }, { x: 6.5, y: 14.5 }, MUZZLE, TILE);
    expect(Math.cos(left.rotation)).toBeLessThan(0);
  });

  it('rises at first when it is shot far, and falls all the way when it is shot near', () => {
    const far = projectilePose(start, { x: 10.6, y: 10.4 }, { x: 14.7, y: 6.3 }, 20, TILE);
    expect(Math.sin(far.rotation)).toBeLessThan(0);
    const near = projectilePose(start, { x: 10.6, y: 10.4 }, { x: 11.5, y: 9.5 }, MUZZLE, TILE);
    expect(Math.sin(near.rotation)).toBeGreaterThan(0);
  });
});

describe('hitBurstAt', () => {
  it('shows for 220 ms, growing and fading, and is then over', () => {
    expect(projectile.hitMs).toBe(220);
    expect(hitBurstAt(0)).toEqual({ alpha: 1, scale: projectile.hitScale.start });
    const half = hitBurstAt(110)!;
    expect(half.alpha).toBeCloseTo(0.5, 9);
    expect(half.scale).toBeGreaterThan(projectile.hitScale.start);
    expect(half.scale).toBeLessThan(projectile.hitScale.end);
    expect(hitBurstAt(220)).toBeUndefined();
    expect(hitBurstAt(-1)).toBeUndefined();
  });
});

describe('groundCircle', () => {
  it('is twice as wide as it is high on the screen, and reaches the tiles at that distance', () => {
    const { rx, ry } = groundCircle(6, TILE);
    expect(rx).toBeCloseTo(2 * ry, 9);
    // The tile six steps along one axis lies on the ring.
    const centre = tileToWorld(10, 10, TILE);
    const edge = tileToWorld(16, 10, TILE);
    const dx = (edge.x - centre.x) / rx;
    const dy = (edge.y - centre.y) / ry;
    expect(dx * dx + dy * dy).toBeCloseTo(1, 9);
  });
});

describe('the pictures', () => {
  const frames = sceneryAtlas.frames as Record<string, { frame: { w: number; h: number } }>;

  it('has an arrow that lies flat and a burst no bigger than a unit', () => {
    expect(frames.arrow).toBeDefined();
    expect(frames.hit).toBeDefined();
    expect(frames.arrow!.frame.w).toBeGreaterThan(frames.arrow!.frame.h * 2);
    expect(frames.hit!.frame.h).toBeLessThanOrEqual(32);
  });

  it('lets the arrow go from the platform of the tower, below its roof', () => {
    const roof = towerAtlas.meta.building.roofHeight;
    expect(MUZZLE_HEIGHT.vakttorn).toBeDefined();
    expect(MUZZLE_HEIGHT.vakttorn!).toBeGreaterThan(roof * 0.5);
    expect(MUZZLE_HEIGHT.vakttorn!).toBeLessThan(roof * 0.75);
  });

  it('the tower is as tall as the size standard asks of a tower: taller than a small house', () => {
    const { roofHeight, minRoofHeight, footprint, sizeClass } = towerAtlas.meta.building;
    expect(sizeClass).toBe('tower');
    expect(footprint).toBe(BUILDING_DEFS.vakttorn.size);
    expect(roofHeight).toBeGreaterThanOrEqual(minRoofHeight);
    expect(minRoofHeight).toBe(96);
  });
});
