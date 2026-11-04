import { useMemo, useState } from "react";
import type { Data } from "../../lib/useData";
import { addDays, dayKey, fmtDay, startOfDay } from "../../lib/dates";
import { logsOn, rankFoods, sumLogs } from "../../lib/nutrition";
import { pushupCalories } from "../../lib/calories";
import { BarChart, type BarPoint } from "../../components/BarChart";
import { Stat } from "../../components/Stat";

const RANGES = [7, 14, 30] as const;

/** Week-end (or any range) report: macros per day, exercise burn, best and worst foods. */
export function FoodReport({ data }: { data: Data }) {
  const [days, setDays] = useState<(typeof RANGES)[number]>(7);
  const goals = data.settings.nutrition;

  const rows = useMemo(() => {
    const today = startOfDay(new Date());
    return Array.from({ length: days }, (_, i) => addDays(today, i - days + 1)).map((d) => {
      const key = dayKey(d);
      const logs = logsOn(data.food_logs, key);
      const burned =
        data.workouts.filter((w) => w.ended_at && dayKey(new Date(w.started_at)) === key).reduce((n, w) => n + (w.calories ?? 0), 0) +
        pushupCalories(data.sets.filter((s) => dayKey(new Date(s.performed_at)) === key), data.settings.bodyweightLb);
      return { d, key, logs, t: sumLogs(logs), burned };
    });
  }, [data.food_logs, data.workouts, data.sets, data.settings.bodyweightLb, days]);

  const logged = rows.filter((r) => r.logs.length);
  const avg = (f: (r: (typeof rows)[number]) => number) => (logged.length ? logged.reduce((n, r) => n + f(r), 0) / logged.length : 0);
  const ranked = useMemo(() => rankFoods(rows.flatMap((r) => r.logs)), [rows]);
  const proteinHit = goals.proteinMin != null ? logged.filter((r) => r.t.protein >= goals.proteinMin!).length : null;
  const addedOver = goals.addedSugarMax != null ? logged.filter((r) => r.t.added_sugar > goals.addedSugarMax! + 0.05).length : null;

  const pts = (value: (r: (typeof rows)[number]) => number, unit: string): BarPoint[] =>
    rows.map((r) => ({
      key: r.key,
      label: fmtDay(r.d, days <= 7 ? { weekday: "short" } : { month: "numeric", day: "numeric" }),
      value: value(r),
      tooltip: (
        <>
          <div className="tt-title">{fmtDay(r.d, { weekday: "short", month: "short", day: "numeric" })}</div>
          <div>
            <strong>{Math.round(value(r)).toLocaleString()}</strong> {unit}
          </div>
          {!r.logs.length && <div className="muted">Nothing logged</div>}
        </>
      ),
    }));

  return (
    <div className="stack">
      <div className="filters">
        <div className="seg" role="radiogroup" aria-label="Range">
          {RANGES.map((r) => (
            <button key={r} role="radio" aria-checked={r === days} className={r === days ? "on" : ""} onClick={() => setDays(r)}>
              {r} days
            </button>
          ))}
        </div>
        <span className="muted small">{logged.length} of {days} days logged · averages use logged days</span>
      </div>

      <section className="card">
        <h2>Averages</h2>
        <div className="stats-grid">
          <Stat label="Protein / day" value={`${avg((r) => r.t.protein).toFixed(0)} g`} sub={proteinHit != null ? `Goal met ${proteinHit} of ${logged.length} days` : undefined} />
          <Stat label="Calories / day" value={Math.round(avg((r) => r.t.kcal)).toLocaleString()} sub={goals.kcal ? `Target ${goals.kcal.toLocaleString()}` : undefined} />
          <Stat label="Added sugar / day" value={`${avg((r) => r.t.added_sugar).toFixed(0)} g`} sub={addedOver != null ? `Over limit ${addedOver} days` : undefined} />
          <Stat label="Sugar / day" value={`${avg((r) => r.t.sugar).toFixed(0)} g`} />
          <Stat label="Carbs / day" value={`${avg((r) => r.t.carbs).toFixed(0)} g`} />
          <Stat label="Exercise burn / day" value={`~${Math.round(rows.reduce((n, r) => n + r.burned, 0) / days)}`} sub="Workouts + daily sets, est." />
        </div>
      </section>

      <section className="card">
        <h2>Protein per day</h2>
        <BarChart points={pts((r) => r.t.protein, "g protein")} target={goals.proteinMin} targetLabel="Goal" ariaLabel="Protein grams per day" />
      </section>
      <section className="card">
        <h2>Added sugar per day</h2>
        <BarChart points={pts((r) => r.t.added_sugar, "g added sugar")} target={goals.addedSugarMax} targetLabel="Limit" overLimit ariaLabel="Added sugar grams per day" />
      </section>
      <section className="card">
        <h2>Total sugar per day</h2>
        <BarChart points={pts((r) => r.t.sugar, "g sugar")} target={goals.sugarMax} targetLabel="Limit" overLimit ariaLabel="Sugar grams per day" />
      </section>
      <section className="card">
        <h2>Carbs per day</h2>
        <BarChart points={pts((r) => r.t.carbs, "g carbs")} target={goals.carbsMax} targetLabel="Limit" overLimit ariaLabel="Carb grams per day" />
      </section>
      <section className="card">
        <h2>Calories eaten per day</h2>
        <BarChart points={pts((r) => r.t.kcal, "kcal eaten")} target={goals.kcal} ariaLabel="Calories eaten per day" />
      </section>
      <section className="card">
        <h2>Calories burned by exercise (est.)</h2>
        <BarChart points={pts((r) => r.burned, "kcal burned (est.)")} ariaLabel="Estimated exercise calories per day" />
        <p className="hint">Exercise only — not your resting burn. Set your body weight in Settings for better estimates.</p>
      </section>

      <div className="two-col">
        <section className="card">
          <h2>Best for you</h2>
          {ranked.best.length ? (
            <ol className="rank">
              {ranked.best.map((f) => (
                <li key={f.name}>
                  <strong>{f.name}</strong>
                  <span className="muted small block">{f.reason}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="muted small">Log a few days of food to see this.</p>
          )}
        </section>
        <section className="card">
          <h2>Watch list</h2>
          {ranked.worst.length ? (
            <ol className="rank">
              {ranked.worst.map((f) => (
                <li key={f.name}>
                  <strong>{f.name}</strong>
                  <span className="muted small block">{f.reason}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="muted small">Nothing high in added sugar. Nice.</p>
          )}
        </section>
      </div>

      {ranked.topProtein.length > 0 && (
        <section className="card">
          <h2>Where your protein came from</h2>
          <table className="table">
            <thead>
              <tr>
                <th>Food</th>
                <th className="num">Times</th>
                <th className="num">Protein</th>
                <th className="num">kcal</th>
              </tr>
            </thead>
            <tbody>
              {ranked.topProtein.map((f) => (
                <tr key={f.name}>
                  <td>{f.name}</td>
                  <td className="num">{f.times}</td>
                  <td className="num">{f.protein.toFixed(0)} g</td>
                  <td className="num">{Math.round(f.kcal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
