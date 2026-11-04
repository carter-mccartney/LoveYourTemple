// Sharing with friends ("crews"). Cloud mode only — needs Supabase.
import { supabase } from "./supabase";
import { withDefaults } from "./store";
import { dayKey } from "./dates";
import type { Settings, Workout, WorkoutSet } from "./types";

export interface Crew {
  id: string;
  name: string;
  invite_code: string;
  created_by: string;
}

export interface Member {
  id: string;
  display_name: string | null;
  share_workouts: boolean;
  share_food: boolean;
  settings: Settings;
}

function must<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

const db = () => {
  if (!supabase) throw new Error("Sharing needs cloud sync (Supabase) to be set up.");
  return supabase;
};

export async function myCrews(): Promise<{ crews: Crew[]; members: Record<string, Member[]> }> {
  const crews = must(await db().from("crews").select("id, name, invite_code, created_by").order("created_at")) as Crew[];
  if (!crews.length) return { crews, members: {} };
  const links = must(await db().from("crew_members").select("crew_id, user_id").in("crew_id", crews.map((c) => c.id))) as {
    crew_id: string;
    user_id: string;
  }[];
  const ids = [...new Set(links.map((l) => l.user_id))];
  const profiles = must(await db().from("profiles").select("id, display_name, share_workouts, share_food, settings").in("id", ids)) as (Omit<Member, "settings"> & { settings: Partial<Settings> })[];
  const byId = new Map(profiles.map((p) => [p.id, { ...p, settings: withDefaults(p.settings) }]));
  const members: Record<string, Member[]> = {};
  for (const l of links) {
    const p = byId.get(l.user_id);
    if (p) (members[l.crew_id] ??= []).push(p);
  }
  return { crews, members };
}

export async function createCrew(name: string) {
  return must(await db().rpc("create_crew", { crew_name: name })) as Crew;
}

export async function joinCrew(code: string) {
  return must(await db().rpc("join_crew", { code })) as Crew;
}

export async function leaveCrew(crewId: string, userId: string) {
  must(await db().from("crew_members").delete().eq("crew_id", crewId).eq("user_id", userId));
}

export async function setSharing(userId: string, patch: { share_workouts?: boolean; share_food?: boolean }) {
  must(await db().from("profiles").update(patch).eq("id", userId));
}

export async function myProfile(userId: string) {
  return must(await db().from("profiles").select("display_name, share_workouts, share_food").eq("id", userId).maybeSingle()) as {
    display_name: string | null;
    share_workouts: boolean;
    share_food: boolean;
  } | null;
}

/** A friend's recent activity. Row-level security decides what's actually visible. */
export async function memberActivity(userId: string, days = 14) {
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const [sets, workouts, profile] = await Promise.all([
    db().from("exercise_sets").select("*").eq("user_id", userId).gte("performed_at", since).order("performed_at", { ascending: false }),
    db().from("workouts").select("*").eq("user_id", userId).gte("started_at", since).order("started_at", { ascending: false }),
    db().from("profiles").select("id, display_name, share_workouts, share_food, settings").eq("id", userId).maybeSingle(),
  ]);
  const p = must(profile) as (Omit<Member, "settings"> & { settings: Partial<Settings> }) | null;
  return {
    sets: (must(sets) ?? []) as WorkoutSet[],
    workouts: (workouts.error ? [] : workouts.data ?? []) as Workout[],
    member: p ? { ...p, settings: withDefaults(p.settings) } : null,
  };
}

/** Today's habit total for one exercise, for notification text like "… · 160 today". */
async function todayTotal(userId: string, exercise: string) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const rows = must(
    await db().from("exercise_sets").select("reps").eq("user_id", userId).eq("exercise", exercise).gte("performed_at", start.toISOString()),
  ) as { reps: number }[];
  return rows.reduce((n, r) => n + r.reps, 0);
}

export interface CrewEvent {
  userId: string;
  title: string;
  body: string;
  url: string;
}

/**
 * Live feed while the app is open: every set a crewmate logs outside a workout,
 * and every workout they finish. (Closed-app notifications come from the
 * notify-crew Edge Function + web push instead.)
 */
export function subscribeCrew(myId: string, names: Map<string, string>, onEvent: (e: CrewEvent) => void) {
  const ch = db()
    .channel("crew-activity")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "exercise_sets" }, async (payload) => {
      const s = payload.new as WorkoutSet & { user_id: string };
      if (s.user_id === myId || s.workout_id) return;
      const who = names.get(s.user_id) ?? "A crewmate";
      const total = await todayTotal(s.user_id, s.exercise).catch(() => null);
      onEvent({
        userId: s.user_id,
        title: `${who} did ${s.reps} ${s.exercise}`,
        body: total ? `${total} today` : "Tap to see their day",
        url: `#/crew/${s.user_id}`,
      });
    })
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "workouts" }, (payload) => {
      const w = payload.new as Workout & { user_id: string };
      const old = payload.old as Partial<Workout>;
      if (w.user_id === myId || !w.ended_at || old.ended_at) return;
      const who = names.get(w.user_id) ?? "A crewmate";
      onEvent({ userId: w.user_id, title: `${who} finished: ${w.title}`, body: "Tap to see their day", url: `#/crew/${w.user_id}` });
    })
    .subscribe();
  return () => {
    db().removeChannel(ch);
  };
}

/** System notification (works while the app is open or in a background tab). */
export async function notify(e: CrewEvent) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const reg = await navigator.serviceWorker?.getRegistration();
  const opts = { body: e.body, icon: "icon.svg", tag: `crew-${e.userId}`, data: { url: e.url } };
  if (reg) reg.showNotification(e.title, opts);
  else new Notification(e.title, opts);
}

const VAPID = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

function urlBase64ToUint8Array(base64: string) {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/**
 * Ask for notification permission and, if a VAPID key is configured, register this
 * device for push so notifications arrive even when the app is closed.
 * On iPhone this only works after "Add to Home Screen" (iOS 16.4+).
 */
export async function enableNotifications(userId: string): Promise<"push" | "open-only" | "denied"> {
  if (!("Notification" in window)) return "denied";
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return "denied";
  const reg = await navigator.serviceWorker?.getRegistration();
  if (!VAPID || !reg || !("pushManager" in reg)) return "open-only";
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID) }));
  const j = sub.toJSON();
  must(await db().from("push_subscriptions").upsert({ user_id: userId, endpoint: j.endpoint, p256dh: j.keys?.p256dh, auth: j.keys?.auth }, { onConflict: "endpoint" }));
  return "push";
}

export const isToday = (iso: string) => dayKey(new Date(iso)) === dayKey(new Date());
