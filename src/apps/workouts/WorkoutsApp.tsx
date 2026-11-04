import { useMemo, useState } from "react";
import type { Toast } from "../../App";
import type { Data } from "../../lib/useData";
import type { Workout, WorkoutKind } from "../../lib/types";
import { dayKey, fmtDay, fmtTime, startOfWeek, toLocalInput } from "../../lib/dates";
import { KIND_ICON, KIND_LABEL, liftTotals, newWorkout, setsOf, startWorkout, summary } from "../../lib/workouts";
import { workoutCalories } from "../../lib/calories";
import { fmtClock, fmtDistance, toMeters, weightUnit } from "../../lib/units";
import { go } from "../../lib/router";
import { Stat } from "../../components/Stat";
import { Modal } from "../../components/Modal";
import { LiftSession } from "./LiftSession";
import { CardioSession } from "./CardioSession";
import { TimedSession } from "./TimedSession";

export function WorkoutsApp({ data, sub, toast }: { data: Data; sub?: string; toast: (t: Toast) => void }) {
  const workout = sub ? data.workouts.find((w) => w.id === sub) : undefined;
  if (sub && !workout) return <p className="muted center">That workout isn't here anymore. <a href="#/workouts">Back to workouts</a></p>;
  if (workout) {
    if (workout.kind === "lift") return <LiftSession data={data} workout={workout} toast={toast} />;
    if (workout.kind === "walk" || workout.kind === "run") return <CardioSession data={data} workout={workout} toast={toast} />;
    return <TimedSession data={data} workout={workout} toast={toast} />;
  }
  return <WorkoutsHome data={data} />;
}

export function KindIcon({ kind, size = 22 }: { kind: WorkoutKind; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path d={KIND_ICON[kind]} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function StartButtons({ data }: { data: Data }) {
  // Re-start a past video workout (e.g. the same Tae Bo video) with its link filled in.
  const classes = useMemo(() => {
    const seen = new Map<string, Workout>();
    for (const w of data.workouts) if (w.kind === "class" && !seen.has(w.title)) seen.set(w.title, w);
    return [...seen.values()].slice(0, 3);
  }, [data.workouts]);
  return (
    <>
      <div className="start-grid">
        {(["lift", "walk", "run", "class", "other"] as WorkoutKind[]).map((k) => (
          <button key={k} className="start-btn" onClick={() => startWorkout(data, k, k === "class" ? "Tae Bo" : undefined)}>
            <KindIcon kind={k} size={26} />
            <span>{k === "class" ? "Video / Tae Bo" : KIND_LABEL[k]}</span>
          </button>
        ))}
      </div>
      {classes.length > 0 && (
        <div className="chips" style={{ marginTop: 10 }}>
          {classes.map((w) => (
            <button key={w.id} className="chip" onClick={() => startWorkout(data, "class", w.title, w.link)}>
              ▶ {w.title} again
            </button>
          ))}
        </div>
      )}
    </>
  );
}

function WorkoutsHome({ data }: { data: Data }) {
  const { settings } = data;
  const [pastOpen, setPastOpen] = useState(false);
  const [shown, setShown] = useState(15);
  const active = data.workouts.filter((w) => !w.ended_at);
  const done = data.workouts.filter((w) => w.ended_at);

  const week = useMemo(() => {
    const start = startOfWeek(new Date()).toISOString();
    const ws = done.filter((w) => w.started_at >= start);
    const liftSets = data.sets.filter((s) => s.workout_id && ws.some((w) => w.id === s.workout_id));
    return {
      count: ws.length,
      time: ws.reduce((n, w) => n + (w.duration_s ?? 0), 0),
      distance: ws.reduce((n, w) => n + (w.distance_m ?? 0), 0),
      volume: liftTotals(liftSets, settings).volume,
      kcal: ws.reduce((n, w) => n + (w.calories ?? 0), 0),
    };
  }, [done, data.sets, settings]);

  return (
    <div className="stack">
      {active.map((w) => (
        <a key={w.id} className="card active-banner" href={`#/workouts/${w.id}`}>
          <KindIcon kind={w.kind} />
          <span className="grow">
            <strong>{w.title}</strong> in progress · started {fmtTime(new Date(w.started_at))}
          </span>
          <span className="btn primary">Resume</span>
        </a>
      ))}

      <section className="card">
        <h2>Start a workout</h2>
        <StartButtons data={data} />
        <button className="link" style={{ marginTop: 8 }} onClick={() => setPastOpen(true)}>+ Log a past workout</button>
      </section>

      <section className="card">
        <h2>This week</h2>
        <div className="stats-grid">
          <Stat label="Workouts" value={week.count} />
          <Stat label="Active time" value={fmtClock(week.time)} />
          <Stat label="Weight moved" value={`${Math.round(week.volume).toLocaleString()} ${weightUnit(settings.units)}`} />
          <Stat label="Distance" value={fmtDistance(week.distance, settings.units, 1)} />
          <Stat label="Calories (est.)" value={`~${week.kcal.toLocaleString()}`} />
        </div>
      </section>

      <h2>History</h2>
      {done.length === 0 && <p className="muted">No workouts yet. Start one above.</p>}
      {done.slice(0, shown).map((w) => (
        <a key={w.id} className="card workout-row" href={`#/workouts/${w.id}`}>
          <span className="kind-dot">
            <KindIcon kind={w.kind} />
          </span>
          <span className="grow">
            <strong>{w.title}</strong>
            {w.focus.length > 0 && <span className="muted"> · {w.focus.join(", ")}</span>}
            <span className="block muted small">
              {fmtDay(new Date(w.started_at))} · {summary(w, setsOf(data.sets, w.id), settings)}
            </span>
          </span>
        </a>
      ))}
      {done.length > shown && (
        <button className="btn" onClick={() => setShown((n) => n + 15)}>Show more</button>
      )}

      {pastOpen && <PastWorkout data={data} onClose={() => setPastOpen(false)} />}
    </div>
  );
}

function PastWorkout({ data, onClose }: { data: Data; onClose: () => void }) {
  const units = data.settings.units;
  const [kind, setKind] = useState<WorkoutKind>("walk");
  const [title, setTitle] = useState("");
  const [when, setWhen] = useState(toLocalInput(new Date(Date.now() - 3600000)));
  const [mins, setMins] = useState("");
  const [dist, setDist] = useState("");
  const [notes, setNotes] = useState("");

  async function save() {
    const duration_s = mins ? Math.round(Number(mins) * 60) : null;
    const distance_m = dist ? toMeters(Number(dist), units) : null;
    const started = new Date(when);
    const w = {
      ...newWorkout(kind, title.trim() || (kind === "class" ? "Tae Bo" : KIND_LABEL[kind])),
      started_at: started.toISOString(),
      ended_at: new Date(started.getTime() + (duration_s ?? 0) * 1000).toISOString(),
      duration_s,
      distance_m,
      avg_speed_mps: distance_m && duration_s ? distance_m / duration_s : null,
      notes,
      calories: workoutCalories({ kind, duration_s, distance_m }, data.settings.bodyweightLb) || null,
    };
    const added = await data.insert("workouts", [w]);
    onClose();
    // A lift needs its exercises entered, so open it.
    if (added?.[0] && kind === "lift") go("workouts", added[0].id);
  }

  return (
    <Modal title="Log a past workout" onClose={onClose}>
      <div className="chips" style={{ marginBottom: 10 }}>
        {(["lift", "walk", "run", "class", "other"] as WorkoutKind[]).map((k) => (
          <button key={k} className={`chip ${k === kind ? "on" : ""}`} onClick={() => setKind(k)}>
            {k === "class" ? "Video / Tae Bo" : KIND_LABEL[k]}
          </button>
        ))}
      </div>
      <label className="field">
        <span>Name</span>
        <input className="input" placeholder={kind === "class" ? "Tae Bo" : KIND_LABEL[kind]} value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <label className="field">
        <span>Started</span>
        <input className="input" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} max={toLocalInput(new Date())} />
      </label>
      <div className="row">
        <label className="field grow">
          <span>Minutes</span>
          <input className="input" type="number" inputMode="decimal" value={mins} onChange={(e) => setMins(e.target.value)} />
        </label>
        {(kind === "walk" || kind === "run") && (
          <label className="field grow">
            <span>Distance ({units === "metric" ? "km" : "mi"})</span>
            <input className="input" type="number" inputMode="decimal" value={dist} onChange={(e) => setDist(e.target.value)} />
          </label>
        )}
      </div>
      <label className="field">
        <span>Notes</span>
        <textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>
      <div className="row end">
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" onClick={save} disabled={!when}>
          {kind === "lift" ? "Save & add exercises" : "Save"}
        </button>
      </div>
    </Modal>
  );
}

export const workoutsOn = (workouts: Workout[], key: string) => workouts.filter((w) => dayKey(new Date(w.started_at)) === key);
