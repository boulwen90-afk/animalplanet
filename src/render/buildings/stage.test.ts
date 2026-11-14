import { describe, expect, it } from 'vitest';
import { buildingCovers, stageOf } from './stage';

describe('stageOf', () => {
  it('shows the footing and frame for the first half of the work', () => {
    expect(stageOf(false, 0)).toBe('construction_1');
    expect(stageOf(false, 0.49)).toBe('construction_1');
  });

  it('shows the walls up for the second half', () => {
    expect(stageOf(false, 0.5)).toBe('construction_2');
    expect(stageOf(false, 0.99)).toBe('construction_2');
  });

  it('shows the finished building once it is complete, whatever the count says', () => {
    expect(stageOf(true, 1)).toBe('complete');
    expect(stageOf(true, 0)).toBe('complete');
  });
});

describe('buildingCovers', () => {
  // A building on tiles 10..12 in both directions, as tall on the screen as three tile heights.
  const corner = { x: 10, y: 10 };
  const hidden = (x: number, y: number) => buildingCovers({ x, y }, corner, 3, 3);

  it('hides a unit standing just behind the far corner', () => {
    expect(hidden(9.5, 9.5)).toBe(true);
    expect(hidden(8.5, 8.5)).toBe(true);
  });

  it('hides a unit behind either far side', () => {
    expect(hidden(11.5, 9.5)).toBe(true);
    expect(hidden(9.5, 11.5)).toBe(true);
  });

  it('does not hide a unit further behind than the building is tall', () => {
    expect(hidden(6.5, 6.5)).toBe(false);
  });

  it('does not hide a unit in front of the building or beside it', () => {
    expect(hidden(13.5, 13.5)).toBe(false);
    expect(hidden(13.5, 11.5)).toBe(false);
    expect(hidden(11.5, 13.5)).toBe(false);
    // Level with the building but out to the side on the screen.
    expect(hidden(13.5, 8.5)).toBe(false);
    expect(hidden(8.5, 13.5)).toBe(false);
  });

  it('a lower building hides less', () => {
    expect(buildingCovers({ x: 8.5, y: 8.5 }, corner, 3, 1)).toBe(false);
    expect(buildingCovers({ x: 9.5, y: 9.5 }, corner, 3, 1)).toBe(true);
  });
});
