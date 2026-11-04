import { useCallback, useEffect, useState } from "react";
import { COLLECTIONS, type DataStore } from "./store";
import { DEFAULT_SETTINGS, type CollectionName, type NewRow, type Row, type Settings } from "./types";

type State = { [K in CollectionName]: Row<K>[] };
const EMPTY: State = { sets: [], goals: [], workouts: [], foods: [], food_logs: [], measurements: [] };

/** Newest-first ordering per collection, so views can take the head of a list. */
const ORDER: { [K in CollectionName]: (a: Row<K>, b: Row<K>) => number } = {
  sets: (a, b) => b.performed_at.localeCompare(a.performed_at),
  goals: (a, b) => b.goal_date.localeCompare(a.goal_date),
  workouts: (a, b) => b.started_at.localeCompare(a.started_at),
  foods: (a, b) => a.name.localeCompare(b.name),
  food_logs: (a, b) => b.eaten_at.localeCompare(a.eaten_at),
  measurements: (a, b) => b.measured_at.localeCompare(a.measured_at),
};

const sorted = <K extends CollectionName>(c: K, rows: Row<K>[]) => [...rows].sort(ORDER[c] as (a: Row<K>, b: Row<K>) => number);

/** Loads everything once, then keeps React state and the store in step. */
export function useData(store: DataStore) {
  const [state, setState] = useState<State>(EMPTY);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const lists = await Promise.all(COLLECTIONS.map((c) => store.list(c)));
      const next = { ...EMPTY } as Record<CollectionName, unknown[]>;
      COLLECTIONS.forEach((c, i) => (next[c] = sorted(c, lists[i] as never)));
      setState(next as State);
      setSettings(await store.loadSettings());
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [store]);

  useEffect(() => {
    reload();
  }, [reload]);

  async function guard<T>(fn: () => Promise<T>): Promise<T | undefined> {
    try {
      return await fn();
    } catch (e) {
      setError((e as Error).message);
      return undefined;
    }
  }

  const put = <K extends CollectionName>(c: K, fn: (rows: Row<K>[]) => Row<K>[]) =>
    setState((s) => ({ ...s, [c]: sorted(c, fn(s[c] as Row<K>[])) }));

  return {
    ...state,
    settings,
    loading,
    error,
    mode: store.mode,
    clearError: () => setError(null),
    reload,

    insert: <K extends CollectionName>(c: K, rows: NewRow<K>[]) =>
      guard(async () => {
        const added = await store.insert(c, rows);
        put(c, (prev) => [...prev, ...added]);
        return added;
      }),
    update: <K extends CollectionName>(c: K, id: string, patch: Partial<NewRow<K>>) =>
      guard(async () => {
        await store.update(c, id, patch);
        put(c, (prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
      }),
    remove: <K extends CollectionName>(c: K, ids: string[]) =>
      guard(async () => {
        if (!ids.length) return;
        await store.remove(c, ids);
        const drop = new Set(ids);
        put(c, (prev) => prev.filter((r) => !drop.has(r.id)));
      }),

    saveSettings: (next: Settings) =>
      guard(async () => {
        await store.saveSettings(next);
        setSettings(next);
      }),
    clearAll: () =>
      guard(async () => {
        await store.clearAll();
        await reload();
      }),
  };
}

export type Data = ReturnType<typeof useData>;
