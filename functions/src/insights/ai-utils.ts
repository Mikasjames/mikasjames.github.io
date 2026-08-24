import type {
  CalculatedHabitCorrelation,
  JournalInsightEntry,
} from './types.js';

// Prompts follow the AI_PROMPT_* naming convention and live in functions/.env.<projectId>
export function getSystemPrompt(): string {
  const prompt = process.env.AI_PROMPT_JOURNAL_ANALYSIS;
  if (!prompt || prompt.trim().length === 0) {
    throw new Error(
      'AI_PROMPT_JOURNAL_ANALYSIS env var is not set — add it to functions/.env.<projectId> and redeploy',
    );
  }
  return prompt;
}

export function prepareEntriesForAi(
  entries: JournalInsightEntry[],
  habitCorrelations: CalculatedHabitCorrelation[],
  label: string,
): { entryCount: number; userContent: string } {
  const sortedEntries = [...entries].sort(
    (a, b) => Date.parse(b.entryDate) - Date.parse(a.entryDate),
  );
  const entriesForAI = sortedEntries.slice(0, 50).map((entry) => ({
    date: entry.entryDate,
    rating: entry.rating,
    content: entry.content.slice(0, 500),
  }));

  if (entries.length > 50) {
    console.warn(`${label} analysis truncated: ${entries.length} entries → 50 sent`);
  }

  const userContent = `Analyze these ${entriesForAI.length} journal entries and this pre-calculated habit correlations data:\n${JSON.stringify(
    { entries: entriesForAI, preCalculatedHabitCorrelations: habitCorrelations },
    null,
    2,
  )}`;

  return { entryCount: entriesForAI.length, userContent };
}

export function parseAiJson(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    // fall through to extraction strategies
  }

  const mdMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (mdMatch) {
    return JSON.parse(mdMatch[1].trim());
  }

  const braceMatch = content.match(/\{[\s\S]*\}/);
  if (braceMatch) {
    return JSON.parse(braceMatch[0]);
  }

  throw new Error('No JSON object found in AI response');
}

// Post-process: Filter out nonsense or generic factors that are not supported by data
export function sanitizeRatingCorrelations(parsed: Record<string, unknown>): void {
  if (!Array.isArray(parsed.ratingCorrelations)) return;
  parsed.ratingCorrelations = parsed.ratingCorrelations.filter(
    (factor) =>
      typeof (factor as { averageRating?: unknown })?.averageRating === 'number' &&
      (factor as { averageRating: number }).averageRating >= 1 &&
      (factor as { averageRating: number }).averageRating <= 5,
  );
}
