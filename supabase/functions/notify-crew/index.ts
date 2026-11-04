// Supabase Edge Function: push "Carter did 40 Push Ups · 160 today" to crewmates.
//
// Wire-up (once):
//   1. npx web-push generate-vapid-keys   → public + private key
//   2. supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:you@example.com
//   3. supabase functions deploy notify-crew --no-verify-jwt
//   4. Dashboard → Database → Webhooks → new hook:
//        table exercise_sets, event INSERT  → this function's URL
//        table workouts,      event UPDATE  → this function's URL
//      Add header  x-webhook-secret: <any long random string>, and
//      supabase secrets set WEBHOOK_SECRET=<same string>
//   5. Put VITE_VAPID_PUBLIC_KEY=<public key> in the app's environment.
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
webpush.setVapidDetails(Deno.env.get("VAPID_SUBJECT")!, Deno.env.get("VAPID_PUBLIC_KEY")!, Deno.env.get("VAPID_PRIVATE_KEY")!);

interface Payload {
  type: "INSERT" | "UPDATE";
  table: string;
  record: Record<string, unknown>;
  old_record?: Record<string, unknown> | null;
}

Deno.serve(async (req) => {
  if (req.headers.get("x-webhook-secret") !== Deno.env.get("WEBHOOK_SECRET")) return new Response("forbidden", { status: 403 });
  const p = (await req.json()) as Payload;
  const r = p.record;
  const userId = r.user_id as string;

  const { data: who } = await db.from("profiles").select("display_name, share_workouts").eq("id", userId).maybeSingle();
  const name = who?.display_name ?? "A crewmate";
  let title: string;
  let body: string;

  if (p.table === "exercise_sets" && p.type === "INSERT") {
    if (r.workout_id) return new Response("skip: workout set"); // workouts announce once, when finished
    const start = new Date();
    start.setUTCHours(0, 0, 0, 0); // close enough for a running total; refined client-side
    const { data: today } = await db
      .from("exercise_sets")
      .select("reps")
      .eq("user_id", userId)
      .eq("exercise", r.exercise as string)
      .is("workout_id", null)
      .gte("performed_at", start.toISOString());
    const total = (today ?? []).reduce((n, x) => n + (x.reps as number), 0);
    title = `${name} did ${r.reps} ${r.exercise}`;
    body = `${total} today — tap to see their day`;
  } else if (p.table === "workouts" && p.type === "UPDATE" && r.ended_at && !p.old_record?.ended_at) {
    if (!who?.share_workouts) return new Response("skip: workouts private");
    title = `${name} finished: ${r.title}`;
    body = "Tap to see their day";
  } else {
    return new Response("skip");
  }

  // Everyone who shares a crew with this person, except themselves.
  const { data: crews } = await db.from("crew_members").select("crew_id").eq("user_id", userId);
  const crewIds = (crews ?? []).map((c) => c.crew_id);
  if (!crewIds.length) return new Response("no crew");
  const { data: mates } = await db.from("crew_members").select("user_id").in("crew_id", crewIds).neq("user_id", userId);
  const mateIds = [...new Set((mates ?? []).map((m) => m.user_id))];
  if (!mateIds.length) return new Response("no crewmates");
  const { data: subs } = await db.from("push_subscriptions").select("endpoint, p256dh, auth").in("user_id", mateIds);

  const msg = JSON.stringify({ title, body, url: `#/crew/${userId}`, tag: `crew-${userId}` });
  const results = await Promise.allSettled(
    (subs ?? []).map((s) => webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, msg)),
  );
  // Clean up devices that unsubscribed (410 Gone / 404).
  const dead = (subs ?? []).filter((_, i) => {
    const res = results[i];
    return res.status === "rejected" && [404, 410].includes((res.reason as { statusCode?: number }).statusCode ?? 0);
  });
  if (dead.length) await db.from("push_subscriptions").delete().in("endpoint", dead.map((d) => d.endpoint));

  return new Response(`sent ${results.filter((x) => x.status === "fulfilled").length}/${results.length}`);
});
