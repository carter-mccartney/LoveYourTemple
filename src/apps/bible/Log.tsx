import { useMemo, useState } from "react";
import type { Data } from "../../lib/useData";
import type { BibleRead } from "../../lib/types";
import { WEEKDAY_NAMES, addDays, dayKey, fmtDay, startOfWeek } from "../../lib/dates";
import { chapterEquivalents, dailyGoal } from "../../lib/bible/progress";
import { BarChart } from "../../components/BarChart";
import { Stat } from "../../components/Stat";
import { ReadEditor } from "./ReadEditor";
import { ReadList } from "./Today";
import { fmtChapters } from "./shared";

const hourLabel = (h: number) => (h === 0 ? "12a" : h < 12 ? `${h}a` : h === 12 ? "12p" : `${h - 12}p`);

export function BibleLog({ data }: { data: Data }) {
  const reads = data.bible_reads;
  const [editing, setEditing] = useState<BibleRead | "new" | null>(null);
  const [limit, setLimit] = useState(60);

  const weekly = useMemo(() => {
    const start = addDays(startOfWeek(new Date()), -7 * 11);
    return Array.from({ length: 12 }, (_, i) => {
      const from = addDays(start, i * 7);
      const to = addDays(from, 7);
      const ch = reads.filter((r) => new Date(r.read_at) >= from && new Date(r.read_at) < to).reduce((a, r) => a + chapterEquivalents(r), 0);
      return {
        key: dayKey(from),
        label: from.toLocaleDateString([], { month: "numeric", day: "numeric" }),
        value: +ch.toFixed(1),
        tooltip: (
          <>
            <strong>Week of {fmtDay(from, { month: "short", day: "numeric" })}</strong>
            <br />
            {fmtChapters(ch)} chapters
          </>
        ),
      };
    });
  }, [reads]);

  const byHour = useMemo(() => {
    const n = Array<number>(24).fill(0);
    reads.forEach((r) => (n[new Date(r.read_at).getHours()] += 1));
    return n.map((v, h) => ({
      key: String(h),
      label: hourLabel(h),
      value: v,
      tooltip: (
        <>
          <strong>{hourLabel(h)}m</strong>
          <br />
          {v} session{v === 1 ? "" : "s"}
        </>
      ),
    }));
  }, [reads]);

  const byDay = useMemo(() => {
    const n = Array<number>(7).fill(0);
    reads.forEach((r) => (n[new Date(r.read_at).getDay()] += chapterEquivalents(r)));
    return n.map((v, d) => ({
      key: String(d),
      label: WEEKDAY_NAMES[d].slice(0, 3),
      value: +v.toFixed(1),
      tooltip: (
        <>
          <strong>{WEEKDAY_NAMES[d]}s</strong>
          <br />
          {fmtChapters(v)} chapters in all
        </>
      ),
    }));
  }, [reads]);

  const minutes = reads.reduce((a, r) => a + (r.minutes ?? 0), 0);
  const topHour = byHour.reduce((a, b) => (b.value > a.value ? b : a), byHour[0]);
  const days = new Set(reads.map((r) => dayKey(new Date(r.read_at)))).size;

  // Group the list by day.
  const groups: [string, BibleRead[]][] = [];
  for (const r of reads.slice(0, limit)) {
    const k = dayKey(new Date(r.read_at));
    const g = groups[groups.length - 1];
    if (g && g[0] === k) g[1].push(r);
    else groups.push([k, [r]]);
  }

  return (
    <div className="stack">
      <div className="row">
        <h1 className="grow">Reading log</h1>
        <button className="btn primary" onClick={() => setEditing("new")}>+ Log reading</button>
      </div>

      {reads.length === 0 ? (
        <section className="card">
          <p>No readings yet. Log what you read — a passage, the time, how long, and any notes — and this page will show your patterns.</p>
        </section>
      ) : (
        <>
          <section className="card">
            <div className="stats-grid">
              <Stat label="Sessions" value={reads.length} sub={`on ${days} day${days === 1 ? "" : "s"}`} />
              <Stat label="Chapters" value={fmtChapters(reads.reduce((a, r) => a + chapterEquivalents(r), 0))} />
              <Stat label="Time logged" value={minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes}m`} />
              <Stat label="You read most at" value={topHour.value ? `${hourLabel(+topHour.key)}m` : "—"} />
            </div>
          </section>
          <section className="card">
            <h2>Chapters per week</h2>
            <BarChart points={weekly} target={dailyGoal(data.settings.bible.tracks) * 7 || null} targetLabel="Goal" ariaLabel="Chapters read per week, last 12 weeks" />
          </section>
          <section className="card">
            <h2>When you read</h2>
            <BarChart points={byHour} ariaLabel="Reading sessions by hour of day" />
            <h3 style={{ marginTop: 12 }}>By day of the week</h3>
            <BarChart points={byDay} ariaLabel="Chapters read by day of week" />
          </section>
          <section className="card">
            <h2>History</h2>
            {groups.map(([k, rs]) => (
              <div key={k} className="day-group">
                <div className="eyebrow">{fmtDay(new Date(`${k}T12:00:00`), { weekday: "long", month: "short", day: "numeric", year: "numeric" })}</div>
                <ReadList reads={rs} onEdit={setEditing} />
              </div>
            ))}
            {reads.length > limit && (
              <button className="btn" onClick={() => setLimit(limit + 100)}>
                Show more
              </button>
            )}
          </section>
        </>
      )}
      {editing && <ReadEditor data={data} read={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
