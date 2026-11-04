import { useState } from "react";
import type { Toast } from "../../App";
import type { Data } from "../../lib/useData";
import type { Workout } from "../../lib/types";
import { finishWorkout, useStopwatch } from "../../lib/workouts";
import { fmtClock } from "../../lib/units";
import { Stat } from "../../components/Stat";
import { WorkoutHeader } from "./WorkoutHeader";

/** Tae Bo, follow-along videos, classes, anything measured by time. */
export function TimedSession({ data, workout, toast }: { data: Data; workout: Workout; toast: (t: Toast) => void }) {
  const watch = useStopwatch(workout.id, workout.ended_at ? undefined : workout.started_at);
  const [link, setLink] = useState(workout.link);
  const [mins, setMins] = useState(workout.duration_s ? (workout.duration_s / 60).toFixed(0) : "");
  const active = !workout.ended_at;
  const validLink = /^https?:\/\//i.test(link.trim());

  return (
    <div className="stack">
      <WorkoutHeader data={data} workout={workout} toast={toast}>
        <div className="row">
          <input
            className="input grow"
            type="url"
            placeholder="Video link (YouTube, etc.)"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            onBlur={() => link !== workout.link && data.update("workouts", workout.id, { link: link.trim() })}
          />
          {validLink && (
            <a className="btn" href={link.trim()} target="_blank" rel="noreferrer">
              Open video
            </a>
          )}
        </div>
      </WorkoutHeader>

      {active ? (
        <>
          <section className="card">
            <div className="hero center-text">{fmtClock(watch.seconds)}</div>
            <p className="hint center-text">{watch.running ? "Timer running" : "Paused"}</p>
          </section>
          <div className="row">
            <button className="btn big grow" onClick={watch.toggle}>{watch.running ? "Pause" : "Resume"}</button>
            <button
              className="btn primary big grow"
              onClick={async () => {
                await finishWorkout(data, workout, { duration_s: Math.round(watch.seconds), link: link.trim() });
                watch.clear();
                toast({ msg: `${workout.title} saved · ${fmtClock(watch.seconds)}` });
              }}
            >
              Finish
            </button>
          </div>
        </>
      ) : (
        <section className="card">
          <div className="stats-grid">
            <Stat label="Time" value={fmtClock(workout.duration_s)} />
            {workout.calories ? <Stat label="Calories (est.)" value={`~${workout.calories}`} sub="High-intensity aerobics" /> : null}
          </div>
          <div className="row" style={{ marginTop: 10 }}>
            <label className="field grow">
              <span>Correct the time (minutes)</span>
              <input className="input" type="number" value={mins} onChange={(e) => setMins(e.target.value)} />
            </label>
            <button
              className="btn"
              onClick={() => finishWorkout(data, workout, { duration_s: Math.round(Number(mins) * 60), ended_at: workout.ended_at })}
              disabled={!mins}
            >
              Update
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
