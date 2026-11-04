import { useMemo, useState } from "react";
import type { Toast } from "../../App";
import type { Data } from "../../lib/useData";
import type { Measurement, NewMeasurement } from "../../lib/types";
import { dayKey, fmtDay, fromDayKey } from "../../lib/dates";
import { BODY_FIELDS, bmi, bmiLabel, earliest, fieldOf, fmtBody, fmtNum, fromDisplay, latest, previous, toDisplay, unitOf, waistToHeight, type BodyKey } from "../../lib/body";
import { LineChart } from "../../components/LineChart";
import { Modal } from "../../components/Modal";
import { Stat } from "../../components/Stat";

export function BodyApp({ data, toast }: { data: Data; toast: (t: Toast) => void }) {
  const ms = data.measurements; // newest first
  const units = data.settings.units;
  const [editing, setEditing] = useState<Measurement | "new" | null>(null);
  const [metric, setMetric] = useState<BodyKey>("weight_lb");
  const field = fieldOf(metric);

  const w = latest(ms, "weight_lb")?.value ?? null;
  const h = latest(ms, "height_in")?.value ?? null;
  const waist = latest(ms, "waist_in")?.value ?? null;
  const b = bmi(w, h);
  const wh = waistToHeight(waist, h);

  const points = useMemo(
    () => ms.filter((m) => m[metric] != null).map((m) => ({ t: new Date(m.measured_at).getTime(), value: toDisplay(field, m[metric], units)! })),
    [ms, metric, field, units],
  );
  const tracked = BODY_FIELDS.filter((f) => f.key !== "height_in" && ms.some((m) => m[f.key] != null));

  return (
    <div className="stack">
      <div className="row">
        <h1 className="grow">Body</h1>
        <button className="btn primary" onClick={() => setEditing("new")}>+ Log measurements</button>
      </div>

      {ms.length === 0 ? (
        <section className="card">
          <h2>Start your baseline</h2>
          <p>
            Log your weight and a few tape measurements today. After that, weigh in as often as you like and re-measure every 2–4 weeks —
            sizes change slowly, and the trend matters more than any single day.
          </p>
          <p className="muted small">
            You'll need a soft tape measure (about $5 at any pharmacy or online). Measure on bare skin, snug but not squeezing, at the same time
            of day each time. Tap “How to measure” next to each box when logging.
          </p>
          <button className="btn primary" onClick={() => setEditing("new")}>Log my first measurements</button>
        </section>
      ) : (
        <>
          <section className="card">
            <h2>Now</h2>
            <div className="stats-grid">
              {BODY_FIELDS.filter((f) => latest(ms, f.key)).map((f) => {
                const cur = latest(ms, f.key)!;
                const first = earliest(ms, f.key)!;
                const prev = previous(ms, f.key);
                return (
                  <button key={f.key} className={`stat stat-btn ${metric === f.key ? "on" : ""}`} onClick={() => f.key !== "height_in" && setMetric(f.key)}>
                    <div className="stat-label">{f.label}</div>
                    <div className="stat-value">{fmtBody(f, cur.value, units)}</div>
                    {f.key !== "height_in" && (
                      <div className="stat-sub">
                        {prev ? <Delta f={f} from={prev.value} to={cur.value} units={units} label="last" /> : "first entry"}
                        {first.at !== cur.at && prev?.at !== first.at && (
                          <>
                            {" · "}
                            <Delta f={f} from={first.value} to={cur.value} units={units} label="since start" />
                          </>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </section>

          {(b || wh) && (
            <section className="card">
              <h2>Health ratios</h2>
              <div className="stats-grid">
                {wh && (
                  <Stat
                    label="Waist-to-height"
                    value={wh.toFixed(2)}
                    sub={wh < 0.5 ? "Under 0.5 — healthy target" : "Target is under 0.5 (belly ÷ height)"}
                  />
                )}
                {b && <Stat label="BMI" value={b.toFixed(1)} sub={bmiLabel(b)} />}
              </div>
              <p className="hint">
                Waist-to-height is the better gauge when you lift: BMI only knows weight and height, so muscle can push it up.
              </p>
            </section>
          )}

          {tracked.length > 0 && (
            <section className="card">
              <div className="chips" style={{ marginBottom: 10 }}>
                {tracked.map((f) => (
                  <button key={f.key} className={`chip ${metric === f.key ? "on" : ""}`} onClick={() => setMetric(f.key)}>
                    {f.label}
                  </button>
                ))}
              </div>
              <h2>
                {field.label} ({unitOf(field, units)})
              </h2>
              <LineChart points={points} format={(v) => `${fmtNum(field, v, units)} ${unitOf(field, units)}`} ariaLabel={`${field.label} over time`} />
            </section>
          )}

          <section className="card">
            <h2>Log</h2>
            <div className="table-scroll">
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    {BODY_FIELDS.filter((f) => f.key !== "height_in" && ms.some((m) => m[f.key] != null)).map((f) => (
                      <th key={f.key} className="num">
                        {f.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ms.map((m) => (
                    <tr key={m.id} className="click-row" onClick={() => setEditing(m)}>
                      <td>{fmtDay(new Date(m.measured_at), { month: "short", day: "numeric", year: "2-digit" })}</td>
                      {BODY_FIELDS.filter((f) => f.key !== "height_in" && ms.some((x) => x[f.key] != null)).map((f) => (
                        <td key={f.key} className="num">
                          {m[f.key] == null ? "–" : fmtNum(f, toDisplay(f, m[f.key], units)!, units)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="hint">Tap a row to edit it.</p>
          </section>
        </>
      )}

      {editing && <MeasureForm data={data} entry={editing === "new" ? null : editing} toast={toast} onClose={() => setEditing(null)} />}
    </div>
  );
}

function Delta({ f, from, to, units, label }: { f: (typeof BODY_FIELDS)[number]; from: number; to: number; units: "imperial" | "metric"; label: string }) {
  const d = toDisplay(f, to - from, units)!;
  if (Math.abs(d) < 0.05) return <span>no change {label}</span>;
  const good = f.downIsGood == null ? null : f.downIsGood ? d < 0 : d > 0;
  return (
    <span className={good == null ? "" : good ? "good-text" : "over-text"}>
      {d > 0 ? "▲" : "▼"} {fmtNum(f, Math.abs(d), units)} {label}
    </span>
  );
}

function MeasureForm({ data, entry, toast, onClose }: { data: Data; entry: Measurement | null; toast: (t: Toast) => void; onClose: () => void }) {
  const units = data.settings.units;
  const ms = data.measurements;
  const [date, setDate] = useState(entry ? dayKey(new Date(entry.measured_at)) : dayKey(new Date()));
  const [vals, setVals] = useState<Record<BodyKey, string>>(() => {
    const out = {} as Record<BodyKey, string>;
    for (const f of BODY_FIELDS) {
      // Height carries over from last time; everything else starts empty with last value as a hint.
      const v = entry ? entry[f.key] : f.key === "height_in" ? latest(ms, "height_in")?.value ?? null : null;
      out[f.key] = v == null ? "" : String(Math.round(toDisplay(f, v, units)! * 10) / 10);
    }
    return out;
  });
  const [notes, setNotes] = useState(entry?.notes ?? "");
  const [help, setHelp] = useState<BodyKey | null>(null);

  async function save() {
    const at = fromDayKey(date);
    const now = new Date();
    at.setHours(now.getHours(), now.getMinutes());
    const row: NewMeasurement = {
      measured_at: entry && dayKey(new Date(entry.measured_at)) === date ? entry.measured_at : at.toISOString(),
      notes: notes.trim(),
      ...(Object.fromEntries(BODY_FIELDS.map((f) => [f.key, vals[f.key] === "" ? null : fromDisplay(f, Number(vals[f.key]), units)])) as Record<BodyKey, number | null>),
    };
    if (entry) await data.update("measurements", entry.id, row);
    else await data.insert("measurements", [row]);
    // Keep calorie estimates current with the newest weigh-in.
    const newest = [...ms.filter((m) => m.id !== entry?.id), { ...row, id: "" }].sort((a, b) => b.measured_at.localeCompare(a.measured_at))[0];
    if (row.weight_lb && newest.measured_at === row.measured_at) await data.saveSettings({ ...data.settings, bodyweightLb: Math.round(row.weight_lb * 10) / 10 });
    toast({ msg: entry ? "Measurements updated" : "Measurements saved" });
    onClose();
  }

  const empty = BODY_FIELDS.every((f) => vals[f.key] === "");

  return (
    <Modal title={entry ? "Edit measurements" : "Log measurements"} onClose={onClose}>
      <label className="field">
        <span>Date</span>
        <input className="input" type="date" value={date} max={dayKey(new Date())} onChange={(e) => setDate(e.target.value)} />
      </label>
      <p className="hint" style={{ marginTop: 0 }}>Fill in only what you measured today — everything is optional.</p>
      <div className="form-grid">
        {BODY_FIELDS.map((f) => {
          const last = latest(ms.filter((m) => m.id !== entry?.id), f.key);
          return (
            <label key={f.key} className="field">
              <span className="row" style={{ gap: 4 }}>
                {f.label} ({unitOf(f, units)})
                <button type="button" className="info-btn" onClick={(e) => { e.preventDefault(); setHelp(help === f.key ? null : f.key); }} aria-label={`How to measure ${f.label}`}>
                  ?
                </button>
              </span>
              <input
                className="input"
                type="number"
                inputMode="decimal"
                step="0.1"
                min={0}
                placeholder={last ? `last ${Math.round(toDisplay(f, last.value, units)! * 10) / 10}` : ""}
                value={vals[f.key]}
                onChange={(e) => setVals((v) => ({ ...v, [f.key]: e.target.value }))}
              />
              {help === f.key && <span className="howto">{f.how}</span>}
            </label>
          );
        })}
      </div>
      <label className="field">
        <span>Notes</span>
        <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. after vacation, new tape measure" />
      </label>
      <div className="row end">
        {entry && (
          <button
            className="btn danger"
            onClick={async () => {
              if (!confirm("Delete this entry?")) return;
              await data.remove("measurements", [entry.id]);
              onClose();
            }}
          >
            Delete
          </button>
        )}
        <span className="spacer" />
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" onClick={save} disabled={empty || !date}>Save</button>
      </div>
    </Modal>
  );
}
