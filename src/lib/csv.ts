import type { NewSet, WorkoutSet } from "./types";

const cell = (v: string | number) => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function setsToCsv(sets: WorkoutSet[]) {
  const rows = [...sets]
    .sort((a, b) => a.performed_at.localeCompare(b.performed_at))
    .map((s) => {
      const d = new Date(s.performed_at);
      return [d.toLocaleDateString(), d.toLocaleTimeString(), s.exercise, s.reps, s.notes, s.performed_at].map(cell).join(",");
    });
  return ["Date,Time,Exercise,Amount,Notes,performed_at", ...rows].join("\n");
}

/** Minimal RFC-4180 parser (quoted fields, escaped quotes, newlines in quotes). */
function parse(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let f = "";
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { f += '"'; i++; }
      else if (c === '"') q = false;
      else f += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(f); f = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(f); rows.push(row); row = []; f = "";
    } else f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim()));
}

/**
 * Accepts this app's own export, or any CSV with a timestamp column
 * (performed_at / Time / Date+Time), an exercise column and a reps/amount column.
 */
export function csvToSets(text: string): NewSet[] {
  const [header, ...rows] = parse(text);
  const h = header.map((x) => x.trim().toLowerCase());
  const col = (...names: string[]) => h.findIndex((x) => names.includes(x));
  const iTs = col("performed_at", "timestamp");
  const iDate = col("date");
  const iTime = col("time");
  const iEx = col("exercise", "exercise_name");
  const iReps = col("reps", "amount", "count");
  const iNotes = col("notes");
  if (iEx < 0 || iReps < 0 || (iTs < 0 && iTime < 0)) throw new Error("CSV needs timestamp, exercise and reps columns.");

  return rows.flatMap((r) => {
    const raw = iTs >= 0 ? r[iTs] : iDate >= 0 && !/\d{4}|\//.test(r[iTime] ?? "") ? `${r[iDate]} ${r[iTime]}` : r[iTime];
    const d = new Date(raw);
    const reps = Number(r[iReps]);
    if (isNaN(d.getTime()) || !reps) return [];
    return [{ performed_at: d.toISOString(), exercise: r[iEx].trim(), reps, notes: iNotes >= 0 ? r[iNotes] ?? "" : "" }];
  });
}

export function download(filename: string, text: string, type = "text/csv") {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
