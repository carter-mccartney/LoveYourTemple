// Supabase Edge Function: "Time for Push Ups" when the rest timer ends — even if the app is closed.
// Runs every minute via pg_cron (see the end of supabase/schema.sql). Uses the same VAPID and
// WEBHOOK_SECRET secrets as notify-crew. Deploy:  supabase functions deploy send-reminders --no-verify-jwt
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
webpush.setVapidDetails(Deno.env.get("VAPID_SUBJECT")!, Deno.env.get("VAPID_PUBLIC_KEY")!, Deno.env.get("VAPID_PRIVATE_KEY")!);

Deno.serve(async (req) => {
  if (req.headers.get("x-webhook-secret") !== Deno.env.get("WEBHOOK_SECRET")) return new Response("forbidden", { status: 403 });

  // Due in the last 10 minutes and not yet sent (older ones are stale — skip them quietly).
  const now = new Date();
  const { data: due } = await db
    .from("reminders")
    .select("user_id, body, due_at")
    .eq("sent", false)
    .lte("due_at", now.toISOString())
    .gte("due_at", new Date(now.getTime() - 10 * 60000).toISOString());
  if (!due?.length) return new Response("nothing due");

  // Mark first so a slow push can't double-send on the next minute's run.
  await db.from("reminders").update({ sent: true }).in("user_id", due.map((d) => d.user_id));

  const { data: subs } = await db.from("push_subscriptions").select("user_id, endpoint, p256dh, auth").in("user_id", due.map((d) => d.user_id));
  const results = await Promise.allSettled(
    (subs ?? []).map((s) => {
      const r = due.find((d) => d.user_id === s.user_id)!;
      // Same tag as the in-app alert, so the phone shows one notification, not two.
      const msg = JSON.stringify({ title: "Time for your next set", body: r.body, url: "#/pushups", tag: "lyt-timer" });
      return webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, msg);
    }),
  );
  const dead = (subs ?? []).filter((_, i) => {
    const res = results[i];
    return res.status === "rejected" && [404, 410].includes((res.reason as { statusCode?: number }).statusCode ?? 0);
  });
  if (dead.length) await db.from("push_subscriptions").delete().in("endpoint", dead.map((d) => d.endpoint));

  return new Response(`sent ${results.filter((x) => x.status === "fulfilled").length}/${results.length}`);
});
