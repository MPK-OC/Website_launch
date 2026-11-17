# Deploying Ova Cure (Supabase cloud + Vercel + email OTP)

Everything here is free for testing. Do the parts **in order**: A → B → C → D → E.
Time needed: about 30–40 minutes the first time.

---

## A. Supabase cloud project (the database + login)

1. Go to https://supabase.com → **New project**.
   - Name: `ova-cure`
   - Region: **South Asia (Mumbai)**, which keeps Indian users' health data close
   - Save the database password somewhere safe.
2. Wait for the project to finish setting up (about 2 min).
3. **SQL Editor → New query**:
   - Open `supabase/migrations/20261101000000_init.sql` from this repo, copy **all** of it, paste, then click **Run**. It should say "Success. No rows returned".
   - New query again: paste `supabase/seed.sql` → **Run** (adds PCOD plans, demo doctors, articles).
4. **Project Settings → API** (also called "API Keys"). Copy these two values for step D:
   - **Project URL**, like `https://abcdefgh.supabase.co`. Copy only this; do **not** add `/rest/v1`.
   - **anon / public key**: the long `eyJ...` key, or the `sb_publishable_...` key.
   - Never put the `service_role` / secret key in Vercel or in the code.

---

## B. Email service (SMTP): why emails are not arriving

Supabase's **built-in** email sender is only for trying Supabase out. It **only delivers to email
addresses that are members of your Supabase team**, and only a few per hour. Testers' emails
are silently not delivered. To send OTPs to anyone, connect your own SMTP service.

> We do **not** use Twilio for email. Twilio is for **SMS** (phone OTP), see section F.
> Twilio's email product (SendGrid) no longer has a free plan.

### Option 1 (recommended now, free, no domain needed): Gmail SMTP
Good for up to ~500 emails/day, which is plenty for beta testing.

1. Use a Gmail account for the startup, e.g. `ovacure.team@gmail.com` (create one if needed).
2. Turn on **2-Step Verification**: https://myaccount.google.com/security
3. Create an **App password**: https://myaccount.google.com/apppasswords
   → App name `Supabase` → **Create** → copy the 16-character password (shown once).
4. Supabase → **Authentication → Emails → SMTP Settings** → **Enable custom SMTP**:

   | Field | Value |
   |---|---|
   | Sender email | `ovacure.team@gmail.com` (same Gmail) |
   | Sender name | `Ova Cure` |
   | Host | `smtp.gmail.com` |
   | Port | `465` |
   | Username | `ovacure.team@gmail.com` |
   | Password | the 16-character app password (no spaces) |
   | Minimum interval between emails | `30` seconds |

   **Save**.

### Option 2 (at launch, once you buy a domain): Brevo or Resend
- **Brevo** (300 emails/day free): brevo.com → SMTP & API → SMTP → host `smtp-relay.brevo.com`, port `587`,
  login + SMTP key from that page. Verify your sender/domain in Brevo first.
- **Resend** (100/day free): needs your own domain verified (DNS records) before it can email other people.
  Host `smtp.resend.com`, port `465`, username `resend`, password = API key.
- With a domain, send from `no-reply@yourdomain.com` so emails don't land in Spam.

### Raise the email rate limit
Supabase → **Authentication → Rate Limits** → *Rate limit for sending emails* → set to `30` per hour
(this setting only appears after custom SMTP is enabled).

---

## C. Login settings & email templates (OTP code in the email)

Supabase → **Authentication**:

1. **Sign In / Providers → Email**
   - Enable Email provider: **ON**
   - Confirm email: either is fine (ON = first email is "Confirm signup", OFF = "Magic Link")
   - **Email OTP Length: `6`**
   - Email OTP Expiration: `3600` seconds
   - Leave **Allow new users to sign up** ON (in the general "User Signups" section).
2. **Emails → Templates**. Do this for **both** templates, **Confirm signup** *and* **Magic Link**:
   - Subject: `Your Ova Cure sign-in code`
   - Body: switch to source/HTML, delete everything, and paste the whole of `supabase/templates/otp.html`
   - **Save**. The template must contain `{{ .Token }}`; that's the 6-digit code.
3. **URL Configuration** (fill in after step D gives you the Vercel URL):
   - Site URL: `https://<your-app>.vercel.app`
   - Redirect URLs → **Add URL**: `https://<your-app>.vercel.app/**`
   - (Optional, for local dev) also add `http://localhost:3000/**`

---

## D. Vercel (the website)

1. https://vercel.com → sign in **with GitHub** → **Add New… → Project**.
2. Import the GitHub repo **`MPK-OC/Website_launch`**. If it isn't listed, click *Adjust GitHub App
   Permissions* and give Vercel access to the `MPK-OC` org or that repo.
3. Configure:
   - Framework Preset: **Next.js** (auto-detected)
   - Root Directory: leave as **`./`** (the repo root *is* the app)
   - Build command / output: leave default
4. **Environment Variables** (apply to Production, Preview and Development):

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Project URL from A4 |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon/publishable key from A4 |
   | `NEXT_PUBLIC_PHONE_LOGIN` | `false` (set `true` only after section F) |

5. **Deploy**. When it finishes you get `https://<your-app>.vercel.app`.
6. Go back and complete **C3** (Site URL + Redirect URLs) with this exact URL.
7. Every `git push` to `main` now redeploys automatically. If you change environment variables,
   redeploy from Vercel → Deployments → ⋯ → **Redeploy**: `NEXT_PUBLIC_*` values are baked in at build time.

---

## E. Test it & make yourself admin

1. Open the Vercel URL on your phone → **Sign in** → enter your email → **Send code**.
2. The email "Your Ova Cure sign-in code" arrives within ~1 minute (check **Spam/Promotions** the first time
   and mark it *Not spam*). Enter the 6-digit code.
3. Make your account admin. Supabase → SQL Editor:
   ```sql
   update profiles set role = 'admin' where email = 'your-email@gmail.com';
   ```
   Log out and log in again → the **Admin** menu appears.
4. Doctor flow: a doctor signs in → "I'm a gynaecologist" → you approve under **Admin → Doctor verification**.

### If something fails

| What you see | Cause → fix |
|---|---|
| No email at all | Custom SMTP not enabled (B), or wrong app password. Supabase → **Logs → Auth** shows the SMTP error. |
| "Too many codes requested" | Rate limit. Wait, or raise it (B, "Raise the email rate limit"). |
| Email has a link but no code | Template not replaced; do C2 for **both** templates. |
| "Code is wrong or has expired" | Using an older email. Only the newest code works. Or the OTP expired (1 h). |
| Link in email opens `localhost` | Site URL / Redirect URLs not set (C3). |
| Site loads but login spins forever | Vercel env vars missing or wrong → fix and **Redeploy** (D7). |
| "Invalid API key" | Wrong anon key, or the service key was pasted. Use the anon/publishable key. |

---

## F. Phone (SMS) OTP later: Twilio or MSG91 (paid)

Email OTP is free; SMS costs money per message. Turn SMS on when you're ready to pay for it.

**Important for India:** every SMS sent to Indian numbers must be registered on **TRAI DLT**
(your company as "Principal Entity" + an approved OTP message template). Without DLT, Indian carriers
block the SMS. DLT registration (Jio/Airtel/Vodafone portals) takes ~3–7 days and needs company documents.
For India, **MSG91** or **Twilio Verify** handle this more easily than plain Twilio SMS.

### Twilio steps (supported directly by Supabase)
1. https://twilio.com → sign up → upgrade from trial (trial can only SMS your own verified number).
2. Console → copy **Account SID** and **Auth Token**.
3. Either:
   - **Twilio Verify** (recommended): Verify → Services → **Create** → copy the **Service SID** (`VA...`); or
   - **Programmable SMS**: Messaging → Services → Create → add a sender → copy the **Messaging Service SID** (`MG...`).
4. Complete DLT: register the entity + OTP template, and add the DLT Entity ID / template ID in Twilio (India regulatory settings).
5. Supabase → Authentication → Sign In / Providers → **Phone** → enable → provider **Twilio** or **Twilio Verify** →
   paste Account SID, Auth Token, Service SID → Save.
6. Vercel → env `NEXT_PUBLIC_PHONE_LOGIN` = `true` → Redeploy. The Mobile tab comes back on the login page.

Cost estimate: roughly ₹0.15–0.25 per OTP with Indian providers. Twilio to India costs more (check their current pricing page).

For **testing without paying**, Supabase → Phone provider → *Test phone numbers and OTPs* lets you add numbers like
`919999900001=123456` (the provider still has to be filled in, but test numbers never send a real SMS).
