import { useState } from "react";
import type { Toast } from "../../App";
import type { Data } from "../../lib/useData";
import type { Food } from "../../lib/types";
import { dayKey } from "../../lib/dates";
import { matchMyFoods } from "../../lib/nutrition";
import { Modal } from "../../components/Modal";
import { AmountSheet, FoodForm, FoodRow } from "./shared";

export function MyFoods({ data, toast }: { data: Data; toast: (t: Toast) => void }) {
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<Food | null>(null);
  const [log, setLog] = useState<Food | null>(null);
  const today = dayKey(new Date());
  const packed = data.settings.packed.date === today ? data.settings.packed.foodIds : [];
  const foods = (q ? matchMyFoods(data.foods, q) : data.foods).slice().sort((a, b) => Number(b.favorite) - Number(a.favorite) || a.name.localeCompare(b.name));

  const togglePack = (f: Food) =>
    data.saveSettings({
      ...data.settings,
      packed: { date: today, foodIds: packed.includes(f.id) ? packed.filter((x) => x !== f.id) : [...packed, f.id] },
    });

  return (
    <div className="stack">
      <input className="input" placeholder="Search my foods" value={q} onChange={(e) => setQ(e.target.value)} />
      {foods.length === 0 && <p className="muted center">Foods you scan, look up or enter are saved here.</p>}
      <section className="card">
        <ul className="set-list">
          {foods.map((f) => (
            <FoodRow
              key={f.id}
              food={f}
              onClick={() => setLog(f)}
              right={
                <span className="row" onClick={(e) => e.stopPropagation()}>
                  <span
                    role="button"
                    tabIndex={0}
                    className={`chip ${packed.includes(f.id) ? "on" : ""}`}
                    onClick={() => togglePack(f)}
                    title="Show as a one-tap button on Food today"
                  >
                    {packed.includes(f.id) ? "Packed" : "Pack"}
                  </span>
                  <span role="button" tabIndex={0} className="star" aria-pressed={f.favorite} onClick={() => data.update("foods", f.id, { favorite: !f.favorite })} title="Favorite">
                    {f.favorite ? "★" : "☆"}
                  </span>
                  <span role="button" tabIndex={0} className="link small" onClick={() => setEdit(f)}>Edit</span>
                </span>
              }
            />
          ))}
        </ul>
      </section>

      {edit && (
        <Modal title="Edit food" onClose={() => setEdit(null)}>
          <FoodForm
            initial={edit}
            onCancel={() => setEdit(null)}
            onSave={async (f) => {
              await data.update("foods", edit.id, f);
              setEdit(null);
            }}
          />
          <button
            className="btn danger"
            style={{ marginTop: 8 }}
            onClick={async () => {
              if (!confirm(`Delete ${edit.name}? Past log entries keep their numbers.`)) return;
              await data.remove("foods", [edit.id]);
              setEdit(null);
            }}
          >
            Delete food
          </button>
        </Modal>
      )}
      {log && <AmountSheet food={log} data={data} date={today} toast={toast} onClose={() => setLog(null)} />}
    </div>
  );
}
