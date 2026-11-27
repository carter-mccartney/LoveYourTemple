// Turns reading logs into coverage: how many times each of the 31,102 verses was read,
// and from that, progress per chapter, book, section and the whole Bible.
import type { BibleRead, BibleTrack, Settings } from "../types";
import { dayKey } from "../dates";
import { BOOKS, BOOK_OFFSET, CHAPTER_OFFSET, TOTAL_VERSES, book, booksIn, clampRef, refSpan, type Book, type Ref, type SectionId } from "./canon";

export const readRef = (r: Pick<BibleRead, "book" | "chapter" | "verse" | "end_chapter" | "end_verse">): Ref =>
  clampRef({ book: r.book, chapter: r.chapter, verse: r.verse, endChapter: r.end_chapter, endVerse: r.end_verse }) ?? {
    book: r.book,
    chapter: 1,
    verse: null,
    endChapter: 1,
    endVerse: null,
  };

/** Start of the progress period: the "since" setting, else Jan 1 of this year. */
export function periodStart(settings: Settings, mode: "period" | "all"): Date | null {
  if (mode === "all") return null;
  const s = settings.bible.since;
  return s ? new Date(`${s}T00:00:00`) : new Date(new Date().getFullYear(), 0, 1);
}

/** Times each verse was read (index = global verse index). */
export function coverage(reads: BibleRead[], since: Date | null): Uint16Array {
  const counts = new Uint16Array(TOTAL_VERSES);
  const from = since?.getTime() ?? -Infinity;
  for (const r of reads) {
    if (new Date(r.read_at).getTime() < from) continue;
    const [a, b] = refSpan(readRef(r));
    for (let i = a; i <= b; i++) if (counts[i] < 65535) counts[i]++;
  }
  return counts;
}

export interface Progress {
  read: number; // verses read at least once
  total: number;
  pct: number; // 0–1
  /** Times the whole thing has been read (least-read verse). */
  times: number;
}

function span(counts: Uint16Array, from: number, len: number): Progress {
  let read = 0;
  let min = Infinity;
  for (let i = from; i < from + len; i++) {
    if (counts[i]) read++;
    if (counts[i] < min) min = counts[i];
  }
  return { read, total: len, pct: len ? read / len : 0, times: len ? min : 0 };
}

export const chapterProgress = (counts: Uint16Array, b: Book, ch: number) =>
  span(counts, BOOK_OFFSET[b.n - 1] + CHAPTER_OFFSET[b.n - 1][ch - 1], b.verses[ch - 1]);
export const bookProgress = (counts: Uint16Array, b: Book) => span(counts, BOOK_OFFSET[b.n - 1], b.totalVerses);

export function groupProgress(counts: Uint16Array, books: Book[]): Progress & { chaptersRead: number; chapters: number; booksDone: number } {
  let read = 0;
  let total = 0;
  let chaptersRead = 0;
  let chapters = 0;
  let booksDone = 0;
  let times = Infinity;
  for (const b of books) {
    const p = bookProgress(counts, b);
    read += p.read;
    total += p.total;
    times = Math.min(times, p.times);
    if (p.pct === 1) booksDone++;
    chapters += b.chapters;
    for (let c = 1; c <= b.chapters; c++) if (chapterProgress(counts, b, c).pct === 1) chaptersRead++;
  }
  return { read, total, pct: total ? read / total : 0, times: total ? times : 0, chaptersRead, chapters, booksDone };
}

export const sectionProgress = (counts: Uint16Array, s: SectionId, hebrewsWithPaul: boolean) => groupProgress(counts, booksIn(s, hebrewsWithPaul));

/** 0 untouched · 1 started · 2 half · 3 almost (80–99%) · 4 complete. */
export type Tier = 0 | 1 | 2 | 3 | 4;
export function tier(pct: number): Tier {
  if (pct >= 1) return 4;
  if (pct >= 0.8) return 3;
  if (pct >= 0.5) return 2;
  if (pct > 0) return 1;
  return 0;
}
export const TIER_LABELS = ["Not started", "Started", "Half or more", "80–99%", "Complete"];

/** Chapters' worth of reading in one log: whole chapters count 1, partial ones their share of verses. */
export function chapterEquivalents(r: BibleRead): number {
  const ref = readRef(r);
  const b = book(ref.book);
  let sum = 0;
  for (let c = ref.chapter; c <= ref.endChapter; c++) {
    const n = b.verses[c - 1];
    const v1 = c === ref.chapter ? (ref.verse ?? 1) : 1;
    const v2 = c === ref.endChapter ? (ref.endVerse ?? n) : n;
    sum += (v2 - v1 + 1) / n;
  }
  return sum;
}

export const readsOn = (reads: BibleRead[], day: string) => reads.filter((r) => dayKey(new Date(r.read_at)) === day);

/** Chapters read on a day, per track id ("" = untracked). */
export function dayTotals(reads: BibleRead[], day: string) {
  const byTrack: Record<string, number> = {};
  let total = 0;
  for (const r of readsOn(reads, day)) {
    const n = chapterEquivalents(r);
    byTrack[r.track ?? ""] = (byTrack[r.track ?? ""] ?? 0) + n;
    total += n;
  }
  return { total, byTrack };
}

export const dailyGoal = (tracks: BibleTrack[]) => tracks.reduce((a, t) => a + t.chaptersPerDay, 0);

/** A day meets the goal when its total chapters reach the daily goal (any reading counts). */
export function metGoal(reads: BibleRead[], settings: Settings, day: string) {
  const goal = dailyGoal(settings.bible.tracks);
  const { total } = dayTotals(reads, day);
  return goal > 0 ? total >= goal - 0.01 : total > 0;
}

/** Consecutive goal days ending today (today counts only once it's met). */
export function streak(reads: BibleRead[], settings: Settings, now = new Date()) {
  const days = settings.bible.days;
  let n = 0;
  const d = new Date(now);
  if (!metGoal(reads, settings, dayKey(d))) d.setDate(d.getDate() - 1);
  for (let guard = 0; guard < 3660; guard++) {
    if (days.includes(d.getDay())) {
      if (!metGoal(reads, settings, dayKey(d))) break;
      n++;
    }
    d.setDate(d.getDate() - 1);
  }
  return n;
}

/** The chapter after the last one read in this track (or null if nothing logged yet). */
export function nextInTrack(reads: BibleRead[], trackId: string): Ref | null {
  const last = reads.find((r) => r.track === trackId); // newest first
  if (!last) return null;
  const ref = readRef(last);
  const b = book(ref.book);
  const finishedChapter = ref.endVerse == null || ref.endVerse >= b.verses[ref.endChapter - 1];
  if (!finishedChapter) return { book: b.n, chapter: ref.endChapter, verse: ref.endVerse! + 1, endChapter: ref.endChapter, endVerse: null };
  if (ref.endChapter < b.chapters) return { book: b.n, chapter: ref.endChapter + 1, verse: null, endChapter: ref.endChapter + 1, endVerse: null };
  const nb = BOOKS[b.n % 66]; // Revelation wraps to Genesis
  return { book: nb.n, chapter: 1, verse: null, endChapter: 1, endVerse: null };
}

/** `count` whole chapters starting at `from` (stays within the book). */
export function chaptersFrom(from: Ref, count: number): Ref {
  const b = book(from.book);
  const end = Math.min(b.chapters, from.chapter + Math.max(1, Math.round(count)) - 1);
  return { book: b.n, chapter: from.chapter, verse: from.verse, endChapter: end, endVerse: null };
}

/** Chapters (equivalent) read since a date. */
export function chaptersSince(reads: BibleRead[], since: Date | null) {
  const from = since?.getTime() ?? -Infinity;
  return reads.filter((r) => new Date(r.read_at).getTime() >= from).reduce((a, r) => a + chapterEquivalents(r), 0);
}
