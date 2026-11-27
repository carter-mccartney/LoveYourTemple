import { useState } from "react";
import type { Toast } from "../../App";
import type { Data } from "../../lib/useData";
import type { BibleRead, BibleTrack, NewBibleRead, Settings } from "../../lib/types";
import { dayKey, fmtTime } from "../../lib/dates";
import { TOTAL_CHAPTERS, fmtRef, type Ref } from "../../lib/bible/canon";
import { chapterEquivalents, chaptersFrom, chaptersSince, dailyGoal, dayTotals, nextInTrack, readRef, readsOn, streak } from "../../lib/bible/progress";
import { Modal } from "../../components/Modal";
import { Stat } from "../../components/Stat";
import { ReadEditor } from "./ReadEditor";
import { BookSelect, fmtChapters } from "./shared";
import { go } from "../../lib/router";

export function BibleToday({ data, toast }: { data: Data; toast: (t: Toast) => void }) {
  const { settings } = data;
  const reads = data.bible_reads;
  const today = dayKey(new Date());
  const goal = dailyGoal(settings.bible.tracks);
  const totals = dayTotals(reads, today);
  const [editing, setEditing] = useState<{ read?: BibleRead; initial?: Partial<NewBibleRead> } | null>(null);
  const [goalsOpen, setGoalsOpen] = useState(false);
  const todays = readsOn(reads, today);

  // A one-year plan starts on the "since" date, else the first day you logged within the last year.
  const yearAgo = Date.now() - 365 * 86400000;
  const firstRecent = [...reads].reverse().find((r) => new Date(r.read_at).getTime() >= yearAgo);
  const planStart = settings.bible.since
    ? new Date(`${settings.bible.since}T00:00:00`)
    : firstRecent
      ? new Date(new Date(firstRecent.read_at).setHours(0, 0, 0, 0))
      : new Date(new Date().setHours(0, 0, 0, 0));
  const planDays = Math.min(365, Math.max(1, (Date.now() - planStart.getTime()) / 86400000));
  const thisYear = chaptersSince(reads, planStart);
  const pace = (TOTAL_CHAPTERS / 365) * planDays;
  const planEnd = new Date(planStart.getTime() + 365 * 86400000);
  const due = data.memory_verses.filter((v) => v.due <= today).length;

  async function logRef(ref: Ref, track: string | null) {
    const row: NewBibleRead = {
      read_at: new Date().toISOString(),
      book: ref.book,
      chapter: ref.chapter,
      verse: ref.verse,
      end_chapter: ref.endChapter,
      end_verse: ref.endVerse,
      minutes: null,
      kind: "read",
      track,
      notes: "",
    };
    const added = await data.insert("bible_reads", [row]);
    if (added?.[0]) toast({ msg: `Logged ${fmtRef(ref)}`, action: { label: "Add notes", run: () => setEditing({ read: added[0] }) } });
  }

  return (
    <div className="stack">
      <section className="card">
        <div className="progress-head">
          <div>
            <div className="eyebrow">Today's reading</div>
            <div className="hero">
              {fmtChapters(totals.total)}
              {goal > 0 && <span className="of"> / {goal} chapters</span>}
            </div>
          </div>
          <div className="right">
            <div className="stat-value">{streak(reads, settings)}</div>
            <div className="stat-label">day streak</div>
          </div>
        </div>
        {goal > 0 && (
          <div className={`bar ${totals.total >= goal - 0.01 ? "met" : ""}`}>
            <div style={{ width: `${Math.min(1, totals.total / goal) * 100}%` }} />
          </div>
        )}
        <div className="stack tight">
          {settings.bible.tracks.map((t) => (
            <TrackRow key={t.id} track={t} reads={reads} done={totals.byTrack[t.id] ?? 0} onLog={logRef} onCustom={(initial) => setEditing({ initial })} />
          ))}
        </div>
        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn primary" onClick={() => setEditing({ initial: {} })}>+ Log reading</button>
          <button className="btn" onClick={() => setGoalsOpen(true)}>Goals</button>
        </div>
      </section>

      {todays.length > 0 && (
        <section className="card">
          <h2>Read today</h2>
          <ReadList reads={todays} onEdit={(r) => setEditing({ read: r })} />
        </section>
      )}

      <section className="card">
        <h2>Bible in a year</h2>
        <p className="hint" style={{ marginTop: 0 }}>
          Year started {planStart.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })} — change it under Goals.
        </p>
        <div className="stats-grid">
          <Stat label="Chapters so far" value={fmtChapters(thisYear)} sub={`of ${TOTAL_CHAPTERS.toLocaleString()} · ${Math.round((thisYear / TOTAL_CHAPTERS) * 100)}%`} />
          <Stat
            label="Pace"
            value={Math.abs(thisYear - pace) < 0.5 ? "On pace" : thisYear >= pace ? `+${fmtChapters(thisYear - pace)}` : `−${fmtChapters(pace - thisYear)}`}
            sub={Math.abs(thisYear - pace) < 0.5 ? "for a 1-year finish" : thisYear >= pace ? "chapters ahead of a 1-year pace" : "chapters behind a 1-year pace"}
          />
          <Stat
            label="Needed per day"
            value={(Math.max(0, TOTAL_CHAPTERS - thisYear) / Math.max(1, 365 - planDays)).toFixed(1)}
            sub={`to finish by ${planEnd.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}`}
          />
        </div>
        <button className="link small" onClick={() => go("bible", "progress")}>See what you've read →</button>
      </section>

      <section className="card row wrap">
        <div className="grow">
          <h2>Verse of the day</h2>
          <p className="muted small" style={{ margin: 0 }}>
            {data.memory_verses.length === 0 ? "Start memorizing — one verse a day adds up fast." : due ? `${due} verse${due === 1 ? "" : "s"} to review today.` : "All caught up — add a new verse?"}
          </p>
        </div>
        <button className="btn" onClick={() => go("bible", "memorize")}>{due ? "Practice" : "Memorize"}</button>
        <button className="btn" onClick={() => go("bible", "quiz")}>Bible challenge</button>
      </section>

      {editing && <ReadEditor data={data} read={editing.read} initial={editing.initial} onClose={() => setEditing(null)} />}
      {goalsOpen && <GoalsEditor data={data} onClose={() => setGoalsOpen(false)} />}
    </div>
  );
}

function TrackRow({
  track,
  reads,
  done,
  onLog,
  onCustom,
}: {
  track: BibleTrack;
  reads: BibleRead[];
  done: number;
  onLog: (r: Ref, track: string) => void;
  onCustom: (initial: Partial<NewBibleRead>) => void;
}) {
  const next = nextInTrack(reads, track.id);
  const [startBook, setStartBook] = useState(1);
  const left = Math.max(0, track.chaptersPerDay - done);
  const suggestion = next ? chaptersFrom(next, Math.max(1, Math.ceil(left || track.chaptersPerDay))) : null;
  return (
    <div className="track">
      <div className="row">
        <strong className="grow">{track.name}</strong>
        <span className={`small ${done >= track.chaptersPerDay - 0.01 ? "good-text" : "muted"}`}>
          {fmtChapters(done)} / {track.chaptersPerDay} today {done >= track.chaptersPerDay - 0.01 ? "✓" : ""}
        </span>
      </div>
      {suggestion ? (
        <div className="row wrap">
          <button className="btn" onClick={() => onLog(suggestion, track.id)}>
            ✓ Read {fmtRef(suggestion)}
          </button>
          <button
            className="link small"
            onClick={() => onCustom({ book: suggestion.book, chapter: suggestion.chapter, end_chapter: suggestion.endChapter, verse: suggestion.verse, track: track.id })}
          >
            Different passage…
          </button>
        </div>
      ) : (
        <div className="row wrap">
          <span className="small muted">Start with</span>
          <div style={{ minWidth: 180 }}>
            <BookSelect value={startBook} onChange={setStartBook} />
          </div>
          <button className="btn" onClick={() => onLog(chaptersFrom({ book: startBook, chapter: 1, verse: null, endChapter: 1, endVerse: null }, track.chaptersPerDay), track.id)}>
            ✓ Read {fmtRef(chaptersFrom({ book: startBook, chapter: 1, verse: null, endChapter: 1, endVerse: null }, track.chaptersPerDay))}
          </button>
        </div>
      )}
    </div>
  );
}

export function ReadList({ reads, onEdit, showDate }: { reads: BibleRead[]; onEdit: (r: BibleRead) => void; showDate?: boolean }) {
  return (
    <div className="read-list">
      {reads.map((r) => (
        <button key={r.id} className="read-row" onClick={() => onEdit(r)}>
          <span className="read-time">{showDate ? new Date(r.read_at).toLocaleDateString([], { month: "short", day: "numeric" }) + " · " : ""}{fmtTime(new Date(r.read_at))}</span>
          <span className="grow">
            <strong>{fmtRef(readRef(r))}</strong>
            {r.kind !== "read" && <span className="pill">{r.kind}</span>}
            {r.notes && <span className="read-notes">{r.notes}</span>}
          </span>
          <span className="muted small">
            {fmtChapters(chapterEquivalents(r))} ch{r.minutes ? ` · ${r.minutes} min` : ""}
          </span>
        </button>
      ))}
    </div>
  );
}

function GoalsEditor({ data, onClose }: { data: Data; onClose: () => void }) {
  const [b, setB] = useState<Settings["bible"]>(data.settings.bible);
  const setTrack = (i: number, p: Partial<BibleTrack>) => setB({ ...b, tracks: b.tracks.map((t, j) => (j === i ? { ...t, ...p } : t)) });
  return (
    <Modal title="Reading goals" onClose={onClose}>
      <div className="stack tight">
        <p className="hint" style={{ marginTop: 0 }}>
          Each goal is a reading track with its own place, e.g. 2 chapters a day in one book and 1 in another. Logging the “next” passage picks up where that track
          left off.
        </p>
        {b.tracks.map((t, i) => (
          <div key={t.id} className="row wrap">
            <label className="field grow">
              <span>Name</span>
              <input className="input" value={t.name} onChange={(e) => setTrack(i, { name: e.target.value })} />
            </label>
            <label className="field">
              <span>Chapters / day</span>
              <input className="input" type="number" min={0.5} step={0.5} value={t.chaptersPerDay} onChange={(e) => setTrack(i, { chaptersPerDay: Math.max(0.5, Number(e.target.value) || 1) })} style={{ width: 100 }} />
            </label>
            <button className="btn" onClick={() => setB({ ...b, tracks: b.tracks.filter((_, j) => j !== i) })} aria-label={`Remove ${t.name}`}>
              Remove
            </button>
          </div>
        ))}
        <button
          className="link"
          onClick={() => setB({ ...b, tracks: [...b.tracks, { id: Math.random().toString(36).slice(2, 8), name: `Track ${b.tracks.length + 1}`, chaptersPerDay: 1 }] })}
        >
          + Add a track
        </button>
        <p className="small muted" style={{ margin: 0 }}>Daily goal: {b.tracks.reduce((a, t) => a + t.chaptersPerDay, 0)} chapters</p>

        <label className="field">
          <span>Start date for Bible in a year and progress (blank = your first reading; progress from Jan 1)</span>
          <input className="input" type="date" value={b.since} onChange={(e) => setB({ ...b, since: e.target.value })} />
        </label>
        <label className="check block">
          <input type="checkbox" checked={b.hebrewsWithPaul} onChange={(e) => setB({ ...b, hebrewsWithPaul: e.target.checked })} /> Group Hebrews with Paul's letters (its
          author isn't named)
        </label>
        <div className="row end">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button
            className="btn primary"
            onClick={async () => {
              await data.saveSettings({ ...data.settings, bible: b });
              onClose();
            }}
          >
            Save
          </button>
        </div>
      </div>
    </Modal>
  );
}

