// Supabase Edge Function: "Time for your next set" when the rest timer ends — even if the app is
// closed — then again every few minutes (your setting) until you log a set or snooze.
// Also: when a rest timer starts on one device, a "Rest timer started" push goes to your iPhone
// (devices with the Clock-timer Shortcut set up), so tapping it starts the Clock timer there.
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

/** Timers that just started: tell your other devices that asked for it (see timer_start). */
async function announceStarts(now: number): Promise<string> {
  const { data: rows, error } = await db.from("reminders").select("user_id, due_at, from_endpoint").eq("announce", true);
  if (error || !rows?.length) return ""; // nothing new (or the database isn't updated for this yet)
  await Promise.all(rows.map((r) => db.from("reminders").update({ announce: false }).eq("user_id", r.user_id).eq("due_at", r.due_at)));
  const live = rows.filter((r) => Date.parse(r.due_at) - now > 60000);
  if (!live.length) return "";
  const { data: subs } = await db
    .from("push_subscriptions")
    .select("user_id, endpoint, p256dh, auth")
    .eq("timer_start", true)
    .in("user_id", live.map((r) => r.user_id));
  const targets = ((subs ?? []) as Sub[])
    .map((s) => ({ s, r: live.find((r) => r.user_id === s.user_id)! }))
    .filter(({ s, r }) => s.endpoint !== r.from_endpoint); // not the device that started it
  const results = await Promise.allSettled(
    targets.map(({ s, r }) =>
      push(
        s,
        {
          title: "Rest timer started",
          body: `Next set in ${Math.round((Date.parse(r.due_at) - now) / 60000)} min. Tap to start your Clock timer.`,
          url: "#/pushups/do-phone",
          tag: "lyt-timer-start",
        },
        300,
      ),
    ),
  );
  return ` · started ${results.filter((x) => x.status === "fulfilled").length}/${results.length}`;
}

Deno.serve(async (req) => {
  if (req.headers.get("x-webhook-secret") !== Deno.env.get("WEBHOOK_SECRET")) return new Response("forbidden", { status: 403 });

  const now = Date.now();
  const started = await announceStarts(now);
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
