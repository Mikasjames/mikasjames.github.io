import { describe, it, expect } from 'vitest';
import { calculateHabitCorrelations, summarizeHabitLogs } from './habits.js';
import type { HabitInsightLog, JournalInsightEntry } from './types.js';

function log(habitId: string, habitName: string, date: string): HabitInsightLog {
  return { habitId, habitName, date };
}

function entry(rating: number, entryDate: string): JournalInsightEntry {
  return { id: `${entryDate}-${rating}`, uid: 'u', content: 'x', rating, entryDate };
}

describe('summarizeHabitLogs', () => {
  it('aggregates counts and deduplicates sorted dates per habit', () => {
    const summary = summarizeHabitLogs([
      log('h1', 'Prayer', '2026-07-02'),
      log('h1', 'Prayer', '2026-07-01'),
      log('h1', 'Prayer', '2026-07-01'),
      log('h2', 'Gym', '2026-07-03'),
    ]);
    expect(summary.totalCheckIns).toBe(4);
    expect(summary.byHabit.h1).toEqual({
      name: 'Prayer',
      count: 3,
      dates: ['2026-07-01', '2026-07-02'],
    });
    expect(summary.byHabit.h2.count).toBe(1);
  });

  it('returns an empty summary for no logs', () => {
    expect(summarizeHabitLogs([])).toEqual({ totalCheckIns: 0, byHabit: {} });
  });
});

describe('calculateHabitCorrelations', () => {
  it('returns an empty array when there are no rated days', () => {
    expect(
      calculateHabitCorrelations([], { totalCheckIns: 0, byHabit: {} }),
    ).toEqual([]);
  });

  it('splits daily ratings into completed vs missed days per habit', () => {
    const entries = [entry(5, '2026-07-01'), entry(1, '2026-07-02')];
    const summary = summarizeHabitLogs([log('h1', 'Prayer', '2026-07-01')]);
    const correlations = calculateHabitCorrelations(entries, summary);

    expect(correlations).toHaveLength(1);
    expect(correlations[0]).toMatchObject({
      habitId: 'h1',
      habitName: 'Prayer',
      averageRatingOnCompletedDays: 5,
      averageRatingOnMissedDays: 1,
      completedDaysCount: 1,
      missedDaysCount: 1,
    });
  });

  it('handles a habit never completed on any rated day', () => {
    const entries = [entry(2, '2026-07-01')];
    const summary = summarizeHabitLogs([log('h9', 'Reading', '2026-08-30')]);
    const correlations = calculateHabitCorrelations(entries, summary);
    expect(correlations[0].averageRatingOnCompletedDays).toBeNull();
    expect(correlations[0].completedDaysCount).toBe(0);
    expect(correlations[0].averageRatingOnMissedDays).toBeCloseTo(2);
  });

  it('averages multiple ratings on the same completed date', () => {
    const entries = [
      entry(5, '2026-07-01'),
      entry(3, '2026-07-01'),
      entry(1, '2026-07-02'),
    ];
    const summary = summarizeHabitLogs([log('h1', 'Prayer', '2026-07-01')]);
    const correlations = calculateHabitCorrelations(entries, summary);
    expect(correlations[0].averageRatingOnCompletedDays).toBeCloseTo(4);
    expect(correlations[0].missedDaysCount).toBe(1);
  });
});
