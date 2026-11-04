-- LoveYourTemple database schema for Supabase (Postgres).
-- Run once in the Supabase dashboard: SQL Editor → New query → paste → Run.
-- Safe to re-run: everything is "if not exists" / "or replace".
--
-- Model:
--   profiles            one row per person (display name, sharing choices, app settings)
--   exercise_sets       every set: the all-day push-up habit (workout_id null) and lift sets
--   workouts            lift / walk / run / video-class sessions
--   goals               the old GoalTracker sheet
--   foods               each person's saved foods ("My foods")
--   food_logs           what was eaten, with nutrients copied in
--   measurements        weight and tape measurements (private to you)
--   reminders           "next set due" time, for push reminders when the app is closed
--   crews, crew_members small groups that can see each other's progress
--   push_subscriptions  devices to notify when a crewmate logs a set
--
-- Privacy rule: you can only WRITE your own rows. You can READ another person's
-- rows only if you share a crew AND they've chosen to share that kind of data
-- (push-up sets always; workouts by default; food only if they turn it on).

-- ---------- Tables ----------

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  share_workouts boolean not null default true,
  share_food boolean not null default false,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.profiles add column if not exists share_workouts boolean not null default true;
alter table public.profiles add column if not exists share_food boolean not null default false;

create table if not exists public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null check (kind in ('lift', 'walk', 'run', 'class', 'other')),
  title text not null default '',
  focus text[] not null default '{}',
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_s integer,
  distance_m numeric,
  avg_speed_mps numeric,
  max_speed_mps numeric,
  route jsonb,
  link text not null default '',
  calories integer,
  notes text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists workouts_user_time on public.workouts (user_id, started_at desc);

create table if not exists public.exercise_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  performed_at timestamptz not null default now(),
  exercise text not null,
  reps integer not null check (reps >= 0),
  notes text not null default '',
  workout_id uuid references public.workouts(id) on delete cascade,
  weight numeric,
  equipment text,
  seconds integer,
  created_at timestamptz not null default now()
);
-- Upgrades from v0.1 of this schema:
alter table public.exercise_sets add column if not exists workout_id uuid references public.workouts(id) on delete cascade;
alter table public.exercise_sets add column if not exists weight numeric;
alter table public.exercise_sets add column if not exists equipment text;
alter table public.exercise_sets add column if not exists seconds integer;
alter table public.exercise_sets drop constraint if exists exercise_sets_reps_check;
alter table public.exercise_sets add constraint exercise_sets_reps_check check (reps >= 0);
create index if not exists exercise_sets_user_time on public.exercise_sets (user_id, performed_at desc);
create index if not exists exercise_sets_workout on public.exercise_sets (workout_id);

create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  goal_date date not null,
  exercise text,
  target integer,
  title text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists goals_user_date on public.goals (user_id, goal_date);

create table if not exists public.foods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  brand text not null default '',
  barcode text not null default '',
  serving_g numeric not null default 100,
  serving_label text not null default '100 g',
  per100 jsonb not null,
  source text not null default 'manual',
  nutriscore text not null default '',
  image_url text not null default '',
  favorite boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists foods_user on public.foods (user_id);

create table if not exists public.food_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  eaten_at timestamptz not null default now(),
  meal text not null default 'snack',
  food_id uuid references public.foods(id) on delete set null,
  name text not null,
  grams numeric not null,
  servings numeric not null default 1,
  serving_label text not null default '',
  totals jsonb not null,
  notes text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists food_logs_user_time on public.food_logs (user_id, eaten_at desc);

create table if not exists public.measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  measured_at timestamptz not null default now(),
  weight_lb numeric,
  height_in numeric,
  waist_in numeric,
  belt_in numeric,
  chest_in numeric,
  arm_in numeric,
  thigh_in numeric,
  calf_in numeric,
  notes text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists measurements_user_time on public.measurements (user_id, measured_at desc);

-- One row per person: when their rest timer ends. send-reminders pushes it, then marks it sent.
create table if not exists public.reminders (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  due_at timestamptz not null,
  body text not null default '',
  sent boolean not null default false
);
create index if not exists reminders_due on public.reminders (due_at) where not sent;

create table if not exists public.crews (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique default upper(substr(md5(random()::text), 1, 6)),
  created_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.crew_members (
  crew_id uuid not null references public.crews(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (crew_id, user_id)
);

create table if not exists public.push_subscriptions (
  endpoint text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

-- ---------- Helpers ----------

-- Profile row is created automatically when someone signs up.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, split_part(new.email, '@', 1))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- True when the signed-in user and `other` are in at least one crew together (or are the same person).
-- security definer so it can read crew_members without tripping that table's own policy.
create or replace function public.shares_crew(other uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select other = auth.uid() or exists (
    select 1 from crew_members a join crew_members b using (crew_id)
    where a.user_id = auth.uid() and b.user_id = other
  );
$$;

-- shares_crew + the owner has opted in to sharing that kind of data.
create or replace function public.can_see(owner uuid, what text) returns boolean
language sql stable security definer set search_path = public as $$
  select owner = auth.uid() or (
    public.shares_crew(owner) and exists (
      select 1 from profiles p where p.id = owner
        and case what when 'workouts' then p.share_workouts when 'food' then p.share_food else true end
    )
  );
$$;

create or replace function public.is_crew_member(c uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from crew_members where crew_id = c and user_id = auth.uid());
$$;

-- Create a crew and join it in one step. Returns the crew (with its invite code).
create or replace function public.create_crew(crew_name text) returns public.crews
language plpgsql security definer set search_path = public as $$
declare c crews;
begin
  insert into crews (name, created_by) values (crew_name, auth.uid()) returning * into c;
  insert into crew_members (crew_id, user_id) values (c.id, auth.uid());
  return c;
end $$;

-- Join a crew with the 6-character code a friend sends you.
create or replace function public.join_crew(code text) returns public.crews
language plpgsql security definer set search_path = public as $$
declare c crews;
begin
  select * into c from crews where invite_code = upper(trim(code));
  if c.id is null then raise exception 'No crew with that code'; end if;
  insert into crew_members (crew_id, user_id) values (c.id, auth.uid()) on conflict do nothing;
  return c;
end $$;

-- ---------- Row-level security ----------

alter table public.profiles enable row level security;
alter table public.exercise_sets enable row level security;
alter table public.workouts enable row level security;
alter table public.goals enable row level security;
alter table public.foods enable row level security;
alter table public.food_logs enable row level security;
alter table public.crews enable row level security;
alter table public.crew_members enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.measurements enable row level security;
alter table public.reminders enable row level security;

drop policy if exists "read own or crew" on public.profiles;
create policy "read own or crew" on public.profiles for select using (public.shares_crew(id));
drop policy if exists "write own" on public.profiles;
create policy "write own" on public.profiles for all using (id = auth.uid()) with check (id = auth.uid());

-- Workout sets are visible only if workouts are shared; habit sets always are.
drop policy if exists "read own or crew" on public.exercise_sets;
create policy "read own or crew" on public.exercise_sets for select
  using (case when workout_id is null then public.shares_crew(user_id) else public.can_see(user_id, 'workouts') end);
drop policy if exists "write own" on public.exercise_sets;
create policy "write own" on public.exercise_sets for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "read own or crew" on public.workouts;
create policy "read own or crew" on public.workouts for select using (public.can_see(user_id, 'workouts'));
drop policy if exists "write own" on public.workouts;
create policy "write own" on public.workouts for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "read own or crew" on public.goals;
create policy "read own or crew" on public.goals for select using (public.shares_crew(user_id));
drop policy if exists "write own" on public.goals;
create policy "write own" on public.goals for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "read own or crew" on public.foods;
create policy "read own or crew" on public.foods for select using (public.can_see(user_id, 'food'));
drop policy if exists "write own" on public.foods;
create policy "write own" on public.foods for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "read own or crew" on public.food_logs;
create policy "read own or crew" on public.food_logs for select using (public.can_see(user_id, 'food'));
drop policy if exists "write own" on public.food_logs;
create policy "write own" on public.food_logs for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "members read" on public.crews;
create policy "members read" on public.crews for select using (public.is_crew_member(id));
drop policy if exists "creator updates" on public.crews;
create policy "creator updates" on public.crews for update using (created_by = auth.uid());

drop policy if exists "members read" on public.crew_members;
create policy "members read" on public.crew_members for select using (public.is_crew_member(crew_id));
drop policy if exists "leave crew" on public.crew_members;
create policy "leave crew" on public.crew_members for delete using (user_id = auth.uid());

-- Body measurements are private: only you can read or write them.
drop policy if exists "own only" on public.measurements;
create policy "own only" on public.measurements for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own only" on public.reminders;
create policy "own only" on public.reminders for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Only you manage your devices; the notify-crew function reads them with the service key.
drop policy if exists "own devices" on public.push_subscriptions;
create policy "own devices" on public.push_subscriptions for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------- Realtime (in-app crew alerts) ----------
-- Realtime respects the policies above, so you only hear about crewmates.
alter table public.workouts replica identity full; -- lets the app see that ended_at just changed
do $$ begin
  alter publication supabase_realtime add table public.exercise_sets;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.workouts;
exception when duplicate_object then null; end $$;

-- ---------- Rest-timer push reminders (optional) ----------
-- After deploying supabase/functions/send-reminders, schedule it every minute.
-- Run this separately, with your project ref and the WEBHOOK_SECRET you chose:
--
--   create extension if not exists pg_cron;
--   create extension if not exists pg_net;
--   select cron.schedule('send-reminders', '* * * * *', $$
--     select net.http_post(
--       url := 'https://<project-ref>.supabase.co/functions/v1/send-reminders',
--       headers := '{"x-webhook-secret": "<WEBHOOK_SECRET>"}'::jsonb
--     );
--   $$);
