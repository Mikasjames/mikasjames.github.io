import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { defineSecret } from 'firebase-functions/params';

// Define secrets properly for v2 functions
const groqApiKey = defineSecret('GROQ_API_KEY');

initializeApp();
const db = getFirestore();

// ========== HELPER FUNCTIONS ==========

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function triggerGitHubDispatch(
  token: string,
  owner: string,
  repo: string,
): Promise<void> {
  const maxAttempts = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/dispatches`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'X-GitHub-Api-Version': '2022-11-28',
          Accept: 'application/vnd.github.v3+json',
        },
        body: JSON.stringify({
          event_type: 'deploy-blog',
        }),
      },
    );

    if (response.ok) return;

    lastError = new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    const shouldRetry = response.status === 429 || response.status >= 500;
    if (!shouldRetry || attempt === maxAttempts) break;

    await sleep(1000 * attempt);
  }

  throw lastError ?? new Error('GitHub API error: dispatch failed');
}

export const deployOnPostChange = onDocumentWritten(
  {
    document: 'blogs/{docId}',
    secrets: ['GITHUB_PAT'],
  },
  async (event) => {
    try {
      const newStatus = event.data?.after?.data()?.status;
      const oldStatus = event.data?.before?.data()?.status;

      if (!event.data?.after?.exists) {
        console.log("Post deleted - triggering deploy to remove from site");
      }

      if (newStatus === 'draft') {
        console.log('Post is draft - skipping deploy');
        return;
      }

      if (oldStatus === 'published' && newStatus === 'draft') {
        console.log('Post unpublished - triggering deploy to remove from site');
      }

      const token = process.env.GITHUB_PAT;
      const githubOwner = process.env.GITHUB_OWNER;
      const githubRepo = process.env.GITHUB_REPO;
      const projectId = process.env.GCLOUD_PROJECT;

      if (!token) {
        throw new Error('GITHUB_PAT environment variable not set');
      }
      if (!projectId) {
        throw new Error('GCLOUD_PROJECT environment variable not set');
      }

      if (!githubOwner || !githubRepo) {
        throw new Error('GITHUB_OWNER or GITHUB_REPO environment variable not set');
      }

      await triggerGitHubDispatch(token, githubOwner, githubRepo);

      console.log('Repository dispatch triggered successfully');
    } catch (error) {
      console.error('Error triggering deployment:', error);
      throw error;
    }
  },
);

// ========== JOURNAL ANALYSIS TYPES ==========

type JournalInsightEntry = {
  id: string;
  uid: string;
  content: string;
  rating: number;
  createdAt: Date;
};

type RatingPoint = {
  date: string;
  time: number;
  rating: number;
};

// ========== STATISTICS FUNCTIONS ==========

function previousMonthRange(reference = new Date()): { year: number; month: number; start: Date; end: Date; key: string } {
  const year = reference.getUTCMonth() === 0
    ? reference.getUTCFullYear() - 1
    : reference.getUTCFullYear();
  const month = reference.getUTCMonth() === 0 ? 11 : reference.getUTCMonth() - 1;
  const start = new Date(Date.UTC(year, month, 1));
  const end = new Date(Date.UTC(year, month + 1, 1));
  return {
    year,
    month,
    start,
    end,
    key: `${year}-${String(month + 1).padStart(2, '0')}`,
  };
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function variance(values: number[]): number | null {
  if (values.length === 0) return null;
  const avg = average(values);
  if (avg === null) return null;
  return values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / values.length;
}

function trendSlope(points: RatingPoint[]): number | null {
  if (points.length < 2) return null;
  const xs = points.map((point) => point.time / 86_400_000);
  const ys = points.map((point) => point.rating);
  const xAvg = average(xs);
  const yAvg = average(ys);
  if (xAvg === null || yAvg === null) return null;

  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < points.length; i += 1) {
    numerator += (xs[i] - xAvg) * (ys[i] - yAvg);
    denominator += (xs[i] - xAvg) ** 2;
  }
  return denominator === 0 ? null : numerator / denominator;
}

function dailyRatingPoints(entries: JournalInsightEntry[]): RatingPoint[] {
  const daily = new Map<string, { time: number; ratings: number[] }>();
  for (const entry of entries) {
    const date = entry.createdAt.toISOString().slice(0, 10);
    const current = daily.get(date) ?? {
      time: Date.parse(`${date}T00:00:00.000Z`),
      ratings: [],
    };
    current.ratings.push(entry.rating);
    daily.set(date, current);
  }

  return [...daily.entries()]
    .map(([date, value]) => ({
      date,
      time: value.time,
      rating: average(value.ratings) ?? 0,
    }))
    .sort((a, b) => a.time - b.time);
}

function longestStreak(points: RatingPoint[], predicate: (rating: number) => boolean): number {
  let longest = 0;
  let current = 0;
  for (const point of points) {
    if (predicate(point.rating)) {
      current += 1;
      longest = Math.max(longest, current);
    } else {
      current = 0;
    }
  }
  return longest;
}

// ========== TEXT ANALYSIS FUNCTIONS (UPDATED FOR GROQ) ==========

function stripMarkdown(value: string): string {
  return value
    .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/[`*_~>#-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

const stopWords = new Set([
  'the', 'and', 'for', 'that', 'with', 'this', 'was', 'were', 'are', 'you',
  'but', 'not', 'have', 'had', 'has', 'from', 'they', 'them', 'then', 'than',
  'into', 'about', 'today', 'just', 'very', 'really', 'still', 'been', 'will',
  'would', 'could', 'should', 'there', 'their', 'what', 'when', 'where', 'why',
  'how', 'all', 'out', 'our', 'your', 'i', 'me', 'my', 'we', 'it', 'is', 'to',
  'of', 'in', 'on', 'at', 'a', 'an', 'as', 'or', 'if', 'so', 'be', 'do',
]);

const positiveWords = new Set([
  'good', 'great', 'happy', 'calm', 'clear', 'better', 'best', 'love', 'win',
  'progress', 'excited', 'grateful', 'proud', 'peace', 'easy', 'focused',
]);

const negativeWords = new Set([
  'bad', 'sad', 'angry', 'tired', 'stress', 'stressed', 'anxious', 'worse',
  'worst', 'hate', 'lost', 'blocked', 'hard', 'heavy', 'lonely', 'pain',
]);

const topicKeywords: Record<string, string[]> = {
  linux: ['linux', 'ubuntu', 'debian', 'arch', 'kernel', 'terminal', 'shell'],
  clientWork: ['client', 'contract', 'invoice', 'meeting', 'deadline', 'project'],
  health: ['sleep', 'walk', 'gym', 'workout', 'food', 'doctor', 'health'],
  relationships: ['friend', 'family', 'partner', 'call', 'dinner', 'message'],
  creativeWork: ['write', 'writing', 'design', 'music', 'photo', 'draw', 'idea'],
};

function keywordCounts(entries: JournalInsightEntry[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const entry of entries) {
    for (const word of stripMarkdown(entry.content).split(/\W+/)) {
      if (word.length < 3 || stopWords.has(word)) continue;
      counts[word] = (counts[word] ?? 0) + 1;
    }
  }
  return Object.fromEntries(
    Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 25),
  );
}

function localTextAnalysis(entries: JournalInsightEntry[]) {
  const highestRated = entries.filter((entry) => entry.rating >= 5);
  const lowestRated = entries.filter((entry) => entry.rating <= 1);
  const topicRatings: Record<string, number[]> = {};
  let positive = 0;
  let negative = 0;

  for (const entry of entries) {
    const text = stripMarkdown(entry.content);
    const words = text.split(/\W+/).filter(Boolean);
    for (const word of words) {
      if (positiveWords.has(word)) positive += 1;
      if (negativeWords.has(word)) negative += 1;
    }
    for (const [topic, keywords] of Object.entries(topicKeywords)) {
      if (keywords.some((keyword) => text.includes(keyword))) {
        topicRatings[topic] = [...(topicRatings[topic] ?? []), entry.rating];
      }
    }
  }

  return {
    source: 'local-fallback',
    keywordFrequencyByRating: {
      highRated: keywordCounts(highestRated),
      lowRated: keywordCounts(lowestRated),
    },
    topicAverages: Object.fromEntries(
      Object.entries(topicRatings).map(([topic, ratings]) => [
        topic,
        {
          count: ratings.length,
          averageRating: average(ratings),
        },
      ]),
    ),
    sentimentVsRating: {
      positiveWordCount: positive,
      negativeWordCount: negative,
      lexicalSentimentScore: positive - negative,
      averageRating: average(entries.map((entry) => entry.rating)),
    },
  };
}

// ** NEW: Groq AI Analysis Function **
async function groqTextAnalysis(entries: JournalInsightEntry[], apiKey: string) {
  // Prepare a summary of entries (limit to prevent token overflow)
  const entriesForAI = entries.slice(0, 50).map(entry => ({
    date: entry.createdAt.toISOString().slice(0, 10),
    rating: entry.rating,
    content: entry.content.slice(0, 500), // Limit content length
  }));

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant', // Fast and good for this use case
      messages: [
        {
          role: 'system',
          content: `You are a journal analysis assistant. Analyze the journal entries and their happiness ratings (1-5 scale, where 5 is happiest).
                    Return ONLY valid JSON with this structure:
                    {
                      "overallSentiment": "positive/negative/neutral",
                      "primaryEmotion": "joy/sadness/anger/fear/surprise/calm",
                      "keyThemes": ["theme1", "theme2"],
                      "patterns": ["pattern observation 1", "pattern observation 2"],
                      "ratingCorrelations": [
                        {"factor": "meditation", "impact": "positive", "averageRating": 4.5},
                        {"factor": "deadline", "impact": "negative", "averageRating": 2.1}
                      ],
                      "briefSummary": "One sentence summary of the month's emotional trajectory"
                    }`
        },
        {
          role: 'user',
          content: `Analyze these ${entriesForAI.length} journal entries with their ratings:\n${JSON.stringify(entriesForAI, null, 2)}`
        }
      ],
      temperature: 0.3,
      max_tokens: 1000,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Groq API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content;

  if (!content) {
    throw new Error('Empty response from Groq API');
  }

  // Parse the JSON response (Groq might wrap in markdown)
  let parsed;
  try {
    // Remove markdown code blocks if present
    const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    parsed = JSON.parse(jsonStr);
  } catch (e) {
    console.error('Failed to parse Groq response as JSON:', content);
    throw new Error('Invalid JSON response from Groq');
  }

  return {
    source: 'groq-api',
    model: 'llama-3.1-8b-instant',
    result: parsed,
    fallback: localTextAnalysis(entries),
  };
}

// ** UPDATED: Main analysis function with Groq support **
async function callTextAnalysis(entries: JournalInsightEntry[]): Promise<any> {
  // Try to get Groq API key from secrets (injected by Firebase)
  const groqKey = process.env.GROQ_API_KEY;

  if (!groqKey) {
    console.log('GROQ_API_KEY not set, using local fallback');
    return localTextAnalysis(entries);
  }

  try {
    console.log(`Attempting Groq analysis for ${entries.length} entries`);
    return await groqTextAnalysis(entries, groqKey);
  } catch (error) {
    console.error('Groq analysis failed, using local fallback:', error);
    return localTextAnalysis(entries);
  }
}

async function buildInsight(entries: JournalInsightEntry[]) {
  const points = dailyRatingPoints(entries);
  const ratings = points.map((point) => point.rating);
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
    textAnalysis: await callTextAnalysis(entries), // Updated function call
  };
}

// ========== DATABASE FUNCTIONS ==========

async function loadJournalEntries(start: Date, end: Date): Promise<JournalInsightEntry[]> {
  const snapshot = await db
    .collection('journal')
    .where('createdAt', '>=', Timestamp.fromDate(start))
    .where('createdAt', '<', Timestamp.fromDate(end))
    .get();

  const fallbackUid = process.env.OWNER_UID || 'owner';
  return snapshot.docs
    .map((doc) => {
      const data = doc.data();
      const createdAt = data.createdAt?.toDate?.();
      const rating = data.happinessRating;
      if (!createdAt || typeof rating !== 'number') return null;
      return {
        id: doc.id,
        uid: data.ownerUid || fallbackUid,
        content: data.content || '',
        rating,
        createdAt,
      };
    })
    .filter((entry): entry is JournalInsightEntry => entry !== null);
}

async function loadYearEntries(uid: string, year: number): Promise<JournalInsightEntry[]> {
  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year + 1, 0, 1));
  const snapshot = await db
    .collection('journal')
    .where('createdAt', '>=', Timestamp.fromDate(start))
    .where('createdAt', '<', Timestamp.fromDate(end))
    .get();
  const fallbackUid = process.env.OWNER_UID || 'owner';

  return snapshot.docs
    .map((doc) => {
      const data = doc.data();
      const createdAt = data.createdAt?.toDate?.();
      const rating = data.happinessRating;
      const entryUid = data.ownerUid || fallbackUid;
      if (!createdAt || typeof rating !== 'number' || entryUid !== uid) return null;
      return {
        id: doc.id,
        uid: entryUid,
        content: data.content || '',
        rating,
        createdAt,
      };
    })
    .filter((entry): entry is JournalInsightEntry => entry !== null);
}

// ========== MAIN SCHEDULED FUNCTION (UPDATED WITH SECRETS) ==========

export const compileJournalHappinessInsights = onSchedule(
  {
    schedule: '0 3 1 * *',
    timeZone: 'UTC',
    memory: '512MiB',
    timeoutSeconds: 540,
    secrets: ['GROQ_API_KEY'], // Add the secret here
  },
  async () => {
    const range = previousMonthRange();
    console.log(`Processing insights for period: ${range.key}`);

    const entries = await loadJournalEntries(range.start, range.end);
    const byUid = new Map<string, JournalInsightEntry[]>();

    for (const entry of entries) {
      byUid.set(entry.uid, [...(byUid.get(entry.uid) ?? []), entry]);
    }

    for (const [uid, uidEntries] of byUid) {
      try {
        console.log(`Building insights for user ${uid} (${uidEntries.length} entries)`);
        const monthInsight = await buildInsight(uidEntries);
        const yearEntries = await loadYearEntries(uid, range.year);
        const yearInsight = await buildInsight(yearEntries);

        await db
          .collection('insights')
          .doc(uid)
          .collection('monthly')
          .doc(range.key)
          .set({
            period: range.key,
            periodStart: Timestamp.fromDate(range.start),
            periodEnd: Timestamp.fromDate(range.end),
            generatedAt: Timestamp.now(),
            monthly: monthInsight,
            yearToDate: yearInsight,
          });

        await db
          .collection('insights')
          .doc(uid)
          .collection('yearly')
          .doc(String(range.year))
          .set(
            {
              year: range.year,
              generatedAt: Timestamp.now(),
              yearly: yearInsight,
            },
            { merge: true },
          );

        console.log(`✅ Successfully compiled insights for ${uid}`);
      } catch (error) {
        console.error(`❌ Failed to compile journal happiness insights for ${uid}`, error);
      }
    }

    console.log(`Compiled journal happiness insights for ${byUid.size} user(s)`);
  },
);
