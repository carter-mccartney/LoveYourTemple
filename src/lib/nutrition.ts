import { BUILTIN_FOODS } from "./foods-builtin";
import { dayKey } from "./dates";
import { NUTRIENT_KEYS, emptyNutrients, type Food, type FoodLog, type NewFood, type Nutrients } from "./types";

// ---------- Math ----------

/** Nutrients for `grams` of a food given per-100 g values. Unknowns stay unknown. */
export function scale(per100: Nutrients, grams: number): Nutrients {
  const out = emptyNutrients();
  for (const k of NUTRIENT_KEYS) out[k] = per100[k] == null ? null : (per100[k]! * grams) / 100;
  return out;
}

export interface DayTotals extends Record<keyof Nutrients, number> {
  /** How many entries had no added-sugar figure (so the total is a floor, not exact). */
  addedSugarUnknown: number;
  entries: number;
}

export function sumLogs(logs: FoodLog[]): DayTotals {
  const t = { ...Object.fromEntries(NUTRIENT_KEYS.map((k) => [k, 0])), addedSugarUnknown: 0, entries: logs.length } as DayTotals;
  for (const l of logs) {
    for (const k of NUTRIENT_KEYS) t[k] += l.totals[k] ?? 0;
    if (l.totals.added_sugar == null) t.addedSugarUnknown++;
  }
  return t;
}

export const logsOn = (logs: FoodLog[], key: string) => logs.filter((l) => dayKey(new Date(l.eaten_at)) === key);

export const fmtG = (n: number | null | undefined, digits = 0) => (n == null ? "?" : `${n.toFixed(digits)} g`);

// ---------- Best / worst foods ----------

export interface FoodScore {
  name: string;
  times: number;
  kcal: number;
  protein: number;
  sugar: number;
  addedSugar: number;
  /** Grams of protein per 100 kcal: ≥ 10 is excellent (chicken ~19, eggs ~9, Greek yogurt ~17). */
  proteinDensity: number;
  reason: string;
}

/** Group a week's logs by food and rank them. "Best" = protein-dense with little added sugar. */
export function rankFoods(logs: FoodLog[]) {
  const by = new Map<string, FoodScore>();
  for (const l of logs) {
    const s = by.get(l.name) ?? { name: l.name, times: 0, kcal: 0, protein: 0, sugar: 0, addedSugar: 0, proteinDensity: 0, reason: "" };
    s.times++;
    s.kcal += l.totals.kcal ?? 0;
    s.protein += l.totals.protein ?? 0;
    s.sugar += l.totals.sugar ?? 0;
    s.addedSugar += l.totals.added_sugar ?? 0;
    by.set(l.name, s);
  }
  const all = [...by.values()].map((s) => ({ ...s, proteinDensity: s.kcal ? (s.protein / s.kcal) * 100 : 0 }));

  const best = all
    .filter((s) => s.protein >= 5 && s.addedSugar < Math.max(2, s.kcal * 0.01))
    .sort((a, b) => b.proteinDensity - a.proteinDensity || b.protein - a.protein)
    .slice(0, 5)
    .map((s) => ({ ...s, reason: `${s.proteinDensity.toFixed(1)} g protein per 100 kcal · ${s.protein.toFixed(0)} g protein this week` }));

  const worst = all
    .filter((s) => s.addedSugar >= 5 || (s.sugar >= 20 && s.proteinDensity < 3))
    .sort((a, b) => b.addedSugar - a.addedSugar || b.sugar - a.sugar)
    .slice(0, 5)
    .map((s) => ({
      ...s,
      reason: s.addedSugar >= 5 ? `${s.addedSugar.toFixed(0)} g added sugar this week` : `${s.sugar.toFixed(0)} g sugar, little protein`,
    }));

  const topProtein = [...all].sort((a, b) => b.protein - a.protein).slice(0, 5);
  return { best, worst, topProtein };
}

// ---------- Lookups ----------

/** fetch with one retry: the free databases occasionally drop a request. */
async function fetchRetry(url: string, source: string): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    try {
      const r = await fetch(url);
      if (r.status >= 500 && attempt === 0) throw new Error(String(r.status));
      return r;
    } catch (e) {
      if (attempt >= 1) throw new Error(`${source} didn't respond (${(e as Error).message}). Try again in a moment.`);
      await new Promise((ok) => setTimeout(ok, 800));
    }
  }
}

const OFF_FIELDS = "code,product_name,brands,serving_size,serving_quantity,nutriments,nutriscore_grade,image_front_small_url";

interface OffProduct {
  code?: string;
  product_name?: string;
  brands?: string;
  serving_size?: string;
  serving_quantity?: number | string;
  nutriscore_grade?: string;
  image_front_small_url?: string;
  nutriments?: Record<string, number | string | undefined>;
}

function fromOff(p: OffProduct, source: Food["source"]): NewFood | null {
  const n = p.nutriments ?? {};
  const num = (k: string) => {
    const v = n[k];
    return v === undefined || v === "" ? null : Number(v);
  };
  const kcal = num("energy-kcal_100g") ?? (num("energy_100g") != null ? num("energy_100g")! / 4.184 : null);
  if (!p.product_name && kcal == null) return null;
  const serving = Number(p.serving_quantity) || 100;
  return {
    name: p.product_name?.trim() || "Unnamed product",
    brand: (p.brands ?? "").split(",")[0].trim(),
    barcode: p.code ?? "",
    serving_g: serving,
    serving_label: p.serving_size || `${serving} g`,
    per100: {
      kcal,
      protein: num("proteins_100g"),
      carbs: num("carbohydrates_100g"),
      fat: num("fat_100g"),
      sat_fat: num("saturated-fat_100g"),
      fiber: num("fiber_100g"),
      sugar: num("sugars_100g"),
      added_sugar: num("added-sugars_100g"),
      sodium_mg: num("sodium_100g") != null ? num("sodium_100g")! * 1000 : null,
    },
    source,
    nutriscore: p.nutriscore_grade && /^[a-e]$/.test(p.nutriscore_grade) ? p.nutriscore_grade : "",
    image_url: p.image_front_small_url ?? "",
    favorite: false,
    created_at: new Date().toISOString(),
  };
}

/** Open Food Facts — free, crowd-sourced, strongest for packaged/branded foods. */
export async function lookupBarcode(code: string): Promise<NewFood | null> {
  const r = await fetchRetry(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=${OFF_FIELDS}`, "Open Food Facts");
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`Open Food Facts error ${r.status}`);
  const j = (await r.json()) as { status?: number; product?: OffProduct };
  if (!j.product || j.status === 0) return null;
  return fromOff({ ...j.product, code }, "scan");
}

export async function searchOpenFoodFacts(q: string): Promise<NewFood[]> {
  const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=12&fields=${OFF_FIELDS}`;
  const r = await fetchRetry(url, "Open Food Facts search");
  if (!r.ok) throw new Error(`Open Food Facts search error ${r.status}`);
  const j = (await r.json()) as { products?: OffProduct[] };
  return (j.products ?? []).map((p) => fromOff(p, "openfoodfacts")).filter((f): f is NewFood => !!f && f.per100.kcal != null);
}

interface UsdaFood {
  description: string;
  foodNutrients: { nutrientNumber: string; value: number }[];
  foodMeasures?: { disseminationText: string; gramWeight: number }[];
}

// The USDA key stays on this device only: USDA deactivates keys that show up
// publicly, and synced settings are readable by crewmates.
const USDA_KEY = "lyt.usdaKey";
export function getUsdaKey() {
  try {
    return localStorage.getItem(USDA_KEY) ?? "";
  } catch {
    return "";
  }
}
export function setUsdaKey(k: string) {
  try {
    if (k) localStorage.setItem(USDA_KEY, k);
    else localStorage.removeItem(USDA_KEY);
  } catch {
    /* ignore */
  }
}

/** USDA FoodData Central — best for generic foods (fruit, meat, vegetables). */
export async function searchUsda(q: string): Promise<NewFood[]> {
  const url = `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(q)}&dataType=Foundation,SR%20Legacy&pageSize=12&api_key=${encodeURIComponent(getUsdaKey() || "DEMO_KEY")}`;
  const r = await fetchRetry(url, "USDA search");
  if (r.status === 429) throw new Error("USDA lookup limit reached — add a free API key in Settings.");
  if (!r.ok) throw new Error(`USDA error ${r.status}`);
  const j = (await r.json()) as { foods?: UsdaFood[] };
  return (j.foods ?? []).map((f) => {
    const get = (...nums: string[]) => {
      for (const n of nums) {
        const hit = f.foodNutrients.find((x) => x.nutrientNumber === n);
        if (hit) return hit.value;
      }
      return null;
    };
    const m = f.foodMeasures?.find((x) => x.gramWeight > 0);
    return {
      name: f.description,
      brand: "",
      barcode: "",
      serving_g: m?.gramWeight ?? 100,
      serving_label: m?.disseminationText ?? "100 g",
      per100: {
        kcal: get("208", "957", "958"),
        protein: get("203"),
        carbs: get("205"),
        fat: get("204"),
        sat_fat: get("606"),
        fiber: get("291"),
        sugar: get("269"),
        added_sugar: get("539"),
        sodium_mg: get("307"),
      },
      source: "usda" as const,
      nutriscore: "",
      image_url: "",
      favorite: false,
      created_at: new Date().toISOString(),
    };
  });
}

/** Matches every word of the query, in any order. */
export function searchBuiltin(q: string): NewFood[] {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  return BUILTIN_FOODS.filter((f) => words.every((w) => f.name.toLowerCase().includes(w)));
}

export function matchMyFoods(foods: Food[], q: string) {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  return foods.filter((f) => words.every((w) => `${f.name} ${f.brand}`.toLowerCase().includes(w)));
}

export const MEALS = ["breakfast", "lunch", "dinner", "snack"] as const;

/** Default meal from the time of day. */
export function mealFor(d: Date): FoodLog["meal"] {
  const h = d.getHours();
  if (h < 10) return "breakfast";
  if (h < 14) return "lunch";
  if (h >= 17 && h < 21) return "dinner";
  return "snack";
}
