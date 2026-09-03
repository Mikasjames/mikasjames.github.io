import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { Timestamp } from 'firebase-admin/firestore';
import { db } from '../firebase.js';
import { callTextAnalysis, getAiProvider } from './ai.js';
import { calculateHabitCorrelations, summarizeHabitLogs } from './habits.js';
import { loadHabitLogs, loadJournalEntries, loadYearEntries } from './loaders.js';
import { localTextAnalysis } from './local-analysis.js';
import {
  average,
  dailyRatingPoints,
  longestStreak,
  previousMonthRange,
  trendSlope,
  variance,
} from './stats.js';
import type {
  CalculatedHabitCorrelation,
  HabitInsightLog,
  JournalInsightEntry,
} from './types.js';
import { isRemoteAnalysis } from './types.js';

export async function buildInsight(
  entries: JournalInsightEntry[],
  habitLogs: HabitInsightLog[],
) {
  const points = dailyRatingPoints(entries);
  const ratings = points.map((point) => point.rating);
  const habitSummary = summarizeHabitLogs(habitLogs);
  const habitCorrelations = calculateHabitCorrelations(entries, habitSummary);

  const contentEntries = entries.filter((e) => e.content.trim().length > 0);
  const textAnalysis =
    contentEntries.length > 0
      ? await callTextAnalysis(contentEntries, habitCorrelations)
      : localTextAnalysis(entries);

  const localAnalysis = isRemoteAnalysis(textAnalysis) ? textAnalysis.fallback : textAnalysis;
  const periodAverage = average(ratings) ?? 3;
  const programmaticFactors = Object.entries(localAnalysis.topicAverages)
    .filter(([_, data]) => data.count >= 2)
    .map(([topic, data]) => {
      const topicAvg = data.averageRating ?? 3;
      const diff = topicAvg - periodAverage;
      const threshold = 0.15;
      return {
        factor: topic.replace(/([A-Z])/g, ' $1').toLowerCase().trim(),
        impact: diff > threshold ? 'positive' : diff < -threshold ? 'negative' : 'neutral',
        averageRating: topicAvg,
      };
    })
    .sort((a, b) => (b.averageRating ?? 0) - (a.averageRating ?? 0));

  let mergedCorrelations: CalculatedHabitCorrelation[] = habitCorrelations.map((calc) => ({
    ...calc,
    insight: 'No qualitative analysis generated.',
  }));

  if (isRemoteAnalysis(textAnalysis)) {
    const aiResult = textAnalysis.result as Record<string, unknown> & {
      habitCorrelations?: Array<{ habit?: string; insight?: string }>;
    };

    if (aiResult) {
      aiResult.ratingCorrelations = programmaticFactors;

      if (Array.isArray(aiResult.habitCorrelations)) {
        mergedCorrelations = habitCorrelations.map((calc) => {
          const matchingLLM = aiResult.habitCorrelations?.find(
            (h) =>
              typeof h.habit === 'string' &&
              h.habit.toLowerCase() === calc.habitName.toLowerCase(),
          );
          return {
            ...calc,
            insight: matchingLLM?.insight || 'No qualitative analysis generated.',
          };
        });
      }
    }
  } else {
    (textAnalysis as Record<string, unknown>).ratingCorrelations = programmaticFactors;
  }

  return {
    entryCount: entries.length,
    ratedDayCount: points.length,
    averageRating: average(ratings),
    trendSlopePerDay: trendSlope(points),
    variance: variance(ratings),
    streaks: {
      longestHighDays: longestStreak(points, (rating) => rating >= 4),
      longestLowDays: longestStreak(points, (rating) => rating <= 2),
    },
    dailyRatings: points,
    textAnalysis,
    habitCorrelations: mergedCorrelations,
    habitSummary,
  };
}

/**
 * Shared workflow for compiling monthly & yearly insights
 */
export async function processUserInsights(ownerUid: string) {
  console.log(`AI provider: ${getAiProvider()}`);

  const range = previousMonthRange();
  console.log(`Processing insights for period: ${range.key}`);

  const entries = await loadJournalEntries(range.start, range.end, ownerUid);

  if (entries.length === 0) {
    console.log('No journal entries found for this period — skipping insight generation');
    return { ok: false, message: 'No journal entries found for previous month', period: range.key };
  }

  console.log(`Building insights for ${ownerUid} (${entries.length} entries)`);

  const yearStart = new Date(Date.UTC(range.year, 0, 1));
  const yearEnd = new Date(Date.UTC(range.year + 1, 0, 1));

  // Fetch habit logs and year entries concurrently
  const [monthHabitLogs, yearEntries, yearHabitLogs] = await Promise.all([
    loadHabitLogs(range.start, range.end, ownerUid),
    loadYearEntries(ownerUid, range.year),
    loadHabitLogs(yearStart, yearEnd, ownerUid),
  ]);

  // Run AI / Statistical analysis in parallel
  const [monthInsight, yearInsight] = await Promise.all([
    buildInsight(entries, monthHabitLogs),
    buildInsight(yearEntries, yearHabitLogs),
  ]);

  const batchWrite = [
    db
      .collection('insights')
      .doc(ownerUid)
      .collection('monthly')
      .doc(range.key)
      .set({
        period: range.key,
        periodStart: Timestamp.fromDate(range.start),
        periodEnd: Timestamp.fromDate(range.end),
        generatedAt: Timestamp.now(),
        monthly: monthInsight,
        yearToDate: yearInsight,
      }),
    db
      .collection('insights')
      .doc(ownerUid)
      .collection('yearly')
      .doc(String(range.year))
      .set(
        {
          year: range.year,
          generatedAt: Timestamp.now(),
          yearly: yearInsight,
        },
        { merge: true },
      ),
  ];

  await Promise.all(batchWrite);
  console.log(`✅ Successfully compiled insights for ${ownerUid}`);

  return {
    ok: true,
    period: range.key,
    generatedAt: new Date().toISOString(),
  };
}

export const compileJournalHappinessInsights = onSchedule(
  {
    schedule: '0 13 2 * *',
    timeZone: 'UTC',
    memory: '512MiB',
    timeoutSeconds: 540,
    secrets: ['GROQ_API_KEY', 'GEMINI_API_KEY', 'OWNER_UID'],
  },
  async () => {
    const ownerUid = process.env.OWNER_UID;
    if (!ownerUid) {
      throw new Error('OWNER_UID secret is not set — cannot compile insights');
    }
    await processUserInsights(ownerUid);
  },
);

export const generateInsightsNow = onCall(
  {
    memory: '512MiB',
    timeoutSeconds: 540,
    secrets: ['GROQ_API_KEY', 'GEMINI_API_KEY', 'OWNER_UID'],
  },
  async (request) => {
    const ownerUid = process.env.OWNER_UID;

    if (!ownerUid) {
      throw new HttpsError('failed-precondition', 'OWNER_UID secret is not set on the backend');
    }

    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'The function must be called while authenticated.');
    }

    if (request.auth.uid !== ownerUid) {
      throw new HttpsError('permission-denied', 'You do not have permission to run this insight generation.');
    }

    try {
      return await processUserInsights(ownerUid);
    } catch (error) {
      console.error(`❌ Failed to compile journal happiness insights for ${ownerUid}`, error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError('internal', (error as Error)?.message ?? 'Insight generation crashed');
    }
  },
);