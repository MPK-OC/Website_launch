"use client";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ExternalLink, Plus, Trash2, Video } from "lucide-react";
import { supabase, track } from "@/lib/supabase";
import { ageFrom, fmtDate, fmtDateTime } from "@/lib/dates";
import { GOAL_LABEL, MENO_SYMPTOMS, SYMPTOMS } from "@/lib/constants";
import { useMyDoctor } from "@/lib/useDoctor";
import { Chat } from "@/components/Chat";
import { Alert, Badge, Button, Card, Field, Input, PageHeader, Spinner, Textarea } from "@/components/ui";

interface Appt {
  id: string; user_id: string; scheduled_at: string; mode: string; status: string; context: string; meeting_url: string;
  pre_consult: Record<string, string>; shared_snapshot: Record<string, unknown> | null;
  profiles: { full_name: string | null; date_of_birth: string | null; phone: string | null } | null;
}
type Med = { name: string; dose: string; frequency: string; duration: string };
const EMPTY_MED: Med = { name: "", dose: "", frequency: "", duration: "" };

export default function DoctorConsult() {
  const { id } = useParams<{ id: string }>();
  const { doctor } = useMyDoctor();
  const [a, setA] = useState<Appt | null>(null);
  const [history, setHistory] = useState<{ id: string; scheduled_at: string; status: string; context: string }[]>([]);
  const [assessments, setAssessments] = useState<{ assessment_type: string; score: number; risk_level: string; created_at: string }[]>([]);
  const [meno, setMeno] = useState<{ log_date: string; score: number; symptoms: Record<string, number> }[]>([]);
  const [enrollment, setEnrollment] = useState<{ id: string; care_plans: { title: string }; start_date: string } | null>(null);
  const [notes, setNotes] = useState({ chief_complaint: "", findings: "", diagnosis: "", advice: "", follow_up_date: "", private_notes: "" });
  const [meds, setMeds] = useState<Med[]>([{ ...EMPTY_MED }]);
  const [rx, setRx] = useState({ investigations: "", instructions: "" });
  const [rxSaved, setRxSaved] = useState(false);
  const [adjust, setAdjust] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const sb = supabase();
    const { data } = await sb.from("appointments").select("*,profiles(full_name,date_of_birth,phone)").eq("id", id).single();
    const ap = data as unknown as Appt;
    setA(ap);
    if (!ap) return;
    const [h, as, mn, en, nt, pr] = await Promise.all([
      sb.from("appointments").select("id,scheduled_at,status,context").eq("user_id", ap.user_id).neq("id", id).order("scheduled_at", { ascending: false }).limit(5),
      sb.from("assessments").select("assessment_type,score,risk_level,created_at").eq("user_id", ap.user_id).order("created_at", { ascending: false }).limit(3),
      sb.from("menopause_logs").select("log_date,score,symptoms").eq("user_id", ap.user_id).order("log_date", { ascending: false }).limit(14),
      sb.from("plan_enrollments").select("id,start_date,care_plans(title)").eq("user_id", ap.user_id).eq("status", "active").maybeSingle(),
      sb.from("consultation_notes").select("*").eq("appointment_id", id).maybeSingle(),
      sb.from("prescriptions").select("*").eq("appointment_id", id).maybeSingle(),
    ]);
    setHistory(h.data ?? []);
    setAssessments(as.data ?? []);
    setMeno((mn.data ?? []) as typeof meno);
    setEnrollment(en.data as unknown as typeof enrollment);
    if (nt.data) setNotes({
      chief_complaint: nt.data.chief_complaint ?? "", findings: nt.data.findings ?? "", diagnosis: nt.data.diagnosis ?? "",
      advice: nt.data.advice ?? "", follow_up_date: nt.data.follow_up_date ?? "", private_notes: nt.data.private_notes ?? "",
    });
    else setNotes((n) => ({ ...n, chief_complaint: n.chief_complaint || ap.pre_consult?.symptoms || "" }));
    if (pr.data) { setMeds(pr.data.medicines.length ? pr.data.medicines : [{ ...EMPTY_MED }]); setRx({ investigations: pr.data.investigations ?? "", instructions: pr.data.instructions ?? "" }); setRxSaved(true); }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  if (!a || !doctor) return <Spinner />;
  const snap = a.shared_snapshot as null | { avg_cycle_length: number; avg_period_length: number; last_period_start: string; recent_cycle_lengths: number[]; days_late: number; top_symptoms_60d: [string, number][]; open_flags: string[] };
  const sym = (k: string) => SYMPTOMS.find((s) => s[0] === k)?.[1] ?? k;
  const done = a.status === "completed";

  async function setStatus(status: string) {
    await supabase().from("appointments").update({ status }).eq("id", id);
    load();
  }
  async function saveNotes() {
    setBusy(true);
    const { error } = await supabase().from("consultation_notes").upsert({
      appointment_id: id, doctor_id: doctor!.id, user_id: a!.user_id, ...notes, follow_up_date: notes.follow_up_date || null,
    }, { onConflict: "appointment_id" });
    setBusy(false);
    setMsg(error ? error.message : "Notes saved.");
  }
  async function savePrescription() {
    const medicines = meds.filter((m) => m.name.trim());
    if (!medicines.length && !rx.investigations) return setMsg("Add at least one medicine or test.");
    setBusy(true);
    const { error } = await supabase().from("prescriptions").insert({ appointment_id: id, doctor_id: doctor!.id, user_id: a!.user_id, medicines, ...rx });
    setBusy(false);
    if (error) return setMsg(error.message);
    setRxSaved(true);
    setMsg("Prescription issued and added to the patient's health records.");
  }
  async function complete() {
    setBusy(true);
    await saveNotes();
    const sb = supabase();
    await sb.from("appointments").update({ status: "completed" }).eq("id", id);
    await sb.from("health_records").insert({
      user_id: a!.user_id, record_type: "consult_summary", title: `Consultation summary — ${doctor!.full_name}`, appointment_id: id,
      data: { diagnosis: notes.diagnosis, advice: notes.advice, follow_up_date: notes.follow_up_date || null },
    });
    await sb.from("notifications").insert({ user_id: a!.user_id, kind: "appointment", title: "Your consultation summary is ready", body: notes.follow_up_date ? `Follow-up suggested on ${fmtDate(notes.follow_up_date)}.` : "View advice and prescription.", link: `/appointments/${id}` });
    if (notes.follow_up_date) {
      await sb.from("notifications").insert({ user_id: a!.user_id, kind: "appointment", title: "Time to book your follow-up", body: `${doctor!.full_name} suggested a follow-up around now.`, link: `/consult/${doctor!.id}`, scheduled_for: new Date(notes.follow_up_date + "T09:00:00").toISOString() });
    }
    track("consult_completed", { context: a!.context });
    setBusy(false);
    load();
  }
  async function addAdjustment() {
    if (!adjust.trim() || !enrollment) return;
    const { error } = await supabase().from("plan_adjustments").insert({ enrollment_id: enrollment.id, doctor_id: doctor!.id, note: adjust.trim() });
    if (!error) { setAdjust(""); setMsg("Plan adjustment shared with the patient."); } else setMsg(error.message);
  }

  return (
    <div className="space-y-5">
      <PageHeader title={a.profiles?.full_name ?? "Patient"}
        subtitle={`${ageFrom(a.profiles?.date_of_birth) ?? "?"} yrs · ${GOAL_LABEL[a.context]} · ${fmtDateTime(a.scheduled_at)} · ${a.mode}`}
        action={<Badge tone={done ? "green" : "ova"} className="capitalize">{a.status.replace("_", " ")}</Badge>} />

      {!done && a.status !== "cancelled" && (
        <Card className="flex flex-wrap items-center gap-3">
          {a.mode !== "chat" && (
            <a href={a.meeting_url} target="_blank" rel="noreferrer" onClick={() => a.status === "confirmed" && setStatus("in_progress")}
              className="inline-flex items-center gap-2 rounded-xl bg-ova-600 px-5 py-2.5 font-semibold text-white hover:bg-ova-700">
              <Video className="size-5" />Start {a.mode} call<ExternalLink className="size-4" />
            </a>
          )}
          {a.status === "confirmed" && a.mode === "chat" && <Button onClick={() => setStatus("in_progress")}>Start chat consultation</Button>}
          <Button variant="ghost" onClick={() => setStatus("no_show")}>Mark no-show</Button>
        </Card>
      )}

      <div className="grid gap-5 lg:grid-cols-5">
        <div className="space-y-5 lg:col-span-2">
          <Card>
            <p className="mb-2 font-semibold text-ova-900">Pre-consultation form</p>
            <dl className="space-y-1.5 text-sm">
              {Object.entries(a.pre_consult).filter(([, v]) => v).map(([k, v]) => <div key={k}><dt className="inline capitalize text-slate-500">{k}: </dt><dd className="inline">{v}</dd></div>)}
            </dl>
          </Card>
          <Card>
            <p className="mb-2 font-semibold text-ova-900">Shared cycle summary</p>
            {snap ? (
              <dl className="space-y-1.5 text-sm">
                <div><dt className="inline text-slate-500">Last period: </dt><dd className="inline">{fmtDate(snap.last_period_start, { day: "numeric", month: "short", year: "numeric" })}{snap.days_late ? ` (${snap.days_late} days late)` : ""}</dd></div>
                <div><dt className="inline text-slate-500">Avg cycle / period: </dt><dd className="inline">{snap.avg_cycle_length} d / {snap.avg_period_length} d</dd></div>
                <div><dt className="inline text-slate-500">Recent cycles: </dt><dd className="inline">{snap.recent_cycle_lengths?.join(", ") || "—"}</dd></div>
                <div><dt className="inline text-slate-500">Top symptoms (60d): </dt><dd className="inline">{snap.top_symptoms_60d?.map(([k, n]) => `${sym(k)} ×${n}`).join(", ") || "—"}</dd></div>
                {snap.open_flags?.length > 0 && <Alert tone="warning">{snap.open_flags.map((f) => <p key={f}>• {f}</p>)}</Alert>}
              </dl>
            ) : <p className="text-sm text-slate-500">Patient chose not to share tracker data.</p>}
          </Card>
          {meno.length > 0 && (
            <Card>
              <p className="mb-2 font-semibold text-ova-900">Menopause symptoms (last {meno.length} logs)</p>
              <p className="text-sm">Average score: <b>{(meno.reduce((s, m) => s + m.score, 0) / meno.length).toFixed(1)}/24</b></p>
              <ul className="mt-2 text-xs text-slate-600">
                {MENO_SYMPTOMS.map(([k, l]) => <li key={k}>{l}: {(meno.reduce((s, m) => s + (m.symptoms[k] ?? 0), 0) / meno.length).toFixed(1)}/3</li>)}
              </ul>
            </Card>
          )}
          {(assessments.length > 0 || history.length > 0) && (
            <Card>
              <p className="mb-2 font-semibold text-ova-900">History</p>
              {assessments.map((x, i) => <p key={i} className="text-sm">{x.assessment_type.toUpperCase()} screen: <b className="capitalize">{x.risk_level}</b> ({x.score}) · {fmtDate(x.created_at.slice(0, 10))}</p>)}
              {history.map((h) => <p key={h.id} className="text-sm text-slate-600">{fmtDateTime(h.scheduled_at)} · {GOAL_LABEL[h.context]} · {h.status}</p>)}
            </Card>
          )}
          {enrollment && (
            <Card className="space-y-2">
              <p className="font-semibold text-ova-900">Care plan: {enrollment.care_plans.title}</p>
              <p className="text-xs text-slate-500">Started {fmtDate(enrollment.start_date)}</p>
              <Textarea value={adjust} onChange={(e) => setAdjust(e.target.value)} placeholder="Doctor-approved plan adjustment (e.g. increase walking to 40 min, add inositol)…" />
              <Button variant="secondary" onClick={addAdjustment}>Share adjustment</Button>
            </Card>
          )}
          <Card>
            <p className="mb-2 font-semibold text-ova-900">Chat</p>
            <Chat appointmentId={a.id} disabled={done} />
          </Card>
        </div>

        <div className="space-y-5 lg:col-span-3">
          <Card className="space-y-3">
            <p className="font-semibold text-ova-900">Consultation notes</p>
            <Field label="Chief complaint"><Input value={notes.chief_complaint} onChange={(e) => setNotes({ ...notes, chief_complaint: e.target.value })} /></Field>
            <Field label="Findings"><Textarea value={notes.findings} onChange={(e) => setNotes({ ...notes, findings: e.target.value })} /></Field>
            <Field label="Provisional diagnosis"><Input value={notes.diagnosis} onChange={(e) => setNotes({ ...notes, diagnosis: e.target.value })} /></Field>
            <Field label="Advice to patient"><Textarea value={notes.advice} onChange={(e) => setNotes({ ...notes, advice: e.target.value })} /></Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Follow-up date"><Input type="date" value={notes.follow_up_date} onChange={(e) => setNotes({ ...notes, follow_up_date: e.target.value })} /></Field>
              <Field label="Private notes (not visible to patient)"><Input value={notes.private_notes} onChange={(e) => setNotes({ ...notes, private_notes: e.target.value })} /></Field>
            </div>
            <Button variant="secondary" onClick={saveNotes} loading={busy}>Save notes</Button>
          </Card>

          <Card className="space-y-3">
            <p className="font-semibold text-ova-900">℞ E-prescription {rxSaved && <Badge tone="green">Issued</Badge>}</p>
            {meds.map((m, i) => (
              <div key={i} className="grid grid-cols-2 gap-2 sm:grid-cols-[2fr_1fr_1fr_1fr_auto]">
                <Input disabled={rxSaved} placeholder="Medicine" value={m.name} onChange={(e) => setMeds(meds.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />
                <Input disabled={rxSaved} placeholder="Dose" value={m.dose} onChange={(e) => setMeds(meds.map((x, j) => j === i ? { ...x, dose: e.target.value } : x))} />
                <Input disabled={rxSaved} placeholder="1-0-1" value={m.frequency} onChange={(e) => setMeds(meds.map((x, j) => j === i ? { ...x, frequency: e.target.value } : x))} />
                <Input disabled={rxSaved} placeholder="5 days" value={m.duration} onChange={(e) => setMeds(meds.map((x, j) => j === i ? { ...x, duration: e.target.value } : x))} />
                {!rxSaved && <button onClick={() => setMeds(meds.filter((_, j) => j !== i))} className="text-slate-400 hover:text-rose-600" aria-label="Remove"><Trash2 className="size-4" /></button>}
              </div>
            ))}
            {!rxSaved && <Button variant="ghost" onClick={() => setMeds([...meds, { ...EMPTY_MED }])}><Plus className="size-4" />Add medicine</Button>}
            <Field label="Investigations advised"><Input disabled={rxSaved} value={rx.investigations} onChange={(e) => setRx({ ...rx, investigations: e.target.value })} placeholder="e.g. TSH, fasting insulin, pelvic USG" /></Field>
            <Field label="Instructions"><Textarea disabled={rxSaved} value={rx.instructions} onChange={(e) => setRx({ ...rx, instructions: e.target.value })} /></Field>
            {!rxSaved && <Button onClick={savePrescription} loading={busy}>Issue prescription</Button>}
            <p className="text-xs text-slate-500">Follow Telemedicine Practice Guidelines 2020 — Schedule X / NDPS drugs cannot be prescribed via teleconsultation.</p>
          </Card>

          {msg && <Alert tone="info">{msg}</Alert>}
          {!done && a.status !== "cancelled" && <Button onClick={complete} loading={busy} className="w-full">Complete consultation & send summary</Button>}
        </div>
      </div>
    </div>
  );
}
