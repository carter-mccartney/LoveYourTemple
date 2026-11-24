// The "next set" rest timer: starts after a daily set, alerts when the rest is over.
//
// How the alert reaches you:
//  • App open (any tab/screen, even minimized): an alarm sound scheduled on the audio clock
//    (see alarm.ts), an in-app banner, and a system notification with Log / Snooze buttons.
//  • App closed / phone locked: browsers can't run timers for a closed page, so in cloud mode
//    the due time is also saved to Supabase and the send-reminders Edge Function pushes the
//    notification — and repeats it every few minutes until you log a set.
//  • iPhone, optionally: a Shortcut starts a real Clock-app timer when you log a set.
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
let prefs = { remindAgainMin: 0, remindAgainTimes: 0 };
/** Cloud mode: mirror the due time to Supabase so a push arrives even if the app is closed. */
export const setTimerUser = (id: string | null) => (remoteUser = id);
export const setReminderPrefs = (p: typeof prefs) => (prefs = p);

async function syncRemote(t: RestTimer | null) {
  if (!supabase || !remoteUser) return;
  try {
    if (!t) {
      await supabase.from("reminders").delete().eq("user_id", remoteUser);
      return;
    }
    const base = { user_id: remoteUser, due_at: new Date(t.dueAt).toISOString(), body: t.body, sent: false };
    const repeats = prefs.remindAgainMin > 0 ? prefs.remindAgainTimes : 0;
    const { error } = await supabase.from("reminders").upsert({
      ...base,
      exercise: t.exercise ?? null,
      reps: t.reps ?? null,
      repeat_min: prefs.remindAgainMin,
      max_sends: 1 + repeats,
      sent_count: 0,
      last_sent_at: null,
    });
    // Database not updated for repeat reminders yet: still save the basic reminder.
    if (error) await supabase.from("reminders").upsert(base);
  } catch {
    /* in-app alert still works */
  }
}

export function startTimer(minutes: number, body: string, next?: { exercise: string; reps: number }) {
  const now = Date.now();
  const t: RestTimer = { startedAt: now, dueAt: now + minutes * 60000, body, fired: false, ...next };
  set(t);
  syncRemote(t);
}

export function addMinutes(minutes: number) {
  if (!state) return;
  const t = { ...state, dueAt: Math.max(Date.now(), state.dueAt) + minutes * 60000, fired: false };
  set(t);
  syncRemote(t);
}

export function stopTimer() {
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

/** Run the user's Shortcut (e.g. "Start Timer 30 min"), which starts a real Clock-app timer. */
export function startPhoneTimer() {
  const name = getPhoneShortcut();
  if (!name) return false;
  window.location.href = `shortcuts://run-shortcut?name=${encodeURIComponent(name)}`;
  return true;
}
