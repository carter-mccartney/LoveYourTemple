// ---------- Exercise ----------

/** How a set's entered weight turns into total pounds moved. */
export type Equipment =
  | "dumbbell" // one in each hand → weight × 2
  | "dumbbell-single" // one-arm / one dumbbell → weight × 1
  | "kettlebell"
  | "barbell" // entered weight is the total (bar + plates)
  | "machine" // stack / cable / plate-loaded: as entered
  | "bodyweight" // push-ups, pull-ups: reps only, plus any added weight
  | "other";

export interface WorkoutSet {
  id: string;
  /** ISO timestamp. Date, weekday, rest time etc. are all derived from this. */
  performed_at: string;
  exercise: string;
  /** 0 for a timed set (plank) — see `seconds`. */
  reps: number;
  notes: string;
  /** Set during a workout session. Null/absent = the all-day push-up habit. */
  workout_id?: string | null;
  weight?: number | null; // as entered, per dumbbell for dumbbells
  equipment?: Equipment | null;
  seconds?: number | null;
}

export type NewSet = Omit<WorkoutSet, "id">;

export type WorkoutKind = "lift" | "walk" | "run" | "class" | "other";

export interface Workout {
  id: string;
  kind: WorkoutKind;
  title: string;
  /** Body parts for a lift: "Chest", "Back", … */
  focus: string[];
  started_at: string;
  /** Null while the workout is in progress. */
  ended_at: string | null;
  /** Active time in seconds (excludes pauses). */
  duration_s: number | null;
  distance_m: number | null;
  avg_speed_mps: number | null;
  max_speed_mps: number | null;
  /** Downsampled GPS track: [lat, lng, unix seconds]. */
  route: [number, number, number][] | null;
  /** e.g. the Tae Bo video. */
  link: string;
  calories: number | null;
  notes: string;
}

export type NewWorkout = Omit<Workout, "id">;

export interface Goal {
  id: string;
  goal_date: string; // YYYY-MM-DD
  exercise: string | null;
  target: number | null; // reps for that day, when the goal is measurable
  title: string;
  notes: string;
}

export type NewGoal = Omit<Goal, "id">;

// ---------- Food ----------

/** Per-100 g values. null = unknown (common for added sugar), which is not the same as 0. */
export interface Nutrients {
  kcal: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  sat_fat: number | null;
  fiber: number | null;
  sugar: number | null;
  added_sugar: number | null;
  sodium_mg: number | null;
}

export const NUTRIENT_KEYS: (keyof Nutrients)[] = ["kcal", "protein", "carbs", "fat", "sat_fat", "fiber", "sugar", "added_sugar", "sodium_mg"];

export const emptyNutrients = (): Nutrients => ({
  kcal: null, protein: null, carbs: null, fat: null, sat_fat: null, fiber: null, sugar: null, added_sugar: null, sodium_mg: null,
});

export type FoodSource = "scan" | "openfoodfacts" | "usda" | "builtin" | "manual";

/** A food in "My foods": scanned, looked up, or typed in once and reused. */
export interface Food {
  id: string;
  name: string;
  brand: string;
  barcode: string;
  serving_g: number;
  serving_label: string; // "1 cup", "2 tbsp", "1 container"
  per100: Nutrients;
  source: FoodSource;
  nutriscore: string; // a–e when Open Food Facts has it
  image_url: string;
  favorite: boolean;
  created_at: string;
}

export type NewFood = Omit<Food, "id">;

export type Meal = "breakfast" | "lunch" | "dinner" | "snack";

/** One thing eaten. Nutrients are copied in, so later edits to the food don't rewrite history. */
export interface FoodLog {
  id: string;
  eaten_at: string;
  meal: Meal;
  food_id: string | null;
  name: string;
  grams: number;
  servings: number;
  serving_label: string;
  /** Totals for the amount eaten (not per 100 g). */
  totals: Nutrients;
  notes: string;
}

export type NewFoodLog = Omit<FoodLog, "id">;

// ---------- Body ----------

/** One measuring session. Every field is optional; stored in lb and inches whatever the display units. */
export interface Measurement {
  id: string;
  measured_at: string;
  weight_lb: number | null;
  height_in: number | null;
  waist_in: number | null; // belly, at the navel
  belt_in: number | null; // where the belt sits
  chest_in: number | null;
  arm_in: number | null;
  thigh_in: number | null;
  calf_in: number | null;
  notes: string;
}

export type NewMeasurement = Omit<Measurement, "id">;

// ---------- Settings ----------

export interface Settings {
  displayName: string;
  units: "imperial" | "metric";
  /** Used for calorie estimates and body-weight volume. Stored in lb. */
  bodyweightLb: number | null;

  /** Daily rep target per exercise, e.g. { "Push Ups": 480 }. */
  dailyTargets: Record<string, number>;
  exercises: string[];
  defaultExercise: string;
  defaultReps: number;
  /** Minutes between sets (your "every 30 minutes"). */
  intervalMin: number;
  workStart: string; // "HH:MM"
  workEnd: string; // "HH:MM"
  /** 0 = Sunday … 6 = Saturday. Used for streaks and the week table. */
  workdays: number[];
  /** Start the rest timer automatically after each daily set. */
  autoTimer: boolean;
  /** Only auto-start when the next set would fall inside work hours on a workday. */
  timerWorkHoursOnly: boolean;

  nutrition: {
    kcal: number | null; // daily target
    proteinMin: number | null;
    carbsMax: number | null;
    sugarMax: number | null;
    addedSugarMax: number | null;
  };
  /** Foods you brought today, shown as one-tap buttons. */
  packed: { date: string; foodIds: string[] };
}

export const DEFAULT_SETTINGS: Settings = {
  displayName: "",
  units: "imperial",
  bodyweightLb: null,
  dailyTargets: { "Push Ups": 480 },
  exercises: [
    "Push Ups",
    "Split Squats",
    "Calf Raises",
    "Full Squats",
    "Wall Sits",
    "Bulgarian Split Squats",
    "Reverse Lunges",
    "Archer Push Ups",
    "Diamond Push Ups",
    "Wide Push Ups",
    "Pike Push Ups",
  ],
  defaultExercise: "Push Ups",
  defaultReps: 40,
  intervalMin: 30,
  workStart: "06:15",
  workEnd: "15:15",
  workdays: [1, 2, 3, 4, 5],
  autoTimer: true,
  timerWorkHoursOnly: true,
  nutrition: { kcal: null, proteinMin: 150, carbsMax: null, sugarMax: 50, addedSugarMax: 25 },
  packed: { date: "", foodIds: [] },
};

// ---------- Store ----------

export interface Collections {
  sets: WorkoutSet;
  goals: Goal;
  workouts: Workout;
  foods: Food;
  food_logs: FoodLog;
  measurements: Measurement;
}

export type CollectionName = keyof Collections;
export type Row<K extends CollectionName> = Collections[K];
export type NewRow<K extends CollectionName> = Omit<Collections[K], "id">;
