import { useEffect, useRef, useState } from "react";
import type { Toast } from "../../App";
import type { Data } from "../../lib/useData";
import type { CustomCard } from "../../lib/types";
import { CATEGORIES, CURATED_COUNT, nextCard, type Category, type QCard } from "../../lib/bible/questions";
import { gradeAnswer, type Grade } from "../../lib/bible/compare";
import { QuestionSettings, quizVersions } from "./QuestionSettings";
import { Modal } from "../../components/Modal";
import { addAnswer, clearHistory, historySynced, loadHistory, regradeLast, syncHistory } from "../../lib/bible/history";

interface Tally {
  right: number;
  total: number;
  best: number;
}
const STATS_KEY = "lyt.quiz";
const loadStats = (): Tally => {
  try {
    return { right: 0, total: 0, best: 0, ...JSON.parse(localStorage.getItem(STATS_KEY) ?? "{}") };
  } catch {
    return { right: 0, total: 0, best: 0 };
  }
};
const saveStats = (t: Tally) => {
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(t));
  } catch {
    /* ignore */
  }
};

export function BibleQuiz({ data, toast }: { data: Data; toast: (t: Toast) => void }) {
  const [cats, setCats] = useState<Category[]>([]);
  const [card, setCard] = useState<QCard | null>(null);
  const [typed, setTyped] = useState("");
  const [result, setResult] = useState<{ grade: Grade; picked?: string } | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [session, setSession] = useState({ right: 0, total: 0, streak: 0 });
  const [stats, setStats] = useState(loadStats);
  const [err, setErr] = useState<string | null>(null);
  const [cardsOpen, setCardsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const recent = useRef(new Set<string>());
  const versions = quizVersions(data);
  const outside = data.settings.bible.outsideQuestions;

  const next = () => {
    setCard(null);
    setTyped("");
    setResult(null);
    setRevealed(false);
    setErr(null);
    nextCard(cats, { versions, outside, hebrewsWithPaul: data.settings.bible.hebrewsWithPaul, custom: data.settings.bible.customCards, recent: recent.current }).then(
      (c) => {
        recent.current.add(c.id);
        if (recent.current.size > 150) recent.current.delete(recent.current.values().next().value!);
        setCard(c);
      },
      (e) => setErr((e as Error).message),
    );
  };
  useEffect(next, [cats]); // eslint-disable-line react-hooks/exhaustive-deps
  // Turning off outside-the-Bible questions drops that category from the selection.
  useEffect(() => {
    if (!outside && cats.includes("teachers")) setCats(cats.filter((c) => c !== "teachers"));
    else if (!outside && card?.cat === "teachers") next();
  }, [outside]); // eslint-disable-line react-hooks/exhaustive-deps

  function record(grade: Grade, picked?: string) {
    setResult({ grade, picked });
    if (card) {
      const given = picked ?? (typed.trim() || "(shown the answer)");
      const { cat, prompt, quote, answers, ref, explain, link } = card;
      addAnswer({ at: Date.now(), cat, prompt, quote, given, answer: answers[0], grade, ref, explain, link });
    }
    const ok = grade === "right";
    setSession((s) => {
      const streak = ok ? s.streak + 1 : 0;
      const t = { right: stats.right + (ok ? 1 : 0), total: stats.total + 1, best: Math.max(stats.best, streak) };
      setStats(t);
      saveStats(t);
      return { right: s.right + (ok ? 1 : 0), total: s.total + 1, streak };
    });
  }
  /** "Close" answers: you decide whether it counts. */
  function overrule(ok: boolean) {
    setResult({ grade: ok ? "right" : "wrong" });
    regradeLast(ok ? "right" : "wrong");
    if (ok) {
      setSession((s) => ({ ...s, right: s.right + 1, streak: s.streak + 1 }));
      const t = { ...stats, right: stats.right + 1 };
      setStats(t);
      saveStats(t);
    } else setSession((s) => ({ ...s, streak: 0 }));
  }

  const toggle = (c: Category) => setCats(cats.includes(c) ? cats.filter((x) => x !== c) : [...cats, c]);

  return (
    <div className="stack">
      <div className="row wrap">
        <h1 className="grow">Bible challenge</h1>
        <button className="btn" onClick={() => setHistoryOpen(true)}>My answers</button>
        <button className="btn" onClick={() => setCardsOpen(true)}>My cards ({data.settings.bible.customCards.length})</button>
      </div>
      <div className="chips">
        <button className={`chip ${cats.length === 0 ? "on" : ""}`} onClick={() => setCats([])}>
          Everything
        </button>
        {CATEGORIES.filter((c) => (c.id !== "mine" || data.settings.bible.customCards.length) && (c.id !== "teachers" || outside)).map((c) => (
          <button key={c.id} className={`chip ${cats.includes(c.id) ? "on" : ""}`} onClick={() => toggle(c.id)}>
            {c.label}
          </button>
        ))}
      </div>
      <p className="muted small" style={{ margin: 0 }}>
        {CURATED_COUNT} hand-written questions + unlimited ones built from the Bible text · Session {session.right}/{session.total}
        {session.streak > 1 ? ` · 🔥 ${session.streak} in a row` : ""} · All time {stats.right}/{stats.total} (best streak {stats.best})
      </p>
      <details className="q-settings">
        <summary>
          Question settings: {versions.join(", ")} · {outside ? "includes pastors & authors" : "the Bible only"}
        </summary>
        <QuestionSettings data={data} />
      </details>

      <section className="card quiz-card">
        {err && <p className="error-text">{err}</p>}
        {!card ? (
          !err && <p className="muted">Shuffling…</p>
        ) : (
          <>
            <div className="eyebrow">{CATEGORIES.find((c) => c.id === card.cat)?.label}</div>
            <h2 className="quiz-q">{card.prompt}</h2>
            {card.quote && <blockquote className="verse-quote">{card.quote}</blockquote>}

            {card.kind === "text" && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!result && typed.trim()) record(gradeAnswer(typed, card.answers));
                }}
              >
                <div className="row">
                  <input
                    className={`input grow ${result ? `g-${result.grade}` : ""}`}
                    value={typed}
                    onChange={(e) => setTyped(e.target.value)}
                    placeholder="Type your answer (optional)"
                    disabled={!!result}
                    autoFocus
                  />
                  {!result && <button className="btn primary" disabled={!typed.trim()}>Check</button>}
                </div>
              </form>
            )}
            {(card.kind === "tf" || card.kind === "mc") && (
              <div className="choice-grid">
                {(card.kind === "tf" ? ["True", "False"] : card.choices!).map((c) => {
                  const right = card.answers[0] === c;
                  return (
                    <button
                      key={c}
                      className={`btn choice ${result ? (right ? "g-right" : result.picked === c ? "g-wrong" : "") : ""}`}
                      disabled={!!result}
                      onClick={() => record(right ? "right" : "wrong", c)}
                    >
                      {c}
                    </button>
                  );
                })}
              </div>
            )}

            {result || revealed ? (
              <div className="answer">
                {result && (
                  <p className={`grade g-${result.grade}`}>
                    {result.grade === "right" ? "Right!" : result.grade === "close" ? "Close —" : "Not quite."}{" "}
                    {result.grade !== "right" || card.kind === "text" ? (
                      <>
                        Answer: <strong>{card.answers[0]}</strong>
                      </>
                    ) : null}
                  </p>
                )}
                {!result && (
                  <p className="grade">
                    Answer: <strong>{card.answers[0]}</strong>
                  </p>
                )}
                {(card.explain || card.ref) && (
                  <p className="hint">
                    {card.explain}
                    {card.explain && card.ref ? " " : ""}
                    {card.ref && <span className="muted">({card.ref})</span>}
                    {card.link && (
                      <>
                        {" "}
                        <a href={card.link} target="_blank" rel="noreferrer">
                          See the source
                        </a>
                      </>
                    )}
                  </p>
                )}
                <div className="row wrap">
                  {result?.grade === "close" && (
                    <>
                      <button className="btn" onClick={() => overrule(true)}>Count it — I knew it</button>
                      <button className="btn" onClick={() => overrule(false)}>Mark wrong</button>
                    </>
                  )}
                  {!result && revealed && (
                    <>
                      <button className="btn" onClick={() => record("right")}>I knew it</button>
                      <button className="btn" onClick={() => record("wrong")}>I didn't</button>
                    </>
                  )}
                  <span className="grow" />
                  <button className="btn primary" onClick={next}>Next question</button>
                </div>
              </div>
            ) : (
              card.kind === "text" && (
                <button className="link" style={{ marginTop: 8 }} onClick={() => setRevealed(true)}>
                  Just show me the answer (flash-card style)
                </button>
              )
            )}
          </>
        )}
      </section>
      {cardsOpen && <MyCards data={data} toast={toast} onClose={() => setCardsOpen(false)} />}
      {historyOpen && <History onClose={() => setHistoryOpen(false)} />}
    </div>
  );
}

function MyCards({ data, toast, onClose }: { data: Data; toast: (t: Toast) => void; onClose: () => void }) {
  const [cards, setCards] = useState<CustomCard[]>(data.settings.bible.customCards);
  const [q, setQ] = useState("");
  const [a, setA] = useState("");
  const [note, setNote] = useState("");
  const save = async (next: CustomCard[]) => {
    setCards(next);
    await data.saveSettings({ ...data.settings, bible: { ...data.settings.bible, customCards: next } });
  };
  return (
    <Modal title="My quiz cards" onClose={onClose}>
      <div className="stack tight">
        <p className="hint" style={{ marginTop: 0 }}>
          Add your own questions — a sermon point, a quote from a pastor or author you want to remember (“Who said: …?”), or a verse from your Bible study. Several
          accepted answers? Separate them with “|”.
        </p>
        <label className="field">
          <span>Question</span>
          <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Who said: “…”?" />
        </label>
        <label className="field">
          <span>Answer</span>
          <input className="input" value={a} onChange={(e) => setA(e.target.value)} placeholder="Name|Other accepted spelling" />
        </label>
        <label className="field">
          <span>Note or source (shown after answering)</span>
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        <button
          className="btn primary"
          disabled={!q.trim() || !a.trim()}
          onClick={async () => {
            await save([...cards, { q: q.trim(), a: a.trim(), note: note.trim() || undefined }]);
            setQ("");
            setA("");
            setNote("");
            toast({ msg: "Card added" });
          }}
        >
          Add card
        </button>
        {cards.length > 0 && (
          <table className="table">
            <tbody>
              {cards.map((c, i) => (
                <tr key={i}>
                  <td>{c.q}</td>
                  <td className="muted">{c.a}</td>
                  <td className="num">
                    <button className="link small" onClick={() => save(cards.filter((_, j) => j !== i))}>
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="row end">
          <button className="btn" onClick={onClose}>Done</button>
        </div>
      </div>
    </Modal>
  );
}

const GRADE_LABEL: Record<Grade, string> = { right: "Right", close: "Close", wrong: "Missed" };

/** Your past answers, with how you're doing in each category. */
function History({ onClose }: { onClose: () => void }) {
  const [all, setAll] = useState(loadHistory);
  const [synced, setSynced] = useState(false);
  useEffect(() => {
    let live = true;
    syncHistory().then((h) => live && setAll(h));
    historySynced().then((s) => live && setSynced(s));
    return () => {
      live = false;
    };
  }, []);
  const [show, setShow] = useState<"all" | "wrong" | "right">("all");
  const [cat, setCat] = useState<Category | "">("");
  const [limit, setLimit] = useState(50);
  const byCat = CATEGORIES.map((c) => {
    const rows = all.filter((a) => a.cat === c.id);
    return { ...c, n: rows.length, right: rows.filter((a) => a.grade === "right").length };
  }).filter((c) => c.n);
  const rows = all
    .filter((a) => (show === "all" ? true : show === "right" ? a.grade === "right" : a.grade !== "right") && (!cat || a.cat === cat))
    .reverse();
  const when = (t: number) => new Date(t).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  return (
    <Modal title="My answers" onClose={onClose}>
      <div className="stack tight">
        {all.length === 0 ? (
          <p className="muted">No answers yet. Every question you answer shows up here.</p>
        ) : (
          <>
            <p className="hint" style={{ marginTop: 0 }}>
              How you're doing by category. Tap one to see just those answers.{" "}
              {synced ? "Includes answers from all your devices." : "Kept on this device — sign in to see them on all your devices."}
            </p>
            <table className="table">
              <tbody>
                {byCat.map((c) => (
                  <tr key={c.id} className={cat === c.id ? "on" : ""} onClick={() => setCat(cat === c.id ? "" : c.id)} style={{ cursor: "pointer" }}>
                    <td>{c.label}</td>
                    <td className="num muted">
                      {c.right}/{c.n}
                    </td>
                    <td className="num">{Math.round((100 * c.right) / c.n)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="row wrap">
              <div className="seg">
                {(
                  [
                    ["all", "All"],
                    ["wrong", "Missed"],
                    ["right", "Right"],
                  ] as const
                ).map(([k, l]) => (
                  <button key={k} className={show === k ? "on" : ""} onClick={() => setShow(k)}>
                    {l}
                  </button>
                ))}
              </div>
              {cat && (
                <button className="chip on" onClick={() => setCat("")}>
                  {CATEGORIES.find((c) => c.id === cat)?.label} ✕
                </button>
              )}
              <span className="grow" />
              <span className="muted small">{rows.length} answers</span>
            </div>
            <div className="history-list">
              {rows.slice(0, limit).map((a) => (
                <div key={a.id} className={`history-item h-${a.grade}`}>
                  <div className="row">
                    <span className="eyebrow grow">
                      {CATEGORIES.find((c) => c.id === a.cat)?.label} · {when(a.at)}
                    </span>
                    <span className={`pill h-pill-${a.grade}`}>{GRADE_LABEL[a.grade]}</span>
                  </div>
                  <div>{a.prompt}</div>
                  {a.quote && <div className="history-quote">{a.quote}</div>}
                  <div className="small">
                    You: <strong>{a.given}</strong>
                    {a.given !== a.answer && (
                      <>
                        {" "}
                        · Answer: <strong>{a.answer}</strong>
                      </>
                    )}
                  </div>
                  {(a.explain || a.ref || a.link) && (
                    <div className="small muted">
                      {a.explain} {a.ref && `(${a.ref})`}{" "}
                      {a.link && (
                        <a href={a.link} target="_blank" rel="noreferrer">
                          Source
                        </a>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
            {rows.length > limit && (
              <button className="btn" onClick={() => setLimit(limit + 100)}>
                Show more
              </button>
            )}
          </>
        )}
        <div className="row end">
          {all.length > 0 && (
            <button
              className="btn"
              onClick={() => {
                if (!confirm(synced ? "Clear your answer history on all your devices?" : "Clear your answer history on this device?")) return;
                clearHistory();
                setAll([]);
              }}
            >
              Clear history
            </button>
          )}
          <button className="btn primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </Modal>
  );
}
