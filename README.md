# Ova Cure — Web MVP

Women's health platform: period tracker, online gynaecologist consultations, PCOD care plans,
pregnancy planning and menopause care. Patient app, doctor portal and admin portal are all in this one
Next.js app (role-based).

**Stack:** Next.js 16 (App Router) · Tailwind CSS 4 · Supabase (Postgres + Auth + RLS) · Jitsi (free video)
**Cost to run locally:** ₹0. No domain, SMS or payment provider needed.

---

## 1. Run it on your laptop (first time ≈ 10 min)

Prerequisites: **Node 20+** and **Docker Desktop** (running).

```bash
cd web
npm install
npm run db:start      # starts local Supabase in Docker (first run downloads images)
npm run dev           # http://localhost:3000
```

`.env.local` already points to the local Supabase. If `db:start` prints different keys, copy
`ANON_KEY` into `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

| What | URL |
|---|---|
| Website | http://localhost:3000 |
| Supabase Studio (see tables, run SQL) | http://127.0.0.1:58323 |
| Mailpit (email OTPs land here) | http://127.0.0.1:58324 |

> Ports are 583xx (not Supabase's default 543xx) because Windows/Hyper-V reserves 54xxx on this machine.

### Free OTP login (no SMS cost)
Phone test numbers are configured in `supabase/config.toml` → `[auth.sms.test_otp]`:

| Mobile (enter without +91) | OTP | Suggested use |
|---|---|---|
| 99999 00001 – 99999 00005 | 123456 | testers / patients / doctors |
| 99999 00009 | 123456 | admin |

Email OTP also works — the code arrives in Mailpit.

### Make yourself admin
Log in once with `9999900009`, then in Studio → SQL editor:
```sql
update profiles set role = 'admin' where phone = '919999900009';
```

### Try the complete loop
1. **Patient** (`9999900001`): onboarding → log a day → Tracker → Consult → book a doctor.
2. **Doctor** (`9999900002`): on onboarding click *"I'm a gynaecologist"* → submit application.
3. **Admin** (`9999900009`): Admin → Doctor verification → Approve.
4. **Doctor**: set Availability → patient books → doctor opens booking, writes notes + e-prescription → *Complete*.
5. **Patient**: sees summary, prescription in Health records, rates the doctor.

The 3 seeded doctors are flagged *Demo* (no login attached) so the directory isn't empty.

### Automated check
`npm run test:e2e` runs 30 checks covering the patient, doctor and admin flows and the security rules
(RLS). Afterwards, run `npm run db:reset` to clean up.

---

## 2. Testing with 4–5 people (still free)

Local Supabase only works on your machine. To let friends test from their phones, follow
**[docs/DEPLOY.md](docs/DEPLOY.md)** step by step: Supabase cloud project → email SMTP → OTP email
templates → Vercel → test. It also has a troubleshooting table and the Twilio/MSG91 SMS steps for later.

The short version:
1. Supabase cloud project: run `supabase/migrations/*.sql`, then `supabase/seed.sql`.
2. **Custom SMTP is required**: Supabase's built-in sender only emails your own team members. Gmail SMTP with an app password is free and needs no domain.
3. Put `supabase/templates/otp.html` into **both** the *Confirm signup* and *Magic Link* templates (it contains `{{ .Token }}`).
4. Vercel: import the repo and set `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Then set Supabase Site URL / Redirect URLs to the Vercel URL.

---

## 3. Project map

```
src/app/page.tsx                 Landing page (public)
src/app/login, onboarding        OTP auth + 4-step onboarding with DPDP consent
src/app/(app)/dashboard          Home: cycle ring, today's log, flags, upcoming consult
src/app/(app)/tracker            Calendar, predictions, hormone phase, log, insights, PDF report
src/app/(app)/consult            Doctor directory + booking (slots, pre-consult form, consent)
src/app/(app)/appointments       Patient consult room: video link, chat, summary, Rx, rating
src/app/(app)/pcod               Screening quiz, plans, daily diet+workout, check-ins, progress
src/app/(app)/pregnancy          TTC mode: 14-day fertility view, checklist, journey
src/app/(app)/menopause          Symptom scoring, trends, red-flag alerts, lifestyle
src/app/(app)/learn, records     Articles; prescriptions/reports vault
src/app/(app)/profile            Settings, consent log, data export, one-tap delete
src/app/(app)/doctor/*           Doctor portal: apply, dashboard, consult workspace, availability
src/app/(app)/admin/*            Admin: metrics, doctor verification, appointments, CMS, users
src/lib/cycle.ts                 Prediction engine (rule-based; swap for ML later)
src/lib/constants.ts             Symptoms, PCOD quiz, diet & fitness templates, checklists
src/proxy.ts                     Session refresh + route protection
supabase/migrations/             Full DB schema + RLS + triggers
supabase/seed.sql                Plans, demo doctors, starter articles
```

See `../docs/` for the MVP plan, database design and workflow diagrams.
