import { useMemo } from "react";
import type { Toast } from "../../App";
import type { Data } from "../../lib/useData";
import { dayKey, fmtDay } from "../../lib/dates";
import { habitSets, todayPlan } from "../../lib/stats";
import { logsOn, sumLogs } from "../../lib/nutrition";
import { pushupCalories } from "../../lib/calories";
import { setsOf, summary } from "../../lib/workouts";
import { go } from "../../lib/router";
import { RestTimerCard, logHabitSet, useNow } from "../pushups/Today";
import { KindIcon, StartButtons } from "../workouts/WorkoutsApp";
import { MacroBar } from "../food/FoodToday";
import { earliest, fieldOf, fmtBody, latest, toDisplay } from "../../lib/body";
import { dailyGoal, dayTotals, streak } from "../../lib/bible/progress";
import { fmtChapters } from "../bible/shared";

export function Home({ data, toast, cloud }: { data: Data; toast: (t: Toast) => void; cloud: boolean }) {
  const { settings } = data;
  const now = useNow(1000);
  const today = dayKey(now);
  const ex = settings.defaultExercise;
  const habit = useMemo(() => habitSets(data.sets, settings), [data.sets, settings]);
  const plan = todayPlan(habit, ex, settings, now);
  const quickReps = data.sets.find((s) => s.exercise === ex && !s.workout_id)?.reps ?? settings.defaultReps;

  const workoutsToday = data.workouts.filter((w) => dayKey(new Date(w.started_at)) === today);
  const active = data.workouts.filter((w) => !w.ended_at);
  const food = sumLogs(logsOn(data.food_logs, today));
  const burned =
    workoutsToday.reduce((n, w) => n + (w.calories ?? 0), 0) +
    pushupCalories(data.sets.filter((s) => dayKey(new Date(s.performed_at)) === today), settings.bodyweightLb);
  const hour = now.getHours();
  const hello = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="stack">
      <div>
        <div className="eyebrow">{fmtDay(now, { weekday: "long", month: "long", day: "numeric" })}</div>
        <h1>
          {hello}
          {settings.displayName ? `, ${settings.displayName}` : ""}
        </h1>
      </div>

      {active.map((w) => (
        <a key={w.id} className="card active-banner" href={`#/workouts/${w.id}`}>
          <KindIcon kind={w.kind} />
          <span className="grow">
            <strong>{w.title}</strong> in progress
          </span>
          <span className="btn primary">Resume</span>
        </a>
      ))}

      <div className="hub">
        <section className="card tile">
          <a className="tile-head" href="#/pushups">
            <span>Daily {ex}</span>
            <span className="chev">›</span>
          </a>
          <div className="hero">
            {plan.reps}
            {plan.target > 0 && <span className="of"> / {plan.target}</span>}
          </div>
          {plan.target > 0 && (
            <div className="bar">
              <div style={{ width: `${Math.min(100, (plan.reps / plan.target) * 100)}%` }} />
            </div>
          )}
          {plan.fromWorkouts > 0 && <p className="hint" style={{ margin: 0 }}>Includes {plan.fromWorkouts} from workouts</p>}
          <RestTimerCard data={data} exercise={ex} compact />
          <button className="btn primary big" onClick={() => logHabitSet(data, toast, ex, quickReps)}>
            + Log {quickReps}
          </button>
        </section>

        <section className="card tile">
          <a className="tile-head" href="#/food">
            <span>Food today</span>
            <span className="chev">›</span>
          </a>
          <MacroBar label="Protein" value={food.protein} goal={settings.nutrition.proteinMin} kind="min" />
          <MacroBar label="Added sugar" value={food.added_sugar} goal={settings.nutrition.addedSugarMax} kind="max" floor={food.addedSugarUnknown > 0} />
          <MacroBar label="Calories" value={food.kcal} goal={settings.nutrition.kcal} kind="target" unit="kcal" />
          <div className="row">
            <button className="btn primary grow" onClick={() => go("food", "add", "scan")}>Scan</button>
            <button className="btn grow" onClick={() => go("food", "add")}>Add food</button>
          </div>
        </section>

        <section className="card tile">
          <a className="tile-head" href="#/workouts">
            <span>Workouts</span>
            <span className="chev">›</span>
          </a>
          {workoutsToday.filter((w) => w.ended_at).map((w) => (
            <a key={w.id} className="mini-row" href={`#/workouts/${w.id}`}>
              <KindIcon kind={w.kind} size={18} />
              <span>
                <strong>{w.title}</strong> <span className="muted small">{summary(w, setsOf(data.sets, w.id), settings)}</span>
              </span>
            </a>
          ))}
          {!workoutsToday.length && <p className="muted small">No workout yet today. Start one:</p>}
          <StartButtons data={data} />
          {burned > 0 && <p className="hint">~{burned} kcal burned by exercise today (est.)</p>}
        </section>

        <BodyTile data={data} />

        <BibleTile data={data} />

        <section className="card tile">
          <a className="tile-head" href="#/crew">
            <span>Crew</span>
            <span className="chev">›</span>
          </a>
          <p className="muted small">
            {cloud
              ? "See your crewmates' progress and get a ping when they finish a set."
              : "Share your day with a workout buddy or family — available once cloud sync is connected."}
          </p>
          <button className="btn" onClick={() => go("crew")}>{cloud ? "Open crew" : "How it works"}</button>
        </section>
      </div>
    </div>
  );
}

function BodyTile({ data }: { data: Data }) {
  const units = data.settings.units;
  const wf = fieldOf("weight_lb");
  const bf = fieldOf("waist_in");
  const w = latest(data.measurements, "weight_lb");
  const w0 = earliest(data.measurements, "weight_lb");
  const belly = latest(data.measurements, "waist_in");
  const belly0 = earliest(data.measurements, "waist_in");
  const change = (a: number, b: number, f: typeof wf) => {
    const d = toDisplay(f, a - b, units)!;
    return Math.abs(d) < 0.05 ? "no change" : `${d > 0 ? "▲" : "▼"} ${Math.abs(d).toFixed(1)} since start`;
  };
  return (
    <section className="card tile">
      <a className="tile-head" href="#/body">
        <span>Body</span>
        <span className="chev">›</span>
      </a>
      {w || belly ? (
        <div className="stats-grid">
          {w && (
            <div className="stat">
              <div className="stat-label">Weight</div>
              <div className="stat-value">{fmtBody(wf, w.value, units)}</div>
              {w0 && w0.at !== w.at && <div className="stat-sub">{change(w.value, w0.value, wf)}</div>}
            </div>
          )}
          {belly && (
            <div className="stat">
              <div className="stat-label">Belly</div>
              <div className="stat-value">{fmtBody(bf, belly.value, units)}</div>
              {belly0 && belly0.at !== belly.at && <div className="stat-sub">{change(belly.value, belly0.value, bf)}</div>}
            </div>
          )}
        </div>
      ) : (
        <p className="muted small">Log weight and tape measurements (belly, chest, arms, legs) to see your body change over time.</p>
      )}
      <button className="btn" onClick={() => go("body")}>{w || belly ? "Log measurements" : "Start a baseline"}</button>
    </section>
  );
}

function BibleTile({ data }: { data: Data }) {
  const goal = dailyGoal(data.settings.bible.tracks);
  const done = dayTotals(data.bible_reads, dayKey(new Date())).total;
  const days = streak(data.bible_reads, data.settings);
  const due = data.memory_verses.filter((v) => v.due <= dayKey(new Date())).length;
  return (
    <section className="card tile">
      <a className="tile-head" href="#/bible">
        <span>Bible</span>
        <span className="chev">›</span>
      </a>
      <div className="hero">
        {fmtChapters(done)}
        {goal > 0 && <span className="of"> / {goal} chapters</span>}
      </div>
      {goal > 0 && (
        <div className={`bar ${done >= goal - 0.01 ? "met" : ""}`}>
          <div style={{ width: `${Math.min(1, done / goal) * 100}%` }} />
        </div>
      )}
      <p className="muted small" style={{ margin: 0 }}>
        {days ? `${days}-day streak` : "Start a streak today"}
        {due ? ` · ${due} memory verse${due === 1 ? "" : "s"} to review` : ""}
      </p>
      <button className="btn" onClick={() => go("bible")}>{done ? "Log more" : "Log today's reading"}</button>
    </section>
  );
}
