import { useState } from "react";
import type { Toast } from "../../App";
import type { Data } from "../../lib/useData";
import type { NewReadingBook, ReadingBook } from "../../lib/types";
import { toLocalInput } from "../../lib/dates";
import { Modal } from "../../components/Modal";
import { Stat } from "../../components/Stat";

/** Progress = the furthest page/chapter you've logged. */
const position = (data: Data, b: ReadingBook) => Math.max(0, ...data.book_reads.filter((r) => r.book_id === b.id).map((r) => r.position));

export function BooksApp({ data, toast }: { data: Data; toast: (t: Toast) => void }) {
  const [editing, setEditing] = useState<ReadingBook | "new" | null>(null);
  const [logging, setLogging] = useState<ReadingBook | null>(null);
  const year = new Date().getFullYear();
  const reading = data.reading_books.filter((b) => !b.finished_at);
  const done = data.reading_books.filter((b) => b.finished_at);
  const doneThisYear = done.filter((b) => new Date(b.finished_at!).getFullYear() === year).length;
  const pagesThisYear = data.book_reads
    .filter((r) => new Date(r.read_at).getFullYear() === year)
    .reduce((sum, r) => {
      const prev = Math.max(0, ...data.book_reads.filter((x) => x.book_id === r.book_id && x.read_at < r.read_at).map((x) => x.position));
      return sum + Math.max(0, r.position - prev);
    }, 0);

  return (
    <div className="stack">
      <div className="row">
        <h1 className="grow">Other books</h1>
        <button className="btn primary" onClick={() => setEditing("new")}>+ Add a book</button>
      </div>
      <section className="card">
        <div className="stats-grid">
          <Stat label="Reading now" value={reading.length} />
          <Stat label={`Finished in ${year}`} value={doneThisYear} />
          <Stat label={`Pages read in ${year}`} value={pagesThisYear.toLocaleString()} />
        </div>
      </section>
      {data.reading_books.length === 0 && (
        <section className="card">
          <p>Track any book alongside your Bible reading — devotionals, theology, biographies. Add it with its page count, then log where you got to.</p>
        </section>
      )}
      {reading.map((b) => (
        <BookCard key={b.id} data={data} b={b} onLog={() => setLogging(b)} onEdit={() => setEditing(b)} />
      ))}
      {done.length > 0 && (
        <section className="card">
          <h2>Finished</h2>
          <table className="table">
            <tbody>
              {done.map((b) => (
                <tr key={b.id} onClick={() => setEditing(b)} style={{ cursor: "pointer" }}>
                  <td>
                    <strong>{b.title}</strong> <span className="muted small">{b.author}</span>
                  </td>
                  <td className="num small muted">{new Date(b.finished_at!).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
      {editing && <BookEditor data={data} b={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
      {logging && <LogBook data={data} b={logging} toast={toast} onClose={() => setLogging(null)} />}
    </div>
  );
}

function BookCard({ data, b, onLog, onEdit }: { data: Data; b: ReadingBook; onLog: () => void; onEdit: () => void }) {
  const pos = position(data, b);
  const pct = b.total ? Math.min(1, pos / b.total) : 0;
  const reads = data.book_reads.filter((r) => r.book_id === b.id);
  const last = reads[0];
  return (
    <section className="card">
      <div className="row">
        <div className="grow">
          <h2 style={{ margin: 0 }}>{b.title}</h2>
          {b.author && <div className="muted small">{b.author}</div>}
        </div>
        <button className="btn" onClick={onEdit}>Edit</button>
        <button className="btn primary" onClick={onLog}>Log</button>
      </div>
      <div className={`bar ${pct >= 1 ? "met" : ""}`}>
        <div style={{ width: `${pct * 100}%` }} />
      </div>
      <div className="row small muted">
        <span className="grow">
          {b.unit === "pages" ? "Page" : "Chapter"} {pos} of {b.total} · {Math.round(pct * 100)}%
        </span>
        {last && <span>last read {new Date(last.read_at).toLocaleDateString([], { month: "short", day: "numeric" })}</span>}
      </div>
      {reads.some((r) => r.notes) && (
        <details style={{ marginTop: 8 }}>
          <summary className="small">Notes</summary>
          {reads
            .filter((r) => r.notes)
            .map((r) => (
              <p key={r.id} className="note-line">
                <span className="muted small">
                  {new Date(r.read_at).toLocaleDateString()} · {b.unit === "pages" ? "p." : "ch."} {r.position} ·{" "}
                </span>
                {r.notes}
              </p>
            ))}
        </details>
      )}
    </section>
  );
}

function BookEditor({ data, b, onClose }: { data: Data; b: ReadingBook | null; onClose: () => void }) {
  const [f, setF] = useState<NewReadingBook>(b ?? { title: "", author: "", total: 200, unit: "pages", started_at: new Date().toISOString(), finished_at: null, notes: "" });
  const save = async () => {
    const row = { ...f, title: f.title.trim(), author: f.author.trim() };
    if (b) await data.update("reading_books", b.id, row);
    else await data.insert("reading_books", [row]);
    onClose();
  };
  return (
    <Modal title={b ? "Edit book" : "Add a book"} onClose={onClose}>
      <div className="stack tight">
        <label className="field">
          <span>Title</span>
          <input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} autoFocus />
        </label>
        <label className="field">
          <span>Author</span>
          <input className="input" value={f.author} onChange={(e) => setF({ ...f, author: e.target.value })} />
        </label>
        <div className="row wrap">
          <label className="field">
            <span>Length</span>
            <input className="input" type="number" min={1} value={f.total} onChange={(e) => setF({ ...f, total: Math.max(1, +e.target.value) })} style={{ width: 110 }} />
          </label>
          <label className="field">
            <span>Counted in</span>
            <select className="input" value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value as NewReadingBook["unit"] })}>
              <option value="pages">Pages</option>
              <option value="chapters">Chapters</option>
            </select>
          </label>
        </div>
        {b && (
          <label className="check block">
            <input type="checkbox" checked={!!f.finished_at} onChange={(e) => setF({ ...f, finished_at: e.target.checked ? new Date().toISOString() : null })} /> Finished
          </label>
        )}
        <div className="row end">
          {b && (
            <button
              className="btn danger"
              onClick={async () => {
                await data.remove("book_reads", data.book_reads.filter((r) => r.book_id === b.id).map((r) => r.id));
                await data.remove("reading_books", [b.id]);
                onClose();
              }}
            >
              Delete
            </button>
          )}
          <span className="grow" />
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={!f.title.trim()} onClick={save}>
            Save
          </button>
        </div>
      </div>
    </Modal>
  );
}

function LogBook({ data, b, toast, onClose }: { data: Data; b: ReadingBook; toast: (t: Toast) => void; onClose: () => void }) {
  const pos = position(data, b);
  const [to, setTo] = useState(Math.min(b.total, pos + (b.unit === "pages" ? 20 : 1)));
  const [minutes, setMinutes] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [when, setWhen] = useState(new Date());
  const save = async () => {
    await data.insert("book_reads", [{ book_id: b.id, read_at: when.toISOString(), position: to, minutes, notes: notes.trim() }]);
    if (to >= b.total) {
      await data.update("reading_books", b.id, { finished_at: when.toISOString() });
      toast({ msg: `Finished ${b.title}! 🎉` });
    } else toast({ msg: `${b.title}: ${b.unit === "pages" ? "page" : "chapter"} ${to}` });
    onClose();
  };
  return (
    <Modal title={b.title} onClose={onClose}>
      <div className="stack tight">
        <div className="row wrap">
          <label className="field">
            <span>Read up to {b.unit === "pages" ? "page" : "chapter"} (was {pos})</span>
            <input className="input" type="number" min={1} max={b.total} value={to} onChange={(e) => setTo(Math.min(b.total, Math.max(1, +e.target.value)))} style={{ width: 120 }} autoFocus />
          </label>
          <label className="field">
            <span>Minutes</span>
            <input className="input" type="number" min={0} value={minutes ?? ""} onChange={(e) => setMinutes(e.target.value === "" ? null : +e.target.value)} style={{ width: 96 }} />
          </label>
          <label className="field">
            <span>When</span>
            <input className="input" type="datetime-local" value={toLocalInput(when)} onChange={(e) => e.target.value && setWhen(new Date(e.target.value))} />
          </label>
        </div>
        <label className="field">
          <span>Notes</span>
          <textarea className="input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
        <div className="row end">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={save}>Save</button>
        </div>
      </div>
    </Modal>
  );
}
