import { useEffect, useState } from "react";
import type { Data } from "../../lib/useData";
import type { BibleRead, NewBibleRead } from "../../lib/types";
import { BOOKS, BOOK_OFFSET, CHAPTER_OFFSET, SECTIONS, TOTAL_CHAPTERS, book, booksIn, refSpan, sectionOf, type Book, type SectionId } from "../../lib/bible/canon";
import { bookProgress, chapterProgress, groupProgress, readRef, sectionProgress } from "../../lib/bible/progress";
import { passage, versionInfo, BUNDLED } from "../../lib/bible/text";
import { go } from "../../lib/router";
import { Stat } from "../../components/Stat";
import { ReadEditor } from "./ReadEditor";
import { ReadList } from "./Today";
import { PeriodToggle, TierLegend, periodLabel, tierClass, useCoverage, type Period } from "./shared";

const pctText = (p: number) => (p > 0 && p < 0.01 ? "<1%" : `${Math.floor(p * 100)}%`);

export function BibleProgress({ data, path }: { data: Data; path: string[] }) {
  const [period, setPeriod] = useState<Period>("period");
  const { counts } = useCoverage(data, period);
  const hwp = data.settings.bible.hebrewsWithPaul;
  const [sectionId, bookName] = path;
  const section = SECTIONS.find((s) => s.id === sectionId);
  const bk = bookName ? BOOKS.find((b) => String(b.n) === bookName) : undefined;

  const header = (
    <div className="row wrap">
      <nav className="crumbs grow" aria-label="Breadcrumb">
        <a href="#/bible/progress">Whole Bible</a>
        {section && (
          <>
            {" › "}
            <a href={`#/bible/progress/${section.id}`}>{section.name}</a>
          </>
        )}
        {bk && <> › {bk.name}</>}
      </nav>
      <PeriodToggle data={data} period={period} onChange={setPeriod} />
    </div>
  );

  if (bk) return (
    <div className="stack">
      {header}
      <BookView data={data} b={bk} counts={counts} period={period} />
    </div>
  );
  if (section)
    return (
      <div className="stack">
        {header}
        <SectionView data={data} id={section.id} counts={counts} hwp={hwp} />
      </div>
    );

  const all = groupProgress(counts, BOOKS);
  const ot = groupProgress(counts, BOOKS.slice(0, 39));
  const nt = groupProgress(counts, BOOKS.slice(39));
  return (
    <div className="stack">
      {header}
      <section className="card">
        <div className="progress-head">
          <div>
            <div className="eyebrow">Whole Bible · {periodLabel(data, period)}</div>
            <div className="hero">{pctText(all.pct)}</div>
          </div>
        </div>
        <div className="stats-grid" style={{ marginTop: 8 }}>
          <Stat label="Chapters read" value={all.chaptersRead.toLocaleString()} sub={`of ${TOTAL_CHAPTERS.toLocaleString()}`} />
          <Stat label="Verses read" value={all.read.toLocaleString()} sub={`of ${all.total.toLocaleString()}`} />
          <Stat label="Books complete" value={all.booksDone} sub="of 66" />
          <Stat label="Old / New Testament" value={`${pctText(ot.pct)} / ${pctText(nt.pct)}`} />
        </div>

        <h3 style={{ marginTop: 16 }}>By section</h3>
        <SectionBar counts={counts} hwp={hwp} />
      </section>

      <section className="card">
        <div className="row wrap">
          <h2 className="grow">Bible map</h2>
          <TierLegend />
        </div>
        <p className="hint" style={{ marginTop: 0 }}>Every square is a chapter. Tap a book to see its chapters and verses.</p>
        {(["OT", "NT"] as const).map((t) => (
          <div key={t} className="map-testament">
            <div className="eyebrow">{t === "OT" ? "Old Testament" : "New Testament"}</div>
            {SECTIONS.filter((s) => s.testament === t).map((s) => (
              <div key={s.id} className="map-section">
                <a className="map-section-name" href={`#/bible/progress/${s.id}`}>{s.name}</a>
                <div className="map-books">
                  {booksIn(s.id, hwp).map((b) => (
                    <a key={b.n} className="map-book" href={`#/bible/progress/${s.id}/${b.n}`} title={`${b.name} — ${pctText(bookProgress(counts, b).pct)}`}>
                      <span className="map-book-name">{b.short}</span>
                      <span className="map-cells">
                        {b.verses.map((_, i) => (
                          <i key={i} className={tierClass(chapterProgress(counts, b, i + 1).pct)} />
                        ))}
                      </span>
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))}
      </section>
    </div>
  );
}

/** One bar for the whole Bible, split into sections (width = share of verses), each filled by progress. */
function SectionBar({ counts, hwp }: { counts: Uint16Array; hwp: boolean }) {
  return (
    <div className="section-bar-wrap">
      <div className="section-bar" role="list">
        {SECTIONS.map((s) => {
          const p = sectionProgress(counts, s.id, hwp);
          return (
            <a
              key={s.id}
              role="listitem"
              href={`#/bible/progress/${s.id}`}
              className="section-seg"
              style={{ flexGrow: p.total }}
              title={`${s.name}: ${pctText(p.pct)} (${p.chaptersRead}/${p.chapters} chapters)`}
            >
              <span className={`section-fill ${tierClass(p.pct)}`} style={{ height: `${Math.max(p.pct > 0 ? 6 : 0, p.pct * 100)}%` }} />
            </a>
          );
        })}
      </div>
      <div className="section-list">
        {SECTIONS.map((s) => {
          const p = sectionProgress(counts, s.id, hwp);
          return (
            <a key={s.id} href={`#/bible/progress/${s.id}`} className="section-row">
              <i className={tierClass(p.pct)} />
              <span className="grow">
                {s.name} <span className="muted small">· {booksIn(s.id, hwp).length} books</span>
              </span>
              <span className="small">{p.chaptersRead}/{p.chapters} ch</span>
              <strong className="pct">{pctText(p.pct)}</strong>
            </a>
          );
        })}
      </div>
    </div>
  );
}

function SectionView({ data, id, counts, hwp }: { data: Data; id: SectionId; counts: Uint16Array; hwp: boolean }) {
  const s = SECTIONS.find((x) => x.id === id)!;
  const books = booksIn(id, hwp);
  const p = groupProgress(counts, books);
  return (
    <>
      <section className="card">
        <div className="eyebrow">{s.testament === "OT" ? "Old Testament" : "New Testament"}</div>
        <h1>{s.name}</h1>
        <div className="stats-grid">
          <Stat label="Read" value={pctText(p.pct)} sub={`${p.read.toLocaleString()} of ${p.total.toLocaleString()} verses`} />
          <Stat label="Chapters" value={`${p.chaptersRead}/${p.chapters}`} />
          <Stat label="Books complete" value={`${p.booksDone}/${books.length}`} />
        </div>
        {id === "general" && !hwp && <p className="hint">Hebrews is here because its author isn't named. You can group it with Paul's letters under Goals.</p>}
        {id === "paul" && hwp && <p className="hint">Includes Hebrews (author debated). Change this under Goals.</p>}
      </section>
      <div className="row wrap">
        <span className="grow" />
        <TierLegend />
      </div>
      <div className="book-tiles">
        {books.map((b) => {
          const bp = bookProgress(counts, b);
          return (
            <a key={b.n} className={`book-tile ${tierClass(bp.pct)}`} href={`#/bible/progress/${id}/${b.n}`}>
              <span className="book-tile-name">{b.name}</span>
              <span className="book-tile-pct">{pctText(bp.pct)}</span>
              <span className="book-tile-sub">
                {b.chapters} ch{bp.times > 1 ? ` · read ${bp.times}×` : ""}
              </span>
              <span className="book-strip">
                {b.verses.map((_, i) => (
                  <i key={i} className={tierClass(chapterProgress(counts, b, i + 1).pct)} />
                ))}
              </span>
            </a>
          );
        })}
      </div>
    </>
  );
}

function BookView({ data, b, counts, period }: { data: Data; b: Book; counts: Uint16Array; period: Period }) {
  const [chapter, setChapter] = useState<number | null>(null);
  const [editing, setEditing] = useState<{ read?: BibleRead; initial?: Partial<NewBibleRead> } | null>(null);
  const bp = bookProgress(counts, b);
  const reads = data.bible_reads.filter((r) => r.book === b.n);
  const chapterTimes = b.verses.map((_, i) => chapterProgress(counts, b, i + 1));
  const fully = chapterTimes.filter((c) => c.pct === 1).length;
  const sec = SECTIONS.find((s) => s.id === sectionOf(b, data.settings.bible.hebrewsWithPaul))!;

  return (
    <>
      <section className="card">
        <div className="eyebrow">{sec.name}</div>
        <div className="row">
          <h1 className="grow">{b.name}</h1>
          <button className="btn primary" onClick={() => setEditing({ initial: { book: b.n, chapter: chapter ?? 1, end_chapter: chapter ?? 1 } })}>
            + Log reading
          </button>
        </div>
        <div className="stats-grid">
          <Stat label={periodLabel(data, period)} value={pctText(bp.pct)} sub={`${bp.read} of ${bp.total} verses`} />
          <Stat label="Chapters read" value={`${fully}/${b.chapters}`} />
          <Stat label="Times through" value={bp.times} sub="whole book" />
          <Stat label="Sessions" value={reads.length} sub={`${reads.reduce((a, r) => a + (r.minutes ?? 0), 0)} min logged`} />
        </div>
      </section>

      <section className="card">
        <div className="row wrap">
          <h2 className="grow">Chapters</h2>
          <TierLegend />
        </div>
        <div className="chapter-grid">
          {chapterTimes.map((c, i) => (
            <button
              key={i}
              className={`chapter-cell ${tierClass(c.pct)} ${chapter === i + 1 ? "on" : ""}`}
              onClick={() => setChapter(chapter === i + 1 ? null : i + 1)}
              title={`Chapter ${i + 1}: ${pctText(c.pct)}${c.times ? `, read ${c.times}×` : ""}`}
            >
              {i + 1}
              {c.times > 1 && <sup>{c.times}×</sup>}
            </button>
          ))}
        </div>
        {chapter && <ChapterDetail data={data} b={b} chapter={chapter} counts={counts} onLog={(initial) => setEditing({ initial })} />}
      </section>

      {reads.length > 0 && (
        <section className="card">
          <h2>Your log for {b.name}</h2>
          <ReadList reads={reads} onEdit={(r) => setEditing({ read: r })} showDate />
        </section>
      )}
      {editing && <ReadEditor data={data} read={editing.read} initial={editing.initial} onClose={() => setEditing(null)} />}
    </>
  );
}

/** Verse-by-verse view of one chapter: how often each verse was read, and the text. */
function ChapterDetail({ data, b, chapter, counts, onLog }: { data: Data; b: Book; chapter: number; counts: Uint16Array; onLog: (i: Partial<NewBibleRead>) => void }) {
  const n = b.verses[chapter - 1];
  const base = BOOK_OFFSET[b.n - 1] + CHAPTER_OFFSET[b.n - 1][chapter - 1];
  const times = Array.from({ length: n }, (_, i) => counts[base + i]);
  const max = Math.max(1, ...times);
  const [showText, setShowText] = useState(false);
  const [version, setVersion] = useState(BUNDLED.includes(data.settings.bible.version) ? data.settings.bible.version : "KJV");
  const [text, setText] = useState<[number, string][] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const notes = data.bible_reads.filter((r) => {
    if (r.book !== b.n || !r.notes) return false;
    const [a, z] = refSpan(readRef(r));
    return a <= base + n - 1 && z >= base;
  });

  useEffect(() => {
    if (!showText) return;
    setText(null);
    setErr(null);
    passage(version, { book: b.n, chapter, verse: null, endChapter: chapter, endVerse: null })
      .then((p) => setText(p[0]?.verses ?? []))
      .catch((e) => setErr((e as Error).message));
  }, [showText, version, b.n, chapter]);

  return (
    <div className="chapter-detail">
      <div className="row wrap">
        <h3 className="grow" style={{ margin: 0 }}>
          {b.name} {chapter}
        </h3>
        <button className="btn" onClick={() => onLog({ book: b.n, chapter, end_chapter: chapter })}>
          Log this chapter
        </button>
        <button className="btn" onClick={() => setShowText(!showText)}>{showText ? "Hide text" : "Read it"}</button>
      </div>
      <div className="verse-grid" aria-label="Verses, shaded by times read">
        {times.map((t, i) => (
          <span
            key={i}
            className={`verse-cell ${t ? "read" : "t0"}`}
            style={t ? { opacity: 0.45 + 0.55 * (t / max) } : undefined}
            title={`Verse ${i + 1}: ${t ? `read ${t}×` : "not read"}`}
          >
            {i + 1}
          </span>
        ))}
      </div>
      <p className="hint">Darker green = read more times. Most-read verse: {max > 1 || times.some(Boolean) ? `${max}×` : "—"}</p>
      {notes.length > 0 && (
        <div className="stack tight">
          <h3 style={{ margin: "8px 0 0" }}>Your notes</h3>
          {notes.map((r) => (
            <p key={r.id} className="note-line">
              <span className="muted small">{new Date(r.read_at).toLocaleDateString()} · </span>
              {r.notes}
            </p>
          ))}
        </div>
      )}
      {showText && (
        <div className="passage">
          <div className="row">
            <select className="input small-select" value={version} onChange={(e) => setVersion(e.target.value)}>
              {BUNDLED.map((v) => (
                <option key={v} value={v}>
                  {v} — {versionInfo(v).name}
                </option>
              ))}
            </select>
          </div>
          {err && <p className="error-text">{err}</p>}
          {!text && !err && <p className="muted">Loading…</p>}
          {text && (
            <p className="passage-text">
              {text.map(([v, t]) => (
                <span key={v} className={times[v - 1] ? "was-read" : ""}>
                  <sup>{v}</sup>
                  {t || <em className="muted">(not in this translation)</em>}{" "}
                </span>
              ))}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export const bookName = (n: number) => book(n).name;
export const openBook = (b: Book, hwp: boolean) => go("bible", "progress", sectionOf(b, hwp), String(b.n));
