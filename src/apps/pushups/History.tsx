import { useMemo, useState } from "react";
import type { Data } from "../../lib/useData";
import type { WorkoutSet } from "../../lib/types";
import { dayKey, fromDayKey, fmtDay } from "../../lib/dates";
import { habitSets, restMinutes } from "../../lib/stats";
import { SetRow } from "./Today";

const PAGE = 14;

export function PushupsHistory({ data, onEdit }: { data: Data; onEdit: (s: WorkoutSet | "new") => void }) {
  const [days, setDays] = useState(PAGE);
  const [filter, setFilter] = useState("All");
  const [q, setQ] = useState("");
  const sets = useMemo(() => habitSets(data.sets, data.settings), [data.sets, data.settings]);
  const rest = useMemo(() => restMinutes(data.sets.filter((s) => !s.workout_id)), [data.sets]);

  const exercises = useMemo(() => ["All", ...new Set(sets.map((s) => s.exercise))], [sets]);
  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const m = new Map<string, WorkoutSet[]>();
    for (const s of sets) {
      if (filter !== "All" && s.exercise !== filter) continue;
      if (needle && !s.notes.toLowerCase().includes(needle) && !s.exercise.toLowerCase().includes(needle)) continue;
      const k = dayKey(new Date(s.performed_at));
      (m.get(k) ?? m.set(k, []).get(k)!).push(s);
    }
    return [...m.entries()];
  }, [sets, filter, q]);

  return (
    <div className="stack">
      <div className="filters">
        <select className="input" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Exercise">
          {exercises.map((e) => (
            <option key={e}>{e}</option>
          ))}
        </select>
        <input className="input" placeholder="Search notes" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn" onClick={() => onEdit("new")}>+ Past set</button>
      </div>

      {groups.length === 0 && <p className="muted center">No sets match.</p>}

      {groups.slice(0, days).map(([k, list]) => {
        const totals = new Map<string, number>();
        list.forEach((s) => totals.set(s.exercise, (totals.get(s.exercise) ?? 0) + s.reps));
        return (
          <section className="card" key={k}>
            <div className="day-head">
              <h2>{fmtDay(fromDayKey(k), { weekday: "long", month: "short", day: "numeric", year: "numeric" })}</h2>
              <span className="muted">
                {[...totals.entries()].map(([e, n]) => `${n} ${e}`).join(" · ")} · {list.length} sets
              </span>
            </div>
            <ul className="set-list">
              {list.map((s) => (
                // Workout sets are edited inside their workout.
                <SetRow key={s.id} s={s} rest={rest.get(s.id)} onClick={s.workout_id ? undefined : () => onEdit(s)} />
              ))}
            </ul>
          </section>
        );
      })}

      {groups.length > days && (
        <button className="btn" onClick={() => setDays((d) => d + PAGE)}>
          Show older days ({groups.length - days} more)
        </button>
      )}
    </div>
  );
}
