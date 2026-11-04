# Roadmap

## Done
### v0.1 — push-up tracker (replaces the Excel workbook)
- [x] One-tap logging pre-filled from the last set (replaces the copy-row macro)
- [x] Daily / week / all-time KPIs, most reps in a single day and week, streaks
- [x] Self-completing goals (Hit / Missed computed from the log)
- [x] Rest time since the previous set; charts with 1W / 1M / 3M / 1Y / All views
- [x] Works offline on a phone; installable to the home screen

### v0.2 — apps inside the app
- [x] Home hub with Push-ups, Workouts, Food, Crew
- [x] Workout push-ups count toward the daily total and are shown separately
- [x] Lifts: body-part focus, natural-language entry, repeat set with new reps, equipment-aware pounds moved,
      bodyweight-volume estimate
- [x] Walks / runs: GPS start/pause/finish, distance, avg + top speed, pace, route sketch; manual entry fallback
- [x] Tae Bo / video workouts: timer + video link, "again" shortcut
- [x] Food: barcode scan, built-in common foods, USDA + Open Food Facts search, label entry, My foods, favorites
- [x] "Packed for today" foods as one-tap buttons
- [x] Protein / calories / sugar / added sugar / carbs goals and progress
- [x] Report: per-day charts, averages, best foods, watch list, protein sources, exercise burn estimate
- [x] Crews: invite code, member progress, per-category sharing, live in-app alerts, web push function

### v0.3 — LoveYourTemple
- [x] Renamed to LoveYourTemple
- [x] 30-minute rest timer after each daily set: snooze, restart, stop; chime + vibration + notification; "Log 40" from the alert
- [x] Server push for the timer when the app is closed (send-reminders + pg_cron)
- [x] Body: weight, height, belly, belt line, chest, arm, thigh, calf; trends, waist-to-height, BMI
- [x] Zero-gram limits (added sugar 0 g); natural vs. added sugar breakdown
- [x] Personal goals bundled with the Excel import (git-ignored)

## Needs testing once Supabase is connected
- [ ] Sign-in, sync, crew create/join, friend's-day view
- [ ] Realtime alerts and closed-app push (notify-crew, send-reminders)
- [ ] Rest-timer notifications on iPhone (requires Add to Home Screen) and Android

## Next ideas
- [ ] Muscle-group recovery: "sufficient rest" if > 30 h since the last workout for that body part
- [ ] Time since last doing the same exercise; personal records per lift (heaviest, best volume)
- [ ] Hourly push-up plan generated from a goal, auto-checked as sets are logged
- [ ] Progression plans (feet-elevated → pike → handstand push-ups) as multi-step goals
- [ ] Body: progress photos; optional sharing with a crew; goal weight / goal belly line on the charts
- [ ] Separate "fruit sugar" allowance so whole fruit doesn't crowd out the sugar limit
- [ ] Recipes / meals made of several foods (e.g. "Breakfast: 4 eggs + cheese + beef square")
- [ ] Photo-of-plate estimates or voice entry for food
- [ ] Resting calories (BMR) from body weight + height for a full in-vs-out picture
- [ ] Crew leaderboard, weekly challenges, reactions ("👊") on a friend's set
- [ ] Native wrapper (Capacitor) for background GPS and more reliable notifications

## Exercise ideas list (from the sheet)
Split squats, full squats, calf raises, wall sits, Bulgarian split squats, reverse lunges,
archer / diamond / wide / pike / handstand / one-arm push-ups, single-leg squats.
