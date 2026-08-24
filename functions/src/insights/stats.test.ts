import { describe, it, expect } from 'vitest';
import {
  average,
  dailyRatingPoints,
  longestStreak,
  previousMonthRange,
  trendSlope,
  variance,
} from './stats.js';

const DAY_MS = 86_400_000;

function day(n: number): string {
  return new Date(Date.UTC(2026, 6, n)).toISOString().slice(0, 10);
}

describe('previousMonthRange', () => {
  it('returns the prior month for a mid-year date', () => {
    const range = previousMonthRange(new Date(Date.UTC(2026, 6, 15)));
    expect(range.year).toBe(2026);
    expect(range.month).toBe(5);
    expect(range.key).toBe('2026-06');
    expect(range.start).toEqual(new Date(Date.UTC(2026, 5, 1)));
    expect(range.end).toEqual(new Date(Date.UTC(2026, 6, 1)));
  });

  it('wraps December back to January of the same year', () => {
    const range = previousMonthRange(new Date(Date.UTC(2026, 11, 31)));
    expect(range.key).toBe('2026-11');
  });

  it('wraps January back to December of the previous year', () => {
    const range = previousMonthRange(new Date(Date.UTC(2026, 0, 2)));
    expect(range.year).toBe(2025);
    expect(range.month).toBe(11);
    expect(range.key).toBe('2025-12');
    expect(range.start).toEqual(new Date(Date.UTC(2025, 11, 1)));
    expect(range.end).toEqual(new Date(Date.UTC(2026, 0, 1)));
  });
});

describe('average / variance', () => {
  it('average returns null for empty input', () => {
    expect(average([])).toBeNull();
  });

  it('average computes the mean', () => {
    expect(average([1, 2, 3, 4])).toBeCloseTo(2.5);
  });

  it('variance returns null for empty input and zero for constant sets', () => {
    expect(variance([])).toBeNull();
    expect(variance([4, 4, 4])).toBeCloseTo(0);
  });

  it('variance computes population variance', () => {
    expect(variance([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(4);
  });
});

describe('trendSlope', () => {
  it('returns null with fewer than two points', () => {
    expect(trendSlope([])).toBeNull();
    expect(trendSlope([{ date: day(1), time: DAY_MS, rating: 3 }])).toBeNull();
  });

  it('computes slope over time in days', () => {
    const points = [
      { date: day(1), time: DAY_MS, rating: 1 },
      { date: day(2), time: 2 * DAY_MS, rating: 3 },
    ];
    expect(trendSlope(points)).toBeCloseTo(2);
  });

  it('returns negative slope for declining ratings', () => {
    const points = [
      { date: day(1), time: DAY_MS, rating: 5 },
      { date: day(2), time: 2 * DAY_MS, rating: 4 },
      { date: day(3), time: 3 * DAY_MS, rating: 3 },
    ];
    expect(trendSlope(points)).toBeCloseTo(-1);
  });
});

describe('dailyRatingPoints', () => {
  it('averages multiple entries from the same date into one point', () => {
    const points = dailyRatingPoints([
      { id: 'a', uid: 'u', content: '', rating: 5, entryDate: day(1) },
      { id: 'b', uid: 'u', content: '', rating: 3, entryDate: day(1) },
    ]);
    expect(points).toHaveLength(1);
    expect(points[0].date).toBe(day(1));
    expect(points[0].rating).toBeCloseTo(4);
    expect(points[0].time).toBe(Date.parse(`${day(1)}T00:00:00.000Z`));
  });

  it('sorts points chronologically regardless of input order', () => {
    const points = dailyRatingPoints([
      { id: 'a', uid: 'u', content: '', rating: 2, entryDate: day(3) },
      { id: 'b', uid: 'u', content: '', rating: 4, entryDate: day(1) },
    ]);
    expect(points.map((p) => p.date)).toEqual([day(1), day(3)]);
  });
});

describe('longestStreak', () => {
  function pointsAt(ratingsByDay: Array<[number, number]>) {
    return ratingsByDay.map(([d, r]) => ({ date: day(d), time: d * DAY_MS, rating: r }));
  }

  it('counts consecutive qualifying days', () => {
    const points = pointsAt([
      [1, 5],
      [2, 4],
      [3, 5],
      [4, 2],
    ]);
    expect(longestStreak(points, (r) => r >= 4)).toBe(3);
  });

  it('resets the streak when the gap exceeds ~25 hours', () => {
    const points = [
      { date: day(1), time: 1 * DAY_MS, rating: 5 },
      { date: day(3), time: 3 * DAY_MS + 40 * 3_600_000, rating: 5 },
    ];
    expect(longestStreak(points, (r) => r >= 4)).toBe(1);
  });

  it('keeps counting across normal day gaps', () => {
    const points = pointsAt([
      [1, 5],
      [2, 5],
    ]);
    expect(longestStreak(points, (r) => r >= 4)).toBe(2);
  });

  it('resets on a non-qualifying day', () => {
    const points = pointsAt([
      [1, 5],
      [2, 3],
      [3, 5],
      [4, 5],
    ]);
    expect(longestStreak(points, (r) => r >= 4)).toBe(2);
  });

  it('returns zero when nothing qualifies', () => {
    const points = pointsAt([
      [1, 1],
      [2, 2],
    ]);
    expect(longestStreak(points, (r) => r >= 4)).toBe(0);
  });
});
