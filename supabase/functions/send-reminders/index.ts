// Supabase Edge Function: "Time for your next set" when the rest timer ends — even if the app is
// closed — then again every few minutes (your setting) until you log a set or snooze.
// Also: timer changes made on one device (started, +5 min, stopped) go to your other devices that
// asked for them — "Rest timer started" on an iPhone with the Clock-timer Shortcut starts that
// timer when tapped — and a countdown ("10 min left" … "1 min left") goes to devices that want it.
// Add a Database Webhook on timer_events (Insert) → this function to make the changes instant.
// Runs every minute via pg_cron (see the end of supabase/schema.sql). Uses the same VAPID and
// WEBHOOK_SECRET secrets as notify-crew. Deploy with "Verify JWT" turned off.
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
webpush.setVapidDetails(Deno.env.get("VAPID_SUBJECT")!, Deno.env.get("VAPID_PUBLIC_KEY")!, Deno.env.get("VAPID_PRIVATE_KEY")!);

interface Reminder {
  user_id: string;
  body: string;
  due_at: string;
  reps: number | null;
  repeat_min: number | null;
  max_sends: number | null;
  sent_count: number | null;
  last_sent_at: string | null;
}

interface Sub {
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}
const push = (s: Sub, msg: object, ttl: number) =>
  webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(msg), { urgency: "high", TTL: ttl });

const minsLeft = (due: string, now: number) => Math.max(1, Math.round((Date.parse(due) - now) / 60000));
const mins = (n: number) => `${n} min`;

interface TimerEvent {
  user_id: string;
  kind: "start" | "add" | "stop";
  due_at: string | null;
  minutes: number | null;
  from_endpoint: string | null;
}

/**
 * Timer changes made on one device ("timer_events", written by the app) → a notification on your
 * other devices. Runs instantly from the timer_events webhook, and every minute as a sweep.
 */
async function handleEvents(now: number): Promise<string> {
  const cutoff = new Date(now - 10 * 60000).toISOString();
  // Deleting is how an event is claimed, so the webhook and the sweep never both send it.
  const { data, error } = await db.from("timer_events").delete().gte("created_at", cutoff).select("user_id, kind, due_at, minutes, from_endpoint");
  if (error) return ""; // database not updated for this yet
  await db.from("timer_events").delete().lt("created_at", cutoff); // too old to matter
  const events = (data ?? []) as TimerEvent[];
  if (!events.length) return "";
  const { data: subs } = await db
    .from("push_subscriptions")
    .select("user_id, endpoint, p256dh, auth, timer_start, timer_updates")
    .in("user_id", [...new Set(events.map((e) => e.user_id))]);
  const sends: Promise<unknown>[] = [];
  for (const e of events) {
    for (const s of (subs ?? []) as (Sub & { timer_start: boolean; timer_updates: boolean })[]) {
      if (s.user_id !== e.user_id || s.endpoint === e.from_endpoint) continue; // not the device that did it
      const clock = s.timer_start; // iPhone with the Clock-timer Shortcut
      let msg: { title: string; body: string; url: string } | null = null;
      if (e.kind === "start" && e.due_at && Date.parse(e.due_at) - now > 30000 && (clock || s.timer_updates)) {
        const left = minsLeft(e.due_at, now);
        msg = { title: "Rest timer started", body: `Next set in ${mins(left)}.${clock ? " Tap to start your Clock timer." : ""}`, url: clock ? "#/pushups/do-phone" : "#/pushups" };
      } else if (e.kind === "add" && e.due_at && s.timer_updates) {
        const left = minsLeft(e.due_at, now);
        msg = {
          title: `Rest timer +${mins(Math.round(e.minutes ?? 5))}`,
          body: `Next set in ${mins(left)}.${clock ? " Your Clock timer doesn't change on its own: tap, then Start Clock timer." : ""}`,
          url: clock ? "#/pushups/do-phone" : "#/pushups",
        };
      } else if (e.kind === "stop" && s.timer_updates) {
        msg = { title: "Rest timer stopped", body: clock ? "Cancel the Clock timer if it's still running." : "No rest timer running.", url: "#/pushups" };
      }
      if (msg) sends.push(push(s, { ...msg, tag: "lyt-timer-status" }, 300));
    }
  }
  const results = await Promise.allSettled(sends);
  return ` · events ${results.filter((x) => x.status === "fulfilled").length}/${results.length}`;
}

/** Countdown: every 10 minutes while 10+ minutes are left, then at 5, 3 and 1 minute left. */
async function countdown(now: number): Promise<string> {
  const { data, error } = await db
    .from("reminders")
    .select("user_id, due_at, started_at, body, countdown_last")
    .eq("sent", false)
    .gt("due_at", new Date(now + 30000).toISOString());
  if (error || !data?.length) return "";
  const todo = (data as { user_id: string; due_at: string; started_at: string | null; body: string; countdown_last: number | null }[]).filter((r) => {
    const left = minsLeft(r.due_at, now);
    const total = r.started_at ? (Date.parse(r.due_at) - Date.parse(r.started_at)) / 60000 : Infinity;
    const mark = left >= 10 ? left % 10 === 0 : [5, 3, 1].includes(left);
    // Not the very start (the "started" notification covers it), and each mark once.
    return mark && left < total - 0.5 && (r.countdown_last == null || left < r.countdown_last);
  });
  if (!todo.length) return "";
  await Promise.all(todo.map((r) => db.from("reminders").update({ countdown_last: minsLeft(r.due_at, now) }).eq("user_id", r.user_id).eq("due_at", r.due_at)));
  const { data: subs } = await db
    .from("push_subscriptions")
    .select("user_id, endpoint, p256dh, auth")
    .eq("timer_countdown", true)
    .in("user_id", todo.map((r) => r.user_id));
  const results = await Promise.allSettled(
    ((subs ?? []) as Sub[]).map((s) => {
      const r = todo.find((t) => t.user_id === s.user_id)!;
      const left = minsLeft(r.due_at, now);
      return push(s, { title: `${mins(left)} left`, body: `Next: ${r.body}`, url: "#/pushups", tag: "lyt-timer-status" }, 120);
    }),
  );
  return ` · countdown ${results.filter((x) => x.status === "fulfilled").length}/${results.length}`;
}

Deno.serve(async (req) => {
  if (req.headers.get("x-webhook-secret") !== Deno.env.get("WEBHOOK_SECRET")) return new Response("forbidden", { status: 403 });

  const now = Date.now();
  // From the timer_events webhook: just send that change, right away.
  const hook = await req.json().catch(() => null);
  if (hook?.table === "timer_events") return new Response(`event${await handleEvents(now)}`);
  const started = (await handleEvents(now)) + (await countdown(now));
  const { data: rows, error } = await db
    .from("reminders")
    .select("user_id, body, due_at, reps, repeat_min, max_sends, sent_count, last_sent_at")
    .eq("sent", false)
    .lte("due_at", new Date(now).toISOString())
    .gte("due_at", new Date(now - 3 * 3600000).toISOString());
  if (error) return new Response(error.message, { status: 500 });

  const due = ((rows ?? []) as Reminder[]).filter((r) => {
    const count = r.sent_count ?? 0;
    // First alert: only if it came due in the last 10 minutes (older ones are stale — skip quietly).
    if (count === 0) return now - Date.parse(r.due_at) <= 10 * 60000;
    // Repeats: every repeat_min minutes after the last one.
    return !!r.repeat_min && !!r.last_sent_at && now - Date.parse(r.last_sent_at) >= r.repeat_min * 60000 - 20000;
  });
  // Stale first alerts: mark sent so they stop being looked at.
  const stale = ((rows ?? []) as Reminder[]).filter((r) => !due.includes(r) && (r.sent_count ?? 0) === 0);
  if (stale.length) await db.from("reminders").update({ sent: true }).in("user_id", stale.map((r) => r.user_id));
  if (!due.length) return new Response(`nothing due${started}`);

  // Record the send first, so a slow push can't double-send on the next minute's run.
  // (Logging a set or snoozing re-saves the row with sent_count 0, which stops the repeats.)
  const stamp = new Date(now).toISOString();
  await Promise.all(
    due.map((r) => {
      const count = (r.sent_count ?? 0) + 1;
      return db
        .from("reminders")
        .update({ sent_count: count, last_sent_at: stamp, sent: count >= (r.max_sends ?? 1) })
        .eq("user_id", r.user_id)
        .eq("due_at", r.due_at);
    }),
  );

  const { data: subs } = await db.from("push_subscriptions").select("user_id, endpoint, p256dh, auth").in("user_id", due.map((d) => d.user_id));
  const results = await Promise.allSettled(
    (subs ?? []).map((s) => {
      const r = due.find((d) => d.user_id === s.user_id)!;
      const repeat = r.sent_count ?? 0;
      const msg = JSON.stringify({
        title: repeat ? "Still time for your next set" : "Time for your next set",
        body: r.body,
        url: "#/pushups",
        tag: "lyt-timer", // same as the in-app alert, so you see one notification, not two
        timer: true,
        repeat,
        reps: r.reps,
      });
      return webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, msg, { urgency: "high", TTL: 600 });
    }),
  );
  const dead = (subs ?? []).filter((_, i) => {
    const res = results[i];
    return res.status === "rejected" && [404, 410].includes((res.reason as { statusCode?: number }).statusCode ?? 0);
  });
  if (dead.length) await db.from("push_subscriptions").delete().in("endpoint", dead.map((d) => d.endpoint));

  return new Response(`sent ${results.filter((x) => x.status === "fulfilled").length}/${results.length}${started}`);
});
