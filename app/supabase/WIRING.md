# Wiring the PMCC portal live

The demo becomes real in four moves. Steps marked **YOU** need the account
owner; everything else is done in code in this repo.

## 1. YOU — create the Supabase project (~10 min)

1. https://supabase.com → Start your project → sign up (GitHub or email).
2. New project: name **pmcc**, region **Frankfurt (eu-central-1)**, generate a
   strong database password and store it somewhere safe (it is rarely needed).
3. When the project finishes provisioning: **Project Settings → API**.
   Send the developer two values (both are safe to share — the anon key is
   public by design and useless without the row-level security rules):
   - Project URL — `https://xxxx.supabase.co`
   - `anon` public key — a long `eyJ...` string
4. **Authentication → Providers → Email**: ON (it is by default). This gives
   owners passwordless sign-in by 6-digit email code. (Phone/SMS codes need a
   Twilio account — do that later if wanted; email codes cost nothing.)

## 2. YOU — run the schema (~3 min)

SQL Editor → New query → paste the whole of `schema.sql` → Run.
Then Storage → Create bucket: `site-photos` (public) and `documents` (private).

## 3. YOU — Groq + the two functions (~7 min)

1. https://console.groq.com → sign up → API Keys → Create key. Copy it.
2. Supabase → Edge Functions → **Manage secrets** → add `GROQ_API_KEY` = the key.
   (The key never leaves Supabase; do not paste it in chat.)
3. Edge Functions → Deploy new function → name **ask** → paste
   `functions/ask/index.ts` → Deploy.
4. Same again → name **copilot** → paste `functions/copilot/index.ts` → Deploy.

## 4. DEVELOPER — the switch-over

With the Project URL + anon key: the app's data layer flips from the demo
seed to Supabase (env vars `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` in
Render), Daher 563's real record is seeded into the database, the first team
account and a test owner are created, and both chat surfaces call the edge
functions. Then app.pmcclb.com: a CNAME at IDM once the service exists.

## The security posture, for the record

- Row-level security decides everything; the app is just a window.
- The chatbot reads with the caller's own identity — it cannot see another
  owner's rows even if prompted maliciously.
- The copilot returns *proposed* actions; only a human tap writes them.
- The Groq key lives in Supabase secrets, server-side only.
