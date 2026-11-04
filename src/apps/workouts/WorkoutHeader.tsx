import { useState, type ReactNode } from "react";
import type { Toast } from "../../App";
import type { Data } from "../../lib/useData";
import type { Workout } from "../../lib/types";
import { fmtDay, fmtTime } from "../../lib/dates";
import { KIND_LABEL, deleteWorkout } from "../../lib/workouts";
import { go } from "../../lib/router";

/** Title, date, notes and delete — shared by every workout type. */
export function WorkoutHeader({ data, workout, toast, children }: { data: Data; workout: Workout; toast: (t: Toast) => void; children?: ReactNode }) {
  const [title, setTitle] = useState(workout.title);
  const [notes, setNotes] = useState(workout.notes);
  const start = new Date(workout.started_at);
  return (
    <section className="card stack tight">
      <div className="day-head">
        <span className="eyebrow">
          {KIND_LABEL[workout.kind]} · {fmtDay(start)} {fmtTime(start)}
        </span>
        {!workout.ended_at ? <span className="badge in-progress">In progress</span> : <span className="badge hit">Done</span>}
      </div>
      <input
        className="input title-input"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={() => title.trim() && title !== workout.title && data.update("workouts", workout.id, { title: title.trim() })}
        aria-label="Workout name"
      />
      {children}
      <textarea
        className="input"
        rows={2}
        placeholder="Notes"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        onBlur={() => notes !== workout.notes && data.update("workouts", workout.id, { notes })}
      />
      <div className="row">
        <button className="link" onClick={() => go("workouts")}>← All workouts</button>
        <span className="spacer" />
        <button
          className="link danger-text"
          onClick={async () => {
            if (!confirm(`Delete "${workout.title}"${workout.kind === "lift" ? " and its sets" : ""}?`)) return;
            await deleteWorkout(data, workout);
            toast({ msg: "Workout deleted" });
            go("workouts");
          }}
        >
          Delete workout
        </button>
      </div>
    </section>
  );
}
