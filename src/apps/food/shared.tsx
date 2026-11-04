import { useState, type ReactNode } from "react";
import type { Toast } from "../../App";
import type { Data } from "../../lib/useData";
import { NUTRIENT_KEYS, emptyNutrients, type Food, type FoodLog, type Meal, type NewFood, type Nutrients } from "../../lib/types";
import { MEALS, fmtG, mealFor, scale } from "../../lib/nutrition";
import { dayKey, fromDayKey } from "../../lib/dates";
import { Modal } from "../../components/Modal";

export const MEAL_LABEL: Record<Meal, string> = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snack: "Snacks" };
const SOURCE_LABEL: Record<Food["source"], string> = {
  scan: "Scanned",
  openfoodfacts: "Open Food Facts",
  usda: "USDA",
  builtin: "Common food",
  manual: "Entered by you",
};

export const isSaved = (f: Food | NewFood): f is Food => "id" in f;

/** Save a looked-up food to My foods (once), so it can be re-logged or packed later. */
export async function ensureSaved(data: Data, f: Food | NewFood): Promise<Food | undefined> {
  if (isSaved(f)) return f;
  const existing = data.foods.find(
    (x) => (f.barcode && x.barcode === f.barcode) || (x.name === f.name && x.brand === f.brand && x.source === f.source),
  );
  if (existing) return existing;
  return (await data.insert("foods", [{ ...f, created_at: new Date().toISOString() }]))?.[0];
}

export function NutriBadge({ grade }: { grade: string }) {
  if (!grade) return null;
  return <span className={`nutri nutri-${grade}`} title="Nutri-Score (A best → E worst)">{grade.toUpperCase()}</span>;
}

export function FoodRow({ food, onClick, right }: { food: Food | NewFood; onClick: () => void; right?: ReactNode }) {
  const per = scale(food.per100, food.serving_g);
  return (
    <li>
      <button className="food-row" onClick={onClick}>
        {food.image_url ? <img src={food.image_url} alt="" /> : <span className="food-dot" aria-hidden="true" />}
        <span className="grow">
          <span className="block">
            {food.name} <NutriBadge grade={food.nutriscore} />
          </span>
          <span className="muted small">
            {[food.brand, food.serving_label, per.kcal != null ? `${Math.round(per.kcal)} kcal` : null, per.protein != null ? `${per.protein.toFixed(0)} g protein` : null]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </span>
        {right ?? <span className="tag">{SOURCE_LABEL[food.source]}</span>}
      </button>
    </li>
  );
}

const QUICK = [0.25, 0.5, 0.75, 1, 1.5, 2, 3];
const frac = (n: number) => ({ 0.25: "¼", 0.5: "½", 0.75: "¾", 1.5: "1½" })[n] ?? String(n);

/** Pick an amount and log it, or just pack it for today. */
export function AmountSheet({
  food,
  data,
  date,
  toast,
  onClose,
  existing,
}: {
  food: Food | NewFood;
  data: Data;
  /** YYYY-MM-DD the entry belongs to. */
  date: string;
  toast: (t: Toast) => void;
  onClose: (logged: boolean) => void;
  /** Editing an entry already in the log. */
  existing?: FoodLog;
}) {
  const [servings, setServings] = useState(existing?.servings ?? 1);
  const [grams, setGrams] = useState(existing?.grams ?? food.serving_g);
  const [meal, setMeal] = useState<Meal>(existing?.meal ?? mealFor(new Date()));
  const totals = scale(food.per100, grams);
  const setS = (s: number) => {
    setServings(s);
    setGrams(Math.round(s * food.serving_g * 10) / 10);
  };
  const setG = (g: number) => {
    setGrams(g);
    setServings(Math.round((g / food.serving_g) * 100) / 100);
  };
  const today = dayKey(new Date());
  const packed = data.settings.packed.date === today && isSaved(food) && data.settings.packed.foodIds.includes(food.id);

  async function log() {
    const saved = await ensureSaved(data, food);
    // Logging on a past day: keep the current time of day on that date.
    const at = date === today ? new Date() : (() => {
      const d = fromDayKey(date);
      const n = new Date();
      d.setHours(n.getHours(), n.getMinutes());
      return d;
    })();
    const row = {
      eaten_at: existing?.eaten_at ?? at.toISOString(),
      meal,
      food_id: saved?.id ?? null,
      name: food.brand && !food.name.toLowerCase().includes(food.brand.toLowerCase()) ? `${food.name} (${food.brand})` : food.name,
      grams,
      servings,
      serving_label: food.serving_label,
      totals,
      notes: existing?.notes ?? "",
    };
    if (existing) {
      await data.update("food_logs", existing.id, row);
      onClose(true);
      return;
    }
    const added = await data.insert("food_logs", [row]);
    if (added?.[0]) toast({ msg: `Logged ${food.name}`, action: { label: "Undo", run: () => data.remove("food_logs", [added[0].id]) } });
    onClose(true);
  }

  async function togglePack() {
    const saved = await ensureSaved(data, food);
    if (!saved) return;
    const cur = data.settings.packed.date === today ? data.settings.packed.foodIds : [];
    const foodIds = cur.includes(saved.id) ? cur.filter((x) => x !== saved.id) : [...cur, saved.id];
    await data.saveSettings({ ...data.settings, packed: { date: today, foodIds } });
    toast({ msg: cur.includes(saved.id) ? `Removed ${food.name} from today's food` : `Packed ${food.name} for today` });
    onClose(false);
  }

  return (
    <Modal title={existing ? "Edit entry" : food.name} onClose={() => onClose(false)}>
      {!existing && (food.brand || food.nutriscore) && (
        <p className="muted">
          {food.brand} <NutriBadge grade={food.nutriscore} />
        </p>
      )}
      <div className="field">
        <span>How much? (1 serving = {food.serving_label}{food.serving_label.includes("g") ? "" : `, ${food.serving_g} g`})</span>
        <div className="chips">
          {QUICK.map((q) => (
            <button key={q} className={`chip ${servings === q ? "on" : ""}`} onClick={() => setS(q)}>
              {frac(q)}
            </button>
          ))}
        </div>
      </div>
      <div className="row">
        <label className="field grow">
          <span>Servings</span>
          <input className="input" type="number" inputMode="decimal" step="0.25" min={0} value={servings} onChange={(e) => setS(Number(e.target.value))} />
        </label>
        <label className="field grow">
          <span>Grams</span>
          <input className="input" type="number" inputMode="decimal" min={0} value={grams} onChange={(e) => setG(Number(e.target.value))} />
        </label>
        <label className="field grow">
          <span>Meal</span>
          <select className="input" value={meal} onChange={(e) => setMeal(e.target.value as Meal)}>
            {MEALS.map((m) => (
              <option key={m} value={m}>
                {MEAL_LABEL[m]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <NutrientGrid n={totals} />
      <div className="row end">
        {!existing && (
          <button className="btn" onClick={togglePack} title="Brought it with you? Pack it so it's one tap away all day.">
            {packed ? "Unpack" : "Pack for today"}
          </button>
        )}
        {existing && (
          <button
            className="btn danger"
            onClick={async () => {
              await data.remove("food_logs", [existing.id]);
              onClose(true);
            }}
          >
            Delete
          </button>
        )}
        <span className="spacer" />
        <button className="btn primary" onClick={log} disabled={grams <= 0}>
          {existing ? "Save" : "Log it"}
        </button>
      </div>
    </Modal>
  );
}

export function NutrientGrid({ n }: { n: Nutrients }) {
  const cells: [string, string][] = [
    ["Calories", n.kcal == null ? "?" : `${Math.round(n.kcal)}`],
    ["Protein", fmtG(n.protein, 1)],
    ["Carbs", fmtG(n.carbs, 1)],
    ["Fat", fmtG(n.fat, 1)],
    ["Sugar", fmtG(n.sugar, 1)],
    ["Added sugar", n.added_sugar == null ? "unknown" : `${n.added_sugar.toFixed(1)} g`],
    ["Fiber", fmtG(n.fiber, 1)],
    ["Sodium", n.sodium_mg == null ? "?" : `${Math.round(n.sodium_mg)} mg`],
  ];
  return (
    <div className="nutrient-grid">
      {cells.map(([k, v]) => (
        <div key={k}>
          <span className="muted small">{k}</span>
          <strong>{v}</strong>
        </div>
      ))}
    </div>
  );
}

/** Type a label in by serving (the way it's printed), stored per 100 g. */
export function FoodForm({ initial, onSave, onCancel, saveLabel = "Save food" }: { initial?: Partial<NewFood>; onSave: (f: NewFood) => void; onCancel?: () => void; saveLabel?: string }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [brand, setBrand] = useState(initial?.brand ?? "");
  const [label, setLabel] = useState(initial?.serving_label ?? "1 serving");
  const [g, setG] = useState(initial?.serving_g ?? 100);
  const per = initial?.per100 ? scale(initial.per100, initial.serving_g ?? 100) : emptyNutrients();
  const [vals, setVals] = useState<Record<keyof Nutrients, string>>(
    () => Object.fromEntries(NUTRIENT_KEYS.map((k) => [k, per[k] == null ? "" : String(Math.round(per[k]! * 10) / 10)])) as Record<keyof Nutrients, string>,
  );
  const fields: [keyof Nutrients, string][] = [
    ["kcal", "Calories"],
    ["protein", "Protein (g)"],
    ["carbs", "Carbs (g)"],
    ["fat", "Fat (g)"],
    ["sat_fat", "Sat. fat (g)"],
    ["fiber", "Fiber (g)"],
    ["sugar", "Total sugar (g)"],
    ["added_sugar", "Added sugar (g)"],
    ["sodium_mg", "Sodium (mg)"],
  ];

  function save() {
    const per100 = emptyNutrients();
    for (const k of NUTRIENT_KEYS) per100[k] = vals[k] === "" ? null : (Number(vals[k]) * 100) / g;
    onSave({
      name: name.trim(),
      brand: brand.trim(),
      barcode: initial?.barcode ?? "",
      serving_g: g,
      serving_label: label.trim() || `${g} g`,
      per100,
      source: initial?.source ?? "manual",
      nutriscore: initial?.nutriscore ?? "",
      image_url: initial?.image_url ?? "",
      favorite: initial?.favorite ?? false,
      created_at: initial?.created_at ?? new Date().toISOString(),
    });
  }

  return (
    <div>
      <div className="row">
        <label className="field grow">
          <span>Name</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ground beef breakfast square" />
        </label>
        <label className="field grow">
          <span>Brand (optional)</span>
          <input className="input" value={brand} onChange={(e) => setBrand(e.target.value)} />
        </label>
      </div>
      <div className="row">
        <label className="field grow">
          <span>Serving</span>
          <input className="input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="1 square, 1 cup, 2 tbsp" />
        </label>
        <label className="field" style={{ width: 120 }}>
          <span>Serving weight (g)</span>
          <input className="input" type="number" inputMode="decimal" min={1} value={g} onChange={(e) => setG(Math.max(1, Number(e.target.value)))} />
        </label>
      </div>
      <p className="hint" style={{ marginTop: 0 }}>Per serving, as on the label. Leave blank if unknown.</p>
      <div className="form-grid">
        {fields.map(([k, lbl]) => (
          <label key={k} className="field">
            <span>{lbl}</span>
            <input className="input" type="number" inputMode="decimal" min={0} value={vals[k]} onChange={(e) => setVals((v) => ({ ...v, [k]: e.target.value }))} />
          </label>
        ))}
      </div>
      <div className="row end">
        {onCancel && <button className="btn" onClick={onCancel}>Cancel</button>}
        <button className="btn primary" onClick={save} disabled={!name.trim() || vals.kcal === ""}>
          {saveLabel}
        </button>
      </div>
    </div>
  );
}
