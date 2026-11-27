// The 66 books: names, sections, chapter and verse counts (KJV versification, from
// public/bible via scripts/build_bible.py), and a forgiving reference parser.
import COUNTS from "./verse-counts.json";

export type SectionId = "law" | "history" | "poetry" | "major" | "minor" | "gospels" | "acts" | "paul" | "general" | "prophecy";

export interface Section {
  id: SectionId;
  name: string;
  testament: "OT" | "NT";
}

export const SECTIONS: Section[] = [
  { id: "law", name: "Law", testament: "OT" },
  { id: "history", name: "History", testament: "OT" },
  { id: "poetry", name: "Poetry & Wisdom", testament: "OT" },
  { id: "major", name: "Major Prophets", testament: "OT" },
  { id: "minor", name: "Minor Prophets", testament: "OT" },
  { id: "gospels", name: "Gospels", testament: "NT" },
  { id: "acts", name: "Church History", testament: "NT" },
  { id: "paul", name: "Paul's Letters", testament: "NT" },
  { id: "general", name: "General Letters", testament: "NT" },
  { id: "prophecy", name: "Prophecy", testament: "NT" },
];

export interface Book {
  /** 1 = Genesis … 66 = Revelation. */
  n: number;
  name: string;
  short: string;
  section: SectionId;
  /** Verses in each chapter (index 0 = chapter 1). */
  verses: number[];
  chapters: number;
  totalVerses: number;
}

// [name, short, section, extra aliases]
const RAW: [string, string, SectionId, string[]][] = [
  ["Genesis", "Gen", "law", ["ge", "gn"]],
  ["Exodus", "Exod", "law", ["ex", "exo"]],
  ["Leviticus", "Lev", "law", ["lv"]],
  ["Numbers", "Num", "law", ["nu", "nm"]],
  ["Deuteronomy", "Deut", "law", ["dt", "deu"]],
  ["Joshua", "Josh", "history", ["jos"]],
  ["Judges", "Judg", "history", ["jdg", "jg"]],
  ["Ruth", "Ruth", "history", ["ru", "rth"]],
  ["1 Samuel", "1 Sam", "history", ["1sa", "1 sm"]],
  ["2 Samuel", "2 Sam", "history", ["2sa", "2 sm"]],
  ["1 Kings", "1 Kgs", "history", ["1ki", "1 kin"]],
  ["2 Kings", "2 Kgs", "history", ["2ki", "2 kin"]],
  ["1 Chronicles", "1 Chr", "history", ["1ch", "1 chron"]],
  ["2 Chronicles", "2 Chr", "history", ["2ch", "2 chron"]],
  ["Ezra", "Ezra", "history", ["ezr"]],
  ["Nehemiah", "Neh", "history", ["ne"]],
  ["Esther", "Esth", "history", ["est", "es"]],
  ["Job", "Job", "poetry", ["jb"]],
  ["Psalms", "Ps", "poetry", ["psalm", "psa", "pss", "psm"]],
  ["Proverbs", "Prov", "poetry", ["pr", "prv", "pro"]],
  ["Ecclesiastes", "Eccl", "poetry", ["ec", "ecc", "qoh"]],
  ["Song of Solomon", "Song", "poetry", ["song of songs", "sos", "ss", "canticles"]],
  ["Isaiah", "Isa", "major", ["is"]],
  ["Jeremiah", "Jer", "major", ["je", "jr"]],
  ["Lamentations", "Lam", "major", ["la"]],
  ["Ezekiel", "Ezek", "major", ["eze", "ezk"]],
  ["Daniel", "Dan", "major", ["da", "dn"]],
  ["Hosea", "Hos", "minor", ["ho"]],
  ["Joel", "Joel", "minor", ["jl"]],
  ["Amos", "Amos", "minor", ["am"]],
  ["Obadiah", "Obad", "minor", ["ob"]],
  ["Jonah", "Jonah", "minor", ["jon", "jnh"]],
  ["Micah", "Mic", "minor", ["mi"]],
  ["Nahum", "Nah", "minor", ["na"]],
  ["Habakkuk", "Hab", "minor", ["hb"]],
  ["Zephaniah", "Zeph", "minor", ["zep", "zp"]],
  ["Haggai", "Hag", "minor", ["hg"]],
  ["Zechariah", "Zech", "minor", ["zec", "zc"]],
  ["Malachi", "Mal", "minor", ["ml"]],
  ["Matthew", "Matt", "gospels", ["mt", "mat"]],
  ["Mark", "Mark", "gospels", ["mk", "mr", "mrk"]],
  ["Luke", "Luke", "gospels", ["lk", "luk"]],
  ["John", "John", "gospels", ["jn", "jhn"]],
  ["Acts", "Acts", "acts", ["ac", "act"]],
  ["Romans", "Rom", "paul", ["ro", "rm"]],
  ["1 Corinthians", "1 Cor", "paul", ["1co"]],
  ["2 Corinthians", "2 Cor", "paul", ["2co"]],
  ["Galatians", "Gal", "paul", ["ga"]],
  ["Ephesians", "Eph", "paul", ["ephes"]],
  ["Philippians", "Phil", "paul", ["php", "pp"]],
  ["Colossians", "Col", "paul", ["co"]],
  ["1 Thessalonians", "1 Thess", "paul", ["1th", "1 thes"]],
  ["2 Thessalonians", "2 Thess", "paul", ["2th", "2 thes"]],
  ["1 Timothy", "1 Tim", "paul", ["1ti"]],
  ["2 Timothy", "2 Tim", "paul", ["2ti"]],
  ["Titus", "Titus", "paul", ["ti", "tit"]],
  ["Philemon", "Phlm", "paul", ["phm", "philem"]],
  ["Hebrews", "Heb", "general", ["he"]],
  ["James", "Jas", "general", ["jm", "jms"]],
  ["1 Peter", "1 Pet", "general", ["1pe", "1 pt"]],
  ["2 Peter", "2 Pet", "general", ["2pe", "2 pt"]],
  ["1 John", "1 John", "general", ["1jn", "1 jhn"]],
  ["2 John", "2 John", "general", ["2jn", "2 jhn"]],
  ["3 John", "3 John", "general", ["3jn", "3 jhn"]],
  ["Jude", "Jude", "general", ["jud", "jd"]],
  ["Revelation", "Rev", "prophecy", ["re", "revelations", "apocalypse"]],
];

export const BOOKS: Book[] = RAW.map(([name, short, section], i) => {
  const verses = (COUNTS as number[][])[i];
  return { n: i + 1, name, short, section, verses, chapters: verses.length, totalVerses: verses.reduce((a, b) => a + b, 0) };
});

export const TOTAL_CHAPTERS = BOOKS.reduce((a, b) => a + b.chapters, 0); // 1189
export const TOTAL_VERSES = BOOKS.reduce((a, b) => a + b.totalVerses, 0); // 31102
export const book = (n: number) => BOOKS[n - 1];
export const HEBREWS = 58;

/** Hebrews' author isn't named; the app can group it with Paul's letters if you prefer. */
export function sectionOf(b: Book, hebrewsWithPaul: boolean): SectionId {
  return b.n === HEBREWS && hebrewsWithPaul ? "paul" : b.section;
}
export const booksIn = (s: SectionId, hebrewsWithPaul: boolean) => BOOKS.filter((b) => sectionOf(b, hebrewsWithPaul) === s);

// ---------- Global verse index (0 … 31101), for fast coverage counting ----------

/** Offset of each book's first verse, and of each chapter's first verse within its book. */
export const BOOK_OFFSET: number[] = [];
export const CHAPTER_OFFSET: number[][] = [];
{
  let o = 0;
  for (const b of BOOKS) {
    BOOK_OFFSET.push(o);
    let c = 0;
    CHAPTER_OFFSET.push(b.verses.map((v) => ((c += v), c - v)));
    o += b.totalVerses;
  }
}
export const verseIndex = (bookN: number, chapter: number, verse: number) => BOOK_OFFSET[bookN - 1] + CHAPTER_OFFSET[bookN - 1][chapter - 1] + verse - 1;

// ---------- References ----------

export interface Ref {
  book: number;
  chapter: number;
  verse: number | null;
  endChapter: number;
  endVerse: number | null;
}

const norm = (s: string) => s.toLowerCase().replace(/\./g, "").replace(/^(i{1,3})\s+/, (m) => `${m.trim().length} `).replace(/\s+/g, " ").trim();
const ALIASES: [string, number][] = RAW.flatMap(([name, short, , extra], i) =>
  [name, short, ...extra].map((a) => [norm(a).replace(/^(\d) /, "$1"), i + 1] as [string, number]),
).sort((a, b) => b[0].length - a[0].length);

/** "jas" → James, "1 cor" / "1cor" / "I Corinthians" → 1 Corinthians, "phil" → Philippians. */
export function findBook(text: string): Book | null {
  const t = norm(text).replace(/^(\d) /, "$1");
  if (!t) return null;
  const exact = ALIASES.find(([a]) => a === t);
  if (exact) return book(exact[1]);
  // Unique prefix of a full name ("philip" → Philippians, but "phil" alone is handled as an alias).
  const hits = BOOKS.filter((b) => norm(b.name).replace(/^(\d) /, "$1").startsWith(t));
  return hits.length === 1 ? hits[0] : null;
}

/**
 * Parse "James 4", "Gen 1-3", "John 3:16", "Rom 8:28-39", "Ps 119:1-24", "1 Cor 13", "Matt 5:1-7:29".
 * A missing verse means the whole chapter.
 */
export function parseRef(input: string): Ref | null {
  const m = norm(input).match(/^(\d?\s?[a-z][a-z ]*?)\s*(\d+)(?::(\d+))?(?:\s*[-–]\s*(\d+)(?::(\d+))?)?$/);
  if (!m) {
    const b = findBook(input);
    return b ? { book: b.n, chapter: 1, verse: null, endChapter: b.chapters, endVerse: null } : null; // whole book
  }
  const b = findBook(m[1]);
  if (!b) return null;
  const chapter = +m[2];
  let verse = m[3] ? +m[3] : null;
  let endChapter = chapter;
  let endVerse: number | null = verse;
  if (m[4]) {
    if (m[5]) {
      endChapter = +m[4];
      endVerse = +m[5];
    } else if (verse != null) endVerse = +m[4];
    else endChapter = +m[4];
  }
  if (b.chapters === 1 && m[3] == null && !m[4] && chapter > 1) {
    // "Jude 3" means verse 3 of the only chapter.
    verse = endVerse = chapter;
    return clampRef({ book: b.n, chapter: 1, verse, endChapter: 1, endVerse });
  }
  return clampRef({ book: b.n, chapter, verse, endChapter, endVerse });
}

export function clampRef(r: Ref): Ref | null {
  const b = book(r.book);
  if (!b || r.chapter < 1 || r.chapter > b.chapters) return null;
  const endChapter = Math.min(Math.max(r.endChapter, r.chapter), b.chapters);
  const verse = r.verse == null ? null : Math.min(Math.max(1, r.verse), b.verses[r.chapter - 1]);
  let endVerse = r.endVerse == null ? null : Math.min(Math.max(1, r.endVerse), b.verses[endChapter - 1]);
  if (endChapter === r.chapter && verse != null && endVerse != null && endVerse < verse) endVerse = verse;
  return { book: r.book, chapter: r.chapter, verse, endChapter, endVerse };
}

/** "James 4", "Genesis 1–3", "John 3:16–21", "Matthew 5:1–7:29". */
export function fmtRef(r: Ref, short = false): string {
  const b = book(r.book);
  const name = short ? b.short : b.name;
  const whole = (c: number, v: number | null, end: boolean) => v == null || (end ? v === b.verses[c - 1] : v === 1);
  if (r.chapter === 1 && r.endChapter === b.chapters && whole(1, r.verse, false) && whole(r.endChapter, r.endVerse, true) && b.chapters > 1) return name;
  if (r.verse == null && r.endVerse == null) return r.endChapter === r.chapter ? `${name} ${r.chapter}` : `${name} ${r.chapter}–${r.endChapter}`;
  const v1 = r.verse ?? 1;
  const v2 = r.endVerse ?? b.verses[r.endChapter - 1];
  if (r.endChapter === r.chapter) return v1 === v2 ? `${name} ${r.chapter}:${v1}` : `${name} ${r.chapter}:${v1}–${v2}`;
  return `${name} ${r.chapter}:${v1}–${r.endChapter}:${v2}`;
}

/** Every verse a reference covers, as global indexes [from, to] inclusive. */
export function refSpan(r: Ref): [number, number] {
  const b = book(r.book);
  const from = verseIndex(r.book, r.chapter, r.verse ?? 1);
  const to = verseIndex(r.book, r.endChapter, r.endVerse ?? b.verses[r.endChapter - 1]);
  return [from, Math.max(from, to)];
}
