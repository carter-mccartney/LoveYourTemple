import { useMemo } from "react";
import type { Data } from "../../lib/useData";
import { BOOKS, SECTIONS, booksIn, fmtRef, type Ref } from "../../lib/bible/canon";
import { TIER_LABELS, coverage, periodStart, tier, type Tier } from "../../lib/bible/progress";

export type Period = "period" | "all";

export function useCoverage(data: Data, period: Period) {
  const since = periodStart(data.settings, period);
  const sinceKey = since?.getTime() ?? 0;
  const counts = useMemo(() => coverage(data.bible_reads, since), [data.bible_reads, sinceKey]); // eslint-disable-line react-hooks/exhaustive-deps
  return { counts, since };
}

export const periodLabel = (data: Data, period: Period) => {
  if (period === "all") return "All time";
  const s = data.settings.bible.since;
  return s ? `Since ${new Date(`${s}T00:00:00`).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}` : `${new Date().getFullYear()}`;
};

export function PeriodToggle({ data, period, onChange }: { data: Data; period: Period; onChange: (p: Period) => void }) {
  return (
    <div className="seg" role="group" aria-label="Progress period">
      <button className={period === "period" ? "on" : ""} onClick={() => onChange("period")}>
        {periodLabel(data, "period")}
      </button>
      <button className={period === "all" ? "on" : ""} onClick={() => onChange("all")}>
        All time
      </button>
    </div>
  );
}

export const tierClass = (pct: number) => `t${tier(pct)}`;

export function TierLegend() {
  return (
    <div className="tier-legend" aria-label="Color key">
      {TIER_LABELS.map((l, i) => (
        <span key={l}>
          <i className={`t${i as Tier}`} />
          {l}
        </span>
      ))}
    </div>
  );
}

/** Book picker grouped by section. */
export function BookSelect({ value, onChange, id }: { value: number; onChange: (n: number) => void; id?: string }) {
  return (
    <select id={id} className="input" value={value} onChange={(e) => onChange(Number(e.target.value))}>
      {SECTIONS.map((s) => (
        <optgroup key={s.id} label={s.name}>
          {booksIn(s.id, false).map((b) => (
            <option key={b.n} value={b.n}>
              {b.name}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

export const RefText = ({ r, short }: { r: Ref; short?: boolean }) => <>{fmtRef(r, short)}</>;

export const fmtChapters = (n: number) => (Math.abs(n - Math.round(n)) < 0.05 ? String(Math.round(n)) : n.toFixed(1));

export const bookByName = (name: string) => BOOKS.find((b) => b.name === name);
