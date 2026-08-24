import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getSystemPrompt,
  parseAiJson,
  prepareEntriesForAi,
  sanitizeRatingCorrelations,
} from './ai-utils.js';
import type { CalculatedHabitCorrelation, JournalInsightEntry } from './types.js';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('getSystemPrompt', () => {
  it('returns the env value when set', () => {
    vi.stubEnv('AI_PROMPT_JOURNAL_ANALYSIS', 'Be a journal analyst.');
    expect(getSystemPrompt()).toBe('Be a journal analyst.');
  });

  it('throws when the var is unset or whitespace-only', () => {
    vi.stubEnv('AI_PROMPT_JOURNAL_ANALYSIS', '');
    expect(() => getSystemPrompt()).toThrow(/AI_PROMPT_JOURNAL_ANALYSIS/);

    delete process.env.AI_PROMPT_JOURNAL_ANALYSIS;
    expect(() => getSystemPrompt()).toThrow(/AI_PROMPT_JOURNAL_ANALYSIS/);

    process.env.AI_PROMPT_JOURNAL_ANALYSIS = '   ';
    expect(() => getSystemPrompt()).toThrow(/AI_PROMPT_JOURNAL_ANALYSIS/);
  });
});

function entryFactory(n: number, date: string, content = ''): JournalInsightEntry {
  return { id: `e${n}`, uid: 'u', content, rating: 3, entryDate: date };
}

describe('prepareEntriesForAi', () => {
  const correlations: CalculatedHabitCorrelation[] = [
    {
      habitId: 'h1',
      habitName: 'Prayer',
      averageRatingOnCompletedDays: 4,
      averageRatingOnMissedDays: 2,
      completedDaysCount: 5,
      missedDaysCount: 3,
    },
  ];

  it('sorts entries newest-first and embeds count plus correlations payload', () => {
    const { entryCount, userContent } = prepareEntriesForAi(
      [
        entryFactory(1, '2026-07-01'),
        entryFactory(2, '2026-07-05'),
        entryFactory(3, '2026-07-03'),
      ],
      correlations,
      'Gemini',
    );
    expect(entryCount).toBe(3);
    expect(userContent).toContain('Analyze these 3 journal entries');
    const parsed = JSON.parse(userContent.slice(userContent.indexOf('{')));
    expect(parsed.entries.map((e: { date: string }) => e.date)).toEqual([
      '2026-07-05',
      '2026-07-03',
      '2026-07-01',
    ]);
    expect(parsed.preCalculatedHabitCorrelations).toEqual(correlations);
  });

  it('truncates to the 50 most recent entries and warns', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const entries = Array.from({ length: 60 }, (_, i) =>
      entryFactory(i + 1, `2026-06-${String((i % 28) + 1).padStart(2, '0')}`),
    );
    // make dates strictly increasing so "most recent" is deterministic
    entries.forEach((e, i) => {
      e.entryDate = new Date(Date.UTC(2026, 4, 1) + i * 86_400_000).toISOString().slice(0, 10);
    });

    const { entryCount, userContent } = prepareEntriesForAi(entries, [], 'Gemini');
    expect(entryCount).toBe(50);
    expect(warnSpy).toHaveBeenCalledWith(
      'Gemini analysis truncated: 60 entries → 50 sent',
    );
    const parsed = JSON.parse(userContent.slice(userContent.indexOf('{')));
    expect(parsed.entries[0].date).toBe(entries[59].entryDate);
  });

  it('slices each entry content to 500 characters', () => {
    const long = 'x'.repeat(600);
    const { userContent } = prepareEntriesForAi([entryFactory(1, '2026-07-01', long)], [], 'Gemini');
    const parsed = JSON.parse(userContent.slice(userContent.indexOf('{')));
    expect(parsed.entries[0].content).toHaveLength(500);
  });
});

describe('parseAiJson', () => {
  const obj = { overallSentiment: 'positive' };

  it('parses direct JSON', () => {
    expect(parseAiJson(JSON.stringify(obj))).toEqual(obj);
  });

  it('extracts from markdown code fences with and without language tag', () => {
    const fenced = '```json\n' + JSON.stringify(obj) + '\n```';
    expect(parseAiJson(fenced)).toEqual(obj);
    const bareFenced = '```\n' + JSON.stringify(obj) + '\n```';
    expect(parseAiJson(bareFenced)).toEqual(obj);
  });

  it('extracts the first-to-last brace block when prose surrounds the JSON', () => {
    const wrapped = `Here is your analysis:\n${JSON.stringify(obj)}\nHope this helps!`;
    expect(parseAiJson(wrapped)).toEqual(obj);
  });

  it('throws when no JSON object can be found', () => {
    expect(() => parseAiJson('no json here at all')).toThrow(/No JSON object found/);
  });
});

describe('sanitizeRatingCorrelations', () => {
  it('keeps only numeric ratings between 1 and 5', () => {
    const parsed: Record<string, unknown> = {
      ratingCorrelations: [
        { factor: 'keep', averageRating: 4.5 },
        { factor: 'zero', averageRating: 0 },
        { factor: 'high', averageRating: 9 },
        { factor: 'negative', averageRating: -2 },
        { factor: 'string', averageRating: '4' },
        { factor: 'missing' },
      ],
    };
    sanitizeRatingCorrelations(parsed);
    expect(parsed.ratingCorrelations).toEqual([{ factor: 'keep', averageRating: 4.5 }]);
  });

  it('leaves other shapes untouched', () => {
    const missing: Record<string, unknown> = {};
    sanitizeRatingCorrelations(missing);
    expect(missing).toEqual({});

    const notArray: Record<string, unknown> = { ratingCorrelations: 'nope' };
    sanitizeRatingCorrelations(notArray);
    expect(notArray.ratingCorrelations).toBe('nope');
  });
});
