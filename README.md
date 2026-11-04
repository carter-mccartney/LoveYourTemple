# LoveYourTemple

A phone-and-desktop fitness app that grew out of my `Fitness.xlsm` push-up tracker. One home screen,
with these "apps" inside it:

| App | What it does |
|---|---|
| **Push-ups** | The all-day habit: one-tap logging (or **L** on a keyboard), a 30-minute rest timer that starts after each set and alerts you when the next one is due, daily target, records, streaks, goals |
| **Workouts** | Lifts (body-part focus, quick entry like `50 lb dumbbell curls 3x10`, repeat sets, total pounds moved), walks and runs (GPS start/stop, distance, average and top speed, route), timed/video workouts like Tae Bo |
| **Food** | Barcode scan, search (built-in common foods, USDA, Open Food Facts), "Packed for today" one-tap foods, protein/sugar/added-sugar/calorie progress, weekly report with best and worst foods |
| **Body** | Weight, height and tape measurements (belly, belt line, chest, arm, thigh, calf) with how-to-measure tips, change since last time and since the start, trend charts, waist-to-height ratio and BMI |
| **Crew** | Share your day with a workout buddy or family; get "Carter did 40 Push Ups · 160 today" notifications that open their day |

**Stack:** React + TypeScript + Vite · Supabase (Postgres, auth, realtime, edge function) for sync and sharing · GitHub Pages hosting · installable PWA.

## How the pieces fit

- **Daily vs. workout push-ups.** Every set lives in one table. Sets logged in the Push-ups app have no
  `workout_id`; sets logged inside a workout do. Workout push-ups count toward the daily total and are
  shown separately ("400 daily habit + 120 in workouts"). Stats can include or exclude them.
- **Pounds moved.** `weight × reps × multiplier`. A pair of dumbbells counts ×2 (50 lb curls, 3×10 = 3,000 lb);
  barbells, machines and single dumbbells/kettlebells ×1. Equipment is guessed from the exercise name
  and can be changed per exercise. Bodyweight moves (push-ups ≈ 64% of body weight, pull-ups ≈ 100%)
  are estimated separately so they don't inflate the plate total.
- **Rest timer.** Logging a daily set starts a timer (Settings: length, on/off, work hours only). When it ends
  the app chimes, vibrates and shows "Time for 40 Push Ups · Log 40"; in the background it sends a system
  notification. With the app fully closed, only a server can wake the phone: in cloud mode the due time is
  saved to the `reminders` table and the `send-reminders` Edge Function pushes it (setup at the end of `schema.sql`).
- **Body measurements** are stored in lb and inches and shown in your units. They're private — never shared with a crew.
- **Calories burned** are exercise-only estimates (MET × body weight × time). Set your body weight in Settings.
- **Food nutrients** are stored per 100 g on each saved food and copied into every log entry, so editing a
  food later never rewrites past days. Unknown added sugar is tracked as unknown, not zero.

## Run it locally

Requires [Node.js](https://nodejs.org) 20+.

```bash
npm install
npm run dev
```

Open the URL Vite prints (http://localhost:5173). With no `.env.local` the app runs in
**local mode**: data is saved in that browser only. Use Settings → Export JSON for backups.
The camera (barcode scanning) works on `localhost` and on https sites, not on plain http.

### Import the Excel history

```bash
pip install openpyxl
python scripts/import_excel.py "path/to/Fitness.xlsm"
```

This writes `src/data/excel-history.json` (git-ignored, since it's personal data). The app then
shows an **Import my Excel history** button on first run / in Settings. If `scripts/personal-settings.json`
exists (also git-ignored), its body weight, nutrition goals and name are applied on import too.

## Turn on cloud sync (Supabase)

1. Create a free project at [supabase.com](https://supabase.com).
2. SQL Editor → paste all of `supabase/schema.sql` → Run.
3. Authentication → URL Configuration: set **Site URL** to where the app is hosted (and add
   `http://localhost:5173` under Redirect URLs for local dev).
4. Project Settings → API: copy the Project URL and the `anon` public key into `.env.local`
   (see `.env.example`), then restart `npm run dev`.
5. Sign in with your email (magic link), then Settings → Import the JSON backup you exported in local mode.

The `anon` key is designed to be public; row-level security in `schema.sql` is what keeps each
person's data private. Never put the `service_role` key in this app.

### Sharing and notifications

- **Crew** tab → create a crew → send the 6-letter code. Friends sign in and join with it.
- Crewmates always see push-up sets; workouts are shared by default; food is private unless you turn it on.
- **While the app is open**, crew activity arrives instantly (Supabase Realtime) as an in-app banner.
- **While the app is closed**, notifications need the `notify-crew` Edge Function plus web push keys —
  setup steps are at the top of `supabase/functions/notify-crew/index.ts`. On iPhone, web push only works
  after adding the app to the Home Screen (iOS 16.4+).

## Deploy to GitHub Pages

1. Push this folder to a GitHub repo (branch `main`).
2. Repo → Settings → Pages → Source: **GitHub Actions**.
3. Repo → Settings → Secrets and variables → Actions: add `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
   and (for closed-app notifications) `VITE_VAPID_PUBLIC_KEY`.
4. Push. `.github/workflows/deploy.yml` builds and publishes to `https://<you>.github.io/<repo>/`.
5. On your phone, open that URL → Share → **Add to Home Screen** to install it like an app.

## Known limits of a web app

- **GPS stops when the phone locks** or you switch apps; the app keeps the screen awake while tracking.
  Background tracking would need a native wrapper (e.g. Capacitor) — on the roadmap.
- Online food search uses USDA's shared `DEMO_KEY` (a few searches an hour). A free personal key from
  https://fdc.nal.usda.gov/api-key-signup goes in Settings → Nutrition. It's stored only on that device —
  never commit it, since USDA deactivates keys found in public repos.

## Project layout

```
src/
  App.tsx                 shell: nav, auth, toasts, live crew alerts
  apps/home/              hub screen
  apps/pushups/           daily habit (today, stats, history, goals)
  apps/workouts/          lift, cardio (GPS), timed/video sessions
  apps/food/              scan, search, packed foods, report
  apps/body/              weight and tape measurements
  apps/crew/              sharing + friend's day
  apps/settings/
  lib/                    types, storage (local + Supabase), stats, lift parser, GPS, nutrition, calories
supabase/schema.sql       tables, sharing rules, realtime
supabase/functions/notify-crew/     web push to crewmates
supabase/functions/send-reminders/  web push when your rest timer ends
scripts/import_excel.py
```

See [ROADMAP.md](ROADMAP.md) for what's next.
