import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { callTextAnalysis } from './ai.js';
import type { CalculatedHabitCorrelation, JournalInsightEntry } from './types.js';

const PROMPT = 'You are a journal analysis assistant for tests.';

function entry(n: number): JournalInsightEntry {
  return {
    id: `e${n}`,
    uid: 'u',
    content: `Entry number ${n} about work and sleep`,
    rating: ((n % 5) + 1),
    entryDate: new Date(Date.UTC(2026, 6, n)).toISOString().slice(0, 10),
  };
}

const correlations: CalculatedHabitCorrelation[] = [
  {
    habitId: 'h1',
    habitName: 'Prayer',
    averageRatingOnCompletedDays: 4.2,
    averageRatingOnMissedDays: 2.8,
    completedDaysCount: 10,
    missedDaysCount: 4,
  },
];

type FetchStub = (url: string | URL | globalThis.Request, init?: RequestInit) => Promise<unknown>;

function stubFetch(impl: FetchStub) {
  const fetchMock = vi.fn(impl as unknown as typeof fetch);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function geminiResponse(text: string) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }),
    text: async () => text,
  };
}

function validAiJson(): string {
  return JSON.stringify({
    overallSentiment: 'positive',
    primaryEmotion: 'calm',
    keyThemes: ['work'],
    patterns: ['steady'],
    ratingCorrelations: [
      { factor: 'morning routine', impact: 'positive', averageRating: 4.5 },
      { factor: 'zero', impact: 'negative', averageRating: 0 },
      { factor: 'too-high', impact: 'negative', averageRating: 9 },
      { factor: 'non-numeric', impact: 'negative', averageRating: '4' },
    ],
    habitCorrelations: [{ habit: 'Prayer', insight: 'correlates with better days' }],
    briefSummary: 'an upward month',
  });
}

beforeEach(() => {
  vi.stubEnv('AI_PROMPT_JOURNAL_ANALYSIS', PROMPT);
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('callTextAnalysis — Gemini path', () => {
  it('sends the env prompt and returns sanitized parsed result plus fallback', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'test-key');
    const fetchMock = stubFetch(async () => geminiResponse('```json\n' + validAiJson() + '\n```'));

    const result = await callTextAnalysis([entry(1), entry(2)], correlations);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain('generativelanguage.googleapis.com');
    expect(url).toContain('key=test-key');
    expect(url).toContain('gemini-2.5-flash');
    const body = JSON.parse(init!.body as string);
    expect(body.system_instruction.parts[0].text).toBe(PROMPT);
    expect(body.generationConfig).toEqual({ temperature: 0.3, maxOutputTokens: 15000 });

    expect(result.source).toBe('gemini-api');
    if (result.source !== 'gemini-api') throw new Error('wrong branch');
    expect(result.model).toBe('gemini-2.5-flash');
    const ratingCorrelations = (
      result.result as { ratingCorrelations: Array<{ factor: string }> }
    ).ratingCorrelations;
    expect(ratingCorrelations).toHaveLength(1);
    expect(ratingCorrelations[0].factor).toBe('morning routine');
    expect(result.fallback.source).toBe('local-fallback');
    expect(result.fallback.sentimentVsRating.averageRating).toBeCloseTo(2.5);
  });

  it('falls back to local analysis when the API responds with an error status', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'test-key');
    stubFetch(async () => ({
      ok: false,
      status: 500,
      text: async () => 'boom',
      json: async () => ({}),
    }));

    const result = await callTextAnalysis([entry(1)], correlations);
    expect(result.source).toBe('local-fallback');
  });

  it('falls back to local analysis when the network fails', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'test-key');
    stubFetch(async () => {
      throw new Error('ECONNREFUSED');
    });

    const result = await callTextAnalysis([entry(1)], correlations);
    expect(result.source).toBe('local-fallback');
  });

  it('returns local fallback without calling fetch when the API key is missing', async () => {
    vi.stubEnv('GEMINI_API_KEY', '');
    const fetchMock = stubFetch(async () => geminiResponse(validAiJson()));

    const result = await callTextAnalysis([entry(1)], correlations);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.source).toBe('local-fallback');
  });

  it('throws (no silent fallback) when the prompt env var is missing', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'test-key');
    process.env.AI_PROMPT_JOURNAL_ANALYSIS = '';
    stubFetch(async () => geminiResponse(validAiJson()));

    await expect(callTextAnalysis([entry(1)], correlations)).rejects.toThrow(
      /AI_PROMPT_JOURNAL_ANALYSIS/,
    );
  });
});

describe('callTextAnalysis — Groq path', () => {
  it('uses the Groq endpoint, auth header, model, and token limit', async () => {
    vi.stubEnv('AI_PROVIDER', 'groq');
    vi.stubEnv('GROQ_API_KEY', 'groq-key');
    const fetchMock = stubFetch(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { role: 'assistant', content: validAiJson() }, finish_reason: 'stop', index: 0 }],
      }),
      text: async () => '',
    }));

    const result = await callTextAnalysis([entry(1)], correlations);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.groq.com/openai/v1/chat/completions');
    expect((init!.headers as Record<string, string>).Authorization).toBe('Bearer groq-key');
    const body = JSON.parse(init!.body as string);
    expect(body.model).toBe('llama-3.1-8b-instant');
    expect(body.max_tokens).toBe(1000);
    expect(body.temperature).toBe(0.3);
    expect(body.messages[0]).toEqual({ role: 'system', content: PROMPT });
    expect(String(body.messages[1].content)).toContain('"preCalculatedHabitCorrelations"');

    expect(result.source).toBe('groq-api');
    if (result.source !== 'groq-api') throw new Error('wrong branch');
    expect(result.model).toBe('llama-3.1-8b-instant');
  });
});
