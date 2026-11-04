// All the math that used to live in the HOME sheet's formulas.
import { addDays, atTime, dayKey, fromDayKey, minutesBetween, startOfDay, startOfWeek } from "./dates";
import type { Goal, Settings, WorkoutSet } from "./types";

export interface DayAgg {
  key: string;
  reps: number;
  sets: number;
  maxSet: number;
}

/** Sets sorted oldest → newest (the store keeps them newest-first). */
export const chronological = (sets: WorkoutSet[]) =>
  [...sets].sort((a, b) => a.performed_at.localeCompare(b.performed_at));

/**
 * Sets the push-up app works with: the all-day habit, plus (optionally) workout
 * sets of exercises that have a daily target — workout push-ups count toward the day.
 */
export function habitSets(sets: WorkoutSet[], settings: Settings, includeWorkouts = true) {
  return sets.filter((s) => !s.workout_id || (includeWorkouts && settings.dailyTargets[s.exercise] != null));
}

export const ofExercise = (sets: WorkoutSet[], exercise: string) => sets.filter((s) => s.exercise === exercise);

export function byDay(sets: WorkoutSet[]): Map<string, DayAgg> {
  const m = new Map<string, DayAgg>();
  for (const s of sets) {
    const k = dayKey(new Date(s.performed_at));
    const a = m.get(k) ?? { key: k, reps: 0, sets: 0, maxSet: 0 };
    a.reps += s.reps;
    a.sets += 1;
    a.maxSet = Math.max(a.maxSet, s.reps);
    m.set(k, a);
  }
  return m;
}

/** Minutes since the previous set on the same day (any exercise) — the "Rest" column. */
export function restMinutes(sets: WorkoutSet[]): Map<string, number> {
  const out = new Map<string, number>();
  const sorted = chronological(sets);
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1].performed_at);
    const cur = new Date(sorted[i].performed_at);
    if (dayKey(prev) === dayKey(cur)) out.set(sorted[i].id, minutesBetween(prev, cur));
  }
  return out;
}

export function todayPlan(sets: WorkoutSet[], exercise: string, settings: Settings, now: Date) {
  const today = dayKey(now);
  const todays = ofExercise(sets, exercise).filter((s) => dayKey(new Date(s.performed_at)) === today);
  const reps = todays.reduce((n, s) => n + s.reps, 0);
  const target = settings.dailyTargets[exercise] ?? 0;
  const remaining = Math.max(0, target - reps);
  const end = atTime(now, settings.workEnd);
  const minutesLeft = Math.max(0, minutesBetween(now, end));
  // Same idea as the sheet's "Estimated sets left for 30min sets", rounded up so a
  // set you can still squeeze in before quitting time counts.
  const setsLeft = Math.ceil(minutesLeft / settings.intervalMin);
  // The 30-minute rhythm follows habit sets only; a workout doesn't reset it.
  const habit = sets.filter((s) => !s.workout_id);
  const last = habit.length ? habit.reduce((a, b) => (a.performed_at > b.performed_at ? a : b)) : undefined;
  const fromWorkouts = todays.filter((s) => s.workout_id).reduce((n, s) => n + s.reps, 0);
  const nextDue = last ? new Date(new Date(last.performed_at).getTime() + settings.intervalMin * 60000) : undefined;
  return {
    reps,
    fromWorkouts,
    sets: todays.length,
    avg: todays.length ? reps / todays.length : 0,
    target,
    remaining,
    minutesLeft,
    setsLeft,
    repsPerSetNeeded: remaining && setsLeft ? Math.ceil(remaining / setsLeft) : 0,
    setsAtDefault: Math.ceil(remaining / Math.max(1, settings.defaultReps)),
    last,
    nextDue,
  };
}

/** Mon–Fri (or whatever workdays are set) rows for the current week. */
export function weekTable(sets: WorkoutSet[], exercise: string, settings: Settings, now: Date) {
  const days = byDay(ofExercise(sets, exercise));
  const monday = startOfWeek(now);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i))
    .filter((d) => settings.workdays.includes(d.getDay()) || days.has(dayKey(d)))
    .map((d) => {
      const a = days.get(dayKey(d));
      return { date: d, reps: a?.reps ?? 0, sets: a?.sets ?? 0, avg: a ? a.reps / a.sets : 0, isToday: dayKey(d) === dayKey(now) };
    });
}

export function records(sets: WorkoutSet[], exercise: string, settings: Settings, now: Date) {
  const mine = ofExercise(sets, exercise);
  const days = [...byDay(mine).values()];
  const total = mine.reduce((n, s) => n + s.reps, 0);
  const bestDay = days.reduce<DayAgg | undefined>((a, b) => (!a || b.reps > a.reps ? b : a), undefined);
  const mostSets = days.reduce<DayAgg | undefined>((a, b) => (!a || b.sets > a.sets ? b : a), undefined);
  const bestSet = mine.reduce<WorkoutSet | undefined>((a, b) => (!a || b.reps > a.reps ? b : a), undefined);

  const weeks = new Map<string, number>();
  for (const d of days) {
    const wk = dayKey(startOfWeek(fromDayKey(d.key)));
    weeks.set(wk, (weeks.get(wk) ?? 0) + d.reps);
  }
  let bestWeek: { start: string; reps: number } | undefined;
  for (const [start, reps] of weeks) if (!bestWeek || reps > bestWeek.reps) bestWeek = { start, reps };

  const firstKey = days.map((d) => d.key).sort()[0];
  const calendarDays = firstKey ? Math.max(1, Math.round(minutesBetween(fromDayKey(firstKey), startOfDay(now)) / 1440) + 1) : 0;

  const thisWeek = weekTable(sets, exercise, settings, now);
  const weekReps = thisWeek.reduce((n, d) => n + d.reps, 0);
  const weekSets = thisWeek.reduce((n, d) => n + d.sets, 0);
  const elapsedWorkdays = thisWeek.filter((d) => d.date <= now && settings.workdays.includes(d.date.getDay())).length;

  return {
    total,
    totalSets: mine.length,
    activeDays: days.length,
    firstKey,
    perActiveDay: days.length ? total / days.length : 0,
    perCalendarDay: calendarDays ? total / calendarDays : 0,
    avgPerSet: mine.length ? total / mine.length : 0,
    bestDay,
    mostSets,
    bestSet,
    bestWeek,
    weekReps,
    weekSets,
    weekPerDay: elapsedWorkdays ? weekReps / elapsedWorkdays : 0,
    weekAvgPerSet: weekSets ? weekReps / weekSets : 0,
    streak: streak(mine, settings, now),
  };
}

/** Consecutive workdays (back from today) with at least one set. Today doesn't break it until it's over. */
export function streak(sets: WorkoutSet[], settings: Settings, now: Date) {
  const active = new Set(sets.map((s) => dayKey(new Date(s.performed_at))));
  let d = startOfDay(now);
  if (!active.has(dayKey(d))) d = addDays(d, -1);
  let n = 0;
  for (let guard = 0; guard < 3650; guard++, d = addDays(d, -1)) {
    if (active.has(dayKey(d))) n++;
    else if (settings.workdays.includes(d.getDay())) break;
  }
  return n;
}

export type Range = "1W" | "1M" | "3M" | "1Y" | "All";

export interface Bucket {
  key: string;
  start: Date;
  reps: number;
  sets: number;
}

/** Daily buckets for short ranges, weekly beyond three months. */
export function series(sets: WorkoutSet[], exercise: string, range: Range, settings: Settings, now: Date) {
  const mine = ofExercise(sets, exercise);
  const days = byDay(mine);
  const first = mine.length ? startOfDay(new Date(chronological(mine)[0].performed_at)) : startOfDay(now);
  const span: Record<Range, number> = { "1W": 7, "1M": 30, "3M": 91, "1Y": 365, All: Infinity };
  let from = addDays(startOfDay(now), -(span[range] - 1));
  if (range === "All" || from < first) from = first;
  const weekly = range === "1Y" || range === "All" ? minutesBetween(from, now) / 1440 > 120 : false;

  const out: Bucket[] = [];
  if (weekly) {
    for (let w = startOfWeek(from); w <= now; w = addDays(w, 7)) {
      const b: Bucket = { key: dayKey(w), start: w, reps: 0, sets: 0 };
      for (let i = 0; i < 7; i++) {
        const a = days.get(dayKey(addDays(w, i)));
        if (a) { b.reps += a.reps; b.sets += a.sets; }
      }
      out.push(b);
    }
  } else {
    for (let d = from; d <= now; d = addDays(d, 1)) {
      const a = days.get(dayKey(d));
      // Skip empty non-workdays so weekends don't leave gaps in the chart.
      if (!a && !settings.workdays.includes(d.getDay())) continue;
      out.push({ key: dayKey(d), start: d, reps: a?.reps ?? 0, sets: a?.sets ?? 0 });
    }
  }
  return { buckets: out, bucket: weekly ? ("week" as const) : ("day" as const) };
}

/** A goal is "hit" when that day's reps of its exercise reached its target. */
export function goalStatus(goal: Goal, sets: WorkoutSet[], now: Date) {
  if (!goal.exercise || !goal.target) return { state: "note" as const, reps: 0 };
  const reps = ofExercise(sets, goal.exercise)
    .filter((s) => dayKey(new Date(s.performed_at)) === goal.goal_date)
    .reduce((n, s) => n + s.reps, 0);
  const today = dayKey(now);
  if (goal.goal_date > today) return { state: "upcoming" as const, reps };
  if (reps >= goal.target) return { state: "hit" as const, reps };
  return { state: goal.goal_date === today ? ("in-progress" as const) : ("missed" as const), reps };
}
