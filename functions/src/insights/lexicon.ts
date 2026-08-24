import type { JournalInsightEntry } from './types.js';

export function stripMarkdown(value: string): string {
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
  'ang', 'mga', 'ng', 'sa', 'si', 'ni', 'kay', 'nina', 'kina', 'ito', 'iyan',
  'iyon', 'nito', 'niyan', 'niyon', 'dito', 'diyan', 'doon', 'rito', 'riyan',
  'roon', 'ako', 'akin', 'ko', 'kami', 'atin', 'amin', 'kita', 'ikaw', 'ka',
  'iyo', 'mo', 'kayo', 'inyo', 'ninyo', 'siya', 'kaniya', 'niya', 'sila',
  'kanila', 'nila', 'na', 'nang', 'at', 'o', 'subalit', 'ngunit', 'pero',
  'kasi', 'dahil', 'upang', 'para', 'kaya', 'kapag', 'kung', 'habang', 'din',
  'rin', 'daw', 'raw', 'po', 'opo', 'lamang', 'lang', 'naman', 'pala', 'sana',
  'yata', 'ba', 'pa', 'isang', 'may', 'mayroon', 'wala', 'walang', 'mismo', 'akong', 'kong', 'mag'
]);

export const positiveWords = new Set([
  'good', 'great', 'happy', 'calm', 'clear', 'better', 'best', 'love', 'win',
  'progress', 'excited', 'grateful', 'proud', 'peace', 'easy', 'focused',
  'masaya', 'saya', 'maligaya', 'ligaya', 'mabuti', 'maayos', 'ok', 'okey',
  'maganda', 'ganda', 'magaling', 'galing', 'mahusay', 'husay', 'payapa',
  'tahimik', 'kalmado', 'panatag', 'malinaw', 'linaw', 'salamat', 'pagmamalaki',
  'magaan', 'tagumpay', 'panalo', 'pag-unlad', 'ginawa', 'bago', 'gising'
]);

export const negativeWords = new Set([
  'bad', 'sad', 'angry', 'tired', 'stress', 'stressed', 'anxious', 'worse',
  'worst', 'hate', 'lost', 'blocked', 'hard', 'heavy', 'lonely', 'pain',
  'malungkot', 'lungkot', 'sawi', 'pighati', 'hapis', 'galit', 'inis', 'yamot',
  'asar', 'poot', 'pagod', 'hapo', 'puyat', 'tamlay', 'nanghihina', 'kabado',
  'kaba', 'takot', 'pangamba', 'alala', 'balisa', 'mahirap', 'hirap', 'bigat',
  'mabigat', 'ayaw', 'sakit', 'dusa', 'lumbay', 'talo', 'bagsak', 'bigo', 'kabiguan'
]);

const topicKeywords: Record<string, string[]> = {
  linux: ['linux', 'ubuntu', 'debian', 'arch', 'kernel', 'terminal', 'shell'],
  clientWork: ['client', 'contract', 'invoice', 'meeting', 'deadline', 'project', 'work'],
  health: ['sleep', 'walk', 'gym', 'workout', 'food', 'junk', 'doctor', 'health', 'exercise'],
  relationships: ['friend', 'family', 'partner', 'call', 'dinner', 'message', 'socializing', 'date'],
  creativeWork: ['write', 'writing', 'design', 'music', 'photo', 'draw', 'idea'],
  spiritual: ['bible', 'prayer', 'KH', 'bible study', 'kingdom hall', 'congregation', 'kongregasyon', 'assembly', 'convention', 'kombensiyon', 'spiritual', 'meditation', 'god', 'jehovah'],
  stress: ['stress', 'pressure', 'deadlines', 'anxiety', 'worried'],
  routine: ['morning', 'routine', 'habit', 'schedule', 'planning'],
};

export function keywordCounts(entries: JournalInsightEntry[]): Record<string, number> {
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

export function topicRatingsFor(entries: JournalInsightEntry[]): Record<string, number[]> {
  const topicRatings: Record<string, number[]> = {};
  for (const entry of entries) {
    const text = stripMarkdown(entry.content);
    for (const [topic, keywords] of Object.entries(topicKeywords)) {
      if (keywords.some((keyword) => text.includes(keyword))) {
        topicRatings[topic] = [...(topicRatings[topic] ?? []), entry.rating];
      }
    }
  }
  return topicRatings;
}
