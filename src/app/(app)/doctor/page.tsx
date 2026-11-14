"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { CalendarClock, Clock, ShieldCheck, Star, Users } from "lucide-react";
import { supabase, track } from "@/lib/supabase";
import { fmtDateTime, todayISO } from "@/lib/dates";
import { GOAL_LABEL } from "@/lib/constants";
import { useMyDoctor, type DoctorRow } from "@/lib/useDoctor";
import { useUser } from "@/components/UserProvider";
import { Alert, Badge, Button, Card, Chip, Empty, Field, Input, LinkButton, PageHeader, Select, Spinner, Stat, Textarea } from "@/components/ui";

export default function DoctorHome() {
  const { doctor, loading, reload } = useMyDoctor();
  const [editing, setEditing] = useState(false);
  if (loading) return <Spinner />;
  if (!doctor || editing) return <Apply existing={doctor} onDone={() => { setEditing(false); reload(); }} />;
  if (doctor.verification_status !== "verified") return (
    <div className="mx-auto max-w-xl space-y-4">
      <PageHeader title="Doctor application" />
      {doctor.verification_status === "pending" && (
        <Alert tone="info" title="Your application is under review">
          Our team is verifying your registration ({doctor.registration_number}, {doctor.medical_council}). This usually takes 1–2 working days. You&apos;ll get a notification once approved.
        </Alert>
      )}
      {doctor.verification_status === "rejected" && <Alert tone="warning" title="Changes needed">{doctor.verification_note ?? "Please review your details and resubmit."}</Alert>}
      {doctor.verification_status === "suspended" && <Alert tone="urgent" title="Account suspended">Please contact support.</Alert>}
      <Button variant="secondary" onClick={() => setEditing(true)}>{doctor.verification_status === "rejected" ? "Edit & resubmit" : "Edit application"}</Button>
    </div>
  );
  return <Dashboard doctor={doctor} reload={reload} onEdit={() => setEditing(true)} />;
}

function Apply({ existing, onDone }: { existing: DoctorRow | null; onDone: () => void }) {
  const { user, profile, refreshProfile } = useUser();
  const [f, setF] = useState({
    full_name: existing?.full_name ?? (profile?.full_name ? `Dr. ${profile.full_name}` : "Dr. "), gender: existing?.gender ?? "female",
    qualification: existing?.qualification ?? "", registration_number: existing?.registration_number ?? "", medical_council: existing?.medical_council ?? "",
    experience_years: existing?.experience_years ?? 0, languages: existing?.languages.join(", ") ?? "English, Hindi",
    specialties: existing?.specialties ?? ["general"], consultation_fee: existing?.consultation_fee ?? 500, bio: existing?.bio ?? "",
  });
  const [agree, setAgree] = useState(!!existing);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setErr(null);
    if (!f.qualification || !f.registration_number || !f.medical_council) return setErr("Qualification, registration number and council are required.");
    if (!agree) return setErr("Please accept the telemedicine declaration.");
    setBusy(true);
    const row = { ...f, languages: f.languages.split(",").map((s) => s.trim()).filter(Boolean), user_id: user!.id };
    const { error } = existing
      ? await supabase().from("doctors").update({ ...row, ...(existing.verification_status === "rejected" ? { verification_status: "pending" } : {}) }).eq("id", existing.id)
      : await supabase().from("doctors").insert(row);
    if (error) { setBusy(false); return setErr(error.message); }
    if (!profile?.onboarded_at) await supabase().from("profiles").update({ full_name: profile?.full_name || f.full_name.replace(/^Dr\.?\s*/, ""), onboarded_at: new Date().toISOString() }).eq("id", user!.id);
    track("doctor_applied");
    await refreshProfile();
    onDone();
  }

  const toggleSpec = (s: string) => setF({ ...f, specialties: f.specialties.includes(s) ? f.specialties.filter((x) => x !== s) : [...f.specialties, s] });

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader title={existing ? "Edit your doctor profile" : "Join Ova Cure as a gynaecologist"} subtitle="We verify every doctor's registration before they can consult." />
      <Card className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name (as registered)"><Input value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} /></Field>
          <Field label="Gender"><Select value={f.gender} onChange={(e) => setF({ ...f, gender: e.target.value })}><option value="female">Female</option><option value="male">Male</option><option value="other">Other</option></Select></Field>
          <Field label="Qualification" hint="e.g. MBBS, MS (OBG) / DNB / DGO"><Input value={f.qualification} onChange={(e) => setF({ ...f, qualification: e.target.value })} /></Field>
          <Field label="Years of experience"><Input type="number" min={0} value={f.experience_years} onChange={(e) => setF({ ...f, experience_years: Number(e.target.value) })} /></Field>
          <Field label="Registration number"><Input value={f.registration_number} onChange={(e) => setF({ ...f, registration_number: e.target.value })} /></Field>
          <Field label="Medical council" hint="NMC or State Medical Council"><Input value={f.medical_council} onChange={(e) => setF({ ...f, medical_council: e.target.value })} placeholder="Delhi Medical Council" /></Field>
          <Field label="Languages (comma separated)"><Input value={f.languages} onChange={(e) => setF({ ...f, languages: e.target.value })} /></Field>
          <Field label="Consultation fee (₹)"><Input type="number" min={0} value={f.consultation_fee} onChange={(e) => setF({ ...f, consultation_fee: Number(e.target.value) })} /></Field>
        </div>
        <Field label="Areas of focus">
          <div className="flex flex-wrap gap-2">{["general", "period", "pcod", "ttc", "menopause"].map((s) => <Chip key={s} active={f.specialties.includes(s)} onClick={() => toggleSpec(s)}>{GOAL_LABEL[s]}</Chip>)}</div>
        </Field>
        <Field label="Short bio"><Textarea value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value })} /></Field>
        <label className="flex items-start gap-3 rounded-xl bg-ova-50 p-3 text-sm">
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 accent-ova-600" />
          I am a registered medical practitioner and will follow the Telemedicine Practice Guidelines (India, 2020), including patient consent, record keeping and prescription rules.
        </label>
        {err && <Alert tone="urgent">{err}</Alert>}
        <Button onClick={submit} loading={busy}>{existing ? "Save" : "Submit for verification"}</Button>
      </Card>
    </div>
  );
}

interface Appt { id: string; scheduled_at: string; mode: string; status: string; context: string; user_id: string; pre_consult: { symptoms?: string }; profiles: { full_name: string | null } | null }

function Dashboard({ doctor, reload, onEdit }: { doctor: DoctorRow; reload: () => void; onEdit: () => void }) {
  const [appts, setAppts] = useState<Appt[] | null>(null);
  useEffect(() => {
    supabase().from("appointments").select("id,scheduled_at,mode,status,context,user_id,pre_consult,profiles(full_name)")
      .eq("doctor_id", doctor.id).order("scheduled_at").then(({ data }) => setAppts((data ?? []) as unknown as Appt[]));
  }, [doctor.id]);
  if (!appts) return <Spinner />;

  const today = todayISO();
  const active = appts.filter((a) => ["confirmed", "in_progress", "requested"].includes(a.status));
  const todays = active.filter((a) => a.scheduled_at.slice(0, 10) === today || new Date(a.scheduled_at).toDateString() === new Date().toDateString());
  const upcoming = active.filter((a) => new Date(a.scheduled_at).getTime() > Date.now() - 3600e3 && !todays.includes(a));
  const completed = appts.filter((a) => a.status === "completed");
  const patients = new Set(appts.map((a) => a.user_id)).size;

  async function toggleAccepting() {
    await supabase().from("doctors").update({ is_accepting: !doctor.is_accepting }).eq("id", doctor.id);
    reload();
  }

  const row = (a: Appt) => (
    <Link key={a.id} href={`/doctor/appointments/${a.id}`} className="flex flex-wrap items-center gap-3 rounded-xl border border-ova-100 p-3 hover:border-ova-300">
      <Clock className="size-4 text-ova-500" />
      <div className="flex-1">
        <p className="font-semibold text-ova-900">{a.profiles?.full_name ?? "Patient"} <span className="font-normal text-slate-500">· {GOAL_LABEL[a.context]}</span></p>
        <p className="line-clamp-1 text-sm text-slate-600">{a.pre_consult?.symptoms}</p>
      </div>
      <span className="text-sm text-ova-800">{fmtDateTime(a.scheduled_at)}</span>
      <Badge tone={a.status === "in_progress" ? "green" : "ova"} className="capitalize">{a.mode}</Badge>
    </Link>
  );

  return (
    <div className="space-y-6">
      <PageHeader title={`Welcome, ${doctor.full_name}`} subtitle="Doctor dashboard"
        action={<div className="flex gap-2"><Button variant="secondary" onClick={onEdit}>Edit profile</Button><LinkButton href="/doctor/availability">Availability</LinkButton></div>} />
      <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-900">
        <ShieldCheck className="size-5" /> Verified · Reg. {doctor.registration_number}
        <span className="flex-1" />
        <label className="flex items-center gap-2 font-medium"><input type="checkbox" className="accent-emerald-600" checked={doctor.is_accepting} onChange={toggleAccepting} />Accepting new bookings</label>
      </div>
      <div className="grid gap-4 sm:grid-cols-4">
        <Stat label="Today" value={todays.length} sub="consultations" />
        <Stat label="Upcoming" value={upcoming.length} />
        <Stat label="Patients" value={<span className="flex items-center gap-1"><Users className="size-5" />{patients}</span>} />
        <Stat label="Rating" value={<span className="flex items-center gap-1"><Star className="size-5 fill-amber-400 text-amber-400" />{doctor.rating_avg || "—"}</span>} sub={`${doctor.rating_count} reviews · ${completed.length} completed`} />
      </div>
      <Card>
        <p className="mb-3 flex items-center gap-2 font-semibold text-ova-900"><CalendarClock className="size-5" />Today</p>
        {todays.length ? <div className="space-y-2">{todays.map(row)}</div> : <p className="text-sm text-slate-500">No consultations today.</p>}
      </Card>
      <Card>
        <p className="mb-3 font-semibold text-ova-900">Upcoming</p>
        {upcoming.length ? <div className="space-y-2">{upcoming.map(row)}</div> : <Empty title="No upcoming bookings" text="Make sure your availability is set so patients can book you." action={<LinkButton href="/doctor/availability">Set availability</LinkButton>} />}
      </Card>
      {completed.length > 0 && (
        <Card>
          <p className="mb-3 font-semibold text-ova-900">Recent completed</p>
          <div className="space-y-2">{completed.slice(-5).reverse().map(row)}</div>
        </Card>
      )}
    </div>
  );
}
