// The app only talks to this interface. Without Supabase keys it's backed by
// the browser (localStorage); with them, by the cloud database.
import { DEFAULT_SETTINGS, type CollectionName, type NewRow, type Row, type Settings } from "./types";
import { supabase } from "./supabase";

export interface DataStore {
  mode: "local" | "cloud";
  list<K extends CollectionName>(c: K): Promise<Row<K>[]>;
  insert<K extends CollectionName>(c: K, rows: NewRow<K>[]): Promise<Row<K>[]>;
  update<K extends CollectionName>(c: K, id: string, patch: Partial<NewRow<K>>): Promise<void>;
  remove<K extends CollectionName>(c: K, ids: string[]): Promise<void>;
  loadSettings(): Promise<Settings>;
  saveSettings(s: Settings): Promise<void>;
  clearAll(): Promise<void>;
}

export const COLLECTIONS: CollectionName[] = ["sets", "goals", "workouts", "foods", "food_logs", "measurements", "bible_reads", "memory_verses", "reading_books", "book_reads"];

/** Added after launch: if their tables aren't in the database yet, the rest of the app still loads. */
export const OPTIONAL: CollectionName[] = ["bible_reads", "memory_verses", "reading_books", "book_reads"];

/** Merge stored settings over defaults, one level deep for nested groups. */
export const withDefaults = (s: Partial<Settings> | null | undefined): Settings => ({
  ...DEFAULT_SETTINGS,
  ...(s ?? {}),
  nutrition: { ...DEFAULT_SETTINGS.nutrition, ...(s?.nutrition ?? {}) },
  packed: { ...DEFAULT_SETTINGS.packed, ...(s?.packed ?? {}) },
  bible: { ...DEFAULT_SETTINGS.bible, ...(s?.bible ?? {}) },
});

const uid = () => crypto.randomUUID();

// ---------- Local (this device only) ----------

const key = (c: CollectionName | "settings") => `replog.${c}`;

function read<T>(k: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(k);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(k: string, value: unknown) {
  try {
    localStorage.setItem(k, JSON.stringify(value));
  } catch (e) {
    console.error("Could not save to this browser", e);
    throw new Error("This browser blocked saving (private window or storage full).");
  }
}

export const localStore: DataStore = {
  mode: "local",
  async list(c) {
    return read(key(c), []);
  },
  async insert(c, rows) {
    const added = rows.map((r) => ({ ...r, id: uid() })) as Row<typeof c>[];
    write(key(c), [...read<unknown[]>(key(c), []), ...added]);
    return added;
  },
  async update(c, id, patch) {
    write(key(c), read<{ id: string }[]>(key(c), []).map((r) => (r.id === id ? { ...r, ...patch } : r)));
  },
  async remove(c, ids) {
    const drop = new Set(ids);
    write(key(c), read<{ id: string }[]>(key(c), []).filter((r) => !drop.has(r.id)));
  },
  async loadSettings() {
    return withDefaults(read<Partial<Settings>>(key("settings"), {}));
  },
  async saveSettings(s) {
    write(key("settings"), s);
  },
  async clearAll() {
    [...COLLECTIONS, "settings" as const].forEach((c) => localStorage.removeItem(key(c)));
  },
};

// ---------- Cloud (Supabase) ----------
// Table names match supabase/schema.sql. Row-level security does the real
// access control; the user_id filter just keeps friends' rows out of *my* lists.

const TABLE: Record<CollectionName, string> = {
  sets: "exercise_sets",
  goals: "goals",
  workouts: "workouts",
  foods: "foods",
  food_logs: "food_logs",
  measurements: "measurements",
  bible_reads: "bible_reads",
  memory_verses: "memory_verses",
  reading_books: "reading_books",
  book_reads: "book_reads",
};

function must<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

const strip = <T extends object>(r: T) => {
  const { user_id: _u, created_at: _c, ...rest } = r as Record<string, unknown>;
  return rest as unknown as T;
};

export function cloudStore(userId: string): DataStore {
  const db = supabase!;
  return {
    mode: "cloud",
    async list(c) {
      const rows: unknown[] = [];
      // Supabase caps a select at 1000 rows; page through.
      for (let from = 0; ; from += 1000) {
        const page = must(await db.from(TABLE[c]).select("*").eq("user_id", userId).range(from, from + 999)) as object[];
        rows.push(...page.map(strip));
        if (page.length < 1000) return rows as Row<typeof c>[];
      }
    },
    async insert(c, rows) {
      const out: unknown[] = [];
      for (let i = 0; i < rows.length; i += 500) {
        out.push(...(must(await db.from(TABLE[c]).insert(rows.slice(i, i + 500) as never).select("*")) as object[]).map(strip));
      }
      return out as Row<typeof c>[];
    },
    async update(c, id, patch) {
      must(await db.from(TABLE[c]).update(patch as never).eq("id", id));
    },
    async remove(c, ids) {
      must(await db.from(TABLE[c]).delete().in("id", ids));
    },
    async loadSettings() {
      const row = must(await db.from("profiles").select("settings").eq("id", userId).maybeSingle()) as
        | { settings: Partial<Settings> | null }
        | null;
      return withDefaults(row?.settings);
    },
    async saveSettings(s) {
      must(await db.from("profiles").upsert({ id: userId, settings: s, display_name: s.displayName || null }));
    },
    async clearAll() {
      for (const c of COLLECTIONS) {
        const res = await db.from(TABLE[c]).delete().eq("user_id", userId);
        if (res.error && !OPTIONAL.includes(c)) throw new Error(res.error.message);
      }
    },
  };
}
