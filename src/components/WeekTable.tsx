import type { weekTable } from "../lib/stats";

export function WeekTable({ rows }: { rows: ReturnType<typeof weekTable> }) {
  return (
    <table className="table">
      <thead>
        <tr>
          <th>Day</th>
          <th className="num">Reps</th>
          <th className="num">Sets</th>
          <th className="num">Avg/set</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.date.toISOString()} className={r.isToday ? "today" : ""}>
            <td>{r.date.toLocaleDateString([], { weekday: "long" })}</td>
            <td className="num">{r.reps || "–"}</td>
            <td className="num">{r.sets || "–"}</td>
            <td className="num">{r.sets ? r.avg.toFixed(1) : "–"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
