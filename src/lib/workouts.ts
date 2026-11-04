import { useEffect, useState } from "react";
import type { Data } from "./useData";
import type { Settings, Workout, WorkoutKind, WorkoutSet } from "./types";
import { bodyweightVolume, LB_PER_KG, setVolume } from "./lifts";
import { workoutCalories } from "./calories";
import { fmtClock, fmtDistance, fmtSpeed } from "./units";
import { go } from "./router";

export const KIND_LABEL: Record<WorkoutKind, string> = {
  lift: "Lift",
  walk: "Walk",
  run: "Run",
  class: "Video / class",
  other: "Other",
};

export const KIND_ICON: Record<WorkoutKind, string> = {
  lift: "M6 7v10M18 7v10M3 10v4M21 10v4M6 12h12",
  walk: "M13 4a1.5 1.5 0 1 0 0-.01M10 21l2-6 3 3v3M9 12l2-4 3 2 3 1M11 8l-3 3",
  run: "M14 4a1.5 1.5 0 1 0 0-.01M5 20l4-5 3 2 2-4 4 1M9 11l3-3 3 2 3-1",
  class: "M4 5h16v11H4zM10 8.5v5l4-2.5zM8 20h8",
  other: "M12 3v18M3 12h18",
};

export const setsOf = (sets: WorkoutSet[], workoutId: string) =>
  sets.filter((s) => s.workout_id === workoutId).sort((a, b) => a.performed_at.localeCompare(b.performed_at));

/** Weight-moved totals. Weights are stored in the user's unit; `toLb` normalizes for comparisons. */
export function liftTotals(sets: WorkoutSet[], settings: Settings) {
  const bw = settings.units === "metric" && settings.bodyweightLb ? settings.bodyweightLb / LB_PER_KG : settings.bodyweightLb;
  return {
    volume: sets.reduce((n, s) => n + setVolume(s), 0),
    bodyweightVolume: sets.reduce((n, s) => n + bodyweightVolume(s, bw), 0),
    sets: sets.length,
    reps: sets.reduce((n, s) => n + s.reps, 0),
    exercises: new Set(sets.map((s) => s.exercise)).size,
  };
}

export function summary(w: Workout, sets: WorkoutSet[], settings: Settings) {
  const parts: string[] = [];
  if (w.duration_s) parts.push(fmtClock(w.duration_s));
  if (w.distance_m) parts.push(fmtDistance(w.distance_m, settings.units));
  if (w.avg_speed_mps) parts.push(`avg ${fmtSpeed(w.avg_speed_mps, settings.units)}`);
  if (w.kind === "lift") {
    const t = liftTotals(sets, settings);
    parts.push(`${t.exercises} exercises · ${t.sets} sets`);
    if (t.volume) parts.push(`${Math.round(t.volume).toLocaleString()} ${settings.units === "metric" ? "kg" : "lb"} moved`);
  }
  if (w.calories) parts.push(`~${w.calories} kcal`);
  return parts.join(" · ");
}

export function newWorkout(kind: WorkoutKind, title?: string, link = ""): Omit<Workout, "id"> {
  return {
    kind,
    title: title ?? KIND_LABEL[kind],
    focus: [],
    started_at: new Date().toISOString(),
    ended_at: null,
    duration_s: null,
    distance_m: null,
    avg_speed_mps: null,
    max_speed_mps: null,
    route: null,
    link,
    calories: null,
    notes: "",
  };
}

export async function startWorkout(data: Data, kind: WorkoutKind, title?: string, link = "") {
  const added = await data.insert("workouts", [newWorkout(kind, title, link)]);
  if (added?.[0]) go("workouts", added[0].id);
}

export async function finishWorkout(data: Data, w: Workout, patch: Partial<Workout>) {
  const merged = { ...w, ...patch };
  const duration_s = merged.duration_s ?? Math.round((Date.now() - new Date(w.started_at).getTime()) / 1000);
  await data.update("workouts", w.id, {
    ...patch,
    duration_s,
    ended_at: patch.ended_at ?? new Date().toISOString(),
    calories: workoutCalories({ kind: w.kind, duration_s, distance_m: merged.distance_m }, data.settings.bodyweightLb),
  });
}

export async function deleteWorkout(data: Data, w: Workout) {
  await data.remove("sets", setsOf(data.sets, w.id).map((s) => s.id));
  await data.remove("workouts", [w.id]);
  try {
    localStorage.removeItem(`replog.track.${w.id}`);
    localStorage.removeItem(`replog.watch.${w.id}`);
  } catch {
    /* ignore */
  }
}

/** Pause-able stopwatch for timed workouts, persisted so a reload keeps the time. */
export function useStopwatch(id: string, autoStartAt?: string) {
  const key = `replog.watch.${id}`;
  const [s, setS] = useState<{ activeMs: number; runningSince: number | null }>(() => {
    try {
      const saved = localStorage.getItem(key);
      if (saved) return JSON.parse(saved);
    } catch {
      /* fall through */
    }
    return { activeMs: 0, runningSince: autoStartAt ? new Date(autoStartAt).getTime() : null };
  });
  const [, tick] = useState(0);
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(s));
    } catch {
      /* ignore */
    }
  }, [s, key]);
  useEffect(() => {
    if (!s.runningSince) return;
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [s.runningSince]);
  const seconds = (s.activeMs + (s.runningSince ? Date.now() - s.runningSince : 0)) / 1000;
  return {
    seconds,
    running: !!s.runningSince,
    toggle: () =>
      setS((p) => (p.runningSince ? { activeMs: p.activeMs + Date.now() - p.runningSince, runningSince: null } : { ...p, runningSince: Date.now() })),
    clear: () => {
      try {
        localStorage.removeItem(key);
      } catch {
        /* ignore */
      }
    },
  };
}
