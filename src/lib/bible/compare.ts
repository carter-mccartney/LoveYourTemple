// Grading typed answers: forgiving about case, punctuation and small typos.

export type Grade = "right" | "close" | "wrong";

const NUMBER_WORDS: Record<string, string> = {
  zero: "0", one: "1", two: "2", three: "3", four: "4", five: "5", six: "6", seven: "7", eight: "8", nine: "9", ten: "10",
  eleven: "11", twelve: "12", thirteen: "13", fourteen: "14", fifteen: "15", sixteen: "16", seventeen: "17", eighteen: "18",
  nineteen: "19", twenty: "20", thirty: "30", forty: "40", fifty: "50", seventy: "70", hundred: "100", first: "1", second: "2", third: "3",
};

/** Lowercase words without punctuation; "Thou" and "you" style differences are left alone. */
export function words(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[^a-z0-9' ]+/g, " ")
    .replace(/'/g, "")
    .split(/\s+/)
    .filter(Boolean);
}

const answerWords = (s: string) => words(s).map((w) => NUMBER_WORDS[w] ?? w).filter((w) => !["the", "a", "an", "of", "book"].includes(w));

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}

/** Short answers ("Moses", "40 days", "Sea of Galilee"). `answers` lists accepted forms. */
export function gradeAnswer(typed: string, answers: string[]): Grade {
  const t = answerWords(typed).join(" ");
  if (!t) return "wrong";
  let best: Grade = "wrong";
  for (const a of answers) {
    const w = answerWords(a).join(" ");
    if (!w) continue;
    if (t === w) return "right";
    // Typed the key word(s) inside a longer accepted answer, e.g. "Galilee" for "Sea of Galilee".
    if (w.split(" ").length > 1 && w.includes(t) && t.length >= 4) best = "close";
    const d = levenshtein(t, w);
    const allowed = w.length <= 4 ? 0 : w.length <= 8 ? 1 : 2;
    if (d <= allowed) return "right";
    if (d <= allowed + 2 && best === "wrong") best = "close";
  }
  return best;
}

export interface WordDiff {
  word: string;
  status: "ok" | "typo" | "missing" | "extra";
}

/**
 * Memory verse: compare word by word. Right = exact words (case and punctuation ignored).
 * Close = no more than 3 small mistakes (typos, a missing or extra word). Wrong = more.
 */
export function gradeVerse(typed: string, target: string): { grade: Grade; diff: WordDiff[]; mistakes: number } {
  const a = words(target);
  const b = words(typed);
  // Word-level alignment (LCS-style DP), treating near-identical words as a typo match.
  const n = a.length;
  const m = b.length;
  const cost = (x: string, y: string) => (x === y ? 0 : levenshtein(x, y) <= Math.max(1, Math.floor(x.length / 4)) ? 0.5 : 2);
  const dp: number[][] = Array.from({ length: n + 1 }, (_, i) => Array.from({ length: m + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= n; i++)
    for (let j = 1; j <= m; j++) dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost(a[i - 1], b[j - 1]));
  const diff: WordDiff[] = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && dp[i][j] === dp[i - 1][j - 1] + cost(a[i - 1], b[j - 1]) && cost(a[i - 1], b[j - 1]) < 2) {
      diff.unshift({ word: a[i - 1], status: a[i - 1] === b[j - 1] ? "ok" : "typo" });
      i--;
      j--;
    } else if (i > 0 && (j === 0 || dp[i][j] === dp[i - 1][j] + 1)) {
      diff.unshift({ word: a[i - 1], status: "missing" });
      i--;
    } else {
      diff.unshift({ word: b[j - 1], status: "extra" });
      j--;
    }
  }
  const mistakes = diff.filter((d) => d.status !== "ok").length;
  const grade: Grade = mistakes === 0 ? "right" : mistakes <= 3 && b.length > 0 ? "close" : "wrong";
  return { grade, diff, mistakes };
}

/** First letter of each word — a classic memorization hint. */
export const firstLetters = (text: string) =>
  text
    .split(/\s+/)
    .map((w) => w.replace(/^([^A-Za-z]*)([A-Za-z])[A-Za-z'’-]*/, "$1$2"))
    .join(" ");
