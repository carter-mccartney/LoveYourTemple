import type { Settings } from "./types";

const M_PER_MI = 1609.344;
const MPS_TO_MPH = 2.236936;

export function fmtDistance(m: number | null | undefined, units: Settings["units"], digits = 2) {
  if (m == null) return "–";
  return units === "metric" ? `${(m / 1000).toFixed(digits)} km` : `${(m / M_PER_MI).toFixed(digits)} mi`;
}

export function fmtSpeed(mps: number | null | undefined, units: Settings["units"]) {
  if (mps == null || !isFinite(mps)) return "–";
  return units === "metric" ? `${(mps * 3.6).toFixed(1)} km/h` : `${(mps * MPS_TO_MPH).toFixed(1)} mph`;
}

/** Minutes per mile/km, e.g. "14:32 /mi". */
export function fmtPace(mps: number | null | undefined, units: Settings["units"]) {
  if (!mps || mps < 0.3) return "–";
  const secPer = (units === "metric" ? 1000 : M_PER_MI) / mps;
  return `${Math.floor(secPer / 60)}:${String(Math.round(secPer % 60)).padStart(2, "0")} /${units === "metric" ? "km" : "mi"}`;
}

/** 3725 → "1:02:05", 125 → "2:05". */
export function fmtClock(sec: number | null | undefined) {
  const s = Math.max(0, Math.round(sec ?? 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

export const weightUnit = (u: Settings["units"]) => (u === "metric" ? "kg" : "lb");

/** Parse a distance typed in the user's unit back to meters. */
export const toMeters = (v: number, units: Settings["units"]) => (units === "metric" ? v * 1000 : v * M_PER_MI);
export const fromMeters = (m: number, units: Settings["units"]) => (units === "metric" ? m / 1000 : m / M_PER_MI);
