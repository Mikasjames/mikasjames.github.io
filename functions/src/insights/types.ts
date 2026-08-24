export type JournalInsightEntry = {
  id: string;
  uid: string;
  content: string;
  rating: number;
  entryDate: string;
};

export type RatingPoint = {
  date: string;
  time: number;
  rating: number;
};

export type HabitInsightLog = {
  habitId: string;
  habitName: string;
  date: string;
};

export type HabitSummary = {
  totalCheckIns: number;
  byHabit: Record<string, { name: string; count: number; dates: string[] }>;
};

export type CalculatedHabitCorrelation = {
  habitId: string;
  habitName: string;
  averageRatingOnCompletedDays: number | null;
  averageRatingOnMissedDays: number | null;
  completedDaysCount: number;
  missedDaysCount: number;
  insight?: string; // Programmatic merge targets this field
};

export type LocalTextAnalysisResult = {
  source: 'local-fallback';
  keywordFrequencyByRating: {
    highRated: Record<string, number>;
    lowRated: Record<string, number>;
  };
  topicAverages: Record<string, { count: number; averageRating: number | null }>;
  sentimentVsRating: {
    positiveWordCount: number;
    negativeWordCount: number;
    lexicalSentimentScore: number;
    averageRating: number | null;
  };
};

export type RemoteTextAnalysisResult = {
  source: 'groq-api' | 'gemini-api';
  model: string;
  result: unknown;
  fallback: LocalTextAnalysisResult;
};

export type TextAnalysisResult = LocalTextAnalysisResult | RemoteTextAnalysisResult;

export function isRemoteAnalysis(
  analysis: TextAnalysisResult,
): analysis is RemoteTextAnalysisResult {
  return analysis.source !== 'local-fallback';
}
