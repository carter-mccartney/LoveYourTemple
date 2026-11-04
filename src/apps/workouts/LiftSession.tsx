import { useMemo, useState } from "react";
import type { Toast } from "../../App";
import type { Data } from "../../lib/useData";
import type { Equipment, Workout, WorkoutSet } from "../../lib/types";
import { BODY_PARTS, EQUIPMENT_LABEL, LB_PER_KG, MULTIPLIER, normalizeExercise, parseLiftLine, setVolume, weightLabel, guessEquipment } from "../../lib/lifts";
import { finishWorkout, liftTotals, setsOf } from "../../lib/workouts";
import { fmtClock, weightUnit } from "../../lib/units";
import { Stat } from "../../components/Stat";
import { Modal } from "../../components/Modal";
import { useNow } from "../pushups/Today";
import { WorkoutHeader } from "./WorkoutHeader";

export function LiftSession({ data, workout, toast }: { data: Data; workout: Workout; toast: (t: Toast) => void }) {
  const { settings } = data;
  const unit = weightUnit(settings.units);
  const now = useNow(1000);
  const sets = useMemo(() => setsOf(data.sets, workout.id), [data.sets, workout.id]);
  const groups = useMemo(() => {
    const m = new Map<string, WorkoutSet[]>();
    for (const s of sets) (m.get(s.exercise) ?? m.set(s.exercise, []).get(s.exercise)!).push(s);
    return [...m.entries()];
  }, [sets]);
  const totals = liftTotals(sets, settings);
  const active = !workout.ended_at;

  const [line, setLine] = useState("");
  const parsed = line.trim() ? parseLiftLine(line, unit) : null;
  const [editing, setEditing] = useState<WorkoutSet | null>(null);

  // Exercise names you've used before, for autocomplete.
  const known = useMemo(() => [...new Set(data.sets.filter((s) => s.workout_id).map((s) => s.exercise))].sort(), [data.sets]);

  async function addParsed() {
    if (!parsed) return;
    const toUnit = (w: number | null) => (w == null ? null : parsed.unit === unit ? w : parsed.unit === "kg" ? w * LB_PER_KG : w / LB_PER_KG);
    const base = Date.now();
    await data.insert(
      "sets",
      Array.from({ length: parsed.sets }, (_, i) => ({
        performed_at: new Date(base + i).toISOString(),
        exercise: parsed.exercise,
        reps: parsed.reps,
        seconds: parsed.seconds,
        weight: toUnit(parsed.weight),
        equipment: parsed.equipment,
        notes: "",
        workout_id: workout.id,
      })),
    );
    setLine("");
  }

  async function repeat(last: WorkoutSet, reps: number, weight: number | null) {
    const { id: _id, ...rest } = last;
    await data.insert("sets", [{ ...rest, reps, weight, performed_at: new Date().toISOString() }]);
  }

  async function setEquipment(group: WorkoutSet[], equipment: Equipment) {
    for (const s of group) await data.update("sets", s.id, { equipment });
  }

  return (
    <div className="stack">
      <WorkoutHeader data={data} workout={workout} toast={toast}>
        <div className="chips">
          {BODY_PARTS.map((p) => {
            const on = workout.focus.includes(p);
            return (
              <button
                key={p}
                className={`chip ${on ? "on" : ""}`}
                aria-pressed={on}
                onClick={() => data.update("workouts", workout.id, { focus: on ? workout.focus.filter((f) => f !== p) : [...workout.focus, p] })}
              >
                {p}
              </button>
            );
          })}
        </div>
      </WorkoutHeader>

      <section className="card">
        <form
          className="stack tight"
          onSubmit={(e) => {
            e.preventDefault();
            addParsed();
          }}
        >
          <label className="field" style={{ margin: 0 }}>
            <span>Add an exercise</span>
            <div className="row">
              <input
                className="input grow"
                list="lift-names"
                placeholder="50 lb dumbbell curls 3x10"
                value={line}
                onChange={(e) => setLine(e.target.value)}
                autoComplete="off"
              />
              <button className="btn primary" disabled={!parsed}>Add</button>
            </div>
            <datalist id="lift-names">
              {known.map((k) => (
                <option key={k} value={k} />
              ))}
            </datalist>
          </label>
          {parsed ? (
            <p className="hint" style={{ margin: 0 }}>
              <strong>{parsed.exercise}</strong> · {EQUIPMENT_LABEL[parsed.equipment]}
              {parsed.weight ? ` · ${parsed.weight} ${parsed.unit}${MULTIPLIER[parsed.equipment] === 2 ? " each" : ""}` : ""} · {parsed.sets} set
              {parsed.sets > 1 ? "s" : ""} × {parsed.seconds ? `${parsed.seconds}s` : `${parsed.reps} reps`}
              {parsed.weight && parsed.reps
                ? ` = ${Math.round(setVolume({ ...parsed, weight: parsed.weight }) * parsed.sets).toLocaleString()} ${parsed.unit} moved`
                : ""}
            </p>
          ) : (
            <p className="hint" style={{ margin: 0 }}>
              Type it how you'd say it: “bench press 150 x 8”, “pull ups 12”, “plank 60s”, “goblet squat 40 lb 3 sets of 12”.
            </p>
          )}
        </form>
      </section>

      {groups.map(([name, group]) => (
        <ExerciseCard
          key={name}
          name={name}
          sets={group}
          unit={unit}
          onEquipment={(eq) => setEquipment(group, eq)}
          onEdit={setEditing}
          onRepeat={(reps, weight) => repeat(group[group.length - 1], reps, weight)}
        />
      ))}

      <section className="card">
        <h2>{active ? "So far" : "Totals"}</h2>
        <div className="stats-grid">
          {active && <Stat label="Elapsed" value={fmtClock((now.getTime() - new Date(workout.started_at).getTime()) / 1000)} />}
          {!active && workout.duration_s ? <Stat label="Duration" value={fmtClock(workout.duration_s)} /> : null}
          <Stat label="Weight moved" value={`${Math.round(totals.volume).toLocaleString()} ${unit}`} sub="Weight × reps, dumbbell pairs ×2" />
          <Stat label="Sets" value={totals.sets} sub={`${totals.exercises} exercises`} />
          <Stat label="Reps" value={totals.reps} />
          {totals.bodyweightVolume > 0 ? (
            <Stat label="Bodyweight moved (est.)" value={`${Math.round(totals.bodyweightVolume).toLocaleString()} ${unit}`} sub="Push-ups ≈ 64%, pull-ups ≈ 100% of body weight" />
          ) : sets.some((s) => s.equipment === "bodyweight") && !settings.bodyweightLb ? (
            <Stat label="Bodyweight moved" value="–" sub="Add your body weight in Settings" />
          ) : null}
          {workout.calories ? <Stat label="Calories (est.)" value={`~${workout.calories}`} /> : null}
        </div>
      </section>

      {active && (
        <button className="btn primary big" onClick={() => finishWorkout(data, workout, {}).then(() => toast({ msg: "Workout saved" }))}>
          Finish workout
        </button>
      )}

      {editing && <LiftSetEditor set={editing} unit={unit} data={data} onClose={() => setEditing(null)} />}
    </div>
  );
}

function ExerciseCard({
  name,
  sets,
  unit,
  onEquipment,
  onEdit,
  onRepeat,
}: {
  name: string;
  sets: WorkoutSet[];
  unit: string;
  onEquipment: (e: Equipment) => void;
  onEdit: (s: WorkoutSet) => void;
  onRepeat: (reps: number, weight: number | null) => void;
}) {
  const last = sets[sets.length - 1];
  const [reps, setReps] = useState(last.reps);
  const [weight, setWeight] = useState<string>(last.weight?.toString() ?? "");
  const eq = last.equipment ?? guessEquipment(name, !!last.weight);
  const volume = sets.reduce((n, s) => n + setVolume(s), 0);
  const timed = !!last.seconds;

  return (
    <section className="card">
      <div className="day-head">
        <h2>{name}</h2>
        <select className="input small-select" value={eq} onChange={(e) => onEquipment(e.target.value as Equipment)} aria-label="Equipment">
          {Object.entries(EQUIPMENT_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>
      <div className="set-chips">
        {sets.map((s, i) => (
          <button key={s.id} className="set-chip" onClick={() => onEdit(s)} title="Edit set">
            <span className="muted">{i + 1}</span>
            <strong>{s.seconds ? `${s.seconds}s` : s.reps}</strong>
            {s.weight ? <span className="muted">@{weightLabel(s, unit)}</span> : null}
          </button>
        ))}
      </div>
      <div className="row repeat-row">
        {eq !== "bodyweight" || weight ? (
          <label className="mini">
            <input className="input" type="number" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} aria-label={`Weight (${unit})`} />
            <span>{unit}</span>
          </label>
        ) : null}
        {!timed && (
          <label className="mini">
            <input className="input" type="number" inputMode="numeric" value={reps} onChange={(e) => setReps(Number(e.target.value))} aria-label="Reps" />
            <span>reps</span>
          </label>
        )}
        <button className="btn" onClick={() => onRepeat(timed ? 0 : reps, weight ? Number(weight) : null)}>
          + Set
        </button>
        <span className="spacer" />
        {volume > 0 && (
          <span className="muted small">
            {Math.round(volume).toLocaleString()} {unit}
          </span>
        )}
      </div>
    </section>
  );
}

function LiftSetEditor({ set, unit, data, onClose }: { set: WorkoutSet; unit: string; data: Data; onClose: () => void }) {
  const [exercise, setExercise] = useState(set.exercise);
  const [reps, setReps] = useState(set.reps);
  const [seconds, setSeconds] = useState(set.seconds?.toString() ?? "");
  const [weight, setWeight] = useState(set.weight?.toString() ?? "");
  const [notes, setNotes] = useState(set.notes);
  return (
    <Modal title="Edit set" onClose={onClose}>
      <label className="field">
        <span>Exercise</span>
        <input className="input" value={exercise} onChange={(e) => setExercise(e.target.value)} />
      </label>
      <div className="row">
        <label className="field grow">
          <span>Weight ({unit})</span>
          <input className="input" type="number" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} />
        </label>
        <label className="field grow">
          <span>Reps</span>
          <input className="input" type="number" inputMode="numeric" value={reps} onChange={(e) => setReps(Number(e.target.value))} />
        </label>
        <label className="field grow">
          <span>Seconds</span>
          <input className="input" type="number" inputMode="numeric" value={seconds} onChange={(e) => setSeconds(e.target.value)} />
        </label>
      </div>
      <label className="field">
        <span>Notes</span>
        <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>
      <div className="row end">
        <button
          className="btn danger"
          onClick={async () => {
            await data.remove("sets", [set.id]);
            onClose();
          }}
        >
          Delete set
        </button>
        <span className="spacer" />
        <button className="btn" onClick={onClose}>Cancel</button>
        <button
          className="btn primary"
          onClick={async () => {
            await data.update("sets", set.id, {
              exercise: normalizeExercise(exercise),
              reps,
              seconds: seconds ? Number(seconds) : null,
              weight: weight ? Number(weight) : null,
              notes: notes.trim(),
            });
            onClose();
          }}
        >
          Save
        </button>
      </div>
    </Modal>
  );
}
