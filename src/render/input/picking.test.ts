import { describe, expect, it } from 'vitest';
import { MAP_CONFIG } from '../../data/map';
import { createBuilding, createUnit } from '../../sim/entities';
import { tileCenterToWorld, tileToWorld } from '../../sim/map/iso';
import { openState, stateFromRows } from '../../sim/testUtils';
import {
  BUILDING_VISUALS,
  TERRAIN_OBJECT_VISUALS,
  UNIT_VISUALS,
  unitVisualCentre,
} from '../views/visuals';
import { pickEntity, pickResourceTile, rectFromPoints, unitsInRect } from './picking';

const size = MAP_CONFIG;

describe('pickEntity', () => {
  it('picks a unit at the centre of its circle', () => {
    const state = openState(10, 10);
    const unit = createUnit(state, 'samlare', 0, 4, 4);
    const centre = unitVisualCentre(unit, unit.x, unit.y, size);
    expect(pickEntity(state.entities, centre, size)).toBe(unit);
  });

  it('picks a unit anywhere on its circle but not well outside it', () => {
    const state = openState(10, 10);
    const unit = createUnit(state, 'samlare', 0, 4, 4);
    const centre = unitVisualCentre(unit, unit.x, unit.y, size);
    const radius = UNIT_VISUALS.samlare.radius;
    expect(pickEntity(state.entities, { x: centre.x + radius, y: centre.y }, size)).toBe(unit);
    expect(pickEntity(state.entities, { x: centre.x, y: centre.y - radius }, size)).toBe(unit);
    expect(
      pickEntity(state.entities, { x: centre.x + radius + 10, y: centre.y }, size),
    ).toBeUndefined();
  });

  it('returns nothing on empty ground', () => {
    const state = openState(10, 10);
    createUnit(state, 'samlare', 0, 4, 4);
    const ground = tileToWorld(8.5, 1.5, size);
    expect(pickEntity(state.entities, ground, size)).toBeUndefined();
  });

  it('picks the unit drawn in front when two overlap', () => {
    const state = openState(10, 10);
    const behind = createUnit(state, 'samlare', 0, 4, 4);
    const front = createUnit(state, 'samlare', 0, 4, 4);
    // Slightly further down the screen, so it is drawn on top.
    front.x += 0.1;
    front.y += 0.1;
    const between = unitVisualCentre(behind, 4.55, 4.55, size);
    expect(pickEntity(state.entities, between, size)).toBe(front);
  });

  it('picks enemy units too', () => {
    const state = openState(10, 10);
    const enemy = createUnit(state, 'samlare', 1, 2, 2);
    expect(pickEntity(state.entities, unitVisualCentre(enemy, enemy.x, enemy.y, size), size)).toBe(
      enemy,
    );
  });

  it('picks a building on its roof, its walls and its footprint', () => {
    const state = openState(12, 12);
    const building = createBuilding(state, 'storide', 0, 4, 4);
    const wall = BUILDING_VISUALS.storide.wallHeight;
    const centre = tileToWorld(5.5, 5.5, size);
    // Middle of the roof, which is lifted by the wall height.
    expect(pickEntity(state.entities, { x: centre.x, y: centre.y - wall }, size)).toBe(building);
    // Middle of the footprint on the ground, hidden behind the front walls.
    expect(pickEntity(state.entities, centre, size)).toBe(building);
    // Front wall, just above the lowest corner of the footprint.
    const bottom = tileToWorld(7, 7, size);
    expect(pickEntity(state.entities, { x: bottom.x, y: bottom.y - 4 }, size)).toBe(building);
  });

  it('does not pick a building from the ground beside it', () => {
    const state = openState(12, 12);
    createBuilding(state, 'storide', 0, 4, 4);
    const below = tileToWorld(7, 7, size);
    expect(pickEntity(state.entities, { x: below.x, y: below.y + 8 }, size)).toBeUndefined();
    const left = tileToWorld(4, 7, size);
    expect(pickEntity(state.entities, { x: left.x - 8, y: left.y }, size)).toBeUndefined();
  });

  it('prefers a unit standing in front of a building', () => {
    const state = openState(12, 12);
    createBuilding(state, 'storide', 0, 4, 4);
    const unit = createUnit(state, 'samlare', 0, 7, 7);
    const centre = unitVisualCentre(unit, unit.x, unit.y, size);
    expect(pickEntity(state.entities, centre, size)).toBe(unit);
  });
});

describe('unitsInRect', () => {
  it('returns the units whose circles are centred inside the rectangle', () => {
    const state = openState(12, 12);
    const inside = createUnit(state, 'samlare', 0, 4, 4);
    const outside = createUnit(state, 'samlare', 0, 9, 2);
    const centre = unitVisualCentre(inside, inside.x, inside.y, size);
    const rect = { x: centre.x - 20, y: centre.y - 20, width: 40, height: 40 };
    const found = unitsInRect(state.entities, rect, 0, size);
    expect(found).toEqual([inside]);
    expect(found).not.toContain(outside);
  });

  it("leaves out the other player's units and all buildings", () => {
    const state = openState(12, 12);
    createUnit(state, 'samlare', 1, 4, 4);
    createBuilding(state, 'storide', 0, 5, 5);
    const everything = { x: -10_000, y: -10_000, width: 20_000, height: 20_000 };
    expect(unitsInRect(state.entities, everything, 0, size)).toEqual([]);
  });

  it("returns all of the player's units inside a large rectangle", () => {
    const state = openState(12, 12);
    const mine = [
      createUnit(state, 'samlare', 0, 1, 1),
      createUnit(state, 'samlare', 0, 5, 3),
      createUnit(state, 'samlare', 0, 8, 8),
    ];
    const everything = { x: -10_000, y: -10_000, width: 20_000, height: 20_000 };
    expect(unitsInRect(state.entities, everything, 0, size)).toEqual(mine);
  });
});

describe('rectFromPoints', () => {
  it('gives the same rectangle whichever corner comes first', () => {
    const expected = { x: 10, y: 20, width: 30, height: 40 };
    expect(rectFromPoints({ x: 10, y: 20 }, { x: 40, y: 60 })).toEqual(expected);
    expect(rectFromPoints({ x: 40, y: 60 }, { x: 10, y: 20 })).toEqual(expected);
    expect(rectFromPoints({ x: 40, y: 20 }, { x: 10, y: 60 })).toEqual(expected);
  });
});

describe('pickResourceTile', () => {
  const rows = ['......', '..T...', '......', '....B.', '......', '......'];

  it('picks a tree by its trunk and by the top of its crown', () => {
    const { map } = stateFromRows(rows);
    const centre = tileCenterToWorld(2, 1, size);
    const base = centre.y + size.tileHeight / 4;
    const height = TERRAIN_OBJECT_VISUALS.tree!.height;
    expect(pickResourceTile(map, { x: centre.x, y: base - 2 }, size)).toEqual({ x: 2, y: 1 });
    // The crown reaches well above the tree's own tile.
    expect(pickResourceTile(map, { x: centre.x, y: base - height + 3 }, size)).toEqual({
      x: 2,
      y: 1,
    });
  });

  it('picks a berry bush', () => {
    const { map } = stateFromRows(rows);
    const centre = tileCenterToWorld(4, 3, size);
    expect(pickResourceTile(map, centre, size)).toEqual({ x: 4, y: 3 });
  });

  it('returns nothing on open ground, beside or above a source', () => {
    const { map } = stateFromRows(rows);
    const centre = tileCenterToWorld(2, 1, size);
    const base = centre.y + size.tileHeight / 4;
    const { width, height } = TERRAIN_OBJECT_VISUALS.tree!;
    expect(pickResourceTile(map, tileCenterToWorld(0, 4, size), size)).toBeUndefined();
    expect(
      pickResourceTile(map, { x: centre.x + width / 2 + 20, y: base - height / 2 }, size),
    ).toBeUndefined();
    expect(pickResourceTile(map, { x: centre.x, y: base - height - 10 }, size)).toBeUndefined();
  });

  it('picks the tree in front where two trees overlap', () => {
    // Two trees in a column down the screen; the front one's crown covers the back one's trunk.
    const { map } = stateFromRows(['....', '.T..', '..T.', '....']);
    const back = tileCenterToWorld(1, 1, size);
    const point = { x: back.x, y: back.y + size.tileHeight / 4 - 2 };
    expect(pickResourceTile(map, point, size)).toEqual({ x: 2, y: 2 });
  });

  it('does not pick rocks, water or emptied sources', () => {
    const state = stateFromRows(['...', '.R.', '.W.', '.T.', '...']);
    state.map.resourceAmount[3 * 3 + 1] = 0;
    for (const y of [1, 2, 3]) {
      expect(pickResourceTile(state.map, tileCenterToWorld(1, y, size), size)).toBeUndefined();
    }
  });
});
