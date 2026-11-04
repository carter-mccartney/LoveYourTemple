import { Suspense, lazy, useCallback, useState } from "react";
import type { Toast } from "../../App";
import type { Data } from "../../lib/useData";
import type { Food, NewFood } from "../../lib/types";
import { dayKey } from "../../lib/dates";
import { lookupBarcode, matchMyFoods, searchBuiltin, searchOpenFoodFacts, searchUsda } from "../../lib/nutrition";
import { go } from "../../lib/router";
import { SubTabs } from "../../components/SubTabs";
import { AmountSheet, FoodForm, FoodRow } from "./shared";
// The barcode library is big; only load it when the scanner opens.
const Scanner = lazy(() => import("./Scanner").then((m) => ({ default: m.Scanner })));

type Mode = "search" | "scan" | "manual";

export function AddFood({ data, mode: initialMode, toast }: { data: Data; mode?: string; toast: (t: Toast) => void }) {
  const mode: Mode = initialMode === "scan" || initialMode === "manual" ? initialMode : "search";
  const [picked, setPicked] = useState<Food | NewFood | null>(null);
  const [manualSeed, setManualSeed] = useState<Partial<NewFood> | undefined>();
  const today = dayKey(new Date());

  return (
    <div className="stack">
      <div className="row">
        <button className="link" onClick={() => go("food")}>← Food today</button>
      </div>
      <SubTabs
        tabs={[
          { id: "search", label: "Search" },
          { id: "scan", label: "Scan" },
          { id: "manual", label: "Enter label" },
        ]}
        active={mode}
        onChange={(id) => go("food", "add", id)}
      />
      {mode === "search" && <Search data={data} onPick={setPicked} />}
      {mode === "scan" && (
        <ScanFlow
          data={data}
          onPick={setPicked}
          onNotFound={(barcode) => {
            setManualSeed({ barcode, source: "scan" });
            go("food", "add", "manual");
          }}
        />
      )}
      {mode === "manual" && (
        <section className="card">
          <h2>Enter a nutrition label</h2>
          {manualSeed?.barcode && <p className="hint">Barcode {manualSeed.barcode} wasn't in Open Food Facts. Type the label once and it's saved for next time.</p>}
          <FoodForm
            key={manualSeed?.barcode ?? "new"}
            initial={manualSeed}
            saveLabel="Save & choose amount"
            onSave={async (f) => {
              const added = await data.insert("foods", [f]);
              if (added?.[0]) setPicked(added[0]);
            }}
          />
        </section>
      )}
      {picked && (
        <AmountSheet
          food={picked}
          data={data}
          date={today}
          toast={toast}
          onClose={(logged) => {
            setPicked(null);
            if (logged) go("food");
          }}
        />
      )}
    </div>
  );
}

function Search({ data, onPick }: { data: Data; onPick: (f: Food | NewFood) => void }) {
  const [q, setQ] = useState("");
  const [online, setOnline] = useState<{ usda: NewFood[]; off: NewFood[]; errors: string[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const mine = q.trim() ? matchMyFoods(data.foods, q).slice(0, 8) : data.foods.filter((f) => f.favorite).slice(0, 8);
  const common = searchBuiltin(q).slice(0, 8);

  async function searchOnline() {
    if (!q.trim()) return;
    setBusy(true);
    const [usda, off] = await Promise.allSettled([searchUsda(q), searchOpenFoodFacts(q)]);
    setOnline({
      usda: usda.status === "fulfilled" ? usda.value : [],
      off: off.status === "fulfilled" ? off.value : [],
      errors: [usda, off].filter((r): r is PromiseRejectedResult => r.status === "rejected").map((r) => (r.reason as Error).message),
    });
    setBusy(false);
  }

  return (
    <>
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          searchOnline();
        }}
      >
        <input
          className="input grow"
          placeholder="apple, grapes, greek yogurt, Chobani…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOnline(null);
          }}
          autoFocus
        />
        <button className="btn" disabled={!q.trim() || busy}>{busy ? "Searching…" : "Search online"}</button>
      </form>

      {mine.length > 0 && (
        <section className="card">
          <h2>{q.trim() ? "My foods" : "Favorites"}</h2>
          <ul className="set-list">{mine.map((f) => <FoodRow key={f.id} food={f} onClick={() => onPick(f)} />)}</ul>
        </section>
      )}
      {common.length > 0 && (
        <section className="card">
          <h2>Common foods</h2>
          <ul className="set-list">{common.map((f) => <FoodRow key={f.name} food={f} onClick={() => onPick(f)} />)}</ul>
        </section>
      )}
      {q.trim() && !online && !mine.length && !common.length && (
        <p className="muted center">Nothing saved matches — press <strong>Search online</strong>.</p>
      )}
      {online && (
        <>
          {online.errors.map((e) => (
            <p key={e} className="banner error">{e}</p>
          ))}
          {online.usda.length > 0 && (
            <section className="card">
              <h2>USDA (whole & generic foods)</h2>
              <ul className="set-list">{online.usda.map((f, i) => <FoodRow key={i} food={f} onClick={() => onPick(f)} />)}</ul>
            </section>
          )}
          {online.off.length > 0 && (
            <section className="card">
              <h2>Open Food Facts (packaged foods)</h2>
              <ul className="set-list">{online.off.map((f, i) => <FoodRow key={i} food={f} onClick={() => onPick(f)} />)}</ul>
            </section>
          )}
          {!online.usda.length && !online.off.length && !online.errors.length && <p className="muted center">No results online either. Try “Enter label”.</p>}
        </>
      )}
    </>
  );
}

function ScanFlow({ data, onPick, onNotFound }: { data: Data; onPick: (f: Food | NewFood) => void; onNotFound: (barcode: string) => void }) {
  const [status, setStatus] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const onCode = useCallback(
    async (code: string) => {
      // Already saved? No network needed.
      const strip = (c: string) => c.replace(/^0+/, "");
      const saved = data.foods.find((f) => f.barcode && strip(f.barcode) === strip(code));
      if (saved) return onPick(saved);
      setStatus(`Looking up ${code}…`);
      try {
        const f = await lookupBarcode(code);
        setStatus(null);
        if (f) onPick(f);
        else onNotFound(code);
      } catch (e) {
        setStatus(`${(e as Error).message}. Check your connection and try again.`);
      }
    },
    [data.foods, onPick, onNotFound],
  );

  return (
    <section className="card">
      {status ? (
        <div className="stack tight">
          <p>{status}</p>
          <button className="btn" onClick={() => { setStatus(null); setAttempt((n) => n + 1); }}>Scan again</button>
        </div>
      ) : (
        <Suspense fallback={<p className="muted">Starting camera…</p>}>
          <Scanner key={attempt} onCode={onCode} />
        </Suspense>
      )}
      <p className="hint">Nutrition data from Open Food Facts, a free crowd-sourced database. Scanned foods are saved to My foods.</p>
    </section>
  );
}
