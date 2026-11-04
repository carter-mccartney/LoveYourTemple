import { useMemo, useState } from "react";
import type { Data } from "../../lib/useData";
import { addDays, fromDayKey, fmtDay, fmtTime } from "../../lib/dates";
import { habitSets, records, series, weekTable, type Range } from "../../lib/stats";
import { Stat } from "../../components/Stat";
import { BarChart } from "../../components/BarChart";
import { WeekTable } from "../../components/WeekTable";

const RANGES: Range[] = ["1W", "1M", "3M", "1Y", "All"];

export function PushupsStats({ data }: { data: Data }) {
  const { settings } = data;
  const [withWorkouts, setWithWorkouts] = useState(true);
  const sets = useMemo(() => habitSets(data.sets, settings, withWorkouts), [data.sets, settings, withWorkouts]);
  const exercises = useMemo(() => {
    const counts = new Map<string, number>();
    sets.forEach((s) => counts.set(s.exercise, (counts.get(s.exercise) ?? 0) + 1));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([e]) => e);
  }, [sets]);
  const [exercise, setExercise] = useState(exercises[0] ?? settings.defaultExercise);
  const [range, setRange] = useState<Range>("1M");

  const rec = useMemo(() => records(sets, exercise, settings, new Date()), [sets, exercise, settings]);
  const ser = useMemo(() => series(sets, exercise, range, settings, new Date()), [sets, exercise, range, settings]);
  const week = useMemo(() => weekTable(sets, exercise, settings, new Date()), [sets, exercise, settings]);
  const short = (k?: string) => (k ? fmtDay(fromDayKey(k), { month: "short", day: "numeric", year: "numeric" }) : "–");
  const md = { month: "short", day: "numeric" } as const;

  const points = ser.buckets.map((b) => ({
    key: b.key,
    label: ser.bucket === "week" ? fmtDay(b.start, md) : fmtDay(b.start, ser.buckets.length <= 7 ? { weekday: "short" } : { month: "numeric", day: "numeric" }),
    value: b.reps,
    tooltip: (
      <>
        <div className="tt-title">
          {ser.bucket === "week" ? `${fmtDay(b.start, md)} – ${fmtDay(addDays(b.start, 6), md)}` : fmtDay(b.start, { weekday: "short", ...md })}
        </div>
        <div>
          <strong>{b.reps}</strong> reps · {b.sets} sets
        </div>
        {b.sets > 0 && <div className="muted">{(b.reps / b.sets).toFixed(1)} avg/set</div>}
      </>
    ),
  }));

  return (
    <div className="stack">
      <div className="filters">
        <select className="input" value={exercise} onChange={(e) => setExercise(e.target.value)} aria-label="Exercise">
          {(exercises.length ? exercises : [settings.defaultExercise]).map((e) => (
            <option key={e}>{e}</option>
          ))}
        </select>
        <div className="seg" role="radiogroup" aria-label="Time range">
          {RANGES.map((r) => (
            <button key={r} role="radio" aria-checked={r === range} className={r === range ? "on" : ""} onClick={() => setRange(r)}>
              {r}
            </button>
          ))}
        </div>
        <label className="check">
          <input type="checkbox" checked={withWorkouts} onChange={(e) => setWithWorkouts(e.target.checked)} /> Include workout sets
        </label>
      </div>

      <section className="card">
        <h2>
          {exercise} per {ser.bucket}
        </h2>
        <BarChart
          points={points}
          target={ser.bucket === "day" ? settings.dailyTargets[exercise] : undefined}
          ariaLabel={`${exercise} reps per ${ser.bucket}`}
        />
      </section>

      <section className="card">
        <h2>Records & totals</h2>
        <div className="stats-grid">
          <Stat label="All-time reps" value={rec.total.toLocaleString()} sub={`${rec.totalSets.toLocaleString()} sets since ${short(rec.firstKey)}`} />
          <Stat label="Most in one day" value={rec.bestDay?.reps ?? "–"} sub={short(rec.bestDay?.key)} />
          <Stat label="Best week" value={rec.bestWeek?.reps ?? "–"} sub={rec.bestWeek ? `Week of ${short(rec.bestWeek.start)}` : ""} />
          <Stat
            label="Biggest set"
            value={rec.bestSet?.reps ?? "–"}
            sub={rec.bestSet ? `${fmtDay(new Date(rec.bestSet.performed_at))} ${fmtTime(new Date(rec.bestSet.performed_at))}` : ""}
          />
          <Stat label="Most sets in a day" value={rec.mostSets?.sets ?? "–"} sub={short(rec.mostSets?.key)} />
          <Stat label="Avg per active day" value={rec.perActiveDay.toFixed(0)} sub={`${rec.activeDays} active days`} />
          <Stat label="Avg per day since start" value={rec.perCalendarDay.toFixed(0)} sub="Counts every calendar day" />
          <Stat label="Avg reps per set" value={rec.avgPerSet.toFixed(1)} sub={`This week ${rec.weekAvgPerSet.toFixed(1)}`} />
          <Stat label="Workday streak" value={rec.streak} sub="Days in a row with a set" />
        </div>
      </section>

      <section className="card">
        <h2>Week of {fmtDay(week[0]?.date ?? new Date(), md)}</h2>
        <WeekTable rows={week} />
      </section>
    </div>
  );
}
