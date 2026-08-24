import { describe, it, expect } from 'vitest';
import { localTextAnalysis } from './local-analysis.js';
import { stripMarkdown, topicRatingsFor } from './lexicon.js';

function entry(content: string, rating = 3, id = 'e1') {
  return { id, uid: 'u', content, rating, entryDate: '2026-07-01' };
}

describe('stripMarkdown', () => {
  it('removes images, links, emphasis markers, and collapses whitespace', () => {
    const text = stripMarkdown('# Heading\n![alt](img.png)\n[link](url) **bold** `code` _it_');
    expect(text).toBe('heading bold code it');
  });

  it('lowercases output', () => {
    expect(stripMarkdown('HeLLo World')).toBe('hello world');
  });
});

describe('topicRatingsFor', () => {
  it('matches topics via substring keywords and collects ratings', () => {
    const ratings = topicRatingsFor([
      entry('gym workout done', 5, 'a'),
      entry('walk and health food', 1, 'b'),
      entry('unrelated content', 3, 'c'),
    ]);
    expect(ratings.health).toEqual([5, 1]);
    expect(Object.keys(ratings)).not.toContain('linux');
  });

  it('matches multiword phrases', () => {
    const ratings = topicRatingsFor([entry('went to bible study today', 4, 'a')]);
    expect(ratings.spiritual).toEqual([4]);
  });
});

describe('localTextAnalysis', () => {
  it('buckets keywords by high/low rated entries and filters stopwords and short words', () => {
    const result = localTextAnalysis([
      entry('alpha beta alpha the an ko na xy', 5, 'hi'),
      entry('gamma gamma delta the of in on at a', 1, 'lo'),
    ]);
    expect(result.keywordFrequencyByRating.highRated).toEqual({ alpha: 2, beta: 1 });
    expect(result.keywordFrequencyByRating.lowRated).toEqual({ gamma: 2, delta: 1 });
  });

  it('caps keyword frequency lists at 25 entries', () => {
    const words = Array.from({ length: 30 }, (_, i) => `w${String(i).padStart(2, '0')}`);
    const result = localTextAnalysis([entry(words.join(' '), 5, 'many')]);
    expect(Object.keys(result.keywordFrequencyByRating.highRated)).toHaveLength(25);
    // kept entries are the most frequent; all tied at 1 so just verify cap
  });

  it('counts English and Tagalog sentiment words', () => {
    const result = localTextAnalysis([
      entry('masaya grateful happy but pagod hirap sad', 4, 's'),
    ]);
    expect(result.sentimentVsRating.positiveWordCount).toBe(3);
    expect(result.sentimentVsRating.negativeWordCount).toBe(3);
    expect(result.sentimentVsRating.lexicalSentimentScore).toBe(0);
  });

  it('computes topic averages and overall average rating', () => {
    const result = localTextAnalysis([
      entry('gym session', 5, 'a'),
      entry('gym again plus stress pressure', 1, 'b'),
    ]);
    expect(result.topicAverages.health).toEqual({ count: 2, averageRating: 3 });
    expect(result.topicAverages.stress).toEqual({ count: 1, averageRating: 1 });
    expect(result.sentimentVsRating.averageRating).toBeCloseTo(3);
  });

  it('returns empty structures for entries without matches', () => {
    const result = localTextAnalysis([]);
    expect(result.source).toBe('local-fallback');
    expect(result.keywordFrequencyByRating.highRated).toEqual({});
    expect(result.topicAverages).toEqual({});
    expect(result.sentimentVsRating.averageRating).toBeNull();
  });
});
