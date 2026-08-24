import { defineString } from 'firebase-functions/params';
import { createTimeoutSignal } from '../shared/util.js';
import { localTextAnalysis } from './local-analysis.js';
import type {
  CalculatedHabitCorrelation,
  JournalInsightEntry,
  RemoteTextAnalysisResult,
  TextAnalysisResult,
} from './types.js';

const aiProvider = defineString('AI_PROVIDER', { default: 'gemini' });

export function getAiProvider(): string {
  return aiProvider.value();
}

interface GroqAPIResponse {
  choices: Array<{
    message: {
      content: string;
      role: string;
    };
    finish_reason: string;
    index: number;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface GeminiAPIResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
}

// Prompts follow the AI_PROMPT_* naming convention and live in functions/.env.<projectId>
function getSystemPrompt(): string {
  const prompt = process.env.AI_PROMPT_JOURNAL_ANALYSIS;
  if (!prompt || prompt.trim().length === 0) {
    throw new Error(
      'AI_PROMPT_JOURNAL_ANALYSIS env var is not set — add it to functions/.env.<projectId> and redeploy',
    );
  }
  return prompt;
}

interface AiProviderAdapter {
  source: RemoteTextAnalysisResult['source'];
  label: string;
  model: string;
  timeoutMs: number;
  endpoint(apiKey: string): string;
  headers(apiKey: string): Record<string, string>;
  body(systemPrompt: string, userContent: string): unknown;
  extractContent(data: unknown): string | undefined | null;
}

function prepareEntriesForAi(
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

function parseAiJson(content: string): unknown {
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
function sanitizeRatingCorrelations(parsed: Record<string, unknown>): void {
  if (!Array.isArray(parsed.ratingCorrelations)) return;
  parsed.ratingCorrelations = parsed.ratingCorrelations.filter(
    (factor) =>
      typeof (factor as { averageRating?: unknown })?.averageRating === 'number' &&
      (factor as { averageRating: number }).averageRating >= 1 &&
      (factor as { averageRating: number }).averageRating <= 5,
  );
}

async function analyzeWithProvider(
  adapter: AiProviderAdapter,
  entries: JournalInsightEntry[],
  habitCorrelations: CalculatedHabitCorrelation[],
  systemPrompt: string,
  apiKey: string,
): Promise<RemoteTextAnalysisResult> {
  const prepared = prepareEntriesForAi(entries, habitCorrelations, adapter.label);
  const timeout = createTimeoutSignal(adapter.timeoutMs);

  try {
    const response = await fetch(adapter.endpoint(apiKey), {
      method: 'POST',
      headers: adapter.headers(apiKey),
      body: JSON.stringify(
        adapter.body(systemPrompt, prepared.userContent),
      ),
      signal: timeout.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`${adapter.label} API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    const content = adapter.extractContent(data);

    if (!content) throw new Error(`Empty response from ${adapter.label} API`);

    let parsed: Record<string, unknown>;
    try {
      parsed = parseAiJson(content) as Record<string, unknown>;
      sanitizeRatingCorrelations(parsed);
    } catch (error) {
      console.error(`Failed to parse ${adapter.label} response as JSON. Raw output:`, content, error);
      throw new Error(`Invalid JSON response from ${adapter.label}`);
    }

    return {
      source: adapter.source,
      model: adapter.model,
      result: parsed,
      fallback: localTextAnalysis(entries),
    };
  } finally {
    timeout.cancel();
  }
}

const groqAdapter: AiProviderAdapter = {
  source: 'groq-api',
  label: 'Groq',
  model: 'llama-3.1-8b-instant',
  timeoutMs: 30_000,
  endpoint: () => 'https://api.groq.com/openai/v1/chat/completions',
  headers: (apiKey) => ({
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  }),
  body: (systemPrompt, userContent) => ({
    model: 'llama-3.1-8b-instant',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ],
    temperature: 0.3,
    max_tokens: 1000,
  }),
  extractContent: (data) => (data as GroqAPIResponse).choices?.[0]?.message?.content,
};

const geminiAdapter: AiProviderAdapter = {
  source: 'gemini-api',
  label: 'Gemini',
  model: 'gemini-2.5-flash',
  timeoutMs: 120_000,
  endpoint: (apiKey) =>
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
  headers: () => ({ 'Content-Type': 'application/json' }),
  body: (systemPrompt, userContent) => ({
    system_instruction: {
      parts: [{ text: systemPrompt }],
    },
    contents: [
      {
        parts: [{ text: userContent }],
      },
    ],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 15000,
    },
  }),
  extractContent: (data) =>
    (data as GeminiAPIResponse).candidates?.[0]?.content?.parts?.[0]?.text,
};

export async function callTextAnalysis(
  entries: JournalInsightEntry[],
  habitCorrelations: CalculatedHabitCorrelation[],
): Promise<TextAnalysisResult> {
  const provider = aiProvider.value();

  if (provider === 'groq') {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      console.log('GROQ_API_KEY not set, using local fallback');
      return localTextAnalysis(entries);
    }
    // Resolved outside the try/catch so a missing prompt fails loudly
    // instead of silently degrading to local analysis.
    const systemPrompt = getSystemPrompt();
    try {
      console.log(`Attempting Groq analysis for ${entries.length} entries`);
      return await analyzeWithProvider(groqAdapter, entries, habitCorrelations, systemPrompt, apiKey);
    } catch (error) {
      console.error('Groq analysis failed, using local fallback:', error);
      return localTextAnalysis(entries);
    }
  }

  // Default: Gemini
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.log('GEMINI_API_KEY not set, using local fallback');
    return localTextAnalysis(entries);
  }

  const systemPrompt = getSystemPrompt();

  try {
    console.log(`Attempting Gemini analysis for ${entries.length} entries`);
    return await analyzeWithProvider(geminiAdapter, entries, habitCorrelations, systemPrompt, apiKey);
  } catch (error) {
    console.error('Gemini analysis failed, using local fallback:', error);
    return localTextAnalysis(entries);
  }
}
