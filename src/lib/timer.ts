// The "next set" rest timer: starts after a daily set, alerts when the rest is over.
//
// How the alert reaches you:
//  • App open (any tab/screen): in-app banner + sound + vibration, and a system
//    notification if the app is in the background.
//  • App closed / phone locked: browsers can't run timers for a closed page, so in
//    cloud mode the due time is also saved to Supabase and the send-reminders Edge
//    Function pushes the notification (see supabase/functions/send-reminders).
import { useSyncExternalStore } from "react";
import { supabase } from "./supabase";
import { enableNotifications } from "./crew";

export interface RestTimer {
  startedAt: number;
  dueAt: number;
  /** Shown in the notification, e.g. "40 Push Ups · 160 / 480 today". */
  body: string;
  fired: boolean;
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

export const useRestTimer = () =>
  useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );

let remoteUser: string | null = null;
/** Cloud mode: mirror the due time to Supabase so a push arrives even if the app is closed. */
export const setTimerUser = (id: string | null) => (remoteUser = id);

async function syncRemote(t: RestTimer | null) {
  if (!supabase || !remoteUser) return;
  try {
    if (t) await supabase.from("reminders").upsert({ user_id: remoteUser, due_at: new Date(t.dueAt).toISOString(), body: t.body, sent: false });
    else await supabase.from("reminders").delete().eq("user_id", remoteUser);
  } catch {
    /* in-app alert still works */
  }
}

export function startTimer(minutes: number, body: string) {
  const now = Date.now();
  const t = { startedAt: now, dueAt: now + minutes * 60000, body, fired: false };
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

/** A short two-tone chime, no audio file needed. */
export function chime() {
  try {
    const ctx = new AudioContext();
    [880, 1175].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.22);
      g.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + i * 0.22 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.22 + 0.4);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + i * 0.22);
      o.stop(ctx.currentTime + i * 0.22 + 0.45);
    });
    setTimeout(() => ctx.close(), 1500);
  } catch {
    /* no audio */
  }
}

export async function showTimerNotification(title: string, body: string) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const opts: NotificationOptions = { body, icon: "icon.svg", tag: "lyt-timer", data: { url: "#/pushups" }, requireInteraction: true };
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
