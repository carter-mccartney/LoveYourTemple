import { useState } from "react";
import type { Toast } from "../../App";
import type { Data } from "../../lib/useData";
import type { Workout } from "../../lib/types";
import { activeSeconds, downsample, useGpsTracker } from "../../lib/gps";
import { finishWorkout } from "../../lib/workouts";
import { fmtClock, fmtDistance, fmtPace, fmtSpeed, fromMeters, toMeters } from "../../lib/units";
import { Stat } from "../../components/Stat";
import { useNow } from "../pushups/Today";
import { WorkoutHeader } from "./WorkoutHeader";

/** Walks and runs: GPS start/stop, or type the distance and time in. */
export function CardioSession({ data, workout, toast }: { data: Data; workout: Workout; toast: (t: Toast) => void }) {
  const units = data.settings.units;
  return (
    <div className="stack">
      <WorkoutHeader data={data} workout={workout} toast={toast} />
      {workout.ended_at ? <CardioSummary data={data} workout={workout} /> : <Tracker data={data} workout={workout} toast={toast} units={units} />}
    </div>
  );
}

function Tracker({ data, workout, toast, units }: { data: Data; workout: Workout; toast: (t: Toast) => void; units: "imperial" | "metric" }) {
  const gps = useGpsTracker(workout.id);
  const now = useNow(1000);
  const t = gps.track;
  const secs = activeSeconds(t, now.getTime());
  const avg = secs > 0 ? t.distance_m / secs : 0;
  const [manual, setManual] = useState(false);
  const [dist, setDist] = useState("");
  const [mins, setMins] = useState("");

  async function finishGps() {
    const final = gps.stop();
    const duration_s = Math.round(final.activeMs / 1000);
    await finishWorkout(data, workout, {
      duration_s,
      distance_m: Math.round(final.distance_m),
      avg_speed_mps: duration_s ? final.distance_m / duration_s : null,
      max_speed_mps: final.max_speed_mps || null,
      route: final.points.length > 1 ? downsample(final.points) : null,
    });
    toast({ msg: `${workout.title} saved · ${fmtDistance(final.distance_m, units)}` });
  }

  async function finishManual() {
    const distance_m = dist ? toMeters(Number(dist), units) : null;
    const duration_s = mins ? Math.round(Number(mins) * 60) : null;
    await finishWorkout(data, workout, {
      distance_m,
      duration_s,
      avg_speed_mps: distance_m && duration_s ? distance_m / duration_s : null,
    });
    toast({ msg: `${workout.title} saved` });
  }

  if (manual) {
    return (
      <section className="card">
        <h2>Enter it yourself</h2>
        <div className="row">
          <label className="field grow">
            <span>Distance ({units === "metric" ? "km" : "miles"})</span>
            <input className="input" type="number" inputMode="decimal" value={dist} onChange={(e) => setDist(e.target.value)} />
          </label>
          <label className="field grow">
            <span>Time (minutes)</span>
            <input className="input" type="number" inputMode="decimal" value={mins} onChange={(e) => setMins(e.target.value)} />
          </label>
        </div>
        <div className="row end">
          <button className="btn" onClick={() => setManual(false)}>Use GPS instead</button>
          <button className="btn primary" onClick={finishManual} disabled={!mins && !dist}>Save</button>
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="card">
        <div className="hero center-text">{fmtClock(secs)}</div>
        <div className="stats-grid">
          <Stat label="Distance" value={fmtDistance(t.distance_m, units)} />
          <Stat label="Avg speed" value={fmtSpeed(avg, units)} sub={fmtPace(avg, units)} />
          <Stat label="Current" value={t.status === "running" ? fmtSpeed(t.current_speed_mps, units) : "–"} sub={t.status === "running" ? fmtPace(t.current_speed_mps, units) : ""} />
          <Stat label="Top speed" value={t.max_speed_mps ? fmtSpeed(t.max_speed_mps, units) : "–"} />
        </div>
        <p className="hint">
          {t.error ? (
            <span className="error-text">{t.error}</span>
          ) : t.status === "running" ? (
            t.accuracy_m ? `GPS ±${Math.round(t.accuracy_m)} m · keep this screen open while you move` : "Finding GPS signal…"
          ) : t.status === "paused" ? (
            "Paused"
          ) : (
            "Press Start when you set off. Keep the app open on screen — phones pause web-page GPS when locked."
          )}
        </p>
      </section>
      <div className="row">
        {t.status === "running" ? (
          <button className="btn big grow" onClick={gps.pause}>Pause</button>
        ) : (
          <button className="btn primary big grow" onClick={gps.start}>{t.status === "paused" ? "Resume" : "Start"}</button>
        )}
        {t.status !== "idle" && (
          <button className="btn primary big grow" onClick={finishGps}>Finish</button>
        )}
      </div>
      {t.status === "idle" && (
        <button className="link center-text" onClick={() => setManual(true)}>No GPS? Enter distance and time instead</button>
      )}
    </>
  );
}

function CardioSummary({ data, workout }: { data: Data; workout: Workout }) {
  const units = data.settings.units;
  const [editing, setEditing] = useState(false);
  const [dist, setDist] = useState(workout.distance_m ? fromMeters(workout.distance_m, units).toFixed(2) : "");
  const [mins, setMins] = useState(workout.duration_s ? (workout.duration_s / 60).toFixed(1) : "");
  return (
    <section className="card">
      <div className="stats-grid">
        <Stat label="Time" value={fmtClock(workout.duration_s)} />
        <Stat label="Distance" value={fmtDistance(workout.distance_m, units)} />
        <Stat label="Avg speed" value={fmtSpeed(workout.avg_speed_mps, units)} sub={fmtPace(workout.avg_speed_mps, units)} />
        <Stat label="Top speed" value={fmtSpeed(workout.max_speed_mps, units)} />
        {workout.calories ? <Stat label="Calories (est.)" value={`~${workout.calories}`} /> : null}
      </div>
      {workout.route && workout.route.length > 1 && <RouteMap route={workout.route} />}
      {editing ? (
        <>
          <div className="row">
            <label className="field grow">
              <span>Distance ({units === "metric" ? "km" : "mi"})</span>
              <input className="input" type="number" value={dist} onChange={(e) => setDist(e.target.value)} />
            </label>
            <label className="field grow">
              <span>Minutes</span>
              <input className="input" type="number" value={mins} onChange={(e) => setMins(e.target.value)} />
            </label>
          </div>
          <div className="row end">
            <button className="btn" onClick={() => setEditing(false)}>Cancel</button>
            <button
              className="btn primary"
              onClick={async () => {
                const distance_m = dist ? toMeters(Number(dist), units) : null;
                const duration_s = mins ? Math.round(Number(mins) * 60) : null;
                await finishWorkout(data, workout, {
                  distance_m,
                  duration_s,
                  avg_speed_mps: distance_m && duration_s ? distance_m / duration_s : null,
                  ended_at: workout.ended_at,
                });
                setEditing(false);
              }}
            >
              Save
            </button>
          </div>
        </>
      ) : (
        <button className="link" onClick={() => setEditing(true)}>Correct distance or time</button>
      )}
    </section>
  );
}

/** The route as a simple line (no map tiles needed). */
function RouteMap({ route }: { route: [number, number, number][] }) {
  const lat0 = route[0][0] * (Math.PI / 180);
  const pts = route.map(([la, ln]) => [ln * Math.cos(lat0), -la]);
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const W = 320;
  const H = 200;
  const s = Math.min((W - 20) / (maxX - minX || 1e-9), (H - 20) / (maxY - minY || 1e-9));
  const P = pts.map(([x, y]) => [10 + (x - minX) * s, 10 + (y - minY) * s]);
  return (
    <svg className="route" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Route shape">
      <polyline points={P.map((p) => p.join(",")).join(" ")} fill="none" className="route-line" />
      <circle cx={P[0][0]} cy={P[0][1]} r={5} className="route-start" />
      <circle cx={P[P.length - 1][0]} cy={P[P.length - 1][1]} r={5} className="route-end" />
    </svg>
  );
}
