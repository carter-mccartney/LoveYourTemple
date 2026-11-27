// The "next set" rest timer: starts after a daily set, alerts when the rest is over.
//
// How the alert reaches you:
//  • App open (any tab/screen, even minimized): an alarm sound scheduled on the audio clock
//    (see alarm.ts), an in-app banner, and a system notification with Log / Snooze buttons.
//  • App closed / phone locked: browsers can't run timers for a closed page, so in cloud mode
//    the due time is also saved to Supabase and the send-reminders Edge Function pushes the
//    notification — and repeats it every few minutes until you log a set.
//  • iPhone, optionally: a Shortcut starts a real Clock-app timer when you log a set.
//
// In cloud mode the timer is shared by all your devices: log a set on the computer and your
// phone shows the same countdown (the reminders row is the shared copy; see pullRemoteTimer).
import { useSyncExternalStore } from "react";
import { supabase } from "./supabase";
import { enableNotifications } from "./crew";

export interface RestTimer {
  startedAt: number;
  dueAt: number;
  /** Shown in the notification, e.g. "40 Push Ups · 160 / 480 today". */
  body: string;
  fired: boolean;
  /** The set it's reminding you about, for the notification's "Log 40" button. */
  exercise?: string;
  reps?: number;
}

const KEY = "lyt.timer";
let state: RestTimer | null = (() => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "null");
  } catch {
    return null;
  }
})();
const listeners = new Set<() => void>();

function set(next: RestTimer | null) {
  state = next;
  try {
    if (next) localStorage.setItem(KEY, JSON.stringify(next));
    else localStorage.removeItem(KEY);
  } catch {
    /* timer still works for this session */
  }
  listeners.forEach((l) => l());
}

export const getTimer = () => state;

export const useRestTimer = () =>
  useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );

let remoteUser: string | null = null;
let prefs = { remindAgainMin: 0, remindAgainTimes: 0, intervalMin: 30 };
/** Cloud mode: mirror the due time to Supabase so a push arrives even if the app is closed. */
export const setTimerUser = (id: string | null) => (remoteUser = id);
export const setReminderPrefs = (p: typeof prefs) => (prefs = p);

/** This device's push address, so a "timer started" push skips the device that started it. */
async function myEndpoint(): Promise<string | null> {
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    return (await reg?.pushManager?.getSubscription())?.endpoint ?? null;
  } catch {
    return null;
  }
}

/** `announce`: a new timer — tell your iPhone (see "timer started" in send-reminders). */
async function syncRemote(t: RestTimer | null, announce = false) {
  if (!supabase || !remoteUser) return;
  try {
    if (!t) {
      await supabase.from("reminders").delete().eq("user_id", remoteUser);
      return;
    }
    const base = { user_id: remoteUser, due_at: new Date(t.dueAt).toISOString(), body: t.body, sent: false };
    const started_at = new Date(t.startedAt).toISOString();
    const repeats = prefs.remindAgainMin > 0 ? prefs.remindAgainTimes : 0;
    const full = {
      ...base,
      exercise: t.exercise ?? null,
      reps: t.reps ?? null,
      repeat_min: prefs.remindAgainMin,
      max_sends: 1 + repeats,
      sent_count: 0,
      last_sent_at: null,
    };
    // Older databases lack newer columns: drop them one step at a time so the reminder still saves.
    const shared = { ...full, started_at, announce, from_endpoint: announce ? await myEndpoint() : null };
    for (const row of [shared, { ...full, started_at }, full, base]) {
      const { error } = await supabase.from("reminders").upsert(row);
      if (!error) break;
    }
  } catch {
    /* in-app alert still works */
  }
}

// ---------- Sharing the timer between your devices ----------

/** When this device last changed the timer — its own save may not have reached the server yet. */
let lastLocalChange = 0;

interface RemoteRow {
  due_at: string;
  body: string;
  started_at?: string | null;
  exercise?: string | null;
  reps?: number | null;
}

/** Make this device's timer match the shared copy (started, snoozed or stopped elsewhere). */
export async function pullRemoteTimer() {
  if (!supabase || !remoteUser) return;
  const asked = Date.now();
  let res = await supabase.from("reminders").select("due_at, body, started_at, exercise, reps").eq("user_id", remoteUser).maybeSingle();
  // Database not updated for timer sharing yet: the basic columns still work.
  if (res.error) res = (await supabase.from("reminders").select("due_at, body").eq("user_id", remoteUser).maybeSingle()) as typeof res;
  if (res.error || lastLocalChange > asked - 15000) return;
  const row = res.data as RemoteRow | null;
  const dueAt = row ? Date.parse(row.due_at) : 0;
  // No timer elsewhere, or only an old one (e.g. from yesterday).
  if (!row || dueAt < Date.now() - 3 * 3600000) {
    if (state && !state.fired) set(null);
    return;
  }
  if (!state || Math.abs(state.dueAt - dueAt) >= 1500) {
    const startedAt = row.started_at ? Date.parse(row.started_at) : dueAt - prefs.intervalMin * 60000;
    set({ startedAt, dueAt, body: row.body, fired: dueAt <= Date.now(), exercise: row.exercise ?? undefined, reps: row.reps ?? undefined });
  }
  autoPhoneTimer();
}

/** Live updates while the app is open. Returns a function that stops listening. */
export function watchRemoteTimer(): () => void {
  if (!supabase || !remoteUser) return () => {};
  const db = supabase;
  const ch = db
    .channel("my-rest-timer")
    .on("postgres_changes", { event: "*", schema: "public", table: "reminders" }, () => pullRemoteTimer())
    .subscribe();
  return () => {
    db.removeChannel(ch);
  };
}

export function startTimer(minutes: number, body: string, next?: { exercise: string; reps: number }) {
  lastLocalChange = Date.now();
  const now = Date.now();
  const t: RestTimer = { startedAt: now, dueAt: now + minutes * 60000, body, fired: false, ...next };
  set(t);
  setPhoneRanFor(now); // started here: this device decides about its own Clock timer
  syncRemote(t, true);
}

export function addMinutes(minutes: number) {
  if (!state) return;
  lastLocalChange = Date.now();
  const t = { ...state, dueAt: Math.max(Date.now(), state.dueAt) + minutes * 60000, fired: false };
  set(t);
  syncRemote(t);
}

export function stopTimer() {
  lastLocalChange = Date.now();
  set(null);
  syncRemote(null);
}

export function markFired() {
  if (state) set({ ...state, fired: true });
}

export async function showTimerNotification(title: string, body: string, reps?: number) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  // Buttons show on desktop and Android (iPhone ignores them). Clicking one is handled in sw.js.
  const opts = {
    body,
    icon: "icon.svg",
    badge: "icon.svg",
    tag: "lyt-timer",
    renotify: true,
    requireInteraction: true,
    vibrate: [300, 150, 300, 150, 600],
    data: { url: "#/pushups" },
    actions: [
      { action: "log", title: reps ? `Log ${reps}` : "Log set" },
      { action: "snooze", title: "Snooze 5 min" },
    ],
  } as NotificationOptions;
  const reg = await navigator.serviceWorker?.getRegistration();
  if (reg) await reg.showNotification(title, opts);
  else new Notification(title, opts);
}

export const notificationsAllowed = () => "Notification" in window && Notification.permission === "granted";

/**
 * Ask for notification permission. In cloud mode also registers this device for
 * push, so reminders arrive with the app closed.
 */
export async function enableAlerts(): Promise<boolean> {
  if (!("Notification" in window)) return false;
  if (remoteUser) return (await enableNotifications(remoteUser).catch(() => "denied")) !== "denied";
  return (await Notification.requestPermission()) === "granted";
}

/**
 * If notifications were allowed before cloud sync existed, this device was never registered
 * for push. Register it quietly (no prompt — permission is already granted).
 */
export async function ensurePushRegistered(userId: string) {
  if (!notificationsAllowed()) return;
  await enableNotifications(userId).catch(() => {});
}

// ---------- iPhone Clock timer via Shortcuts (this device only) ----------

const SHORTCUT_KEY = "lyt.phoneShortcut";
export const getPhoneShortcut = () => {
  try {
    return localStorage.getItem(SHORTCUT_KEY) ?? "";
  } catch {
    return "";
  }
};
export const setPhoneShortcut = (name: string) => {
  try {
    if (name) localStorage.setItem(SHORTCUT_KEY, name);
    else localStorage.removeItem(SHORTCUT_KEY);
  } catch {
    /* ignore */
  }
};

/**
 * Run the user's Shortcut, which starts a real Clock-app timer. It's handed the time left in
 * seconds (so 1.5 minutes → 90), to use as the Start Timer duration.
 */
export function startPhoneTimer() {
  const name = getPhoneShortcut();
  if (!name) return false;
  if (state) setPhoneRanFor(state.startedAt);
  const left = state && state.dueAt > Date.now() ? (state.dueAt - Date.now()) / 1000 : prefs.intervalMin * 60;
  const seconds = Math.max(1, Math.round(left));
  window.location.href = `shortcuts://run-shortcut?name=${encodeURIComponent(name)}&input=text&text=${seconds}`;
  return true;
}

// Timers started on another device (e.g. a set logged on the computer). iPhone won't let a
// website or another device start a Shortcut in the background, so this happens the moment
// this app is on screen: opened, switched back to, or opened from the "timer started" push.

const AUTO_KEY = "lyt.phoneShortcut.remote";
const RAN_KEY = "lyt.phoneShortcut.ranFor";
/** Start the Clock timer for timers started on your other devices (default on). */
export const getPhoneAuto = () => {
  try {
    return localStorage.getItem(AUTO_KEY) !== "0";
  } catch {
    return true;
  }
};
const ranFor = () => {
  try {
    return Number(localStorage.getItem(RAN_KEY) ?? 0);
  } catch {
    return 0;
  }
};
function setPhoneRanFor(startedAt: number) {
  try {
    localStorage.setItem(RAN_KEY, String(Math.round(startedAt)));
  } catch {
    /* ignore */
  }
}
/** Whether this device already started (or chose not to start) its Clock timer for the current rest. */
export const phoneTimerStarted = () => !!state && Math.abs(ranFor() - state.startedAt) < 1500;

/** On this iPhone, start the Clock timer for a rest timer started elsewhere — once per timer. */
export function autoPhoneTimer() {
  if (!getPhoneShortcut() || !getPhoneAuto() || !state || state.fired) return false;
  if (state.dueAt - Date.now() < 15000 || phoneTimerStarted() || document.visibilityState !== "visible") return false;
  return startPhoneTimer();
}

/**
 * Save the iPhone options, and tell the server whether this device wants a push when a
 * timer starts on another device (only devices with a Shortcut set up get one).
 */
export async function setPhoneAuto(on: boolean) {
  try {
    localStorage.setItem(AUTO_KEY, on ? "1" : "0");
  } catch {
    /* ignore */
  }
  await syncPhoneAlerts();
}
export async function syncPhoneAlerts() {
  if (!supabase || !remoteUser) return;
  const endpoint = await myEndpoint();
  if (!endpoint) return;
  await supabase
    .from("push_subscriptions")
    .update({ timer_start: !!getPhoneShortcut() && getPhoneAuto() })
    .eq("endpoint", endpoint);
}
