import { useEffect, useMemo, useState } from "react";
import type { Toast } from "../../App";
import type { Data } from "../../lib/useData";
import type { Settings, WorkoutSet } from "../../lib/types";
import { atTime, dayKey, fmtDuration, fmtTime, minutesBetween } from "../../lib/dates";
import { habitSets, records, restMinutes, todayPlan, weekTable } from "../../lib/stats";
import { addMinutes, enableAlerts, getPhoneShortcut, getTimer, notificationsAllowed, startPhoneTimer, startTimer, stopTimer, useRestTimer } from "../../lib/timer";import { Stat } from "../../components/Stat";
import { WeekTable } from "../../components/WeekTable";

export function useNow(ms: number) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

export function fmtCountdown(min: number) {
  const total = Math.max(0, Math.round(min * 60));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/** Whether a timer started now would end inside work hours on a workday. */
export function timerFits(settings: Settings, now = new Date()) {
  if (!settings.timerWorkHoursOnly) return true;
  const due = new Date(now.getTime() + settings.intervalMin * 60000);
  return settings.workdays.includes(now.getDay()) && now >= atTime(now, settings.workStart) && due <= atTime(now, settings.workEnd);
}

/** Reps for the next daily set: same as your last one, else the default. */
export const nextReps = (data: Data, exercise: string) =>
  data.sets.find((s) => s.exercise === exercise && !s.workout_id)?.reps ?? data.settings.defaultReps;

/** Text for the "time for your next set" notification. */
export function timerBody(data: Data, exercise: string, extraReps = 0, next = nextReps(data, exercise)) {
  const plan = todayPlan(habitSets(data.sets, data.settings), exercise, data.settings, new Date());
  const reps = plan.reps + extraReps;
  return `${next} ${exercise} · ${reps}${plan.target ? ` / ${plan.target}` : ""} today`;
}

/** Start the rest timer for the next set of `exercise`. */
export function startRest(data: Data, exercise: string, extraReps = 0, reps = nextReps(data, exercise)) {
  startTimer(data.settings.intervalMin, timerBody(data, exercise, extraReps, reps), { exercise, reps });
}

/** Log a habit set (and start the rest timer). Shared by the Push-ups screen and the Home quick button. */
export async function logHabitSet(data: Data, toast: (t: Toast) => void, exercise: string, reps: number, notes = "") {
  const added = await data.insert("sets", [{ performed_at: new Date().toISOString(), exercise, reps, notes, workout_id: null }]);
  if (!added) return false;
  navigator.vibrate?.(30);
  const timed = data.settings.autoTimer && timerFits(data.settings);
  if (timed) {
    startRest(data, exercise, reps, reps);
    startPhoneTimer(); // iPhone Clock timer, if set up on this device
  } else if (getTimer()) stopTimer(); // set done; stop any running reminder
  toast({
    msg: `Logged ${reps} ${exercise}${timed ? ` · next set in ${data.settings.intervalMin} min` : ` at ${fmtTime(new Date())}`}`,
    action: {
      label: "Undo",
      run: () => {
        data.remove("sets", [added[0].id]);
        if (timed) stopTimer();
      },
    },
  });
  return true;
}

/** Countdown to the next set, with snooze / restart / stop. */
export function RestTimerCard({ data, exercise, compact }: { data: Data; exercise: string; compact?: boolean }) {
  const timer = useRestTimer();
  const now = useNow(1000);
  const [perm, setPerm] = useState(notificationsAllowed);
  const mins = data.settings.intervalMin;
  const left = timer ? (timer.dueAt - now.getTime()) / 60000 : 0;
  const pct = timer ? Math.min(1, (now.getTime() - timer.startedAt) / (timer.dueAt - timer.startedAt)) : 0;

  return (
    <div className={`timer ${timer && left <= 0 ? "due" : ""}`}>
      {timer ? (
        <>
          <div className="timer-row">
            <div>
              <div className="eyebrow">{left > 0 ? "Next set in" : "Rest is over"}</div>
              <div className={`timer-clock ${compact ? "small" : ""}`}>{left > 0 ? fmtCountdown(left) : "Go!"}</div>
            </div>
            <div className="row">
              <button className="btn" onClick={() => addMinutes(5)} title="Snooze 5 minutes">+5 min</button>
              {!compact && (
                <button className="btn" onClick={() => startRest(data, exercise)} title={`Restart at ${mins}:00`}>
                  Restart
                </button>
              )}
              <button className="btn" onClick={stopTimer}>Stop</button>
            </div>
          </div>
          <div className="bar thin">
            <div style={{ width: `${pct * 100}%` }} />
          </div>
        </>
      ) : (
        <div className="timer-row">
          <span className="muted small">No rest timer running.</span>
          <button className="btn" onClick={() => startRest(data, exercise)}>Start {mins}:00 timer</button>
        </div>
      )}
      {!compact && getPhoneShortcut() && (
        <button className="link small" onClick={() => startPhoneTimer()}>
          Start the phone's Clock timer too
        </button>
      )}
      {!perm && !compact && "Notification" in window && Notification.permission !== "denied" && (
        <button
          className="link small"
          onClick={async () => {
            setPerm(await enableAlerts());
          }}
        >
          Turn on notifications so you're alerted when it's time
        </button>
      )}
      {!compact && "Notification" in window && Notification.permission === "denied" && (
        <p className="hint" style={{ margin: 0 }}>Notifications are blocked for this site — allow them in the browser's site settings to get alerts.</p>
      )}
    </div>
  );
}

/** Today's progress toward the daily target. Also used to show a crewmate's day. */
export function PushupProgress({ sets, settings, exercise, now, title }: { sets: WorkoutSet[]; settings: Settings; exercise: string; now: Date; title?: string }) {
  const habit = habitSets(sets, settings);
  const plan = todayPlan(habit, exercise, settings, now);
  const streak = useMemo(() => records(habit, exercise, settings, now).streak, [sets, exercise, settings, dayKey(now)]); // eslint-disable-line react-hooks/exhaustive-deps
  const pct = plan.target ? Math.min(1, plan.reps / plan.target) : 0;
  return (
    <section className="card">
      <div className="progress-head">
        <div>
          <div className="eyebrow">{title ?? `Today · ${exercise}`}</div>
          <div className="hero">
            {plan.reps}
            {plan.target > 0 && <span className="of"> / {plan.target}</span>}
          </div>
          {plan.fromWorkouts > 0 && (
            <div className="hint" style={{ marginTop: 0 }}>
              {plan.reps - plan.fromWorkouts} daily habit + {plan.fromWorkouts} in workouts
            </div>
          )}
        </div>
        {streak > 1 && <div className="streak" title="Consecutive workdays with at least one set">{streak}-day streak</div>}
      </div>
      {plan.target > 0 && (
        <div className="bar" role="progressbar" aria-valuenow={plan.reps} aria-valuemax={plan.target} aria-label="Progress to daily target">
          <div style={{ width: `${pct * 100}%` }} />
        </div>
      )}
      <div className="stats-grid">
        <Stat label="Sets" value={plan.sets} />
        <Stat label="Avg reps/set" value={plan.avg ? plan.avg.toFixed(1) : "–"} />
        {plan.target > 0 && <Stat label="Reps to go" value={plan.remaining} />}
        {plan.target > 0 && plan.remaining > 0 && (
          <Stat
            label="Needed per set"
            value={plan.setsLeft ? plan.repsPerSetNeeded : "–"}
            sub={plan.setsLeft ? `${plan.setsLeft} set${plan.setsLeft === 1 ? "" : "s"} left before ${fmtTime(atTime(now, settings.workEnd))}` : "Workday is over"}
          />
        )}
      </div>
    </section>
  );
}

export function PushupsToday({ data, onEdit, toast }: { data: Data; onEdit: (s: WorkoutSet) => void; toast: (t: Toast) => void }) {
  const { sets, settings } = data;
  const now = useNow(1000);
  const habit = useMemo(() => habitSets(sets, settings), [sets, settings]);
  const [exercise, setExercise] = useState(settings.defaultExercise);
  // Like the old macro: start from whatever you did last time for this exercise.
  const lastOfExercise = useMemo(() => sets.find((s) => s.exercise === exercise && !s.workout_id), [sets, exercise]);
  const [reps, setReps] = useState(lastOfExercise?.reps ?? settings.defaultReps);
  const [notes, setNotes] = useState("");
  const [showNotes, setShowNotes] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setReps(lastOfExercise?.reps ?? settings.defaultReps);
  }, [exercise, lastOfExercise?.id, settings.defaultReps]); // eslint-disable-line react-hooks/exhaustive-deps

  const today = dayKey(now);
  const plan = todayPlan(habit, exercise, settings, now);
  const rec = useMemo(() => records(habit, exercise, settings, new Date()), [habit, exercise, settings, today]); // eslint-disable-line react-hooks/exhaustive-deps
  const week = useMemo(() => weekTable(habit, exercise, settings, new Date()), [habit, exercise, settings, today]); // eslint-disable-line react-hooks/exhaustive-deps
  const todays = habit.filter((s) => dayKey(new Date(s.performed_at)) === today);
  const rest = useMemo(() => restMinutes(sets.filter((s) => !s.workout_id)), [sets]);

  // Chips for the default + recently used exercises; everything else lives in "More".
  const chips = useMemo(() => {
    const recent = [...new Set(sets.filter((s) => !s.workout_id).slice(0, 300).map((s) => s.exercise))];
    return [...new Set([settings.defaultExercise, ...recent])].slice(0, 4);
  }, [sets, settings.defaultExercise]);
  const shownChips = chips.includes(exercise) ? chips : [...chips, exercise];
  const more = settings.exercises.filter((e) => !shownChips.includes(e));

  async function log() {
    if (busy || reps <= 0) return;
    setBusy(true);
    const ok = await logHabitSet(data, toast, exercise, reps, notes.trim());
    setBusy(false);
    if (ok) {
      setNotes("");
      setShowNotes(false);
    }
  }

  // Keyboard shortcut for desktop, same spirit as the Excel hotkey.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === "l" || e.key === "L") {
        e.preventDefault();
        log();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const sinceLast = plan.last ? minutesBetween(new Date(plan.last.performed_at), now) : null;
  const lastWasToday = plan.last && dayKey(new Date(plan.last.performed_at)) === today;

  return (
    <div className="stack">
      <section className="card log-card">
        <div className="chips" role="radiogroup" aria-label="Exercise">
          {shownChips.map((ex) => (
            <button key={ex} role="radio" aria-checked={ex === exercise} className={`chip ${ex === exercise ? "on" : ""}`} onClick={() => setExercise(ex)}>
              {ex}
            </button>
          ))}
          {more.length > 0 && (
            <select className="chip more" value="" onChange={(e) => e.target.value && setExercise(e.target.value)} aria-label="More exercises">
              <option value="">More…</option>
              {more.map((ex) => (
                <option key={ex}>{ex}</option>
              ))}
            </select>
          )}
        </div>

        <div className="stepper" aria-label="Reps">
          <button className="btn round" onClick={() => setReps((r) => Math.max(1, r - 5))}>−5</button>
          <button className="btn round" onClick={() => setReps((r) => Math.max(1, r - 1))}>−1</button>
          <input className="reps-input" type="number" inputMode="numeric" min={1} value={reps} onChange={(e) => setReps(Math.max(0, Number(e.target.value)))} aria-label="Reps" />
          <button className="btn round" onClick={() => setReps((r) => r + 1)}>+1</button>
          <button className="btn round" onClick={() => setReps((r) => r + 5)}>+5</button>
        </div>

        {showNotes ? (
          <input className="input" placeholder="Notes (form, how it felt, aches…)" value={notes} onChange={(e) => setNotes(e.target.value)} autoFocus />
        ) : (
          <button className="link add-note" onClick={() => setShowNotes(true)}>+ Add a note</button>
        )}

        <button className="btn primary big" onClick={log} disabled={busy || reps <= 0}>
          Log {reps} {exercise}
        </button>
        <RestTimerCard data={data} exercise={exercise} />
        <p className="hint" style={{ margin: 0 }}>
          {lastWasToday && sinceLast !== null ? <>Last set {fmtDuration(sinceLast)} ago.</> : <>No sets yet today.</>} Press <kbd>L</kbd> on a keyboard to log.
        </p>
      </section>

      <PushupProgress sets={sets} settings={settings} exercise={exercise} now={now} />

      <section className="card">
        <h2>This week</h2>
        <WeekTable rows={week} />
        <p className="hint">
          {rec.weekReps} reps this week · {rec.weekPerDay.toFixed(0)} per workday · {rec.weekAvgPerSet.toFixed(1)} avg/set
        </p>
      </section>

      <section className="card">
        <h2>Today's sets</h2>
        {todays.length === 0 ? (
          <p className="muted">Nothing logged yet.</p>
        ) : (
          <ul className="set-list">
            {todays.map((s) => (
              <SetRow key={s.id} s={s} rest={rest.get(s.id)} onClick={() => onEdit(s)} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export function SetRow({ s, rest, onClick }: { s: WorkoutSet; rest?: number; onClick?: () => void }) {
  const d = new Date(s.performed_at);
  return (
    <li>
      <button className="set-row" onClick={onClick} disabled={!onClick}>
        <span className="t">{fmtTime(d)}</span>
        <span className="ex">
          <span>
            {s.exercise}
            {s.workout_id && <span className="tag">Workout</span>}
          </span>
          {s.notes && <span className="note">{s.notes}</span>}
        </span>
        <span className="rest">{rest !== undefined ? `+${fmtDuration(rest)}` : ""}</span>
        <span className="n">{s.reps}</span>
      </button>
    </li>
  );
}
