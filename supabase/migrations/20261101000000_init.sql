-- =====================================================================
-- Ova Cure — MVP database schema (Supabase / PostgreSQL)
-- Modules: Accounts & consent · Period tracker · Teleconsultation ·
--          Health records · PCOD care plans · Pregnancy planning ·
--          Menopause care · Content · Notifications · Analytics
-- Every table has Row Level Security (RLS). The browser talks to the DB
-- directly, and RLS decides who can see or change which row.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- ENUMS
-- ---------------------------------------------------------------------
create type public.user_role           as enum ('user', 'doctor', 'admin');
create type public.goal_mode           as enum ('track', 'pcod', 'ttc', 'menopause');
create type public.verification_status as enum ('pending', 'verified', 'rejected', 'suspended');
create type public.appointment_status  as enum ('requested', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show');
create type public.consult_mode        as enum ('video', 'audio', 'chat');
create type public.care_context        as enum ('general', 'period', 'pcod', 'ttc', 'menopause');
create type public.record_type         as enum ('prescription', 'consult_summary', 'cycle_report', 'symptom_report', 'assessment', 'upload');

-- ---------------------------------------------------------------------
-- 1. ACCOUNTS & CONSENT
-- ---------------------------------------------------------------------
create table public.profiles (
  id             uuid primary key references auth.users (id) on delete cascade,
  full_name      text,
  phone          text,
  email          text,
  date_of_birth  date,
  city           text,
  language       text not null default 'en' check (language in ('en', 'hi')),
  role           public.user_role not null default 'user',
  goal_mode      public.goal_mode not null default 'track',
  onboarded_at   timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Append-only consent log (DPDP Act: we must be able to show what was agreed and when)
create table public.consents (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  consent_type  text not null check (consent_type in ('terms', 'privacy', 'health_data', 'teleconsult', 'marketing')),
  granted       boolean not null,
  version       text not null default 'v1',
  created_at    timestamptz not null default now()
);
create index on public.consents (user_id, consent_type, created_at desc);

-- ---------------------------------------------------------------------
-- 2. PERIOD TRACKER
-- ---------------------------------------------------------------------
create table public.cycle_profiles (
  user_id            uuid primary key references public.profiles (id) on delete cascade,
  avg_cycle_length   int  not null default 28 check (avg_cycle_length between 15 and 90),
  avg_period_length  int  not null default 5  check (avg_period_length between 1 and 15),
  last_period_start  date,
  contraception      text,                                   -- none / pill / iud / condom / other
  health_goals       text[] not null default '{}',
  reminders          jsonb  not null default '{"period": true, "fertile": true, "daily_log": true}',
  updated_at         timestamptz not null default now()
);

-- One row per period. Created from onboarding, from "period started" or auto-created from a daily log with flow.
create table public.periods (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  start_date  date not null,
  end_date    date,
  created_at  timestamptz not null default now(),
  unique (user_id, start_date),
  check (end_date is null or end_date >= start_date)
);

create table public.daily_logs (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles (id) on delete cascade,
  log_date         date not null,
  flow             text check (flow in ('none', 'spotting', 'light', 'medium', 'heavy', 'very_heavy')),
  symptoms         text[] not null default '{}',   -- cramps, headache, bloating, acne, fatigue, cravings ...
  mood             text,                           -- happy, calm, sad, anxious, irritable, low
  sleep_hours      numeric(3, 1) check (sleep_hours between 0 and 24),
  energy           smallint check (energy between 1 and 5),
  medication       text,
  sexual_activity  text check (sexual_activity in ('none', 'protected', 'unprotected')),
  ovulation_test   text check (ovulation_test in ('positive', 'negative')),
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (user_id, log_date)
);

-- Irregularity flags & red flags raised by the app (tracker, menopause, PCOD screen)
create table public.health_flags (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  flag_type   text not null,                   -- short_cycle, long_cycle, missed_period, heavy_bleeding, long_period, postmenopausal_bleeding ...
  severity    text not null check (severity in ('info', 'warning', 'urgent')),
  message     text not null,
  source      text not null default 'tracker' check (source in ('tracker', 'menopause', 'pcod', 'ttc', 'doctor')),
  resolved    boolean not null default false,
  created_at  timestamptz not null default now()
);
create unique index health_flags_open_unique on public.health_flags (user_id, flag_type) where not resolved;

-- ---------------------------------------------------------------------
-- 3. DOCTORS & TELECONSULTATION
-- ---------------------------------------------------------------------
create table public.doctors (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid unique references public.profiles (id) on delete set null,
  full_name            text not null,
  gender               text check (gender in ('female', 'male', 'other')),
  photo_url            text,
  qualification        text not null,          -- MBBS, MS (OBG) / DNB / DGO
  registration_number  text not null,          -- NMC / State Medical Council reg. no.
  medical_council      text not null,
  experience_years     int not null default 0,
  languages            text[] not null default '{English}',
  specialties          text[] not null default '{general}',   -- period, pcod, ttc, menopause
  consultation_fee     int not null default 0 check (consultation_fee >= 0),   -- INR
  bio                  text,
  verification_status  public.verification_status not null default 'pending',
  verification_note    text,
  verified_at          timestamptz,
  verified_by          uuid references public.profiles (id),
  rating_avg           numeric(2, 1) not null default 0,
  rating_count         int not null default 0,
  is_accepting         boolean not null default true,
  is_demo              boolean not null default false,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- Weekly recurring availability (weekday 0 = Sunday). Slots are generated from this.
create table public.doctor_availability (
  id            uuid primary key default gen_random_uuid(),
  doctor_id     uuid not null references public.doctors (id) on delete cascade,
  weekday       smallint not null check (weekday between 0 and 6),
  start_time    time not null,
  end_time      time not null,
  slot_minutes  int not null default 20 check (slot_minutes between 10 and 120),
  check (end_time > start_time)
);

create table public.appointments (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null references public.profiles (id) on delete cascade,
  doctor_id                uuid not null references public.doctors (id) on delete restrict,
  scheduled_at             timestamptz not null,
  duration_minutes         int not null default 20,
  mode                     public.consult_mode not null default 'video',
  status                   public.appointment_status not null default 'confirmed',
  context                  public.care_context not null default 'general',
  female_doctor_requested  boolean not null default false,
  pre_consult              jsonb not null default '{}',   -- symptoms, history, medications, allergies
  shared_snapshot          jsonb,                         -- cycle / symptom summary the patient agreed to share
  consent_at               timestamptz,                   -- teleconsultation informed consent
  meeting_url              text,
  fee                      int not null default 0,
  payment_status           text not null default 'waived' check (payment_status in ('waived', 'pending', 'paid', 'refunded')),
  cancel_reason            text,
  rescheduled_from         uuid references public.appointments (id),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);
-- A doctor cannot be double-booked for the same slot
create unique index appointments_no_double_booking
  on public.appointments (doctor_id, scheduled_at)
  where status in ('requested', 'confirmed', 'in_progress', 'completed');
create index on public.appointments (user_id, scheduled_at desc);
create index on public.appointments (doctor_id, scheduled_at);

create table public.consultation_notes (
  id               uuid primary key default gen_random_uuid(),
  appointment_id   uuid not null unique references public.appointments (id) on delete cascade,
  doctor_id        uuid not null references public.doctors (id),
  user_id          uuid not null references public.profiles (id) on delete cascade,
  chief_complaint  text,
  findings         text,
  diagnosis        text,
  advice           text,
  follow_up_date   date,
  private_notes    text,                         -- visible to the doctor only (see view below)
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table public.prescriptions (
  id              uuid primary key default gen_random_uuid(),
  appointment_id  uuid not null unique references public.appointments (id) on delete cascade,
  doctor_id       uuid not null references public.doctors (id),
  user_id         uuid not null references public.profiles (id) on delete cascade,
  medicines       jsonb not null default '[]',   -- [{name, dose, frequency, duration, notes}]
  investigations  text,                          -- lab tests advised
  instructions    text,
  created_at      timestamptz not null default now()
);

create table public.messages (                   -- chat fallback for low bandwidth
  id              uuid primary key default gen_random_uuid(),
  appointment_id  uuid not null references public.appointments (id) on delete cascade,
  sender_id       uuid not null references public.profiles (id) on delete cascade,
  body            text not null check (length(body) between 1 and 4000),
  created_at      timestamptz not null default now()
);
create index on public.messages (appointment_id, created_at);

create table public.reviews (
  id              uuid primary key default gen_random_uuid(),
  appointment_id  uuid not null unique references public.appointments (id) on delete cascade,
  user_id         uuid not null references public.profiles (id) on delete cascade,
  doctor_id       uuid not null references public.doctors (id) on delete cascade,
  rating          smallint not null check (rating between 1 and 5),
  comment         text,
  created_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 4. HEALTH RECORDS
-- ---------------------------------------------------------------------
create table public.health_records (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles (id) on delete cascade,
  record_type     public.record_type not null,
  title           text not null,
  appointment_id  uuid references public.appointments (id) on delete set null,
  data            jsonb not null default '{}',
  file_path       text,                          -- Supabase Storage path for uploads (later)
  created_by      uuid references public.profiles (id),
  created_at      timestamptz not null default now()
);
create index on public.health_records (user_id, created_at desc);

-- ---------------------------------------------------------------------
-- 5. ASSESSMENTS (PCOD screen, menopause baseline)
-- ---------------------------------------------------------------------
create table public.assessments (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles (id) on delete cascade,
  assessment_type  text not null check (assessment_type in ('pcod', 'menopause')),
  answers          jsonb not null,
  score            int not null,
  risk_level       text not null check (risk_level in ('low', 'moderate', 'high')),
  recommendation   text,
  created_at       timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 6. PCOD CARE PLANS
-- ---------------------------------------------------------------------
create table public.care_plans (
  id                 uuid primary key default gen_random_uuid(),
  slug               text not null unique,
  condition          text not null default 'pcod',
  title              text not null,
  description        text,
  duration_months    int not null,
  price_inr          int not null default 0,
  consults_included  int not null default 1,
  includes           text[] not null default '{}',
  is_active          boolean not null default true,
  created_at         timestamptz not null default now()
);

create table public.plan_enrollments (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles (id) on delete cascade,
  plan_id          uuid not null references public.care_plans (id),
  doctor_id        uuid references public.doctors (id),
  status           text not null default 'active' check (status in ('active', 'paused', 'completed', 'cancelled')),
  start_date       date not null default current_date,
  end_date         date not null,
  diet_preference  text not null default 'veg' check (diet_preference in ('veg', 'eggetarian', 'non_veg')),
  fitness_level    text not null default 'beginner' check (fitness_level in ('beginner', 'intermediate', 'advanced')),
  minutes_per_day  int not null default 20,
  payment_status   text not null default 'waived' check (payment_status in ('waived', 'pending', 'paid', 'refunded')),
  created_at       timestamptz not null default now()
);
create unique index one_active_plan_per_user on public.plan_enrollments (user_id) where status = 'active';

create table public.plan_checkins (            -- daily habit check-in => streaks & adherence
  id             uuid primary key default gen_random_uuid(),
  enrollment_id  uuid not null references public.plan_enrollments (id) on delete cascade,
  user_id        uuid not null references public.profiles (id) on delete cascade,
  checkin_date   date not null default current_date,
  diet_done      boolean not null default false,
  workout_done   boolean not null default false,
  water_done     boolean not null default false,
  sleep_done     boolean not null default false,
  notes          text,
  unique (enrollment_id, checkin_date)
);

create table public.progress_entries (         -- weight & waist over time
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  entry_date  date not null default current_date,
  weight_kg   numeric(5, 1),
  waist_cm    numeric(5, 1),
  notes       text,
  unique (user_id, entry_date)
);

create table public.plan_adjustments (         -- doctor-approved changes at follow-ups
  id             uuid primary key default gen_random_uuid(),
  enrollment_id  uuid not null references public.plan_enrollments (id) on delete cascade,
  doctor_id      uuid not null references public.doctors (id),
  note           text not null,
  created_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 7. PREGNANCY PLANNING (Trying to Conceive)
-- ---------------------------------------------------------------------
create table public.ttc_journeys (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  started_on  date not null default current_date,
  is_active   boolean not null default true,
  notes       text,
  created_at  timestamptz not null default now()
);
create unique index one_active_ttc on public.ttc_journeys (user_id) where is_active;

create table public.ttc_checklist (
  user_id   uuid not null references public.profiles (id) on delete cascade,
  item_key  text not null,
  done      boolean not null default false,
  done_at   timestamptz,
  primary key (user_id, item_key)
);

-- ---------------------------------------------------------------------
-- 8. MENOPAUSE CARE
-- ---------------------------------------------------------------------
create table public.menopause_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  log_date    date not null default current_date,
  symptoms    jsonb not null default '{}',   -- {"hot_flashes": 0-3, "night_sweats": 0-3, ...}
  score       int not null default 0,        -- sum of severities, 0-24
  bleeding    boolean not null default false,
  notes       text,
  unique (user_id, log_date)
);

-- ---------------------------------------------------------------------
-- 9. CONTENT
-- ---------------------------------------------------------------------
create table public.articles (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  title         text not null,
  summary       text,
  body          text not null,                       -- markdown-ish plain text
  category      text not null default 'basics',
  segments      public.goal_mode[] not null default '{track}',
  language      text not null default 'en',
  video_url     text,
  cover_emoji   text default '🌸',
  read_minutes  int not null default 3,
  reviewed_by   text,                                -- medical reviewer name
  published     boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 10. NOTIFICATIONS & ANALYTICS
-- ---------------------------------------------------------------------
create table public.notifications (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles (id) on delete cascade,
  kind           text not null,          -- period_reminder, fertile_window, log_nudge, appointment, plan_task, red_flag
  title          text not null,
  body           text,
  link           text,
  channel        text not null default 'in_app' check (channel in ('in_app', 'push', 'sms', 'whatsapp')),
  scheduled_for  timestamptz not null default now(),
  read_at        timestamptz,
  created_at     timestamptz not null default now()
);
create index on public.notifications (user_id, scheduled_for desc);

create table public.events (
  id          bigint generated always as identity primary key,
  user_id     uuid references public.profiles (id) on delete set null,
  name        text not null,
  props       jsonb not null default '{}',
  created_at  timestamptz not null default now()
);
create index on public.events (name, created_at desc);

-- =====================================================================
-- HELPER FUNCTIONS (security definer => used inside RLS without recursion)
-- =====================================================================
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.my_doctor_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.doctors where user_id = auth.uid() and verification_status = 'verified';
$$;

-- true when the logged-in doctor has (or had) an appointment with this patient
create or replace function public.doctor_has_patient(p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.appointments a
    where a.user_id = p_user
      and a.doctor_id = public.my_doctor_id()
      and a.status <> 'cancelled'
  );
$$;

-- Patients cannot see other people's appointments, so the booking page asks this instead.
create or replace function public.get_booked_slots(p_doctor uuid, p_from timestamptz, p_to timestamptz)
returns setof timestamptz
language sql stable security definer set search_path = public as $$
  select scheduled_at from public.appointments
  where doctor_id = p_doctor
    and scheduled_at between p_from and p_to
    and status in ('requested', 'confirmed', 'in_progress', 'completed');
$$;

-- Admin approves / rejects a doctor application (atomic: doctor row + profile role)
create or replace function public.review_doctor(p_doctor uuid, p_approve boolean, p_note text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare v_user uuid;
begin
  if not public.is_admin() then raise exception 'Only admins can verify doctors'; end if;
  update public.doctors
     set verification_status = case when p_approve then 'verified'::verification_status else 'rejected'::verification_status end,
         verification_note = p_note,
         verified_at = case when p_approve then now() else null end,
         verified_by = auth.uid()
   where id = p_doctor
   returning user_id into v_user;
  if v_user is not null then
    update public.profiles
       set role = case when p_approve then 'doctor'::user_role else 'user'::user_role end
     where id = v_user and role <> 'admin';
    insert into public.notifications (user_id, kind, title, body, link)
    values (v_user, 'doctor_review',
            case when p_approve then 'You are verified on Ova Cure' else 'Your doctor application needs changes' end,
            coalesce(p_note, case when p_approve then 'Set your availability to start receiving bookings.' else null end),
            '/doctor');
  end if;
end $$;

-- One-tap data deletion (DPDP Act). Deleting the auth user cascades to all personal tables.
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  delete from auth.users where id = auth.uid();
end $$;

-- =====================================================================
-- TRIGGERS
-- =====================================================================
create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create trigger trg_profiles_updated     before update on public.profiles           for each row execute function public.set_updated_at();
create trigger trg_daily_logs_updated   before update on public.daily_logs         for each row execute function public.set_updated_at();
create trigger trg_doctors_updated      before update on public.doctors            for each row execute function public.set_updated_at();
create trigger trg_appointments_updated before update on public.appointments       for each row execute function public.set_updated_at();
create trigger trg_notes_updated        before update on public.consultation_notes for each row execute function public.set_updated_at();
create trigger trg_articles_updated     before update on public.articles           for each row execute function public.set_updated_at();

-- New auth user => profile row
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, phone, email)
  values (new.id, new.phone, new.email)
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Users cannot promote themselves (role change only by admin, or from the SQL editor where auth.uid() is null)
create or replace function public.guard_profile_role() returns trigger language plpgsql as $$
begin
  if new.role is distinct from old.role and auth.uid() is not null and not public.is_admin() then
    raise exception 'You cannot change your own role';
  end if;
  return new;
end $$;
create trigger trg_guard_profile_role before update on public.profiles
  for each row execute function public.guard_profile_role();

-- Doctors cannot verify themselves
create or replace function public.guard_doctor_verification() returns trigger language plpgsql as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    if tg_op = 'INSERT' then
      new.verification_status := 'pending';
      new.is_demo := false;
      new.rating_avg := 0; new.rating_count := 0;
    -- the doctor editing their own row (rating triggers run as the reviewing patient, so they pass)
    elsif old.user_id = auth.uid() and (
            (new.verification_status is distinct from old.verification_status
             and not (old.verification_status = 'rejected' and new.verification_status = 'pending'))  -- resubmit allowed
         or new.rating_avg is distinct from old.rating_avg
         or new.rating_count is distinct from old.rating_count) then
      raise exception 'Verification status and ratings are managed by Ova Cure';
    end if;
  end if;
  return new;
end $$;
create trigger trg_guard_doctor before insert or update on public.doctors
  for each row execute function public.guard_doctor_verification();

-- Every appointment gets a free Jitsi video room + fee snapshot + doctor notification
create or replace function public.prepare_appointment() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.meeting_url is null then
    new.meeting_url := 'https://meet.jit.si/OvaCure-' || replace(new.id::text, '-', '');
  end if;
  select consultation_fee into new.fee from public.doctors where id = new.doctor_id;
  return new;
end $$;
create trigger trg_prepare_appointment before insert on public.appointments
  for each row execute function public.prepare_appointment();

create or replace function public.notify_appointment() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_doc_user uuid;
begin
  select user_id into v_doc_user from public.doctors where id = new.doctor_id;
  if tg_op = 'INSERT' then
    insert into public.notifications (user_id, kind, title, body, link, scheduled_for)
    values (new.user_id, 'appointment', 'Consultation booked',
            'Your consultation is on ' || to_char(new.scheduled_at at time zone 'Asia/Kolkata', 'DD Mon, HH12:MI AM'),
            '/appointments/' || new.id, now());
    -- reminder 30 min before
    insert into public.notifications (user_id, kind, title, body, link, scheduled_for)
    values (new.user_id, 'appointment', 'Your consultation starts in 30 minutes',
            'Join from the appointment page.', '/appointments/' || new.id, new.scheduled_at - interval '30 minutes');
    if v_doc_user is not null then
      insert into public.notifications (user_id, kind, title, body, link)
      values (v_doc_user, 'appointment', 'New booking',
              'New consultation on ' || to_char(new.scheduled_at at time zone 'Asia/Kolkata', 'DD Mon, HH12:MI AM'),
              '/doctor/appointments/' || new.id);
    end if;
  elsif new.status is distinct from old.status and new.status = 'cancelled' then
    if v_doc_user is not null then
      insert into public.notifications (user_id, kind, title, body, link)
      values (v_doc_user, 'appointment', 'Booking cancelled', coalesce(new.cancel_reason, ''), '/doctor');
    end if;
  end if;
  return new;
end $$;
create trigger trg_notify_appointment after insert or update on public.appointments
  for each row execute function public.notify_appointment();

-- Keep doctor rating average up to date
create or replace function public.refresh_doctor_rating() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.doctors d
     set rating_avg = coalesce((select round(avg(rating)::numeric, 1) from public.reviews where doctor_id = d.id), 0),
         rating_count = (select count(*) from public.reviews where doctor_id = d.id)
   where d.id = coalesce(new.doctor_id, old.doctor_id);
  return null;
end $$;
create trigger trg_review_rating after insert or update or delete on public.reviews
  for each row execute function public.refresh_doctor_rating();

-- Prescription => copy into the patient's health records
create or replace function public.prescription_to_record() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.health_records (user_id, record_type, title, appointment_id, data, created_by)
  values (new.user_id, 'prescription', 'E-prescription', new.appointment_id,
          jsonb_build_object('medicines', new.medicines, 'investigations', new.investigations, 'instructions', new.instructions),
          auth.uid());
  return new;
end $$;
create trigger trg_prescription_record after insert on public.prescriptions
  for each row execute function public.prescription_to_record();

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================
alter table public.profiles            enable row level security;
alter table public.consents            enable row level security;
alter table public.cycle_profiles      enable row level security;
alter table public.periods             enable row level security;
alter table public.daily_logs          enable row level security;
alter table public.health_flags        enable row level security;
alter table public.doctors             enable row level security;
alter table public.doctor_availability enable row level security;
alter table public.appointments        enable row level security;
alter table public.consultation_notes  enable row level security;
alter table public.prescriptions       enable row level security;
alter table public.messages            enable row level security;
alter table public.reviews             enable row level security;
alter table public.health_records      enable row level security;
alter table public.assessments         enable row level security;
alter table public.care_plans          enable row level security;
alter table public.plan_enrollments    enable row level security;
alter table public.plan_checkins       enable row level security;
alter table public.progress_entries    enable row level security;
alter table public.plan_adjustments    enable row level security;
alter table public.ttc_journeys        enable row level security;
alter table public.ttc_checklist       enable row level security;
alter table public.menopause_logs      enable row level security;
alter table public.articles            enable row level security;
alter table public.notifications       enable row level security;
alter table public.events              enable row level security;

-- profiles
create policy "profiles: own read"       on public.profiles for select using (id = auth.uid() or public.is_admin() or public.doctor_has_patient(id));
create policy "profiles: own update"     on public.profiles for update using (id = auth.uid() or public.is_admin());

-- Simple "owner can do everything" tables (+ admin read, + treating doctor read where useful)
create policy "consents: own"            on public.consents       for all    using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "consents: admin read"     on public.consents       for select using (public.is_admin());

create policy "cycle_profiles: own"      on public.cycle_profiles for all    using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "cycle_profiles: doctor"   on public.cycle_profiles for select using (public.doctor_has_patient(user_id));

create policy "periods: own"             on public.periods        for all    using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "periods: doctor"          on public.periods        for select using (public.doctor_has_patient(user_id));

create policy "daily_logs: own"          on public.daily_logs     for all    using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "daily_logs: doctor"       on public.daily_logs     for select using (public.doctor_has_patient(user_id));

create policy "health_flags: own"        on public.health_flags   for all    using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "health_flags: doctor"     on public.health_flags   for select using (public.doctor_has_patient(user_id));
create policy "health_flags: admin"      on public.health_flags   for select using (public.is_admin());

-- doctors: public directory shows verified doctors; a doctor manages own row; admin everything
create policy "doctors: public verified" on public.doctors for select using (verification_status = 'verified' and is_accepting);
create policy "doctors: own read"        on public.doctors for select using (user_id = auth.uid());
create policy "doctors: apply"           on public.doctors for insert with check (user_id = auth.uid());
create policy "doctors: own update"      on public.doctors for update using (user_id = auth.uid());
create policy "doctors: admin"           on public.doctors for all using (public.is_admin()) with check (public.is_admin());
create policy "doctors: patient's doctor" on public.doctors for select using (
  exists (select 1 from public.appointments a where a.doctor_id = doctors.id and a.user_id = auth.uid()));

create policy "availability: read"       on public.doctor_availability for select using (true);
create policy "availability: own"        on public.doctor_availability for all
  using (doctor_id = public.my_doctor_id() or public.is_admin())
  with check (doctor_id = public.my_doctor_id() or public.is_admin());

-- appointments
create policy "appointments: patient read"   on public.appointments for select using (user_id = auth.uid());
create policy "appointments: patient book"   on public.appointments for insert with check (
  user_id = auth.uid() and status in ('requested', 'confirmed') and consent_at is not null);
create policy "appointments: patient update" on public.appointments for update using (user_id = auth.uid());
create policy "appointments: doctor"         on public.appointments for select using (doctor_id = public.my_doctor_id());
create policy "appointments: doctor update"  on public.appointments for update using (doctor_id = public.my_doctor_id());
create policy "appointments: admin"          on public.appointments for all using (public.is_admin()) with check (public.is_admin());

-- consultation notes: doctor writes, patient reads (private_notes hidden through the view below)
create policy "notes: doctor"        on public.consultation_notes for all
  using (doctor_id = public.my_doctor_id()) with check (doctor_id = public.my_doctor_id());
create policy "notes: admin"         on public.consultation_notes for select using (public.is_admin());

create policy "rx: doctor"           on public.prescriptions for all
  using (doctor_id = public.my_doctor_id()) with check (doctor_id = public.my_doctor_id());
create policy "rx: patient"          on public.prescriptions for select using (user_id = auth.uid());
create policy "rx: admin"            on public.prescriptions for select using (public.is_admin());

create policy "messages: participants" on public.messages for select using (
  exists (select 1 from public.appointments a where a.id = appointment_id
          and (a.user_id = auth.uid() or a.doctor_id = public.my_doctor_id())));
create policy "messages: send"         on public.messages for insert with check (
  sender_id = auth.uid() and exists (select 1 from public.appointments a where a.id = appointment_id
          and (a.user_id = auth.uid() or a.doctor_id = public.my_doctor_id())));

create policy "reviews: public read" on public.reviews for select using (true);
create policy "reviews: patient"     on public.reviews for insert with check (
  user_id = auth.uid() and exists (select 1 from public.appointments a
    where a.id = appointment_id and a.user_id = auth.uid() and a.status = 'completed' and a.doctor_id = reviews.doctor_id));

create policy "records: own"         on public.health_records for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "records: doctor read" on public.health_records for select using (public.doctor_has_patient(user_id));
create policy "records: doctor add"  on public.health_records for insert with check (public.doctor_has_patient(user_id));

create policy "assessments: own"     on public.assessments for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "assessments: doctor"  on public.assessments for select using (public.doctor_has_patient(user_id));
create policy "assessments: admin"   on public.assessments for select using (public.is_admin());

create policy "plans: read"          on public.care_plans for select using (true);
create policy "plans: admin"         on public.care_plans for all using (public.is_admin()) with check (public.is_admin());

create policy "enrollments: own"     on public.plan_enrollments for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "enrollments: doctor"  on public.plan_enrollments for select using (public.doctor_has_patient(user_id));
create policy "enrollments: admin"   on public.plan_enrollments for select using (public.is_admin());

create policy "checkins: own"        on public.plan_checkins for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "checkins: doctor"     on public.plan_checkins for select using (public.doctor_has_patient(user_id));

create policy "progress: own"        on public.progress_entries for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "progress: doctor"     on public.progress_entries for select using (public.doctor_has_patient(user_id));

create policy "adjust: doctor"       on public.plan_adjustments for all
  using (doctor_id = public.my_doctor_id()) with check (doctor_id = public.my_doctor_id()
    and exists (select 1 from public.plan_enrollments e where e.id = enrollment_id and public.doctor_has_patient(e.user_id)));
create policy "adjust: patient"      on public.plan_adjustments for select using (
  exists (select 1 from public.plan_enrollments e where e.id = enrollment_id and e.user_id = auth.uid()));

create policy "ttc: own"             on public.ttc_journeys  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "ttc_check: own"       on public.ttc_checklist for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "meno: own"            on public.menopause_logs for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "meno: doctor"         on public.menopause_logs for select using (public.doctor_has_patient(user_id));

create policy "articles: published"  on public.articles for select using (published);
create policy "articles: admin"      on public.articles for all using (public.is_admin()) with check (public.is_admin());

create policy "notifications: own"   on public.notifications for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "notifications: doctor to patient" on public.notifications for insert with check (public.doctor_has_patient(user_id));
create policy "notifications: admin" on public.notifications for all using (public.is_admin()) with check (public.is_admin());

create policy "events: insert own"   on public.events for insert with check (user_id = auth.uid());
create policy "events: admin read"   on public.events for select using (public.is_admin());

-- Patient-facing view of consultation notes (hides the doctor's private notes)
create view public.my_consultation_notes with (security_invoker = false) as
  select id, appointment_id, doctor_id, user_id, chief_complaint, findings, diagnosis, advice, follow_up_date, created_at
  from public.consultation_notes
  where user_id = auth.uid();
grant select on public.my_consultation_notes to authenticated;
