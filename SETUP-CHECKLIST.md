# LoveYourTemple — remaining setup

Check items off as you go. Secrets come from your private secrets file (outside this repo) — never paste them here.

## 1. Sign-in email (Gmail SMTP)
- [x] myaccount.google.com/apppasswords (personal Gmail) → delete the old one → create a new app password.
- [x] Supabase → Authentication → Emails → SMTP Settings: host `smtp.gmail.com`, port `465`, username = full Gmail address, password = the 16 letters **with no spaces**, sender email = same Gmail. Save.
- [x] Authentication → Emails → Templates → **Magic Link** and **Confirm signup**: add the code `{{ .Token }}` to the message (template HTML is in the chat history / below).
- [x] Authentication → URL Configuration: Site URL and Redirect URL = `https://carter-mccartney.github.io/LoveYourTemple/`.

```html
<div style="font-family:system-ui,sans-serif;max-width:420px;margin:auto;padding:24px;text-align:center">
  <h2 style="margin:0 0 8px">LoveYourTemple</h2>
  <p style="color:#555">Type this code in the app to sign in:</p>
  <p style="font-size:32px;font-weight:700;letter-spacing:6px;margin:16px 0">{{ .Token }}</p>
  <p style="color:#555">Or <a href="{{ .ConfirmationURL }}">tap here to sign in</a> in your browser.</p>
</div>
```

## 2. Your account and history
- [x] Live site → "Email me a link or code" → type the code.
- [x] Settings → **Set password**.
- [x] Settings → **Import CSV / JSON** → `exports/loveyourtemple-import.json` (**once only** — importing twice duplicates sets).

## 3. Database updates (SQL Editor → run each block)
- [ ] Access for signed-in users — the "Table access for signed-in users" block in `supabase/schema.sql` (skip if already run).
- [ ] Repeat reminders:
```sql
alter table public.reminders
  add column if not exists exercise text,
  add column if not exists reps int,
  add column if not exists repeat_min int not null default 0,
  add column if not exists max_sends int not null default 1,
  add column if not exists sent_count int not null default 0,
  add column if not exists last_sent_at timestamptz;
```

- [ ] Bible section — run the “Bible reading, memory verses, other books” block from `supabase/schema.sql` (creates 4 tables; safe to re-run). Until then the Bible tab shows a yellow reminder and can't save to your account.

## 4. Closed-app notifications
- [ ] Edge Functions → Secrets: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `WEBHOOK_SECRET`, `VAPID_SUBJECT` (= `mailto:` + your Gmail).
- [ ] Edge Functions → Deploy a new function → Via Editor → name `send-reminders` → paste `supabase/functions/send-reminders/index.ts` → Deploy → turn **off** Verify JWT.
- [ ] Run every minute (put your WEBHOOK_SECRET in):
```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.schedule('send-reminders', '* * * * *', $$
  select net.http_post(
    url := 'https://igcaeyyczlgfhqmmtnri.supabase.co/functions/v1/send-reminders',
    headers := '{"x-webhook-secret": "PASTE_WEBHOOK_SECRET_HERE"}'::jsonb
  );
$$);
```
- [ ] Test: Settings → Minutes between sets = 1 → log a set → close the tab → a notification arrives within ~2 min. Set it back to 30.
- [ ] Windows: Edge/Chrome → Settings → System → allow running in the background.

## 5. Phone
- [x] Safari → live site → Share → **Add to Home Screen** → open from the home screen → sign in with password → turn on notifications.
- [ ] Optional: Settings → "Also start a timer in the iPhone Clock app" (Shortcuts setup).

## 6. Crew alerts (later, when your wife / buddy join)
- [ ] Deploy `notify-crew` the same way as `send-reminders` (Verify JWT off).
- [ ] Database → Webhooks: `exercise_sets` INSERT and `workouts` UPDATE → the notify-crew URL, header `x-webhook-secret`.
