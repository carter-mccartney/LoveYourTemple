// Exercise calorie estimates (MET × kg × hours, Compendium of Physical Activities).
// These are estimates of exercise only — not your total daily burn.
import type { Workout, WorkoutSet } from "./types";

const KG_PER_LB = 0.453592;
const DEFAULT_LB = 180; // used until a body weight is set in Settings

/** Walking/running MET from speed (m/s), interpolated from Compendium values. */
function metForSpeed(mps: number) {
  const mph = mps * 2.236936;
  const table: [number, number][] = [
    [2.0, 2.8], [2.5, 3.0], [3.0, 3.5], [3.5, 4.3], [4.0, 5.0], [4.5, 7.0],
    [5.0, 8.3], [6.0, 9.8], [7.0, 11.0], [8.0, 11.8], [9.0, 12.8], [10.0, 14.5],
  ];
  if (mph <= table[0][0]) return table[0][1];
  for (let i = 1; i < table.length; i++) {
    const [x1, y1] = table[i];
    const [x0, y0] = table[i - 1];
    if (mph <= x1) return y0 + ((mph - x0) / (x1 - x0)) * (y1 - y0);
  }
  return table[table.length - 1][1];
}

const MET: Record<Workout["kind"], number> = {
  walk: 3.5,
  run: 9.8,
  lift: 5.0, // vigorous weight training ≈ 6, moderate ≈ 3.5
  class: 7.3, // high-intensity aerobics such as Tae Bo
  other: 4.0,
};

export function workoutCalories(w: Pick<Workout, "kind" | "duration_s" | "distance_m">, bodyweightLb: number | null) {
  if (!w.duration_s) return 0;
  const kg = (bodyweightLb ?? DEFAULT_LB) * KG_PER_LB;
  const hours = w.duration_s / 3600;
  const met =
    (w.kind === "walk" || w.kind === "run") && w.distance_m ? metForSpeed(w.distance_m / w.duration_s) : MET[w.kind];
  return Math.round(met * kg * hours);
}

/** Push-ups outside a workout: ~0.45 kcal per rep for an 80 kg person, scaled by weight. */
export function pushupCalories(sets: WorkoutSet[], bodyweightLb: number | null) {
  const reps = sets.filter((s) => !s.workout_id).reduce((n, s) => n + s.reps, 0);
  return Math.round(reps * 0.45 * (((bodyweightLb ?? DEFAULT_LB) * KG_PER_LB) / 80));
}
