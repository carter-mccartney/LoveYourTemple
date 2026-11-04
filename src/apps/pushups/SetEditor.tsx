import { useState } from "react";
import type { Data } from "../../lib/useData";
import type { WorkoutSet } from "../../lib/types";
import { toLocalInput } from "../../lib/dates";
import { Modal } from "../../components/Modal";

/** Edit (or backfill) a single set. */
export function SetEditor({ set, data, onClose }: { set: WorkoutSet | null; data: Data; onClose: () => void }) {
  const [when, setWhen] = useState(toLocalInput(set ? new Date(set.performed_at) : new Date()));
  const [exercise, setExercise] = useState(set?.exercise ?? data.settings.defaultExercise);
  const [reps, setReps] = useState(set?.reps ?? data.settings.defaultReps);
  const [notes, setNotes] = useState(set?.notes ?? "");
  const options = [...new Set([exercise, ...data.settings.exercises, ...data.sets.map((s) => s.exercise)])];

  async function save() {
    const row = { performed_at: new Date(when).toISOString(), exercise: exercise.trim(), reps, notes: notes.trim() };
    if (set) await data.update("sets", set.id, row);
    else await data.insert("sets", [{ ...row, workout_id: null }]);
    onClose();
  }

  async function remove() {
    if (set && confirm(`Delete ${set.reps} ${set.exercise}?`)) {
      await data.remove("sets", [set.id]);
      onClose();
    }
  }

  return (
    <Modal title={set ? "Edit set" : "Add a past set"} onClose={onClose}>
      <label className="field">
        <span>When</span>
        <input className="input" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
      </label>
      <label className="field">
        <span>Exercise</span>
        <input className="input" list="exercise-options" value={exercise} onChange={(e) => setExercise(e.target.value)} />
        <datalist id="exercise-options">
          {options.map((o) => (
            <option key={o} value={o} />
          ))}
        </datalist>
      </label>
      <label className="field">
        <span>Reps</span>
        <input className="input" type="number" inputMode="numeric" min={1} value={reps} onChange={(e) => setReps(Number(e.target.value))} />
      </label>
      <label className="field">
        <span>Notes</span>
        <textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>
      <div className="row end">
        {set && (
          <button className="btn danger" onClick={remove}>
            Delete
          </button>
        )}
        <span className="spacer" />
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" onClick={save} disabled={!exercise.trim() || reps <= 0 || !when}>
          Save
        </button>
      </div>
    </Modal>
  );
}
