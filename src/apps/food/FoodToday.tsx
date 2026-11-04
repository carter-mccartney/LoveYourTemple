import { useMemo, useState } from "react";
import type { Toast } from "../../App";
import type { Data } from "../../lib/useData";
import type { Food, FoodLog, Settings } from "../../lib/types";
import { addDays, dayKey, fmtDay, fmtTime, fromDayKey } from "../../lib/dates";
import { MEALS, logsOn, sumLogs, type DayTotals } from "../../lib/nutrition";
import { go } from "../../lib/router";
import { AmountSheet, MEAL_LABEL } from "./shared";

/** One macro line: value against a minimum goal (protein) or a maximum limit (sugar). */
export function MacroBar({ label, value, goal, kind, unit = "g", floor, sub }: { label: string; value: number; goal: number | null; kind: "min" | "max" | "target"; unit?: string; floor?: boolean; sub?: string }) {
  // A limit of 0 (e.g. zero added sugar): empty bar while clean, full red once anything counts.
  const pct = goal == null ? 0 : goal === 0 ? (value > 0.05 ? 1 : 0) : Math.min(1, value / goal);
  const over = kind === "max" && goal != null && value > goal + 0.05;
  const met = kind === "min" && goal != null && value >= goal;
  const v = unit === "kcal" ? Math.round(value).toLocaleString() : value.toFixed(0);
  return (
    <div className="macro">
      <div className="macro-head">
        <span>{label}</span>
        <span>
          <strong className={over ? "over-text" : met ? "good-text" : ""}>
            {floor ? "≥ " : ""}
            {v}
          </strong>
          {goal != null && (
            <span className="muted">
              {" "}
              / {goal.toLocaleString()} {unit} {kind === "min" ? "goal" : kind === "max" ? "limit" : ""}
            </span>
          )}
          {goal == null && <span className="muted"> {unit}</span>}
        </span>
      </div>
      {goal != null && (
        <div className={`bar thin ${over ? "over" : met ? "met" : ""}`}>
          <div style={{ width: `${pct * 100}%` }} />
        </div>
      )}
      {sub && <div className="muted small">{sub}</div>}
    </div>
  );
}

export function MacroPanel({ t, goals, compact }: { t: DayTotals; goals: Settings["nutrition"]; compact?: boolean }) {
  return (
    <div className="macros">
      <MacroBar label="Protein" value={t.protein} goal={goals.proteinMin} kind="min" />
      <MacroBar label="Calories" value={t.kcal} goal={goals.kcal} kind="target" unit="kcal" />
      <MacroBar label="Added sugar" value={t.added_sugar} goal={goals.addedSugarMax} kind="max" floor={t.addedSugarUnknown > 0} />
      <MacroBar
        label="Total sugar"
        value={t.sugar}
        goal={goals.sugarMax}
        kind="max"
        sub={t.sugar > 0 ? `${Math.max(0, t.sugar - t.added_sugar).toFixed(0)} g natural (fruit, milk) · ${t.added_sugar.toFixed(0)} g added` : undefined}
      />
      {!compact && <MacroBar label="Carbs" value={t.carbs} goal={goals.carbsMax} kind="max" />}
      {!compact && (
        <div className="macro-mini muted small">
          Fat {t.fat.toFixed(0)} g · Fiber {t.fiber.toFixed(0)} g · Sodium {Math.round(t.sodium_mg).toLocaleString()} mg
        </div>
      )}
      {t.addedSugarUnknown > 0 && (
        <p className="hint" style={{ margin: 0 }}>
          {t.addedSugarUnknown} item{t.addedSugarUnknown === 1 ? " has" : "s have"} no added-sugar figure, so added sugar may be higher.
        </p>
      )}
    </div>
  );
}

export function FoodToday({ data, toast }: { data: Data; toast: (t: Toast) => void }) {
  const today = dayKey(new Date());
  const [date, setDate] = useState(today);
  const [sheet, setSheet] = useState<{ food: Food; existing?: FoodLog } | null>(null);
  const logs = useMemo(() => logsOn(data.food_logs, date), [data.food_logs, date]);
  const totals = sumLogs(logs);
  const foodsById = useMemo(() => new Map(data.foods.map((f) => [f.id, f])), [data.foods]);

  const packed = data.settings.packed;
  const packedFoods = packed.date === today ? packed.foodIds.map((id) => foodsById.get(id)).filter((f): f is Food => !!f) : [];
  const stalePacked = packed.date !== today && packed.foodIds.length > 0;

  // Foods logged recently, for one-tap re-logging.
  const recent = useMemo(() => {
    const seen = new Set<string>();
    const out: Food[] = [];
    for (const l of data.food_logs) {
      if (!l.food_id || seen.has(l.food_id) || packedFoods.some((p) => p.id === l.food_id)) continue;
      const f = foodsById.get(l.food_id);
      if (f) {
        seen.add(l.food_id);
        out.push(f);
      }
      if (out.length >= 8) break;
    }
    return out;
  }, [data.food_logs, foodsById, packedFoods]);

  const openEntry = (l: FoodLog) => {
    const f = l.food_id ? foodsById.get(l.food_id) : undefined;
    // Entries whose food was deleted can still be edited from their own snapshot.
    const food: Food = f ?? {
      id: "", name: l.name, brand: "", barcode: "", serving_g: l.grams / (l.servings || 1), serving_label: l.serving_label,
      per100: Object.fromEntries(Object.entries(l.totals).map(([k, v]) => [k, v == null ? null : (v * 100) / l.grams])) as unknown as Food["per100"],
      source: "manual", nutriscore: "", image_url: "", favorite: false, created_at: "",
    };
    setSheet({ food, existing: l });
  };

  return (
    <div className="stack">
      <div className="date-nav">
        <button className="btn round" onClick={() => setDate(dayKey(addDays(fromDayKey(date), -1)))} aria-label="Previous day">‹</button>
        <strong>{date === today ? "Today" : fmtDay(fromDayKey(date), { weekday: "long", month: "short", day: "numeric" })}</strong>
        <button className="btn round" onClick={() => setDate(dayKey(addDays(fromDayKey(date), 1)))} disabled={date >= today} aria-label="Next day">›</button>
      </div>

      <section className="card">
        <MacroPanel t={totals} goals={data.settings.nutrition} />
      </section>

      <div className="row">
        <button className="btn primary big grow" onClick={() => go("food", "add", "scan")}>Scan barcode</button>
        <button className="btn big grow" onClick={() => go("food", "add")}>Search / add</button>
      </div>

      {date === today && (
        <section className="card">
          <div className="day-head">
            <h2>Packed for today</h2>
            <a className="link small" href="#/food/mine">Edit</a>
          </div>
          {packedFoods.length ? (
            <div className="chips">
              {packedFoods.map((f) => (
                <button key={f.id} className="chip big-chip" onClick={() => setSheet({ food: f })}>
                  {f.name}
                </button>
              ))}
            </div>
          ) : (
            <p className="muted small">
              Scan or pick what you brought (yogurt, cottage cheese, fruit…) and tap <em>Pack for today</em>. They'll sit here as one-tap buttons.
            </p>
          )}
          {stalePacked && packedFoods.length === 0 && (
            <button className="btn" style={{ marginTop: 8 }} onClick={() => data.saveSettings({ ...data.settings, packed: { ...packed, date: today } })}>
              Pack the same {packed.foodIds.length} foods as last time
            </button>
          )}
        </section>
      )}

      {recent.length > 0 && (
        <section className="card">
          <h2>Recent</h2>
          <div className="chips">
            {recent.map((f) => (
              <button key={f.id} className="chip" onClick={() => setSheet({ food: f })}>
                {f.name}
              </button>
            ))}
          </div>
        </section>
      )}

      {MEALS.map((m) => {
        const items = logs.filter((l) => l.meal === m);
        if (!items.length) return null;
        const t = sumLogs(items);
        return (
          <section className="card" key={m}>
            <div className="day-head">
              <h2>{MEAL_LABEL[m]}</h2>
              <span className="muted small">
                {Math.round(t.kcal)} kcal · {t.protein.toFixed(0)} g protein
              </span>
            </div>
            <ul className="set-list">
              {[...items].reverse().map((l) => (
                <li key={l.id}>
                  <button className="food-log-row" onClick={() => openEntry(l)}>
                    <span className="t">{fmtTime(new Date(l.eaten_at))}</span>
                    <span className="grow">
                      <span className="block">{l.name}</span>
                      <span className="muted small">
                        {l.servings} × {l.serving_label}
                      </span>
                    </span>
                    <span className="num-col">
                      <strong>{Math.round(l.totals.kcal ?? 0)}</strong>
                      <span className="muted small"> kcal</span>
                      <span className="block muted small">{(l.totals.protein ?? 0).toFixed(0)} g P</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      {!logs.length && <p className="muted center">Nothing logged {date === today ? "yet today" : "this day"}.</p>}

      {sheet && <AmountSheet food={sheet.food} existing={sheet.existing} data={data} date={date} toast={toast} onClose={() => setSheet(null)} />}
    </div>
  );
}
