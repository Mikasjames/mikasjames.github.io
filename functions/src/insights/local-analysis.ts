import { average } from './stats.js';
import type { LocalTextAnalysisResult, JournalInsightEntry } from './types.js';
import {
  negativeWords,
  positiveWords,
  keywordCounts,
  stripMarkdown,
  topicRatingsFor,
} from './lexicon.js';

export function localTextAnalysis(entries: JournalInsightEntry[]): LocalTextAnalysisResult {
  const highestRated = entries.filter((entry) => entry.rating >= 5);
  const lowestRated = entries.filter((entry) => entry.rating <= 1);
  let positive = 0;
  let negative = 0;

  for (const entry of entries) {
    const words = stripMarkdown(entry.content).split(/\W+/).filter(Boolean);
    for (const word of words) {
      if (positiveWords.has(word)) positive += 1;
      if (negativeWords.has(word)) negative += 1;
    }
  }

  const topicAverages = Object.fromEntries(
    Object.entries(topicRatingsFor(entries)).map(([topic, ratings]) => [
      topic,
      { count: ratings.length, averageRating: average(ratings) },
    ]),
  );

  return {
    source: 'local-fallback',
    keywordFrequencyByRating: {
      highRated: keywordCounts(highestRated),
      lowRated: keywordCounts(lowestRated),
    },
    topicAverages,
    sentimentVsRating: {
      positiveWordCount: positive,
      negativeWordCount: negative,
      lexicalSentimentScore: positive - negative,
      averageRating: average(entries.map((entry) => entry.rating)),
    },
  };
}
