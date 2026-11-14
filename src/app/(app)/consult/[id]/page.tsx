"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { BadgeCheck, MessageSquare, Phone, Star, Video } from "lucide-react";
import { supabase, track } from "@/lib/supabase";
import { addDays, parseISO, todayISO } from "@/lib/dates";
import { GOAL_LABEL } from "@/lib/constants";
import { buildCycleSnapshot, useTracker } from "@/lib/useTracker";
import { useUser } from "@/components/UserProvider";
import { DoctorAvatar, type Doctor } from "@/components/doctor";
import { Alert, Badge, Button, Card, Chip, cx, Field, Input, Select, Spinner, Textarea } from "@/components/ui";

interface Slot { weekday: number; start_time: string; end_time: string; slot_minutes: number }
interface Review { rating: number; comment: string | null; created_at: string }

function buildSlots(avail: Slot[], days: number, booked: Set<number>) {
  const out: Record<string, Date[]> = {};
  const now = Date.now() + 30 * 60000; // at least 30 min from now
  for (let i = 0; i < days; i++) {
    const day = addDays(todayISO(), i);
    const wd = parseISO(day).getDay();
    const list: Date[] = [];
    avail.filter((a) => a.weekday === wd).forEach((a) => {
      const [sh, sm] = a.start_time.split(":").map(Number);
      const [eh, em] = a.end_time.split(":").map(Number);
      for (let m = sh * 60 + sm; m + a.slot_minutes <= eh * 60 + em; m += a.slot_minutes) {
        const d = parseISO(day); d.setHours(Math.floor(m / 60), m % 60, 0, 0);
        if (d.getTime() > now && !booked.has(d.getTime())) list.push(d);
      }
    });
    out[day] = list.sort((a, b) => a.getTime() - b.getTime());
  }
  return out;
}

function Booking() {
  const { id } = useParams<{ id: string }>();
  const params = useSearchParams();
  const router = useRouter();
  const { user, profile } = useUser();
  const tracker = useTracker();
  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [avail, setAvail] = useState<Slot[]>([]);
  const [booked, setBooked] = useState<Set<number>>(new Set());
  const [reviews, setReviews] = useState<Review[]>([]);
  const [day, setDay] = useState(todayISO());
  const [slot, setSlot] = useState<Date | null>(null);
  const [mode, setMode] = useState<"video" | "audio" | "chat">("video");
  const ctxParam = params.get("context");
  const [context, setContext] = useState<string>(ctxParam || (profile?.goal_mode === "track" ? "period" : profile?.goal_mode) || "general");
  const [pre, setPre] = useState({ symptoms: "", duration: "", history: "", medications: "", allergies: "" });
  const [share, setShare] = useState(true);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reschedule = params.get("reschedule");

  useEffect(() => {
    const sb = supabase();
    sb.from("doctors").select("*").eq("id", id).maybeSingle().then(({ data }) => setDoctor(data as Doctor));
    sb.from("doctor_availability").select("*").eq("doctor_id", id).then(({ data }) => setAvail((data ?? []) as Slot[]));
    sb.from("reviews").select("rating,comment,created_at").eq("doctor_id", id).order("created_at", { ascending: false }).limit(5)
      .then(({ data }) => setReviews((data ?? []) as Review[]));
    sb.rpc("get_booked_slots", { p_doctor: id, p_from: new Date().toISOString(), p_to: new Date(Date.now() + 8 * 864e5).toISOString() })
      .then(({ data }) => setBooked(new Set(((data ?? []) as string[]).map((s) => new Date(s).getTime()))));
  }, [id]);

  const slots = useMemo(() => buildSlots(avail, 7, booked), [avail, booked]);

  async function book() {
    setError(null);
    if (!slot) return setError("Please choose a time slot.");
    if (!pre.symptoms.trim()) return setError("Please describe your main concern.");
    if (!consent) return setError("Please give consent for the teleconsultation.");
    setBusy(true);
    const sb = supabase();
    const { data, error } = await sb.from("appointments").insert({
      user_id: user!.id, doctor_id: id, scheduled_at: slot.toISOString(), mode, context, status: "confirmed",
      female_doctor_requested: doctor?.gender === "female", pre_consult: pre,
      shared_snapshot: share ? buildCycleSnapshot(tracker) : null, consent_at: new Date().toISOString(),
      rescheduled_from: reschedule,
    }).select("id").single();
    if (error) {
      setBusy(false);
      return setError(error.message.includes("double_booking") ? "Sorry, that slot was just taken. Please pick another." : error.message);
    }
    await sb.from("consents").insert({ user_id: user!.id, consent_type: "teleconsult", granted: true });
    if (reschedule) await sb.from("appointments").update({ status: "cancelled", cancel_reason: "Rescheduled by patient" }).eq("id", reschedule);
    track("appointment_booked", { doctor_id: id, context, mode });
    router.push(`/appointments/${data.id}?booked=1`);
  }

  if (!doctor || tracker.loading) return <Spinner />;
  const days = Object.keys(slots);

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-1">
        <Card>
          <div className="flex gap-4">
            <DoctorAvatar d={doctor} size="size-16" />
            <div>
              <p className="flex items-center gap-1.5 font-bold text-ova-900">{doctor.full_name}<BadgeCheck className="size-4 text-ova-600" /></p>
              <p className="text-sm text-slate-600">{doctor.qualification}</p>
              <p className="mt-1 flex items-center gap-1 text-xs text-slate-500"><Star className="size-3.5 fill-amber-400 text-amber-400" />{doctor.rating_avg || "New"} · {doctor.experience_years} yrs</p>
            </div>
          </div>
          {doctor.bio && <p className="mt-4 text-sm text-slate-700">{doctor.bio}</p>}
          <dl className="mt-4 space-y-1 text-xs text-slate-600">
            <div><dt className="inline font-semibold">Reg. no: </dt><dd className="inline">{doctor.registration_number} ({doctor.medical_council})</dd></div>
            <div><dt className="inline font-semibold">Languages: </dt><dd className="inline">{doctor.languages.join(", ")}</dd></div>
          </dl>
          <p className="mt-4 text-2xl font-bold text-ova-900">₹{doctor.consultation_fee}</p>
          <Badge tone="green">Free during beta testing</Badge>
        </Card>
        {reviews.length > 0 && (
          <Card>
            <p className="mb-2 font-semibold text-ova-900">Patient reviews</p>
            {reviews.map((r, i) => (
              <div key={i} className="border-b border-ova-50 py-2 text-sm last:border-0">
                <p className="text-amber-500">{"★".repeat(r.rating)}<span className="text-slate-200">{"★".repeat(5 - r.rating)}</span></p>
                {r.comment && <p className="text-slate-700">{r.comment}</p>}
              </div>
            ))}
          </Card>
        )}
      </div>

      <div className="space-y-5 lg:col-span-2">
        {reschedule && <Alert tone="info">You are rescheduling an appointment. Your old booking is cancelled once you confirm the new slot.</Alert>}
        <Card>
          <h2 className="mb-3 font-semibold text-ova-900">1. Choose a slot</h2>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2">
            {days.map((d) => (
              <button key={d} onClick={() => { setDay(d); setSlot(null); }}
                className={cx("min-w-16 rounded-xl border px-3 py-2 text-center text-xs", day === d ? "border-ova-600 bg-ova-600 text-white" : "border-ova-100 hover:border-ova-300")}>
                <span className="block font-medium">{parseISO(d).toLocaleDateString("en-IN", { weekday: "short" })}</span>
                <span className="block text-lg font-bold">{parseISO(d).getDate()}</span>
                <span className="block opacity-70">{slots[d].length} slots</span>
              </button>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
            {slots[day]?.length ? slots[day].map((s) => (
              <button key={s.getTime()} onClick={() => setSlot(s)}
                className={cx("rounded-lg border py-2 text-sm font-medium", slot?.getTime() === s.getTime() ? "border-ova-600 bg-ova-600 text-white" : "border-ova-100 hover:border-ova-400")}>
                {s.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}
              </button>
            )) : <p className="col-span-full text-sm text-slate-500">No slots on this day.</p>}
          </div>
        </Card>

        <Card>
          <h2 className="mb-3 font-semibold text-ova-900">2. Consultation type</h2>
          <div className="flex flex-wrap gap-2">
            <Chip active={mode === "video"} onClick={() => setMode("video")}><Video className="mr-1 inline size-4" />Video</Chip>
            <Chip active={mode === "audio"} onClick={() => setMode("audio")}><Phone className="mr-1 inline size-4" />Audio</Chip>
            <Chip active={mode === "chat"} onClick={() => setMode("chat")}><MessageSquare className="mr-1 inline size-4" />Chat (low bandwidth)</Chip>
          </div>
          <div className="mt-4 max-w-xs">
            <Field label="Reason for consultation">
              <Select value={context} onChange={(e) => setContext(e.target.value)}>
                {["general", "period", "pcod", "ttc", "menopause"].map((c) => <option key={c} value={c}>{GOAL_LABEL[c]}</option>)}
              </Select>
            </Field>
          </div>
        </Card>

        <Card className="space-y-4">
          <h2 className="font-semibold text-ova-900">3. Pre-consultation form</h2>
          <Field label="What is your main concern? *"><Textarea value={pre.symptoms} onChange={(e) => setPre({ ...pre, symptoms: e.target.value })} placeholder="e.g. Irregular periods for 6 months, acne" /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Since when?"><Input value={pre.duration} onChange={(e) => setPre({ ...pre, duration: e.target.value })} placeholder="e.g. 3 months" /></Field>
            <Field label="Allergies"><Input value={pre.allergies} onChange={(e) => setPre({ ...pre, allergies: e.target.value })} placeholder="None" /></Field>
            <Field label="Medical history"><Input value={pre.history} onChange={(e) => setPre({ ...pre, history: e.target.value })} placeholder="Thyroid, diabetes, surgeries…" /></Field>
            <Field label="Current medicines"><Input value={pre.medications} onChange={(e) => setPre({ ...pre, medications: e.target.value })} placeholder="Names & doses" /></Field>
          </div>
          <label className="flex items-start gap-3 rounded-xl bg-ova-50 p-3 text-sm">
            <input type="checkbox" checked={share} onChange={(e) => setShare(e.target.checked)} className="mt-0.5 accent-ova-600" />
            <span><b>Share my cycle summary</b> with this doctor (average cycle {tracker.stats.avgCycle} days, recent cycles, top symptoms and any flags).</span>
          </label>
          <label className="flex items-start gap-3 rounded-xl border border-ova-100 p-3 text-sm">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 accent-ova-600" />
            <span>I consent to a teleconsultation. I understand that the doctor may advise an in-person visit if needed, and that this service is not for emergencies. *</span>
          </label>
          {error && <Alert tone="urgent">{error}</Alert>}
          <Button onClick={book} loading={busy} className="w-full sm:w-auto">
            Confirm booking {slot ? `· ${slot.toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}` : ""}
          </Button>
          <p className="text-xs text-slate-500">Payments are switched off during beta — consultations are free for testers.</p>
        </Card>
      </div>
    </div>
  );
}

export default function BookPage() {
  return <Suspense fallback={<Spinner />}><Booking /></Suspense>;
}

