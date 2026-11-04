import { useState } from "react";
import type { Data } from "../../lib/useData";
import type { Goal } from "../../lib/types";
import { dayKey, fromDayKey, fmtDay } from "../../lib/dates";
import { goalStatus, habitSets } from "../../lib/stats";
import { Modal } from "../../components/Modal";

const LABEL = { hit: "Hit", missed: "Missed", upcoming: "Upcoming", "in-progress": "Today", note: "" } as const;

export function PushupsGoals({ data }: { data: Data }) {
  const [editing, setEditing] = useState<Goal | "new" | null>(null);
  const now = new Date();
  const goals = [...data.goals].sort((a, b) => b.goal_date.localeCompare(a.goal_date));

  return (
    <div className="stack">
      <section className="card">
        <div className="day-head">
          <h2>Daily targets</h2>
          <span className="muted">Drives the Today progress bar</span>
        </div>
        <ul className="plain">
          {Object.entries(data.settings.dailyTargets).map(([ex, n]) => (
            <li key={ex}>
              <strong>{n}</strong> {ex} per day
            </li>
          ))}
        </ul>
        <p className="hint">Change targets in Settings → Push-ups, or use “Make daily target” on a goal below.</p>
      </section>

      <div className="row">
        <h2 className="grow">Goal log</h2>
        <button className="btn primary" onClick={() => setEditing("new")}>+ New goal</button>
      </div>

      {goals.length === 0 && <p className="muted center">No goals yet.</p>}
      {goals.map((g) => {
        const st = goalStatus(g, habitSets(data.sets, data.settings), now);
        return (
          <section className="card goal" key={g.id}>
            <div className="day-head">
              <span className="muted">{fmtDay(fromDayKey(g.goal_date), { weekday: "short", month: "short", day: "numeric", year: "numeric" })}</span>
              {st.state !== "note" && (
                <span className={`badge ${st.state}`}>
                  {st.state === "hit" ? "✓ " : ""}
                  {LABEL[st.state]} · {st.reps}/{g.target}
                </span>
              )}
            </div>
            <h3>{g.title || (g.target ? `${g.target} ${g.exercise}` : "Goal")}</h3>
            {g.notes && <p className="pre">{g.notes}</p>}
            <div className="row">
              <button className="link" onClick={() => setEditing(g)}>Edit</button>
              {g.exercise && g.target ? (
                <button
                  className="link"
                  onClick={() =>
                    data.saveSettings({ ...data.settings, dailyTargets: { ...data.settings.dailyTargets, [g.exercise!]: g.target! } })
                  }
                >
                  Make daily target
                </button>
              ) : null}
            </div>
          </section>
        );
      })}

      {editing && <GoalEditor goal={editing === "new" ? null : editing} data={data} onClose={() => setEditing(null)} />}
    </div>
  );
}

function GoalEditor({ goal, data, onClose }: { goal: Goal | null; data: Data; onClose: () => void }) {
  const [date, setDate] = useState(goal?.goal_date ?? dayKey(new Date()));
  const [exercise, setExercise] = useState(goal?.exercise ?? data.settings.defaultExercise);
  const [target, setTarget] = useState(goal?.target?.toString() ?? "");
  const [title, setTitle] = useState(goal?.title ?? "");
  const [notes, setNotes] = useState(goal?.notes ?? "");

  async function save() {
    const row = { goal_date: date, exercise: exercise.trim() || null, target: target ? Number(target) : null, title: title.trim(), notes: notes.trim() };
    if (goal) await data.update("goals", goal.id, row);
    else await data.insert("goals", [row]);
    onClose();
  }

  return (
    <Modal title={goal ? "Edit goal" : "New goal"} onClose={onClose}>
      <label className="field">
        <span>Date</span>
        <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </label>
      <div className="row">
        <label className="field grow">
          <span>Exercise</span>
          <input className="input" list="goal-ex" value={exercise} onChange={(e) => setExercise(e.target.value)} />
          <datalist id="goal-ex">
            {data.settings.exercises.map((e) => (
              <option key={e} value={e} />
            ))}
          </datalist>
        </label>
        <label className="field" style={{ width: 110 }}>
          <span>Reps that day</span>
          <input className="input" type="number" inputMode="numeric" value={target} onChange={(e) => setTarget(e.target.value)} />
        </label>
      </div>
      <label className="field">
        <span>Title</span>
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. 500 a day with feet elevated" />
      </label>
      <label className="field">
        <span>Notes / plan</span>
        <textarea className="input" rows={5} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>
      <div className="row end">
        {goal && (
          <button
            className="btn danger"
            onClick={async () => {
              if (confirm("Delete this goal?")) {
                await data.remove("goals", [goal.id]);
                onClose();
              }
            }}
          >
            Delete
          </button>
        )}
        <span className="spacer" />
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" onClick={save} disabled={!date}>Save</button>
      </div>
    </Modal>
  );
}
