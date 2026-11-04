import { useCallback, useEffect, useMemo, useState } from "react";
import type { Toast } from "../../App";
import type { Data } from "../../lib/useData";
import type { Workout, WorkoutSet } from "../../lib/types";
import { createCrew, enableNotifications, joinCrew, leaveCrew, memberActivity, myCrews, myProfile, setSharing, type Crew, type Member } from "../../lib/crew";
import { supabase } from "../../lib/supabase";
import { dayKey, fmtTime } from "../../lib/dates";
import { habitSets, todayPlan, weekTable } from "../../lib/stats";
import { summary } from "../../lib/workouts";
import { go } from "../../lib/router";
import { PushupProgress, useNow } from "../pushups/Today";
import { WeekTable } from "../../components/WeekTable";
import { KindIcon } from "../workouts/WorkoutsApp";

export function CrewApp({ data, userId, memberId, toast }: { data: Data; userId?: string; memberId?: string; toast: (t: Toast) => void }) {
  if (!supabase || !userId) return <CrewSetup />;
  if (memberId) return <MemberDay memberId={memberId} />;
  return <CrewHome data={data} userId={userId} toast={toast} />;
}

function CrewSetup() {
  return (
    <section className="card">
      <h1>Crew</h1>
      <p>
        Share your day with a workout buddy or your family. Each person keeps their own log; people in your crew can <strong>see</strong> your
        progress (never edit it) and get a notification like <em>“Carter did 40 Push Ups · 160 today”</em> that opens your day.
      </p>
      <p>
        This needs cloud sync, which isn't connected yet. Once the Supabase project is set up (see README → “Turn on cloud sync”), everyone
        signs in with their email and this screen lets you create a crew and share a 6-letter invite code.
      </p>
    </section>
  );
}

function CrewHome({ data, userId, toast }: { data: Data; userId: string; toast: (t: Toast) => void }) {
  const [crews, setCrews] = useState<Crew[]>([]);
  const [members, setMembers] = useState<Record<string, Member[]>>({});
  const [today, setToday] = useState<WorkoutSet[]>([]);
  const [profile, setProfile] = useState<{ share_workouts: boolean; share_food: boolean } | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [notif, setNotif] = useState(() => ("Notification" in window ? Notification.permission : "denied"));

  const load = useCallback(async () => {
    try {
      const r = await myCrews();
      setCrews(r.crews);
      setMembers(r.members);
      setProfile(await myProfile(userId));
      const ids = [...new Set(Object.values(r.members).flat().map((m) => m.id))].filter((id) => id !== userId);
      if (ids.length) {
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        const res = await supabase!.from("exercise_sets").select("*").in("user_id", ids).gte("performed_at", start.toISOString());
        setToday((res.data ?? []) as WorkoutSet[]);
      }
    } catch (e) {
      toast({ msg: (e as Error).message });
    }
  }, [userId, toast]);

  useEffect(() => {
    load();
  }, [load]);

  async function run(fn: () => Promise<unknown>, ok: string) {
    setBusy(true);
    try {
      await fn();
      toast({ msg: ok });
      await load();
    } catch (e) {
      toast({ msg: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      {crews.map((c) => (
        <section className="card" key={c.id}>
          <div className="day-head">
            <h2>{c.name}</h2>
            <button
              className="chip"
              onClick={async () => {
                const text = `Join my LoveYourTemple crew "${c.name}" with code ${c.invite_code}: ${location.origin}${location.pathname}`;
                if (navigator.share) await navigator.share({ text }).catch(() => {});
                else {
                  await navigator.clipboard.writeText(text);
                  toast({ msg: "Invite copied" });
                }
              }}
            >
              Invite code <strong>{c.invite_code}</strong>
            </button>
          </div>
          <ul className="set-list">
            {(members[c.id] ?? []).map((m) => {
              const mine = m.id === userId;
              const sets = mine ? data.sets : today.filter((s) => (s as WorkoutSet & { user_id: string }).user_id === m.id);
              const ex = m.settings.defaultExercise;
              const plan = todayPlan(habitSets(sets, m.settings), ex, m.settings, new Date());
              return (
                <li key={m.id}>
                  <button className="member-row" onClick={() => (mine ? go("pushups") : go("crew", m.id))}>
                    <span className="avatar">{(m.display_name ?? "?").slice(0, 1).toUpperCase()}</span>
                    <span className="grow">
                      <span className="block">
                        <strong>{m.display_name ?? "Unnamed"}</strong>
                        {mine && <span className="muted"> (you)</span>}
                      </span>
                      <span className="muted small">
                        {plan.reps} {ex} today{plan.target ? ` of ${plan.target}` : ""}
                        {plan.last && dayKey(new Date(plan.last.performed_at)) === dayKey(new Date()) ? ` · last ${fmtTime(new Date(plan.last.performed_at))}` : ""}
                      </span>
                      {plan.target > 0 && (
                        <span className="bar thin" style={{ marginTop: 4 }}>
                          <span style={{ display: "block", height: "100%", width: `${Math.min(100, (plan.reps / plan.target) * 100)}%`, background: "var(--accent)", borderRadius: 99 }} />
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <button className="link small danger-text" onClick={() => confirm(`Leave ${c.name}?`) && run(() => leaveCrew(c.id, userId), `Left ${c.name}`)}>
            Leave crew
          </button>
        </section>
      ))}

      <section className="card">
        <h2>{crews.length ? "Another crew" : "Start sharing"}</h2>
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => createCrew(name.trim()), "Crew created — send the invite code");
            setName("");
          }}
        >
          <input className="input grow" placeholder="Crew name, e.g. Work Push-up Crew" value={name} onChange={(e) => setName(e.target.value)} />
          <button className="btn primary" disabled={!name.trim() || busy}>Create</button>
        </form>
        <form
          className="row"
          style={{ marginTop: 8 }}
          onSubmit={(e) => {
            e.preventDefault();
            run(() => joinCrew(code), "Joined!");
            setCode("");
          }}
        >
          <input className="input grow" placeholder="Got a code? e.g. 7F3K9Q" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={6} />
          <button className="btn" disabled={code.length !== 6 || busy}>Join</button>
        </form>
      </section>

      <section className="card">
        <h2>What my crew can see</h2>
        <label className="check block">
          <input type="checkbox" checked disabled /> Push-ups and daily sets (always shared)
        </label>
        <label className="check block">
          <input
            type="checkbox"
            checked={profile?.share_workouts ?? true}
            onChange={(e) => run(() => setSharing(userId, { share_workouts: e.target.checked }), "Updated")}
          />{" "}
          Workouts
        </label>
        <label className="check block">
          <input type="checkbox" checked={profile?.share_food ?? false} onChange={(e) => run(() => setSharing(userId, { share_food: e.target.checked }), "Updated")} />{" "}
          Food log
        </label>
      </section>

      <section className="card">
        <h2>Notifications</h2>
        {notif === "granted" ? (
          <p className="muted">On. You'll be notified when a crewmate logs a set or finishes a workout.</p>
        ) : (
          <>
            <p className="muted">Get “Mike did 40 Push Ups” alerts. On iPhone, first add LoveYourTemple to your Home Screen (Share → Add to Home Screen).</p>
            <button
              className="btn primary"
              onClick={async () => {
                const r = await enableNotifications(userId).catch((e) => {
                  toast({ msg: (e as Error).message });
                  return "denied" as const;
                });
                setNotif("Notification" in window ? Notification.permission : "denied");
                toast({
                  msg: r === "push" ? "Notifications on, even when the app is closed" : r === "open-only" ? "Notifications on while the app is open" : "Notifications are blocked in this browser",
                });
              }}
            >
              Turn on notifications
            </button>
          </>
        )}
      </section>
    </div>
  );
}

/** A crewmate's day — where a notification lands. */
function MemberDay({ memberId }: { memberId: string }) {
  const now = useNow(30000);
  const [state, setState] = useState<{ sets: WorkoutSet[]; workouts: Workout[]; member: Member | null } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () =>
      memberActivity(memberId)
        .then((r) => alive && setState(r))
        .catch((e) => alive && setError((e as Error).message));
    load();
    const t = setInterval(load, 60000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [memberId]);

  const week = useMemo(
    () => (state?.member ? weekTable(habitSets(state.sets, state.member.settings), state.member.settings.defaultExercise, state.member.settings, new Date()) : []),
    [state],
  );

  if (error) return <p className="banner error">{error}</p>;
  if (!state) return <p className="muted center">Loading…</p>;
  if (!state.member) return <p className="muted center">You're not in a crew with this person anymore.</p>;
  const m = state.member;
  const todays = state.sets.filter((s) => dayKey(new Date(s.performed_at)) === dayKey(now) && !s.workout_id);
  const workoutsToday = state.workouts.filter((w) => dayKey(new Date(w.started_at)) === dayKey(now));

  return (
    <div className="stack">
      <button className="link" onClick={() => go("crew")}>← Crew</button>
      <h1>{m.display_name ?? "Crewmate"}'s day</h1>
      <PushupProgress sets={state.sets} settings={m.settings} exercise={m.settings.defaultExercise} now={now} title={`Today · ${m.settings.defaultExercise}`} />
      {workoutsToday.length > 0 && (
        <section className="card">
          <h2>Workouts today</h2>
          {workoutsToday.map((w) => (
            <div key={w.id} className="row" style={{ padding: "6px 0" }}>
              <KindIcon kind={w.kind} />
              <span>
                <strong>{w.title}</strong> <span className="muted small">{summary(w, state.sets.filter((s) => s.workout_id === w.id), m.settings)}</span>
              </span>
            </div>
          ))}
        </section>
      )}
      <section className="card">
        <h2>Sets today</h2>
        {todays.length ? (
          <ul className="plain-list">
            {todays.map((s) => (
              <li key={s.id}>
                <span className="muted">{fmtTime(new Date(s.performed_at))}</span> · {s.reps} {s.exercise}
                {s.notes && <span className="muted"> — {s.notes}</span>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">Nothing yet today.</p>
        )}
      </section>
      <section className="card">
        <h2>This week</h2>
        <WeekTable rows={week} />
      </section>
    </div>
  );
}
