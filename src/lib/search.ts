export function normalizeQuery(q: string): string {
  return q
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length]!;
}

export interface Searchable {
  id: string;
  text: string;
}

/** Scores a document: exact/prefix token hits weigh most, then fuzzy (typo-tolerant) token matches. */
export function scoreMatch(query: string, text: string): number {
  const q = normalizeQuery(query);
  if (!q) return 0;
  const hay = normalizeQuery(text);
  if (hay.includes(q)) return 100 - Math.min(40, hay.indexOf(q));
  const words = hay.split(" ");
  let score = 0;
  for (const token of q.split(" ")) {
    if (words.some((w) => w.startsWith(token))) score += 20;
    else {
      const best = Math.min(...words.map((w) => levenshtein(token, w.slice(0, Math.max(token.length, 3)))));
      const tolerance = token.length <= 4 ? 1 : 2;
      if (best <= tolerance) score += 10 - best * 3;
      else return 0;
    }
  }
  return score;
}

export function didYouMean(query: string, vocabulary: readonly string[]): string | null {
  const q = normalizeQuery(query);
  if (q.length < 3) return null;
  let best: { word: string; d: number } | null = null;
  for (const word of vocabulary) {
    const d = levenshtein(q, normalizeQuery(word));
    if (d <= Math.max(2, Math.floor(q.length / 3)) && (!best || d < best.d)) best = { word, d };
  }
  return best && best.d > 0 ? best.word : null;
}
