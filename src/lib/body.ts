import type { Measurement, Settings } from "./types";

export type BodyKey = Exclude<keyof Measurement, "id" | "measured_at" | "notes">;

export interface BodyField {
  key: BodyKey;
  label: string;
  kind: "weight" | "length";
  /** How to measure it the same way every time. */
  how: string;
  /** For a size, is down good? (belly yes, arms no). null = neutral. */
  downIsGood: boolean | null;
}

export const BODY_FIELDS: BodyField[] = [
  { key: "weight_lb", label: "Weight", kind: "weight", downIsGood: null, how: "Morning, after the bathroom, before eating or drinking. Same scale, same spot on the floor." },
  { key: "waist_in", label: "Belly", kind: "length", downIsGood: true, how: "Around your belly button. Stand relaxed, breathe out normally, don't suck in. Tape level all the way around." },
  { key: "belt_in", label: "Belt line", kind: "length", downIsGood: true, how: "Where your belt or waistband usually sits, usually just above the hip bones." },
  { key: "chest_in", label: "Chest", kind: "length", downIsGood: null, how: "Around the fullest part of the chest, under the armpits, arms relaxed at your sides, after a normal breath out." },
  { key: "arm_in", label: "Arm", kind: "length", downIsGood: false, how: "Upper arm at its biggest point, halfway between shoulder and elbow. Pick relaxed or flexed and always do the same, same arm each time." },
  { key: "thigh_in", label: "Thigh", kind: "length", downIsGood: null, how: "Widest part of the thigh, just below the glutes, standing with weight on both feet. Same leg each time." },
  { key: "calf_in", label: "Calf", kind: "length", downIsGood: false, how: "Widest part of the calf, standing. Same leg each time." },
  { key: "height_in", label: "Height", kind: "length", downIsGood: null, how: "Shoes off, heels against a wall, looking straight ahead. Only needs measuring once." },
];

export const fieldOf = (k: BodyKey) => BODY_FIELDS.find((f) => f.key === k)!;

const CM_PER_IN = 2.54;
const KG_PER_LB = 0.453592;

/** Stored value (lb / in) → display value in the user's units. */
export function toDisplay(f: BodyField, v: number | null, units: Settings["units"]) {
  if (v == null) return null;
  if (units === "imperial") return v;
  return f.kind === "weight" ? v * KG_PER_LB : v * CM_PER_IN;
}

/** Display value → stored value (lb / in). */
export function fromDisplay(f: BodyField, v: number | null, units: Settings["units"]) {
  if (v == null) return null;
  if (units === "imperial") return v;
  return f.kind === "weight" ? v / KG_PER_LB : v / CM_PER_IN;
}

export const unitOf = (f: BodyField, units: Settings["units"]) => (f.kind === "weight" ? (units === "metric" ? "kg" : "lb") : units === "metric" ? "cm" : "in");

/** Tape measures read in quarter inches, so inches keep up to 2 decimals (36.75); everything else 1. */
export function fmtNum(f: BodyField, d: number, units: Settings["units"]) {
  return f.kind === "length" && units === "imperial" ? String(+d.toFixed(2)) : d.toFixed(1);
}

export function fmtBody(f: BodyField, v: number | null, units: Settings["units"]) {
  const d = toDisplay(f, v, units);
  if (d == null) return "–";
  if (f.key === "height_in" && units === "imperial") return `${Math.floor(d / 12)}′ ${+(d % 12).toFixed(2)}″`;
  return `${fmtNum(f, d, units)} ${unitOf(f, units)}`;
}

/** Most recent non-empty value of a field, and the entry it came from. */
export function latest(ms: Measurement[], k: BodyKey) {
  const m = ms.find((x) => x[k] != null);
  return m ? { value: m[k] as number, at: m.measured_at } : null;
}

/** Oldest non-empty value (the starting point). */
export function earliest(ms: Measurement[], k: BodyKey) {
  for (let i = ms.length - 1; i >= 0; i--) if (ms[i][k] != null) return { value: ms[i][k] as number, at: ms[i].measured_at };
  return null;
}

/** The value logged before the latest one. */
export function previous(ms: Measurement[], k: BodyKey) {
  const withVal = ms.filter((x) => x[k] != null);
  return withVal[1] ? { value: withVal[1][k] as number, at: withVal[1].measured_at } : null;
}

/** BMI from lb and inches. A rough screen only: muscle weighs more than fat. */
export const bmi = (lb: number | null, inches: number | null) => (lb && inches ? (703 * lb) / (inches * inches) : null);

export function bmiLabel(b: number) {
  if (b < 18.5) return "under 18.5 = underweight range";
  if (b < 25) return "18.5–24.9 = healthy range";
  if (b < 30) return "25–29.9 = overweight range (muscle counts too)";
  return "30+ = obese range (muscle counts too)";
}

/** Waist-to-height ratio: under 0.5 is the usual healthy target, and it isn't fooled by muscle. */
export const waistToHeight = (waist: number | null, height: number | null) => (waist && height ? waist / height : null);
