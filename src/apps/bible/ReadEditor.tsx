import { useState } from "react";
import type { Data } from "../../lib/useData";
import type { BibleRead, NewBibleRead, ReadKind } from "../../lib/types";
import { book, clampRef, fmtRef, parseRef, type Ref } from "../../lib/bible/canon";
import { chapterEquivalents } from "../../lib/bible/progress";
import { toLocalInput } from "../../lib/dates";
import { Modal } from "../../components/Modal";
import { BookSelect, fmtChapters } from "./shared";

const KINDS: { id: ReadKind; label: string }[] = [
  { id: "read", label: "Read" },
  { id: "study", label: "Study" },
  { id: "listen", label: "Listen" },
];

/** Add or edit a reading. `initial` pre-fills a new one (e.g. from a track's "next" button). */
export function ReadEditor({
  data,
  read,
  initial,
  onClose,
}: {
  data: Data;
  read?: BibleRead | null;
  initial?: Partial<NewBibleRead>;
  onClose: () => void;
}) {
  const start: NewBibleRead = read ?? {
    read_at: new Date().toISOString(),
    book: 1,
    chapter: 1,
    verse: null,
    end_chapter: 1,
    end_verse: null,
    minutes: null,
    kind: "read",
    track: null,
    notes: "",
    ...initial,
  };
  const [r, setR] = useState<NewBibleRead>(start);
  const [refText, setRefText] = useState(() => fmtRef(toRef(start)));
  const [refErr, setRefErr] = useState(false);
  const [busy, setBusy] = useState(false);
  const b = book(r.book);
  const patch = (p: Partial<NewBibleRead>) =>
    setR((prev) => {
      const next = { ...prev, ...p };
      const fixed = clampRef(toRef(next));
      const out = fixed ? { ...next, chapter: fixed.chapter, verse: fixed.verse, end_chapter: fixed.endChapter, end_verse: fixed.endVerse } : next;
      setRefText(fmtRef(toRef(out)));
      return out;
    });

  function applyRef(text: string) {
    const parsed = parseRef(text);
    setRefErr(!parsed && !!text.trim());
    if (parsed) patch({ book: parsed.book, chapter: parsed.chapter, verse: parsed.verse, end_chapter: parsed.endChapter, end_verse: parsed.endVerse });
  }

  async function save() {
    setBusy(true);
    const row = { ...r, notes: r.notes.trim() };
    if (read) await data.update("bible_reads", read.id, row);
    else await data.insert("bible_reads", [row]);
    setBusy(false);
    onClose();
  }

  const num = (v: string) => (v === "" ? null : Math.max(1, Math.round(Number(v))));
  const chapters = Array.from({ length: b.chapters }, (_, i) => i + 1);
  const tracks = data.settings.bible.tracks;

  return (
    <Modal title={read ? "Edit reading" : "Log reading"} onClose={onClose}>
      <div className="stack tight">
        <label className="field">
          <span>Passage — type it (“James 4”, “Gen 1-3”, “John 3:16-21”) or pick below</span>
          <input
            className="input"
            value={refText}
            onChange={(e) => setRefText(e.target.value)}
            onBlur={(e) => applyRef(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applyRef((e.target as HTMLInputElement).value)}
            aria-invalid={refErr}
          />
          {refErr && <span className="error-text small">Couldn't read that reference — try “James 4” or “1 Cor 13:4-7”.</span>}
        </label>
        <div className="row wrap">
          <label className="field grow">
            <span>Book</span>
            <BookSelect value={r.book} onChange={(n) => patch({ book: n, chapter: 1, end_chapter: 1, verse: null, end_verse: null })} />
          </label>
          <label className="field">
            <span>Chapter</span>
            <select className="input" value={r.chapter} onChange={(e) => patch({ chapter: +e.target.value, end_chapter: Math.max(+e.target.value, r.end_chapter) })}>
              {chapters.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>to</span>
            <select className="input" value={r.end_chapter} onChange={(e) => patch({ end_chapter: +e.target.value })}>
              {chapters.filter((c) => c >= r.chapter).map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="row wrap">
          <label className="field">
            <span>From verse (optional)</span>
            <input className="input" type="number" min={1} inputMode="numeric" value={r.verse ?? ""} placeholder="1" onChange={(e) => patch({ verse: num(e.target.value) })} />
          </label>
          <label className="field">
            <span>To verse</span>
            <input
              className="input"
              type="number"
              min={1}
              inputMode="numeric"
              value={r.end_verse ?? ""}
              placeholder={String(b.verses[r.end_chapter - 1])}
              onChange={(e) => patch({ end_verse: num(e.target.value) })}
            />
          </label>
          <p className="hint grow" style={{ alignSelf: "center" }}>
            {fmtChapters(chapterEquivalents({ ...r, id: "" }))} chapter{Math.abs(chapterEquivalents({ ...r, id: "" }) - 1) < 0.05 ? "" : "s"}' worth
          </p>
        </div>
        <div className="row wrap">
          <label className="field">
            <span>When</span>
            <input className="input" type="datetime-local" value={toLocalInput(new Date(r.read_at))} onChange={(e) => e.target.value && setR({ ...r, read_at: new Date(e.target.value).toISOString() })} />
          </label>
          <label className="field">
            <span>Minutes</span>
            <input className="input" type="number" min={0} inputMode="numeric" value={r.minutes ?? ""} onChange={(e) => setR({ ...r, minutes: e.target.value === "" ? null : +e.target.value })} style={{ width: 96 }} />
          </label>
          <div className="field">
            <span>Type</span>
            <div className="seg">
              {KINDS.map((k) => (
                <button key={k.id} className={r.kind === k.id ? "on" : ""} onClick={() => setR({ ...r, kind: k.id })}>
                  {k.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        {tracks.length > 0 && (
          <label className="field">
            <span>Counts toward</span>
            <select className="input" value={r.track ?? ""} onChange={(e) => setR({ ...r, track: e.target.value || null })}>
              <option value="">No particular goal</option>
              {tracks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.chaptersPerDay}/day)
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="field">
          <span>Notes</span>
          <textarea className="input" rows={3} value={r.notes} onChange={(e) => setR({ ...r, notes: e.target.value })} placeholder="What stood out, prayer, study notes…" />
        </label>
        <div className="row end">
          {read && (
            <button
              className="btn danger"
              onClick={async () => {
                await data.remove("bible_reads", [read.id]);
                onClose();
              }}
            >
              Delete
            </button>
          )}
          <span className="grow" />
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={busy || refErr} onClick={save}>
            Save
          </button>
        </div>
      </div>
    </Modal>
  );
}

export const toRef = (r: Pick<NewBibleRead, "book" | "chapter" | "verse" | "end_chapter" | "end_verse">): Ref => ({
  book: r.book,
  chapter: r.chapter,
  verse: r.verse,
  endChapter: r.end_chapter,
  endVerse: r.end_verse,
});
