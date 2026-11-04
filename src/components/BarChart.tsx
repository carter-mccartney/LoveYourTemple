import { useEffect, useRef, useState, type ReactNode } from "react";

export interface BarPoint {
  key: string;
  label: string; // axis label
  value: number;
  tooltip: ReactNode;
}

const H = 200;
const M = { top: 16, right: 8, bottom: 26, left: 40 };

function niceMax(v: number) {
  if (v <= 0) return 10;
  const step = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * step >= v) return m * step;
  return 10 * step;
}

/**
 * Single-series column chart: thin bars, recessive grid, dashed target/limit
 * line, hover/tap tooltip. `over` colors bars past a limit (e.g. added sugar).
 */
export function BarChart({
  points,
  target,
  targetLabel = "Target",
  overLimit = false,
  ariaLabel,
}: {
  points: BarPoint[];
  target?: number | null;
  targetLabel?: string;
  /** When true, bars above `target` are drawn in the warning color. */
  overLimit?: boolean;
  ariaLabel: string;
}) {
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

  if (!points.length) return <p className="muted">No data in this range.</p>;

  const max = niceMax(Math.max(...points.map((b) => b.value), target ?? 0));
  const iw = w - M.left - M.right;
  const ih = H - M.top - M.bottom;
  const band = iw / points.length;
  const bw = Math.max(2, Math.min(24, band - 2)); // ≤24px, ≥2px gap between bars
  const y = (v: number) => M.top + ih - (v / max) * ih;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
  const every = Math.ceil(points.length / Math.max(2, Math.floor(iw / 56)));
  const h = hover !== null ? points[hover] : null;
  const hx = hover !== null ? M.left + band * hover + band / 2 : 0;
  const fmtTick = (t: number) => (t >= 1000 ? `${+(t / 1000).toFixed(1)}k` : `${+t.toFixed(1)}`);

  return (
    <div className="chart" ref={ref} onMouseLeave={() => setHover(null)}>
      <svg width={w} height={H} role="img" aria-label={ariaLabel}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={M.left} x2={w - M.right} y1={y(t)} y2={y(t)} className="grid" />
            <text x={M.left - 6} y={y(t)} className="axis" textAnchor="end" dominantBaseline="middle">
              {fmtTick(t)}
            </text>
          </g>
        ))}
        {points.map((b, i) => {
          if (!b.value) return null;
          const x = M.left + band * i + (band - bw) / 2;
          const top = y(b.value);
          const bottom = M.top + ih;
          const r = Math.min(4, bw / 2, bottom - top);
          // Rounded data-end, square at the baseline.
          const d = `M${x},${bottom}V${top + r}Q${x},${top} ${x + r},${top}H${x + bw - r}Q${x + bw},${top} ${x + bw},${top + r}V${bottom}Z`;
          const over = overLimit && target != null && b.value > target;
          return <path key={b.key} d={d} className={`bar-mark ${over ? "over" : ""} ${hover === i ? "hot" : ""}`} />;
        })}
        {target ? (
          <g>
            <line x1={M.left} x2={w - M.right} y1={y(target)} y2={y(target)} className="target" />
            <text x={w - M.right} y={y(target) - 5} className="axis" textAnchor="end">
              {targetLabel} {+target.toFixed(1)}
            </text>
          </g>
        ) : null}
        {points.map((b, i) =>
          i % every === 0 ? (
            <text key={b.key} x={M.left + band * i + band / 2} y={H - 8} className="axis" textAnchor="middle">
              {b.label}
            </text>
          ) : null,
        )}
        {/* Hit targets: the full column band, bigger than the mark. */}
        {points.map((b, i) => (
          <rect key={b.key} x={M.left + band * i} y={M.top} width={band} height={ih} fill="transparent" onMouseEnter={() => setHover(i)} onClick={() => setHover(i)} />
        ))}
      </svg>
      {h && (
        <div className="tooltip" style={{ left: Math.min(Math.max(hx, 80), w - 80), top: Math.max(56, y(h.value) - 8) }}>
          {h.tooltip}
        </div>
      )}
    </div>
  );
}
