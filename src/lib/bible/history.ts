// Your Bible Challenge answers (last 1,000). Kept on the device, and when you're signed in also
// saved to the quiz_answers table, so your phone and computer show the same history.
import { supabase } from "../supabase";
import type { Category } from "./questions";
import type { Grade } from "./compare";

export interface Answered {
  id: string;
  at: number;
  cat: Category;
  prompt: string;
  quote?: string;
  given: string;
  answer: string;
  grade: Grade;
  ref?: string;
  explain?: string;
  link?: string;
  /** Saved to the server (signed in). Unsaved ones are retried next time. */
  synced?: boolean;
}

const KEY = "lyt.quiz.history";
const MAX = 1000;
const newId = () => crypto.randomUUID();

export const loadHistory = (): Answered[] => {
  try {
    const h = JSON.parse(localStorage.getItem(KEY) ?? "[]") as Answered[];
    // Answers saved before history synced have no id yet.
    return h.map((a) => (a.id ? a : { ...a, id: newId() }));
  } catch {
    return [];
  }
};
const saveLocal = (h: Answered[]) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(h.slice(-MAX)));
  } catch {
    /* ignore */
  }
};

const signedIn = async () => !!supabase && !!(await supabase.auth.getSession()).data.session;

const toRow = (a: Answered) => ({
  id: a.id,
  answered_at: new Date(a.at).toISOString(),
  cat: a.cat,
  prompt: a.prompt,
  quote: a.quote ?? null,
  given: a.given,
  answer: a.answer,
  grade: a.grade,
  ref: a.ref ?? null,
  explain: a.explain ?? null,
  link: a.link ?? null,
});
interface Row {
  id: string;
  answered_at: string;
  cat: Category;
  prompt: string;
  quote: string | null;
  given: string;
  answer: string;
  grade: Grade;
  ref: string | null;
  explain: string | null;
  link: string | null;
}
const fromRow = (r: Row): Answered => ({
  id: r.id,
  at: Date.parse(r.answered_at),
  cat: r.cat,
  prompt: r.prompt,
  quote: r.quote ?? undefined,
  given: r.given,
  answer: r.answer,
  grade: r.grade,
  ref: r.ref ?? undefined,
  explain: r.explain ?? undefined,
  link: r.link ?? undefined,
  synced: true,
});

/** Save these answers to the server; marks the ones that made it. */
async function upload(items: Answered[]) {
  if (!items.length || !(await signedIn())) return;
  const { error } = await supabase!.from("quiz_answers").upsert(items.map(toRow));
  if (error) return; // table not created yet, or offline: stays on this device, retried later
  const done = new Set(items.map((a) => a.id));
  saveLocal(loadHistory().map((a) => (done.has(a.id) ? { ...a, synced: true } : a)));
}

export function addAnswer(a: Omit<Answered, "id" | "synced">) {
  const item = { ...a, id: newId() };
  saveLocal([...loadHistory(), item]);
  upload([item]);
}

/** You decided a "close" answer counts (or doesn't). */
export function regradeLast(grade: Grade) {
  const h = loadHistory();
  if (!h.length) return;
  const last = { ...h[h.length - 1], grade, synced: false };
  saveLocal([...h.slice(0, -1), last]);
  upload([last]);
}

/** Everything from all your devices (signed in), newest last. Falls back to this device's copy. */
export async function syncHistory(): Promise<Answered[]> {
  const local = loadHistory();
  if (!(await signedIn())) return local;
  await upload(local.filter((a) => !a.synced));
  const { data, error } = await supabase!
    .from("quiz_answers")
    .select("id, answered_at, cat, prompt, quote, given, answer, grade, ref, explain, link")
    .order("answered_at", { ascending: false })
    .limit(MAX);
  if (error) return loadHistory();
  const server = (data as Row[]).map(fromRow);
  const have = new Set(server.map((a) => a.id));
  const merged = [...server, ...loadHistory().filter((a) => !a.synced && !have.has(a.id))].sort((x, y) => x.at - y.at);
  saveLocal(merged);
  return merged;
}

export async function clearHistory() {
  saveLocal([]);
  if (await signedIn()) await supabase!.from("quiz_answers").delete().gte("answered_at", "1900-01-01");
}

export const historySynced = signedIn;
