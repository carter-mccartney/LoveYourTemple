// Lift entry parsing and "total pounds moved" math.
import type { Equipment, WorkoutSet } from "./types";

export const EQUIPMENT_LABEL: Record<Equipment, string> = {
  dumbbell: "Dumbbells (pair)",
  "dumbbell-single": "One dumbbell",
  kettlebell: "Kettlebell",
  barbell: "Barbell",
  machine: "Machine / cable",
  bodyweight: "Bodyweight",
  other: "Other",
};

/** How many times the entered weight counts. A pair of 50 lb dumbbells moves 100 lb per rep. */
export const MULTIPLIER: Record<Equipment, number> = {
  dumbbell: 2,
  "dumbbell-single": 1,
  kettlebell: 1,
  barbell: 1,
  machine: 1,
  bodyweight: 1,
  other: 1,
};

/**
 * Rough share of body weight lifted per rep, for the separate "bodyweight volume"
 * estimate. Push-ups ≈ 64% (Ebben et al. 2011); pull-ups, chin-ups and dips ≈ the whole body.
 */
const BODYWEIGHT_SHARE: [RegExp, number][] = [
  [/pull[- ]?ups?|chin[- ]?ups?|muscle[- ]?ups?|dips?\b/i, 1],
  [/handstand/i, 0.95],
  [/pike/i, 0.7],
  [/push[- ]?ups?/i, 0.64],
  [/inverted row|australian/i, 0.5],
  [/squats?|lunges?/i, 0.65],
];

export const bodyweightShare = (exercise: string) => BODYWEIGHT_SHARE.find(([re]) => re.test(exercise))?.[1] ?? 0;

const BODYWEIGHT_NAMES = /push[- ]?ups?|pull[- ]?ups?|chin[- ]?ups?|dips?\b|sit[- ]?ups?|crunch|plank|burpee|mountain climber|jumping jack|wall sit|air squat|lunges?\b|split squat|calf raise|muscle[- ]?up|leg raise|hollow hold|handstand|inverted row/i;
const BARBELL_NAMES = /bench press|deadlift|back squat|front squat|^squats?$|overhead press|military press|barbell|\bbb\b|ez[- ]?bar|hip thrust|good morning|power clean|clean and jerk|snatch|pendlay|t[- ]?bar/i;
const MACHINE_NAMES = /machine|cable|smith|leg press|lat pull[- ]?down|pulldown|pec deck|leg extension|leg curl|seated row|hack squat|chest press|assisted/i;
const DUMBBELL_NAMES = /dumbbells?|\bdbs?\b|curls?|lateral raise|side raise|front raise|flyes?|flys?|shrugs?|hammer|arnold|kickbacks?|goblet|renegade/i;
const SINGLE = /single[- ]?arm|one[- ]?arm|single dumbbell|one dumbbell|concentration|goblet/i;

/** Best guess at the equipment from the exercise name; the user can change it per line. */
export function guessEquipment(name: string, hasWeight: boolean): Equipment {
  if (/kettlebell|\bkb\b/i.test(name)) return /double/i.test(name) ? "dumbbell" : "kettlebell";
  if (MACHINE_NAMES.test(name)) return "machine";
  if (BARBELL_NAMES.test(name)) return "barbell";
  if (DUMBBELL_NAMES.test(name)) return SINGLE.test(name) ? "dumbbell-single" : "dumbbell";
  // Weighted lunges / split squats / step-ups are usually a dumbbell in each hand.
  if (hasWeight && /lunges?|split squats?|step[- ]?ups?|calf raises?|farmer/i.test(name)) return "dumbbell";
  if (BODYWEIGHT_NAMES.test(name)) return "bodyweight";
  return hasWeight ? "other" : "bodyweight";
}

export interface ParsedLine {
  exercise: string;
  equipment: Equipment;
  weight: number | null;
  unit: "lb" | "kg";
  sets: number;
  reps: number;
  seconds: number | null;
}

const titleCase = (s: string) => s.replace(/\b([a-z])/g, (m) => m.toUpperCase());

/** "pushups", "push-ups", "Push ups" → "Push Ups", so workout push-ups line up with the daily habit. */
export function normalizeExercise(name: string) {
  const t = titleCase(name.trim().toLowerCase().replace(/\s+/g, " "));
  return t
    .replace(/\bPush[- ]?Ups?\b/g, "Push Ups")
    .replace(/\bPull[- ]?Ups?\b/g, "Pull Ups")
    .replace(/\bChin[- ]?Ups?\b/g, "Chin Ups")
    .replace(/\bSit[- ]?Ups?\b/g, "Sit Ups");
}

/**
 * "50 lb dumbbell curls 3x10", "bench press 150 x 8", "pull ups 12",
 * "plank 60s", "goblet squat 40lb 3 sets of 12".
 */
export function parseLiftLine(input: string, defaultUnit: "lb" | "kg" = "lb"): ParsedLine | null {
  let s = ` ${input.toLowerCase().replace(/×/g, "x")} `;
  let weight: number | null = null;
  let unit = defaultUnit;
  let sets = 1;
  let reps = 0;
  let seconds: number | null = null;
  const take = (re: RegExp) => {
    const m = s.match(re);
    if (m) s = s.replace(m[0], " ");
    return m;
  };

  let m = take(/(\d+(?:\.\d+)?)\s*(lbs?|pounds?|#|kgs?|kilos?)\b/);
  if (m) {
    weight = Number(m[1]);
    unit = /k/.test(m[2]) ? "kg" : "lb";
  }
  if ((m = take(/(\d+)\s*sets?\s*(?:of|x)?\s*(\d+)/))) {
    sets = Number(m[1]);
    reps = Number(m[2]);
  } else if ((m = take(/(\d+(?:\.\d+)?)\s*x\s*(\d+)(?:\s*x\s*(\d+))?/))) {
    const [a, b, c] = [Number(m[1]), Number(m[2]), m[3] ? Number(m[3]) : null];
    if (c !== null) {
      // 150x3x10 → weight × sets × reps
      weight ??= a;
      sets = b;
      reps = c;
    } else if (a <= 10 && weight === null && b <= 50) {
      sets = a; // 3x10
      reps = b;
    } else if (a <= 10 && weight !== null) {
      sets = a;
      reps = b;
    } else {
      weight ??= a; // 150x8 → 150 lb for 8
      reps = b;
    }
  }
  if ((m = take(/(\d+)\s*(s|sec|secs|seconds|min|mins|minutes)\b/))) {
    seconds = Number(m[1]) * (m[2].startsWith("m") ? 60 : 1);
  }
  if (!reps && (m = take(/(\d+)\s*reps?\b/))) reps = Number(m[1]);

  const loose = [...s.matchAll(/\b\d+(?:\.\d+)?\b/g)].map((x) => Number(x[0]));
  s = s.replace(/\b\d+(?:\.\d+)?\b/g, " ").replace(/\b(reps?|sets?|of|for|with|at|lbs?|x)\b/g, " ");
  const name = s.replace(/[^a-z\- ]/g, " ").replace(/\s+/g, " ").trim();
  if (!name) return null;

  const equipment = guessEquipment(name, weight !== null || loose.length > 1);
  for (const n of loose) {
    if (!reps && equipment === "bodyweight") reps = n;
    else if (weight === null && equipment !== "bodyweight") weight = n;
    else if (!reps) reps = n;
  }
  if (!reps && !seconds) reps = 10;

  return { exercise: normalizeExercise(name), equipment, weight, unit, sets, reps: seconds ? 0 : reps, seconds };
}

export const LB_PER_KG = 2.20462;

/** Pounds moved by one set (weights stored in the user's unit; caller converts). */
export function setVolume(s: Pick<WorkoutSet, "reps" | "weight" | "equipment">) {
  if (!s.weight || !s.reps) return 0;
  return s.weight * MULTIPLIER[s.equipment ?? "other"] * s.reps;
}

/** Estimated body weight moved (reps × share of body weight). Kept separate from plate weight. */
export function bodyweightVolume(s: Pick<WorkoutSet, "reps" | "exercise" | "equipment">, bodyweight: number | null) {
  if (!bodyweight || !s.reps || s.equipment !== "bodyweight") return 0;
  return s.reps * bodyweight * bodyweightShare(s.exercise);
}

export const BODY_PARTS = ["Chest", "Back", "Shoulders", "Biceps", "Triceps", "Legs", "Glutes", "Core", "Full body"];

/** Total weight shown on a set chip, e.g. "50 ×2". */
export function weightLabel(s: Pick<WorkoutSet, "weight" | "equipment">, unit: string) {
  if (!s.weight) return s.equipment === "bodyweight" ? "BW" : "";
  return `${s.weight} ${unit}${MULTIPLIER[s.equipment ?? "other"] === 2 ? " ×2" : ""}`;
}
