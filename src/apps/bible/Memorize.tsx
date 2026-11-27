import { useEffect, useMemo, useState } from "react";
import type { Toast } from "../../App";
import type { Data } from "../../lib/useData";
import type { MemoryVerse, NewMemoryVerse } from "../../lib/types";
import { addDays, dayKey } from "../../lib/dates";
import { BOOKS, book, fmtRef, parseRef, type Book } from "../../lib/bible/canon";
import { VERSIONS, getVersionKey, loadBook, passageText, setVersionKey, versionInfo } from "../../lib/bible/text";
import { VersionPicker, quizVersions } from "./QuestionSettings";
import { firstLetters, gradeVerse, type Grade, type WordDiff } from "../../lib/bible/compare";
import { shuffle } from "../../lib/bible/questions";
import { Modal } from "../../components/Modal";
import { Stat } from "../../components/Stat";

const INTERVAL = [0, 1, 2, 4, 7, 14, 30]; // days until next review, by box
const MASTERED = 5;
const vref = (v: Pick<MemoryVerse, "book" | "chapter" | "verse" | "end_verse">) =>
  fmtRef({ book: v.book, chapter: v.chapter, verse: v.verse, endChapter: v.chapter, endVerse: v.end_verse ?? v.verse });

type Mode = "deck" | "practice" | "name" | "versions";

export function BibleMemorize({ data, toast }: { data: Data; toast: (t: Toast) => void }) {
  const deck = data.memory_verses;
  const today = dayKey(new Date());
  const due = deck.filter((v) => v.due <= today);
  const [mode, setMode] = useState<Mode>(deck.length ? (due.length ? "practice" : "deck") : "deck");
  const [adding, setAdding] = useState(false);
  const addedToday = deck.filter((v) => dayKey(new Date(v.added_at)) === today).length;

  return (
    <div className="stack">
      <div className="row">
        <h1 className="grow">Memorize</h1>
        <button className="btn primary" onClick={() => setAdding(true)}>+ Add verse</button>
      </div>
      <section className="card">
        <div className="stats-grid">
          <Stat label="Today's new verse" value={addedToday ? "✓ Added" : "Not yet"} sub="goal: one a day" />
          <Stat label="To review today" value={due.length} />
          <Stat label="Memorized" value={deck.filter((v) => v.box >= MASTERED).length} sub={`of ${deck.length} verses`} />
        </div>
      </section>
      <div className="seg scroll" role="tablist">
        {(
          [
            ["deck", "My verses"],
            ["practice", `Practice${due.length ? ` (${due.length})` : ""}`],
            ["name", "Name that verse"],
            ["versions", "Versions"],
          ] as [Mode, string][]
        ).map(([m, l]) => (
          <button key={m} className={mode === m ? "on" : ""} onClick={() => setMode(m)}>
            {l}
          </button>
        ))}
      </div>
      {mode === "deck" && <Deck data={data} onAdd={() => setAdding(true)} />}
      {mode === "practice" && <Practice data={data} toast={toast} />}
      {mode === "name" && <NameThatVerse data={data} />}
      {mode === "versions" && <Versions data={data} toast={toast} />}
      {adding && <AddVerse data={data} onClose={() => setAdding(false)} toast={toast} />}
    </div>
  );
}

function Boxes({ box }: { box: number }) {
  return (
    <span className="boxes" title={`Review level ${box} of 6`}>
      {Array.from({ length: 6 }, (_, i) => (
        <i key={i} className={i < box ? "on" : ""} />
      ))}
    </span>
  );
}

function Deck({ data, onAdd }: { data: Data; onAdd: () => void }) {
  const deck = data.memory_verses;
  const [open, setOpen] = useState<string | null>(null);
  if (!deck.length)
    return (
      <section className="card">
        <h2>Start your verse deck</h2>
        <p>Add one verse a day. You'll review each one on a schedule — tomorrow, then in 2 days, 4, a week, two weeks, a month — until it sticks.</p>
        <button className="btn primary" onClick={onAdd}>Add your first verse</button>
      </section>
    );
  return (
    <section className="card">
      <div className="verse-deck">
        {deck.map((v) => (
          <div key={v.id} className="verse-item">
            <button className="verse-item-head" onClick={() => setOpen(open === v.id ? null : v.id)}>
              <strong className="grow">{vref(v)}</strong>
              <span className="pill">{v.version}</span>
              <Boxes box={v.box} />
              <span className="muted small">{v.due <= dayKey(new Date()) ? "due" : `next ${new Date(`${v.due}T12:00:00`).toLocaleDateString([], { month: "short", day: "numeric" })}`}</span>
            </button>
            {open === v.id && (
              <div className="verse-item-body">
                <p className="verse-quote">{v.text}</p>
                <div className="row">
                  <span className="muted small grow">
                    Reviewed {v.reviews}× · right {v.correct}×
                  </span>
                  <button className="btn danger" onClick={() => data.remove("memory_verses", [v.id])}>
                    Remove
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function AddVerse({ data, onClose, toast }: { data: Data; onClose: () => void; toast: (t: Toast) => void }) {
  const [refText, setRefText] = useState("");
  const [version, setVersion] = useState(data.settings.bible.version);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const ref = parseRef(refText);
  const info = versionInfo(version);
  const single = ref && ref.chapter === ref.endChapter && ref.verse != null;

  async function lookup() {
    if (!ref) return;
    setBusy(true);
    setMsg(null);
    try {
      setText(await passageText(version, { ...ref, endVerse: ref.endVerse ?? ref.verse }));
    } catch (e) {
      setMsg((e as Error).message);
    }
    setBusy(false);
  }
  useEffect(() => {
    if (single && info.source !== "paste") lookup();
  }, [refText, version]); // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    if (!ref || !single || !text.trim()) return;
    const row: NewMemoryVerse = {
      book: ref.book,
      chapter: ref.chapter,
      verse: ref.verse!,
      end_verse: ref.endVerse && ref.endVerse !== ref.verse ? ref.endVerse : null,
      version,
      text: text.trim(),
      added_at: new Date().toISOString(),
      box: 0,
      due: dayKey(new Date()),
      reviews: 0,
      correct: 0,
      last_result: null,
    };
    if (await data.insert("memory_verses", [row])) {
      toast({ msg: `Added ${vref(row)} (${version})` });
      onClose();
    }
  }

  return (
    <Modal title="Add a verse to memorize" onClose={onClose}>
      <div className="stack tight">
        <div className="row wrap">
          <label className="field grow">
            <span>Reference (e.g. “James 4:7” or “Prov 3:5-6”)</span>
            <input className="input" value={refText} onChange={(e) => setRefText(e.target.value)} autoFocus />
          </label>
          <label className="field">
            <span>Version</span>
            <select className="input" value={version} onChange={(e) => setVersion(e.target.value)}>
              {VERSIONS.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.id}
                </option>
              ))}
            </select>
          </label>
        </div>
        {refText && !single && <p className="hint">Enter a verse or a short range within one chapter, like “John 3:16” or “Phil 4:6-7”.</p>}
        {single && <p className="hint">{fmtRef({ ...ref!, endVerse: ref!.endVerse ?? ref!.verse })} · {info.name}</p>}
        {info.source === "paste" && <p className="hint">{version} has no free lookup — copy the verse from your Bible app and paste it here.</p>}
        {info.source === "api" && !getVersionKey(version) && <p className="hint">Add your free {version} key under Versions to fill this in automatically, or paste the text.</p>}
        <label className="field">
          <span>Verse text</span>
          <textarea className="input" rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder={busy ? "Looking it up…" : "The verse text"} />
        </label>
        {msg && <p className="error-text small">{msg}</p>}
        <div className="row end">
          {info.source !== "paste" && (
            <button className="btn" disabled={!single || busy} onClick={lookup}>
              Look up again
            </button>
          )}
          <span className="grow" />
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={!single || !text.trim()} onClick={save}>
            Add verse
          </button>
        </div>
      </div>
    </Modal>
  );
}

function DiffView({ diff }: { diff: WordDiff[] }) {
  return (
    <p className="diff">
      {diff.map((d, i) => (
        <span key={i} className={`w-${d.status}`}>
          {d.word}{" "}
        </span>
      ))}
    </p>
  );
}

const GRADE_TEXT: Record<Grade, string> = { right: "Perfect!", close: "Almost — just a few slips", wrong: "Not yet — keep at it" };

function Practice({ data, toast }: { data: Data; toast: (t: Toast) => void }) {
  const today = dayKey(new Date());
  const [extra, setExtra] = useState(false);
  // Fix the queue when practice starts, so grading a card doesn't reshuffle the list.
  const queue = useMemo(
    () => {
      const due = data.memory_verses.filter((v) => v.due <= today);
      return shuffle(extra || !due.length ? data.memory_verses : due).map((v) => v.id);
    },
    [extra], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const [i, setI] = useState(0);
  const [typed, setTyped] = useState("");
  const [hint, setHint] = useState<"none" | "letters" | "show">("none");
  const [result, setResult] = useState<ReturnType<typeof gradeVerse> | null>(null);
  const v = data.memory_verses.find((x) => x.id === queue[i]);

  if (!data.memory_verses.length) return <section className="card">Add a verse first.</section>;
  if (!v)
    return (
      <section className="card">
        <h2>Done for today 🎉</h2>
        <p>You've reviewed every verse that was due.</p>
        <button className="btn" onClick={() => { setExtra(true); setI(0); }}>Practice all verses anyway</button>
      </section>
    );

  async function check() {
    const r = gradeVerse(typed, v!.text);
    setResult(r);
    const box = r.grade === "right" ? Math.min(6, v!.box + (hint === "none" ? 1 : 0)) : r.grade === "close" ? v!.box : 0;
    const days = r.grade === "wrong" ? 1 : Math.max(1, INTERVAL[box]);
    await data.update("memory_verses", v!.id, {
      box,
      due: dayKey(addDays(new Date(), days)),
      reviews: v!.reviews + 1,
      correct: v!.correct + (r.grade === "right" ? 1 : 0),
      last_result: r.grade,
    });
    if (box >= MASTERED && v!.box < MASTERED) toast({ msg: `${vref(v!)} memorized! 🎉` });
  }
  const next = () => {
    setI(i + 1);
    setTyped("");
    setResult(null);
    setHint("none");
  };

  return (
    <section className="card">
      <div className="row">
        <div className="grow">
          <div className="eyebrow">
            {i + 1} of {queue.length} · {v.version}
          </div>
          <h2 style={{ margin: 0 }}>{vref(v)}</h2>
        </div>
        <Boxes box={v.box} />
      </div>
      {hint !== "none" && !result && <p className="verse-quote muted">{hint === "letters" ? firstLetters(v.text) : v.text}</p>}
      <textarea
        className={`input verse-input ${result ? `g-${result.grade}` : ""}`}
        rows={5}
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        placeholder="Type the verse from memory…"
        disabled={!!result}
        autoFocus
      />
      {result ? (
        <>
          <p className={`grade g-${result.grade}`}>
            {GRADE_TEXT[result.grade]}
            {result.mistakes > 0 && ` (${result.mistakes} mistake${result.mistakes === 1 ? "" : "s"})`}
          </p>
          {result.grade !== "right" && <DiffView diff={result.diff} />}
          {result.grade !== "right" && (
            <p className="hint">
              <span className="w-missing">missed</span> · <span className="w-typo">typo</span> · <span className="w-extra">extra</span>
            </p>
          )}
          <button className="btn primary" onClick={next}>Next</button>
        </>
      ) : (
        <div className="row wrap" style={{ marginTop: 8 }}>
          <button className="btn primary" disabled={!typed.trim()} onClick={check}>Check</button>
          <button className="btn" onClick={() => setHint(hint === "letters" ? "show" : "letters")}>
            {hint === "letters" ? "Show the verse" : "Hint: first letters"}
          </button>
          <button className="link small" onClick={next}>Skip</button>
        </div>
      )}
    </section>
  );
}

// ---------- Name that verse ----------

type Level = "easy" | "normal" | "difficult" | "extreme";
const LEVELS: { id: Level; label: string; ask: string }[] = [
  { id: "easy", label: "Easy", ask: "Which version is this?" },
  { id: "normal", label: "Normal", ask: "Which book is it from?" },
  { id: "difficult", label: "Difficult", ask: "Which chapter?" },
  { id: "extreme", label: "Extreme", ask: "Which verse?" },
];

interface Puzzle {
  text: string;
  version: string;
  b: Book;
  chapter: number;
  verse: number;
  choices?: string[];
  answer: string;
}

async function makePuzzle(level: Level, source: "deck" | "bible", data: Data, versions: string[]): Promise<Puzzle> {
  let b: Book, chapter: number, verse: number, text: string, version: string;
  const deck = data.memory_verses;
  if (source === "deck" && deck.length) {
    const v = deck[Math.floor(Math.random() * deck.length)];
    b = book(v.book);
    chapter = v.chapter;
    verse = v.verse;
    text = v.text;
    version = v.version;
  } else {
    b = BOOKS[Math.floor(Math.random() * 66)];
    version = versions[Math.floor(Math.random() * versions.length)];
    const chapters = await loadBook(version, b.n);
    chapter = 1 + Math.floor(Math.random() * chapters.length);
    const vs = chapters[chapter - 1];
    verse = 1 + Math.floor(Math.random() * vs.length);
    text = vs[verse - 1];
    if (!text) return makePuzzle(level, source, data, versions); // a verse this translation omits
  }
  if (level === "easy") {
    // Choices are the versions you've turned on (just one if only one is on — your call).
    const others = shuffle(versions.filter((x) => x !== version)).slice(0, 3);
    return { text, version, b, chapter, verse, choices: shuffle([version, ...others]), answer: version };
  }
  if (level === "normal") {
    const others = shuffle(BOOKS.filter((x) => x.n !== b.n && x.n <= 39 === b.n <= 39)).slice(0, 3).map((x) => x.name);
    return { text, version, b, chapter, verse, choices: shuffle([b.name, ...others]), answer: b.name };
  }
  return { text, version, b, chapter, verse, answer: String(level === "difficult" ? chapter : verse) };
}

function NameThatVerse({ data }: { data: Data }) {
  const [level, setLevel] = useState<Level>("normal");
  const [source, setSource] = useState<"deck" | "bible">(data.memory_verses.length >= 4 ? "deck" : "bible");
  const [p, setP] = useState<Puzzle | null>(null);
  const [typed, setTyped] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const [score, setScore] = useState({ right: 0, total: 0 });
  const [err, setErr] = useState<string | null>(null);

  const load = () => {
    setP(null);
    setPicked(null);
    setTyped("");
    setErr(null);
    makePuzzle(level, source, data, versions).then(setP, (e) => setErr((e as Error).message));
  };
  const versions = quizVersions(data);
  useEffect(load, [level, source, versions.join()]); // eslint-disable-line react-hooks/exhaustive-deps

  const answer = (a: string) => {
    if (!p || picked) return;
    setPicked(a);
    const g = grade(a);
    setScore((s) => ({ right: s.right + (g === "right" ? 1 : 0), total: s.total + 1 }));
  };
  const grade = (a: string): Grade => {
    if (!p) return "wrong";
    if (a.trim().toLowerCase() === p.answer.toLowerCase()) return "right";
    if (!p.choices && Math.abs(Number(a) - Number(p.answer)) === 1) return "close";
    return "wrong";
  };
  const lv = LEVELS.find((l) => l.id === level)!;

  return (
    <section className="card">
      <div className="row wrap">
        <div className="seg">
          {LEVELS.map((l) => (
            <button key={l.id} className={level === l.id ? "on" : ""} onClick={() => setLevel(l.id)}>
              {l.label}
            </button>
          ))}
        </div>
        <span className="grow" />
        <select className="input small-select" value={source} onChange={(e) => setSource(e.target.value as "deck" | "bible")}>
          <option value="bible">Any verse in the Bible</option>
          <option value="deck" disabled={!data.memory_verses.length}>
            My memory verses
          </option>
        </select>
      </div>
      <details className="q-settings">
        <summary>Versions in questions: {versions.join(", ")}</summary>
        <VersionPicker data={data} />
      </details>
      <p className="muted small">
        Score this session: {score.right} / {score.total}
      </p>
      {err && <p className="error-text">{err}</p>}
      {!p ? (
        !err && <p className="muted">Finding a verse…</p>
      ) : (
        <>
          <h2>{lv.ask}</h2>
          {level === "difficult" && <p className="muted">From {p.b.name} ({p.b.chapters} chapters)</p>}
          {level === "extreme" && (
            <p className="muted">
              From {p.b.name} {p.chapter} ({p.b.verses[p.chapter - 1]} verses)
            </p>
          )}
          <blockquote className="verse-quote">{p.text}</blockquote>
          {p.choices ? (
            <div className="choice-grid">
              {p.choices.map((c) => (
                <button
                  key={c}
                  className={`btn choice ${picked ? (c === p.answer ? "g-right" : c === picked ? "g-wrong" : "") : ""}`}
                  onClick={() => answer(c)}
                  disabled={!!picked}
                >
                  {c}
                  {level === "easy" && <span className="muted small"> · {versionInfo(c).name}</span>}
                </button>
              ))}
            </div>
          ) : (
            <form
              className="row"
              onSubmit={(e) => {
                e.preventDefault();
                if (typed) answer(typed);
              }}
            >
              <input className={`input ${picked ? `g-${grade(picked)}` : ""}`} type="number" inputMode="numeric" min={1} value={typed} onChange={(e) => setTyped(e.target.value)} disabled={!!picked} style={{ width: 120 }} autoFocus />
              {!picked && <button className="btn primary">Check</button>}
            </form>
          )}
          {picked && (
            <>
              <p className={`grade g-${grade(picked)}`}>
                {grade(picked) === "right" ? "Correct!" : grade(picked) === "close" ? "So close — off by one." : "Not quite."} It's {p.b.name} {p.chapter}:{p.verse} ({p.version}).
              </p>
              <button className="btn primary" onClick={load}>Next verse</button>
            </>
          )}
        </>
      )}
    </section>
  );
}

// ---------- Versions & keys ----------

function Versions({ data, toast }: { data: Data; toast: (t: Toast) => void }) {
  return (
    <section className="card">
      <h2>Bible versions</h2>
      <label className="field">
        <span>Default version for reading, memorizing and quizzes</span>
        <select
          className="input"
          value={data.settings.bible.version}
          onChange={(e) => data.saveSettings({ ...data.settings, bible: { ...data.settings.bible, version: e.target.value } })}
        >
          {VERSIONS.map((v) => (
            <option key={v.id} value={v.id}>
              {v.id} — {v.name}
            </option>
          ))}
        </select>
      </label>
      <table className="table" style={{ marginTop: 12 }}>
        <tbody>
          {VERSIONS.map((v) => (
            <tr key={v.id}>
              <td><strong>{v.id}</strong></td>
              <td>{v.name}</td>
              <td className="small muted">
                {v.source === "bundled" ? "Built in, works offline" : v.source === "api" ? (getVersionKey(v.id) ? "Key saved ✓" : "Free key needed") : "Paste the text"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="hint">
        ESV, NKJV, NIV, NLT and The Message are copyrighted, so they can't be built into the app. ESV and NLT offer free personal keys; for the others, paste a verse's
        text when you add it. For a free built-in modern version, the BSB reads much like the NIV/ESV, and the AKJV is the KJV in modern words (like the NKJV).
      </p>
      <KeyBox version="ESV" signup="https://api.esv.org/" steps="Create a free account at api.esv.org → “Create an API key” (non-commercial) → copy the token." toast={toast} />
      <KeyBox version="NLT" signup="https://api.nlt.to/" steps="Sign up at api.nlt.to for a free key → copy it." toast={toast} />
      <p className="hint">Keys are saved only in this browser — never synced, shared, or put in the public code.</p>
    </section>
  );
}

function KeyBox({ version, signup, steps, toast }: { version: string; signup: string; steps: string; toast: (t: Toast) => void }) {
  const [key, setKey] = useState(() => getVersionKey(version));
  const [saved, setSaved] = useState(() => getVersionKey(version));
  return (
    <div className="field" style={{ marginTop: 12 }}>
      <span>
        {version} key —{" "}
        <a href={signup} target="_blank" rel="noreferrer">
          get one free
        </a>
      </span>
      <div className="row">
        <input className="input grow" value={key} onChange={(e) => setKey(e.target.value.trim())} placeholder={steps} autoComplete="off" spellCheck={false} />
        <button
          className="btn"
          disabled={key === saved}
          onClick={() => {
            setVersionKey(version, key);
            setSaved(key);
            toast({ msg: key ? `${version} key saved on this device` : `${version} key removed` });
          }}
        >
          Save
        </button>
      </div>
    </div>
  );
}
