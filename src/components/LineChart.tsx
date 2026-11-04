import { useEffect, useRef, useState, type MouseEvent } from "react";
import { fmtDay } from "../lib/dates";

export interface LinePoint {
  t: number; // ms timestamp
  value: number;
}

const H = 200;
const M = { top: 14, right: 12, bottom: 26, left: 44 };

/** Single-series trend line (time-scaled x, fitted y), 2px line, ≥8px markers, crosshair tooltip. */
export function LineChart({ points, format, ariaLabel }: { points: LinePoint[]; format: (v: number) => string; ariaLabel: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(600);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(260, e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (points.length === 0) return <p className="muted">Nothing logged yet.</p>;
  if (points.length === 1) return <p className="muted">One entry so far ({format(points[0].value)}). Log again later to see a trend.</p>;

  const pts = [...points].sort((a, b) => a.t - b.t);
  const vals = pts.map((p) => p.value);
  let lo = Math.min(...vals);
  let hi = Math.max(...vals);
  const pad = Math.max((hi - lo) * 0.15, hi * 0.01, 0.5);
  lo -= pad;
  hi += pad;
  const t0 = pts[0].t;
  const t1 = pts[pts.length - 1].t;
  const iw = w - M.left - M.right;
  const ih = H - M.top - M.bottom;
  const x = (t: number) => M.left + ((t - t0) / Math.max(1, t1 - t0)) * iw;
  const y = (v: number) => M.top + ih - ((v - lo) / (hi - lo)) * ih;
  const ticks = [0, 1 / 3, 2 / 3, 1].map((f) => lo + f * (hi - lo));
  const xTicks = [t0, t0 + (t1 - t0) / 2, t1];
  const d = pts.map((p, i) => `${i ? "L" : "M"}${x(p.t)},${y(p.value)}`).join("");
  const h = hover !== null ? pts[hover] : null;

  function onMove(e: MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    let best = 0;
    pts.forEach((p, i) => Math.abs(x(p.t) - mx) < Math.abs(x(pts[best].t) - mx) && (best = i));
    setHover(best);
  }

  return (
    <div className="chart" ref={ref} onMouseLeave={() => setHover(null)}>
      <svg width={w} height={H} role="img" aria-label={ariaLabel} onMouseMove={onMove} onClick={onMove}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={M.left} x2={w - M.right} y1={y(t)} y2={y(t)} className="grid" />
            <text x={M.left - 6} y={y(t)} className="axis" textAnchor="end" dominantBaseline="middle">
              {t.toFixed(1)}
            </text>
          </g>
        ))}
        {xTicks.map((t, i) => (
          <text key={i} x={x(t)} y={H - 8} className="axis" textAnchor={i === 0 ? "start" : i === 2 ? "end" : "middle"}>
            {fmtDay(new Date(t), { month: "short", day: "numeric" })}
          </text>
        ))}
        <path d={d} className="line-mark" />
        {pts.map((p, i) => (
          <circle key={p.t} cx={x(p.t)} cy={y(p.value)} r={hover === i ? 5 : 4} className="dot-mark" />
        ))}
        {h && <line x1={x(h.t)} x2={x(h.t)} y1={M.top} y2={M.top + ih} className="crosshair" />}
      </svg>
      {h && (
        <div className="tooltip" style={{ left: Math.min(Math.max(x(h.t), 70), w - 70), top: Math.max(50, y(h.value) - 10) }}>
          <div className="tt-title">{fmtDay(new Date(h.t), { weekday: "short", month: "short", day: "numeric", year: "numeric" })}</div>
          <strong>{format(h.value)}</strong>
        </div>
      )}
    </div>
  );
}
