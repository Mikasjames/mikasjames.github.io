import { average, dailyRatingPoints } from './stats.js';
import type {
  CalculatedHabitCorrelation,
  HabitInsightLog,
  HabitSummary,
  JournalInsightEntry,
} from './types.js';

export function summarizeHabitLogs(logs: HabitInsightLog[]): HabitSummary {
  const byHabit: HabitSummary['byHabit'] = {};
  for (const log of logs) {
    const current = byHabit[log.habitId] ?? {
      name: log.habitName,
      count: 0,
      dates: [],
    };
    current.count += 1;
    if (!current.dates.includes(log.date)) {
      current.dates.push(log.date);
    }
    current.dates.sort();
    byHabit[log.habitId] = current;
  }

  return {
    totalCheckIns: logs.length,
    byHabit,
  };
}

export function calculateHabitCorrelations(
  entries: JournalInsightEntry[],
  habitSummary: HabitSummary,
): CalculatedHabitCorrelation[] {
  const dailyRatings = dailyRatingPoints(entries);
  if (dailyRatings.length === 0) return [];

  const correlations: CalculatedHabitCorrelation[] = [];

  for (const [habitId, habitData] of Object.entries(habitSummary.byHabit)) {
    const completedRatings: number[] = [];
    const missedRatings: number[] = [];

    for (const point of dailyRatings) {
      if (habitData.dates.includes(point.date)) {
        completedRatings.push(point.rating);
      } else {
        missedRatings.push(point.rating);
      }
    }

    correlations.push({
      habitId,
      habitName: habitData.name,
      averageRatingOnCompletedDays: average(completedRatings),
      averageRatingOnMissedDays: average(missedRatings),
      completedDaysCount: completedRatings.length,
      missedDaysCount: missedRatings.length,
    });
  }

  return correlations;
}
