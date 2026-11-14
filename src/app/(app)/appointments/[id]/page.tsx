"use client";
import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { CalendarClock, ExternalLink, Printer, Video } from "lucide-react";
import { supabase, track } from "@/lib/supabase";
import { fmtDate, fmtDateTime } from "@/lib/dates";
import { GOAL_LABEL } from "@/lib/constants";
import { useUser } from "@/components/UserProvider";
import { Chat } from "@/components/Chat";
import { DoctorAvatar } from "@/components/doctor";
import { Alert, Badge, Button, Card, LinkButton, Spinner, Textarea } from "@/components/ui";

const STATUS_TONE: Record<string, "ova" | "green" | "amber" | "red" | "gray"> = {
  requested: "amber", confirmed: "ova", in_progress: "green", completed: "green", cancelled: "gray", no_show: "red",
};

interface Appt {
  id: string; doctor_id: string; scheduled_at: string; duration_minutes: number; mode: string; status: string; context: string;
  meeting_url: string; fee: number; pre_consult: Record<string, string>; cancel_reason: string | null;
  doctors: { full_name: string; qualification: string; gender: string; registration_number: string; medical_council: string } | null;
}
interface Notes { chief_complaint: string | null; findings: string | null; diagnosis: string | null; advice: string | null; follow_up_date: string | null }
interface Rx { medicines: { name: string; dose: string; frequency: string; duration: string; notes?: string }[]; investigations: string | null; instructions: string | null; created_at: string }

function Detail() {
  const { id } = useParams<{ id: string }>();
  const booked = useSearchParams().get("booked");
  const { user } = useUser();
  const [a, setA] = useState<Appt | null>(null);
  const [notes, setNotes] = useState<Notes | null>(null);
  const [rx, setRx] = useState<Rx | null>(null);
  const [reviewed, setReviewed] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const sb = supabase();
    const [ap, nt, pr, rv] = await Promise.all([
      sb.from("appointments").select("*,doctors(full_name,qualification,gender,registration_number,medical_council)").eq("id", id).single(),
      sb.from("my_consultation_notes").select("*").eq("appointment_id", id).maybeSingle(),
      sb.from("prescriptions").select("*").eq("appointment_id", id).maybeSingle(),
      sb.from("reviews").select("id").eq("appointment_id", id).maybeSingle(),
    ]);
    setA(ap.data as unknown as Appt);
    setNotes(nt.data as Notes | null);
    setRx(pr.data as Rx | null);
    setReviewed(!!rv.data);
  }, [id]);
  useEffect(() => { load(); }, [load]);

  if (!a) return <Spinner />;
  const start = new Date(a.scheduled_at).getTime();
  const joinable = ["confirmed", "in_progress"].includes(a.status) && Date.now() > start - 10 * 60000 && Date.now() < start + 90 * 60000;
  const cancellable = ["confirmed", "requested"].includes(a.status) && start > Date.now() + 60 * 60000;

  async function cancel() {
    setBusy(true);
    await supabase().from("appointments").update({ status: "cancelled", cancel_reason: "Cancelled by patient" }).eq("id", id);
    track("appointment_cancelled");
    await load();
    setBusy(false);
  }
  async function submitReview() {
    setBusy(true);
    await supabase().from("reviews").insert({ appointment_id: id, user_id: user!.id, doctor_id: a!.doctor_id, rating, comment: comment || null });
    track("review_submitted", { rating });
    setReviewed(true);
    setBusy(false);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      {booked && <Alert tone="success" title="Consultation booked 🎉">You&apos;ll find a reminder in notifications. Join from this page at the scheduled time.</Alert>}

      <Card className="flex flex-col gap-4 sm:flex-row sm:items-center">
        {a.doctors && <DoctorAvatar d={a.doctors} size="size-16" />}
        <div className="flex-1">
          <p className="text-lg font-bold text-ova-900">{a.doctors?.full_name}</p>
          <p className="text-sm text-slate-600">{a.doctors?.qualification}</p>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-ova-800"><CalendarClock className="size-4" />{fmtDateTime(a.scheduled_at)} · {a.duration_minutes} min · <span className="capitalize">{a.mode}</span></p>
        </div>
        <Badge tone={STATUS_TONE[a.status]} className="capitalize">{a.status.replace("_", " ")}</Badge>
      </Card>

      {["confirmed", "in_progress"].includes(a.status) && (
        <Card className="space-y-3">
          {a.mode !== "chat" && (
            <div className="flex flex-wrap items-center gap-3">
              <a href={joinable ? a.meeting_url : undefined} target="_blank" rel="noreferrer"
                className={`inline-flex items-center gap-2 rounded-xl px-5 py-3 font-semibold ${joinable ? "bg-ova-600 text-white hover:bg-ova-700" : "pointer-events-none bg-ova-100 text-ova-400"}`}>
                <Video className="size-5" />Join {a.mode} call<ExternalLink className="size-4" />
              </a>
              <p className="text-sm text-slate-600">{joinable ? "Your doctor will join shortly." : "The join button activates 10 minutes before your slot."}</p>
            </div>
          )}
          <p className="text-sm font-semibold text-ova-900">{a.mode === "chat" ? "Consultation chat" : "Chat (if your connection is weak)"}</p>
          <Chat appointmentId={a.id} />
          <div className="flex flex-wrap gap-2">
            {cancellable && <LinkButton href={`/consult/${a.doctor_id}?reschedule=${a.id}&context=${a.context}`} variant="secondary">Reschedule</LinkButton>}
            {cancellable && <Button variant="ghost" onClick={cancel} loading={busy} className="text-rose-600">Cancel booking</Button>}
          </div>
        </Card>
      )}

      {a.status === "cancelled" && <Alert tone="info">This consultation was cancelled{a.cancel_reason ? ` — ${a.cancel_reason}` : ""}.</Alert>}

      <Card>
        <p className="mb-2 font-semibold text-ova-900">Your pre-consultation details</p>
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div><dt className="text-slate-500">Reason</dt><dd>{GOAL_LABEL[a.context]}</dd></div>
          {Object.entries(a.pre_consult).filter(([, v]) => v).map(([k, v]) => (
            <div key={k}><dt className="capitalize text-slate-500">{k}</dt><dd>{v}</dd></div>
          ))}
        </dl>
      </Card>

      {(notes || rx) && (
        <Card className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-lg font-bold text-ova-900">Consultation summary</p>
            <Button variant="secondary" onClick={() => window.print()} className="no-print"><Printer className="size-4" />Print</Button>
          </div>
          {notes && (
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              {notes.chief_complaint && <div><dt className="text-slate-500">Chief complaint</dt><dd>{notes.chief_complaint}</dd></div>}
              {notes.diagnosis && <div><dt className="text-slate-500">Provisional diagnosis</dt><dd>{notes.diagnosis}</dd></div>}
              {notes.findings && <div><dt className="text-slate-500">Findings</dt><dd>{notes.findings}</dd></div>}
              {notes.advice && <div className="sm:col-span-2"><dt className="text-slate-500">Advice</dt><dd className="whitespace-pre-line">{notes.advice}</dd></div>}
              {notes.follow_up_date && <div><dt className="text-slate-500">Follow-up</dt><dd className="font-semibold">{fmtDate(notes.follow_up_date, { day: "numeric", month: "long", year: "numeric" })} · <Link className="text-ova-600 underline" href={`/consult/${a.doctor_id}`}>Book follow-up</Link></dd></div>}
            </dl>
          )}
          {rx && (
            <div className="rounded-xl border border-ova-100 p-4">
              <p className="font-semibold text-ova-900">℞ E-prescription</p>
              <table className="mt-2 w-full text-sm">
                <thead><tr className="text-left text-xs text-slate-500"><th className="py-1">Medicine</th><th>Dose</th><th>Frequency</th><th>Duration</th></tr></thead>
                <tbody>{rx.medicines.map((m, i) => <tr key={i} className="border-t border-ova-50"><td className="py-1.5 font-medium">{m.name}</td><td>{m.dose}</td><td>{m.frequency}</td><td>{m.duration}</td></tr>)}</tbody>
              </table>
              {rx.investigations && <p className="mt-3 text-sm"><span className="text-slate-500">Tests advised:</span> {rx.investigations}</p>}
              {rx.instructions && <p className="mt-1 text-sm"><span className="text-slate-500">Instructions:</span> {rx.instructions}</p>}
              <p className="mt-3 text-xs text-slate-500">{a.doctors?.full_name} · Reg. {a.doctors?.registration_number} ({a.doctors?.medical_council})</p>
            </div>
          )}
        </Card>
      )}

      {a.status === "completed" && !reviewed && (
        <Card className="space-y-3">
          <p className="font-semibold text-ova-900">How was your consultation?</p>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => <button key={n} onClick={() => setRating(n)} className={`text-3xl ${n <= rating ? "text-amber-400" : "text-slate-200"}`} aria-label={`${n} stars`}>★</button>)}
          </div>
          <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Share feedback (optional)" />
          <Button onClick={submitReview} disabled={!rating} loading={busy}>Submit review</Button>
        </Card>
      )}
      {reviewed && <Alert tone="success">Thank you for your feedback!</Alert>}
    </div>
  );
}

export default function AppointmentPage() {
  return <Suspense fallback={<Spinner />}><Detail /></Suspense>;
}
