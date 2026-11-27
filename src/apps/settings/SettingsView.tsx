import { useState } from "react";
import type { Toast } from "../../App";
import type { Data } from "../../lib/useData";
import type { Settings } from "../../lib/types";
import { WEEKDAY_NAMES, dayKey } from "../../lib/dates";
import { csvToSets, download, setsToCsv } from "../../lib/csv";
import { supabase } from "../../lib/supabase";
import { getUsdaKey, setUsdaKey } from "../../lib/nutrition";
import { chime, primeAudio, testAlarm } from "../../lib/alarm";
import { getPhoneAuto, getPhoneShortcut, setPhoneAuto, setPhoneShortcut, startPhoneTimer, syncPhoneAlerts } from "../../lib/timer";
import { QuestionSettings } from "../bible/QuestionSettings";

type AnyRow = Record<string, unknown> & { id?: string };
const noId = ({ id: _id, ...r }: AnyRow) => r;

export function SettingsView({ data, email, onImportExcel, toast }: { data: Data; email?: string; onImportExcel?: () => Promise<void>; toast: (t: Toast) => void }) {
  const [s, setS] = useState<Settings>(data.settings);
  const [newEx, setNewEx] = useState("");
  const dirty = JSON.stringify(s) !== JSON.stringify(data.settings);
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setS((p) => ({ ...p, [k]: v }));
  const setN = <K extends keyof Settings["nutrition"]>(k: K, v: string) => setS((p) => ({ ...p, nutrition: { ...p.nutrition, [k]: v === "" ? null : Number(v) } }));
  const mode = data.mode;

  /** Restore a backup. IDs are re-issued, so links (set → workout, entry → food) are remapped. */
  async function restore(backup: Record<string, AnyRow[] | undefined> & { settings?: Partial<Settings> }) {
    const workoutIds = new Map<string, string>();
    const foodIds = new Map<string, string>();
    const ws = backup.workouts ?? [];
    const addedW = (await data.insert("workouts", ws.map(noId) as never)) ?? [];
    ws.forEach((w, i) => w.id && addedW[i] && workoutIds.set(w.id, addedW[i].id));
    const fs = backup.foods ?? [];
    const addedF = (await data.insert("foods", fs.map(noId) as never)) ?? [];
    fs.forEach((f, i) => f.id && addedF[i] && foodIds.set(f.id, addedF[i].id));
    const sets = (backup.sets ?? []).map((r) => ({ ...noId(r), workout_id: r.workout_id ? workoutIds.get(r.workout_id as string) ?? null : null }));
    const logs = (backup.food_logs ?? []).map((r) => ({ ...noId(r), food_id: r.food_id ? foodIds.get(r.food_id as string) ?? null : null }));
    await data.insert("sets", sets as never);
    await data.insert("food_logs", logs as never);
    await data.insert("goals", (backup.goals ?? []).map(noId) as never);
    if (backup.settings) await data.saveSettings({ ...data.settings, ...backup.settings });
    toast({ msg: `Restored ${sets.length} sets, ${ws.length} workouts, ${logs.length} food entries` });
  }

  async function importFile(file: File) {
    const text = await file.text();
    try {
      if (file.name.endsWith(".json")) await restore(JSON.parse(text));
      else {
        const sets = csvToSets(text);
        await data.insert("sets", sets);
        toast({ msg: `Imported ${sets.length} sets` });
      }
    } catch (e) {
      toast({ msg: `Import failed: ${(e as Error).message}` });
    }
  }

  return (
    <div className="stack">
      <h1>Settings</h1>
      <section className="card">
        <h2>Account & sync</h2>
        {mode === "local" ? (
          <p>
            Saved <strong>in this browser only</strong>. Back up with “Export JSON” below. Once cloud sync (Supabase) is connected you'll sign in,
            your data syncs between phone and desktop, and you can share with a crew.
          </p>
        ) : (
          <div className="row">
            <p className="grow">
              Signed in as <strong>{email}</strong>.
            </p>
            <button className="btn" onClick={() => supabase?.auth.signOut()}>Sign out</button>
          </div>
        )}
        {mode !== "local" && <PasswordBox toast={toast} />}
      </section>

      <section className="card">
        <h2>Profile</h2>
        <div className="row wrap">
          <label className="field grow">
            <span>Your name (what your crew sees)</span>
            <input className="input" value={s.displayName} onChange={(e) => set("displayName", e.target.value)} placeholder="Carter" />
          </label>
          <label className="field">
            <span>Body weight ({s.units === "metric" ? "kg" : "lb"})</span>
            <input
              className="input"
              type="number"
              inputMode="decimal"
              value={s.bodyweightLb == null ? "" : s.units === "metric" ? Math.round(s.bodyweightLb / 2.20462) : s.bodyweightLb}
              onChange={(e) => set("bodyweightLb", e.target.value === "" ? null : s.units === "metric" ? Number(e.target.value) * 2.20462 : Number(e.target.value))}
            />
          </label>
          <label className="field">
            <span>Units</span>
            <select className="input" value={s.units} onChange={(e) => set("units", e.target.value as Settings["units"])}>
              <option value="imperial">lb, miles, mph</option>
              <option value="metric">kg, km, km/h</option>
            </select>
          </label>
        </div>
        <p className="hint">Body weight is used for calorie estimates and the bodyweight-volume estimate on push-ups and pull-ups.</p>
      </section>

      <section className="card">
        <h2>Daily push-ups</h2>
        <div className="row wrap">
          <label className="field">
            <span>Workday start</span>
            <input className="input" type="time" value={s.workStart} onChange={(e) => set("workStart", e.target.value)} />
          </label>
          <label className="field">
            <span>End</span>
            <input className="input" type="time" value={s.workEnd} onChange={(e) => set("workEnd", e.target.value)} />
          </label>
          <label className="field">
            <span>Minutes between sets</span>
            <input className="input" type="number" min={1} value={s.intervalMin} onChange={(e) => set("intervalMin", Number(e.target.value))} />
          </label>
          <label className="field">
            <span>Default reps</span>
            <input className="input" type="number" min={1} value={s.defaultReps} onChange={(e) => set("defaultReps", Number(e.target.value))} />
          </label>
        </div>
        <div className="chips">
          {WEEKDAY_NAMES.map((n, i) => {
            const on = s.workdays.includes(i);
            return (
              <button key={n} className={`chip ${on ? "on" : ""}`} aria-pressed={on} onClick={() => set("workdays", on ? s.workdays.filter((d) => d !== i) : [...s.workdays, i].sort())}>
                {n.slice(0, 3)}
              </button>
            );
          })}
        </div>
        <div style={{ marginTop: 10 }}>
          <label className="check block">
            <input type="checkbox" checked={s.autoTimer} onChange={(e) => set("autoTimer", e.target.checked)} /> Start a {s.intervalMin}-minute rest timer
            after each daily set
          </label>
          <label className="check block">
            <input type="checkbox" checked={s.timerWorkHoursOnly} onChange={(e) => set("timerWorkHoursOnly", e.target.checked)} disabled={!s.autoTimer} /> Only
            during work hours on workdays (after hours, the “Logged” message has a Start timer button)
          </label>
        </div>
        <h3 style={{ marginTop: 16 }}>When the timer ends</h3>
        <div className="row wrap">
          <label className="field">
            <span>Alarm sound (app open)</span>
            <select className="input" value={s.alarmSeconds} onChange={(e) => set("alarmSeconds", Number(e.target.value))}>
              <option value={0}>Short chime</option>
              <option value={10}>Alarm, 10 seconds</option>
              <option value={30}>Alarm, 30 seconds</option>
              <option value={60}>Alarm, 1 minute</option>
              <option value={300}>Alarm until I click (max 5 min)</option>
            </select>
          </label>
          <label className="field">
            <span>Remind me again</span>
            <select className="input" value={s.remindAgainMin} onChange={(e) => set("remindAgainMin", Number(e.target.value))}>
              <option value={0}>No</option>
              <option value={2}>Every 2 min</option>
              <option value={3}>Every 3 min</option>
              <option value={5}>Every 5 min</option>
            </select>
          </label>
          <label className="field">
            <span>Up to</span>
            <select
              className="input"
              value={s.remindAgainTimes}
              disabled={!s.remindAgainMin}
              onChange={(e) => set("remindAgainTimes", Number(e.target.value))}
            >
              {[1, 2, 3, 5].map((n) => (
                <option key={n} value={n}>
                  {n} more {n === 1 ? "time" : "times"}
                </option>
              ))}
            </select>
          </label>
          <button
            className="btn"
            onClick={() => {
              primeAudio();
              if (s.alarmSeconds > 0) testAlarm();
              else chime();
            }}
          >
            Test sound
          </button>
        </div>
        <p className="hint">
          The alarm plays while the app is open — even in a background tab or minimized window. Click anywhere in the app to silence it. Repeat
          reminders are push notifications, so they reach your phone with the app closed; they stop as soon as you log a set or snooze.
        </p>
        <PhoneShortcut toast={toast} />
        <table className="table" style={{ marginTop: 12 }}>
          <thead>
            <tr>
              <th>Exercise</th>
              <th className="num">Daily target</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {s.exercises.map((ex) => (
              <tr key={ex}>
                <td>
                  <label className="radio">
                    <input type="radio" name="default-ex" checked={s.defaultExercise === ex} onChange={() => set("defaultExercise", ex)} />
                    {ex}
                  </label>
                </td>
                <td className="num">
                  <input
                    className="input small"
                    type="number"
                    min={0}
                    placeholder="–"
                    value={s.dailyTargets[ex] ?? ""}
                    onChange={(e) => {
                      const t = { ...s.dailyTargets };
                      if (e.target.value) t[ex] = Number(e.target.value);
                      else delete t[ex];
                      set("dailyTargets", t);
                    }}
                  />
                </td>
                <td className="num">
                  <button className="link" disabled={ex === s.defaultExercise} onClick={() => set("exercises", s.exercises.filter((x) => x !== ex))}>
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="hint">The selected circle is the default daily exercise. Workout sets of an exercise with a daily target count toward that day.</p>
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault();
            const n = newEx.trim();
            if (n && !s.exercises.includes(n)) set("exercises", [...s.exercises, n]);
            setNewEx("");
          }}
        >
          <input className="input grow" placeholder="Add an exercise" value={newEx} onChange={(e) => setNewEx(e.target.value)} />
          <button className="btn">Add</button>
        </form>
      </section>

      <section className="card">
        <h2>Nutrition goals</h2>
        <div className="form-grid">
          {(
            [
              ["proteinMin", "Protein, at least (g)"],
              ["kcal", "Calories target"],
              ["addedSugarMax", "Added sugar, at most (g)"],
              ["sugarMax", "Total sugar, at most (g)"],
              ["carbsMax", "Carbs, at most (g)"],
            ] as const
          ).map(([k, label]) => (
            <label key={k} className="field">
              <span>{label}</span>
              <input className="input" type="number" min={0} placeholder="none" value={s.nutrition[k] ?? ""} onChange={(e) => setN(k, e.target.value)} />
            </label>
          ))}
        </div>
        <p className="hint">Leave a box empty for no goal. Common guidance: added sugar under 25–36 g a day; protein around 0.7–1 g per lb of body weight when training.</p>
        <UsdaKey toast={toast} />
      </section>

      {dirty && (
        <div className="savebar">
          <span>Unsaved changes</span>
          <button className="btn" onClick={() => setS(data.settings)}>Discard</button>
          <button
            className="btn primary"
            onClick={async () => {
              await data.saveSettings(s);
              toast({ msg: "Settings saved" });
            }}
          >
            Save settings
          </button>
        </div>
      )}

      <section className="card">
        <h2>Bible questions</h2>
        <p className="muted small">Used by the Bible Challenge and “Name that verse.” Changes save right away.</p>
        <QuestionSettings data={data} />
      </section>

      <section className="card">
        <h2>Data</h2>
        <p className="muted">
          {data.sets.length.toLocaleString()} sets · {data.workouts.length} workouts · {data.food_logs.length} food entries · {data.foods.length} saved foods
        </p>
        <div className="row wrap">
          <button className="btn" onClick={() => download(`loveyourtemple-sets-${dayKey(new Date())}.csv`, setsToCsv(data.sets))}>Export sets CSV (Excel)</button>
          <button
            className="btn"
            onClick={() =>
              download(
                `loveyourtemple-backup-${dayKey(new Date())}.json`,
                JSON.stringify(
                  { app: "loveyourtemple", version: 2, exported_at: new Date().toISOString(), sets: data.sets, goals: data.goals, workouts: data.workouts, foods: data.foods, food_logs: data.food_logs, settings: data.settings },
                  null,
                  1,
                ),
                "application/json",
              )
            }
          >
            Export JSON backup
          </button>
          <label className="btn">
            Import CSV / JSON
            <input type="file" accept=".csv,.json" hidden onChange={(e) => e.target.files?.[0] && importFile(e.target.files[0])} />
          </label>
          {data.sets.length === 0 && onImportExcel && (
            <button className="btn primary" onClick={onImportExcel}>Import Excel history</button>
          )}
        </div>
        <details className="danger-zone">
          <summary>Danger zone</summary>
          <p>Erase everything {mode === "local" ? "in this browser" : "in your account"}. Export a backup first.</p>
          <button className="btn danger" onClick={() => confirm("Erase all sets, workouts, foods and goals? This can't be undone.") && data.clearAll()}>
            Erase all data
          </button>
        </details>
      </section>
    </div>
  );
}

/** Set or change the account password, so later sign-ins don't need an email. */
function PasswordBox({ toast }: { toast: (t: Toast) => void }) {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (pw.length < 8) return setErr("Use at least 8 characters.");
    if (pw !== pw2) return setErr("The two passwords don't match.");
    setBusy(true);
    const { error } = await supabase!.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) {
      setErr(
        /reauthenticat/i.test(error.message)
          ? "For security, sign out and sign back in with an email code, then set your password right away."
          : /different from the old/i.test(error.message)
            ? "That's already your password."
            : error.message,
      );
      return;
    }
    setPw("");
    setPw2("");
    toast({ msg: "Password saved. Next time, sign in with your email and password." });
  }

  return (
    <form onSubmit={save} style={{ marginTop: 12 }}>
      <div className="row wrap">
        <label className="field grow">
          <span>New password</span>
          <input className="input" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
        </label>
        <label className="field grow">
          <span>Type it again</span>
          <input className="input" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
        </label>
        <button className="btn" disabled={busy || !pw}>Set password</button>
      </div>
      {err && <p className="error-text">{err}</p>}
      <p className="hint">Optional. With a password you can sign in without waiting for an email. Forgot it? Sign in with an email code and set a new one here.</p>
    </form>
  );
}

/** iPhone: run a Shortcut that starts a Clock-app timer whenever a daily set is logged. This device only. */
function PhoneShortcut({ toast }: { toast: (t: Toast) => void }) {
  const [name, setName] = useState(getPhoneShortcut);
  const [saved, setSaved] = useState(getPhoneShortcut);
  const [auto, setAuto] = useState(getPhoneAuto);
  const isApple = /iPhone|iPad|Macintosh/.test(navigator.userAgent);
  if (!isApple && !saved) return null;
  return (
    <details style={{ marginTop: 12 }}>
      <summary>Also start a timer in the iPhone Clock app</summary>
      <p className="hint">
        A real Clock timer rings out loud even when your phone is locked or on silent. Set up once on this iPhone:
      </p>
      <ol className="hint">
        <li>
          Open the <strong>Shortcuts</strong> app → <strong>+</strong> → <strong>Add Action</strong> → search “Start Timer” (Clock).
        </li>
        <li>
          Tap the timer's length → tap the variable button above the keyboard → <strong>Shortcut Input</strong>, and set the unit to{" "}
          <strong>seconds</strong>. The app sends the rest time in seconds (30 min → 1800, 1.5 min → 90), so the Clock timer always matches.
        </li>
        <li>
          Name the shortcut, e.g. <strong>Pushup Timer</strong>, type that exact name below and tap Save. The first time, iPhone asks to allow opening
          Shortcuts — tap Open.
        </li>
      </ol>
      <div className="row">
        <input className="input grow" value={name} onChange={(e) => setName(e.target.value)} placeholder="Pushup Timer" autoComplete="off" />
        <button
          className="btn"
          disabled={name.trim() === saved}
          onClick={() => {
            setPhoneShortcut(name.trim());
            setSaved(name.trim());
            syncPhoneAlerts();
            toast({ msg: name.trim() ? "Saved. Logging a daily set will also start your Clock timer." : "Clock timer turned off" });
          }}
        >
          Save
        </button>
        {saved && (
          <button className="btn" onClick={() => startPhoneTimer()}>
            Test
          </button>
        )}
      </div>
      {saved && (
        <label className="check block" style={{ marginTop: 10 }}>
          <input
            type="checkbox"
            checked={auto}
            onChange={(e) => {
              setAuto(e.target.checked);
              setPhoneAuto(e.target.checked);
            }}
          />{" "}
          Also when I log a set on my computer: this iPhone gets a “Rest timer started” notification — tap it (or just open the app) and the Clock
          timer starts with the time that's left. iPhone doesn't let it start on its own while the app is closed.
        </label>
      )}
    </details>
  );
}

/** Saved on this device only (never synced or shared), per USDA's key policy. */
function UsdaKey({ toast }: { toast: (t: Toast) => void }) {
  const [key, setKey] = useState(getUsdaKey);
  const [saved, setSaved] = useState(getUsdaKey);
  return (
    <>
      <label className="field">
        <span>USDA API key (optional, this device only)</span>
        <div className="row">
          <input className="input grow" value={key} onChange={(e) => setKey(e.target.value.trim())} placeholder="Shared DEMO_KEY is used if empty" autoComplete="off" spellCheck={false} />
          <button
            className="btn"
            disabled={key === saved}
            onClick={() => {
              setUsdaKey(key);
              setSaved(key);
              toast({ msg: key ? "USDA key saved on this device" : "USDA key removed" });
            }}
          >
            Save key
          </button>
        </div>
      </label>
      <p className="hint" style={{ marginTop: 0 }}>
        Online food search uses USDA's shared key, which allows only a few searches an hour. A free personal key (1,000 searches an hour) comes
        from fdc.nal.usda.gov/api-key-signup. It's kept only in this browser, not synced or shared with your crew.
      </p>
    </>
  );
}
