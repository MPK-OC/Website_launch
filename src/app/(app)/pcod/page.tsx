"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Dumbbell, Flame, Salad, Stethoscope } from "lucide-react";
import { supabase, track } from "@/lib/supabase";
import { addDays, diffDays, fmtDate, parseISO, todayISO } from "@/lib/dates";
import { DIET, FITNESS, PCOD_QUESTIONS, pcodRisk } from "@/lib/constants";
import { useTracker } from "@/lib/useTracker";
import { useUser } from "@/components/UserProvider";
import { Alert, Badge, Button, Card, Chip, cx, Disclaimer, Field, Input, LinkButton, PageHeader, Select, Spinner, Stat } from "@/components/ui";

interface Plan { id: string; slug: string; title: string; description: string; duration_months: number; price_inr: number; consults_included: number; includes: string[] }
interface Enrollment { id: string; plan_id: string; start_date: string; end_date: string; diet_preference: "veg" | "eggetarian" | "non_veg"; fitness_level: "beginner" | "intermediate" | "advanced"; minutes_per_day: number; care_plans: Plan }
interface Assessment { score: number; risk_level: string; recommendation: string; created_at: string }
interface Checkin { checkin_date: string; diet_done: boolean; workout_done: boolean; water_done: boolean; sleep_done: boolean }
interface Progress { entry_date: string; weight_kg: number | null; waist_cm: number | null }

export default function PcodPage() {
  const { user } = useUser();
  const t = useTracker();
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [enr, setEnr] = useState<Enrollment | null>(null);
  const [assess, setAssess] = useState<Assessment | null>(null);
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [progress, setProgress] = useState<Progress[]>([]);
  const [adjustments, setAdjustments] = useState<{ note: string; created_at: string }[]>([]);
  const [takingQuiz, setTakingQuiz] = useState(false);
  const today = todayISO();

  const load = useCallback(async () => {
    if (!user) return;
    const sb = supabase();
    const [pl, en, as, pr] = await Promise.all([
      sb.from("care_plans").select("*").eq("is_active", true).order("duration_months"),
      sb.from("plan_enrollments").select("*,care_plans(*)").eq("user_id", user.id).eq("status", "active").maybeSingle(),
      sb.from("assessments").select("*").eq("user_id", user.id).eq("assessment_type", "pcod").order("created_at", { ascending: false }).limit(1),
      sb.from("progress_entries").select("*").eq("user_id", user.id).order("entry_date"),
    ]);
    setPlans((pl.data ?? []) as Plan[]);
    setEnr(en.data as unknown as Enrollment | null);
    setAssess((as.data?.[0] as Assessment) ?? null);
    setProgress((pr.data ?? []) as Progress[]);
    if (en.data) {
      const [ck, ad] = await Promise.all([
        sb.from("plan_checkins").select("*").eq("enrollment_id", en.data.id).order("checkin_date"),
        sb.from("plan_adjustments").select("note,created_at").eq("enrollment_id", en.data.id).order("created_at", { ascending: false }),
      ]);
      setCheckins((ck.data ?? []) as Checkin[]);
      setAdjustments(ad.data ?? []);
    }
    setLoading(false);
  }, [user]);
  useEffect(() => { load(); }, [load]);

  if (loading || t.loading) return <Spinner />;

  return (
    <div className="space-y-6">
      <PageHeader title="PCOD care" subtitle="A guided programme — doctor follow-ups, Indian diet, home fitness and progress tracking" />
      {takingQuiz ? (
        <Quiz onDone={async () => { setTakingQuiz(false); await load(); }} />
      ) : enr ? (
        <Programme enr={enr} checkins={checkins} progress={progress} adjustments={adjustments} today={today} reload={load} cycle={t.stats} />
      ) : (
        <>
          {assess ? (
            <Card className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="flex-1">
                <p className="text-sm text-slate-500">Your PCOD screening · {fmtDate(assess.created_at.slice(0, 10))}</p>
                <p className="mt-1 text-lg font-bold text-ova-900">
                  Likelihood: <span className={assess.risk_level === "high" ? "text-rose-600" : assess.risk_level === "moderate" ? "text-amber-600" : "text-emerald-600"}>{assess.risk_level}</span>
                </p>
                <p className="mt-1 text-sm text-slate-700">{assess.recommendation}</p>
              </div>
              <div className="flex shrink-0 flex-col gap-2">
                <LinkButton href="/consult?context=pcod"><Stethoscope className="size-4" />Consult a gynaecologist</LinkButton>
                <Button variant="ghost" onClick={() => setTakingQuiz(true)}>Retake check</Button>
              </div>
            </Card>
          ) : (
            <Card className="bg-gradient-to-br from-emerald-50 to-ova-50">
              <p className="text-lg font-bold text-ova-900">Not sure if you have PCOD?</p>
              <p className="mt-1 text-sm text-slate-700">Take a 2-minute symptom check. It doesn&apos;t diagnose — it helps you decide whether to see a doctor.</p>
              <Button className="mt-4" onClick={() => setTakingQuiz(true)}>Start PCOD check</Button>
            </Card>
          )}
          <h2 className="pt-2 text-xl font-bold text-ova-900">Care plans</h2>
          <div className="grid gap-5 md:grid-cols-2">
            {plans.map((p) => <PlanCard key={p.id} plan={p} onEnrolled={load} />)}
          </div>
          <Link href="/learn?segment=pcod" className="block text-sm font-semibold text-ova-600">📚 Read: PCOD basics, myths and the PCOD-friendly Indian plate →</Link>
        </>
      )}
      <Disclaimer />
    </div>
  );
}

function Quiz({ onDone }: { onDone: () => void }) {
  const { user } = useUser();
  const [answers, setAnswers] = useState<Record<string, boolean>>({});
  const [result, setResult] = useState<ReturnType<typeof pcodRisk> | null>(null);
  const done = PCOD_QUESTIONS.every((q) => q.key in answers);

  async function submit() {
    const score = PCOD_QUESTIONS.reduce((s, q) => s + (answers[q.key] ? q.w : 0), 0);
    const r = pcodRisk(score);
    await supabase().from("assessments").insert({ user_id: user!.id, assessment_type: "pcod", answers, score, risk_level: r.level, recommendation: r.text });
    await supabase().from("health_records").insert({ user_id: user!.id, record_type: "assessment", title: "PCOD symptom check", data: { answers, score, risk_level: r.level }, created_by: user!.id });
    if (r.level === "high") {
      await supabase().from("health_flags").insert({ user_id: user!.id, flag_type: "pcod_screen_high", severity: "warning", source: "pcod", message: "Your PCOD symptom check suggests several common PCOD signs. A gynaecologist can confirm with tests." });
    }
    track("pcod_assessment", { score, level: r.level });
    setResult(r);
  }

  if (result) return (
    <Card className="space-y-4 text-center">
      <p className="text-sm text-slate-500">Your result</p>
      <p className={cx("text-3xl font-extrabold capitalize", result.level === "high" ? "text-rose-600" : result.level === "moderate" ? "text-amber-600" : "text-emerald-600")}>{result.level} likelihood</p>
      <p className="mx-auto max-w-lg text-sm text-slate-700">{result.text}</p>
      <p className="text-xs text-slate-500">This is a screening tool, not a diagnosis.</p>
      <div className="flex justify-center gap-2">
        <LinkButton href="/consult?context=pcod">Consult a doctor</LinkButton>
        <Button variant="secondary" onClick={onDone}>See care plans</Button>
      </div>
    </Card>
  );

  return (
    <Card className="space-y-4">
      <p className="text-lg font-bold text-ova-900">PCOD symptom check</p>
      {PCOD_QUESTIONS.map((q, i) => (
        <div key={q.key} className="flex flex-col gap-2 border-b border-ova-50 pb-3 sm:flex-row sm:items-center">
          <p className="flex-1 text-sm text-ova-900">{i + 1}. {q.q}</p>
          <div className="flex gap-2">
            <Chip active={answers[q.key] === true} onClick={() => setAnswers({ ...answers, [q.key]: true })}>Yes</Chip>
            <Chip active={answers[q.key] === false} onClick={() => setAnswers({ ...answers, [q.key]: false })}>No</Chip>
          </div>
        </div>
      ))}
      <Button onClick={submit} disabled={!done}>See my result</Button>
    </Card>
  );
}

function PlanCard({ plan, onEnrolled }: { plan: Plan; onEnrolled: () => void }) {
  const { user } = useUser();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ diet_preference: "veg", fitness_level: "beginner", minutes_per_day: 20 });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function enroll() {
    setBusy(true);
    const start = todayISO();
    const end = parseISO(start); end.setMonth(end.getMonth() + plan.duration_months);
    const { error } = await supabase().from("plan_enrollments").insert({
      user_id: user!.id, plan_id: plan.id, start_date: start, end_date: end.toISOString().slice(0, 10), ...f,
    });
    if (error) { setBusy(false); return setErr(error.message); }
    await supabase().from("profiles").update({ goal_mode: "pcod" }).eq("id", user!.id);
    await supabase().from("notifications").insert({ user_id: user!.id, kind: "plan_task", title: `Welcome to ${plan.title}`, body: "Book your initial consultation to get started.", link: "/consult?context=pcod" });
    track("plan_enrolled", { plan: plan.slug });
    onEnrolled();
  }

  return (
    <Card className="flex flex-col">
      <Badge tone="green" className="self-start">{plan.duration_months} months</Badge>
      <p className="mt-2 text-xl font-bold text-ova-900">{plan.title}</p>
      <p className="mt-1 text-sm text-slate-600">{plan.description}</p>
      <ul className="mt-4 space-y-1.5 text-sm">
        {plan.includes.map((x) => <li key={x} className="flex gap-2"><CheckCircle2 className="size-4 shrink-0 text-emerald-600" />{x}</li>)}
      </ul>
      <p className="mt-4 text-2xl font-bold text-ova-900">₹{plan.price_inr} <span className="text-sm font-normal text-slate-500 line-through">{plan.price_inr + 2000}</span></p>
      {!open ? <Button className="mt-4" onClick={() => setOpen(true)}>Start this plan (free in beta)</Button> : (
        <div className="mt-4 space-y-3 rounded-xl bg-ova-50 p-4">
          <Field label="Diet preference">
            <Select value={f.diet_preference} onChange={(e) => setF({ ...f, diet_preference: e.target.value })}>
              <option value="veg">Vegetarian</option><option value="eggetarian">Eggetarian</option><option value="non_veg">Non-vegetarian</option>
            </Select>
          </Field>
          <Field label="Fitness level">
            <Select value={f.fitness_level} onChange={(e) => setF({ ...f, fitness_level: e.target.value })}>
              <option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option>
            </Select>
          </Field>
          <Field label="Minutes per day for exercise"><Input type="number" min={10} max={90} value={f.minutes_per_day} onChange={(e) => setF({ ...f, minutes_per_day: Number(e.target.value) })} /></Field>
          {err && <Alert tone="urgent">{err}</Alert>}
          <Button onClick={enroll} loading={busy} className="w-full">Confirm & start</Button>
        </div>
      )}
    </Card>
  );
}

function Programme({ enr, checkins, progress, adjustments, today, reload, cycle }: {
  enr: Enrollment; checkins: Checkin[]; progress: Progress[]; adjustments: { note: string; created_at: string }[]; today: string; reload: () => void;
  cycle: ReturnType<typeof useTracker>["stats"];
}) {
  const { user } = useUser();
  const total = diffDays(enr.start_date, enr.end_date);
  const dayN = Math.min(total, diffDays(enr.start_date, today) + 1);
  const meals = DIET[enr.diet_preference][(dayN - 1) % 7];
  const workout = FITNESS[enr.fitness_level][parseISO(today).getDay()];
  const todayCk = checkins.find((c) => c.checkin_date === today);
  const [entry, setEntry] = useState({ weight_kg: "", waist_cm: "" });

  const streak = useMemo(() => {
    const done = new Set(checkins.filter((c) => c.diet_done || c.workout_done || c.water_done || c.sleep_done).map((c) => c.checkin_date));
    let d = done.has(today) ? today : addDays(today, -1), n = 0;
    while (done.has(d)) { n++; d = addDays(d, -1); }
    return n;
  }, [checkins, today]);
  const adherence = useMemo(() => {
    const last7 = checkins.filter((c) => c.checkin_date > addDays(today, -7));
    const diet = last7.filter((c) => c.diet_done).length, work = last7.filter((c) => c.workout_done).length;
    return { diet: Math.round((diet / 7) * 100), work: Math.round((work / 7) * 100) };
  }, [checkins, today]);

  async function toggle(k: keyof Omit<Checkin, "checkin_date">) {
    await supabase().from("plan_checkins").upsert({
      enrollment_id: enr.id, user_id: user!.id, checkin_date: today,
      diet_done: todayCk?.diet_done ?? false, workout_done: todayCk?.workout_done ?? false,
      water_done: todayCk?.water_done ?? false, sleep_done: todayCk?.sleep_done ?? false, [k]: !(todayCk?.[k] ?? false),
    }, { onConflict: "enrollment_id,checkin_date" });
    track("plan_checkin", { item: k });
    reload();
  }
  async function saveProgress() {
    await supabase().from("progress_entries").upsert({
      user_id: user!.id, entry_date: today, weight_kg: entry.weight_kg ? Number(entry.weight_kg) : null, waist_cm: entry.waist_cm ? Number(entry.waist_cm) : null,
    }, { onConflict: "user_id,entry_date" });
    setEntry({ weight_kg: "", waist_cm: "" });
    reload();
  }

  const first = progress.find((p) => p.weight_kg), last = [...progress].reverse().find((p) => p.weight_kg);
  const items: [keyof Omit<Checkin, "checkin_date">, string][] = [["diet_done", "🥗 Followed diet"], ["workout_done", "🏃‍♀️ Did workout"], ["water_done", "💧 8 glasses water"], ["sleep_done", "😴 7+ hours sleep"]];

  return (
    <div className="space-y-5">
      <Card className="bg-gradient-to-r from-ova-600 to-ova-800 text-white">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-ova-100">{enr.care_plans.title}</p>
            <p className="text-2xl font-bold">Day {dayN} of {total}</p>
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-white/15 px-4 py-2"><Flame className="size-5 text-amber-300" /><span className="text-xl font-bold">{streak}</span><span className="text-sm">day streak</span></div>
        </div>
        <div className="mt-4 h-2 rounded-full bg-white/20"><div className="h-full rounded-full bg-blush-300" style={{ width: `${(dayN / total) * 100}%` }} /></div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <p className="mb-3 flex items-center gap-2 font-semibold text-ova-900"><Salad className="size-5 text-emerald-600" />Today&apos;s meals</p>
          <dl className="space-y-2.5 text-sm">
            {Object.entries(meals).map(([k, v]) => <div key={k} className="flex gap-3"><dt className="w-20 shrink-0 capitalize text-slate-500">{k}</dt><dd className="text-ova-900">{v}</dd></div>)}
          </dl>
          <p className="mt-3 text-xs text-slate-500">Low-GI, Indian. Adjust portions to hunger; avoid sugar, maida and fried snacks.</p>
        </Card>
        <Card>
          <p className="mb-1 flex items-center gap-2 font-semibold text-ova-900"><Dumbbell className="size-5 text-ova-600" />Today: {workout.title}</p>
          <p className="mb-3 text-xs text-slate-500">{enr.fitness_level} · about {enr.minutes_per_day} min</p>
          <ul className="space-y-1.5 text-sm">{workout.items.map((x) => <li key={x} className="flex gap-2"><span className="text-ova-400">•</span>{x}</li>)}</ul>
        </Card>
      </div>

      <Card>
        <p className="mb-3 font-semibold text-ova-900">Daily check-in</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {items.map(([k, l]) => (
            <button key={k} onClick={() => toggle(k)} className={cx("rounded-xl border p-3 text-sm font-medium transition", todayCk?.[k] ? "border-emerald-500 bg-emerald-50 text-emerald-800" : "border-ova-100 hover:border-ova-300")}>
              {l} {todayCk?.[k] && "✓"}
            </button>
          ))}
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-4">
        <Stat label="Diet adherence (7d)" value={`${adherence.diet}%`} />
        <Stat label="Workout adherence (7d)" value={`${adherence.work}%`} />
        <Stat label="Weight change" value={first && last ? `${(Number(last.weight_kg) - Number(first.weight_kg)).toFixed(1)} kg` : "—"} sub={last ? `Now ${last.weight_kg} kg` : "Log below"} />
        <Stat label="Cycle regularity" value={`${cycle.avgCycle} d`} sub={cycle.variability ? `varies ±${cycle.variability} d` : "keep logging periods"} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <p className="mb-3 font-semibold text-ova-900">Weekly progress</p>
          <div className="flex gap-2">
            <Input type="number" step="0.1" placeholder="Weight (kg)" value={entry.weight_kg} onChange={(e) => setEntry({ ...entry, weight_kg: e.target.value })} />
            <Input type="number" step="0.5" placeholder="Waist (cm)" value={entry.waist_cm} onChange={(e) => setEntry({ ...entry, waist_cm: e.target.value })} />
            <Button onClick={saveProgress} disabled={!entry.weight_kg && !entry.waist_cm}>Save</Button>
          </div>
          <table className="mt-4 w-full text-sm">
            <thead><tr className="text-left text-xs text-slate-500"><th className="py-1">Date</th><th>Weight</th><th>Waist</th></tr></thead>
            <tbody>{[...progress].reverse().slice(0, 6).map((p) => <tr key={p.entry_date} className="border-t border-ova-50"><td className="py-1.5">{fmtDate(p.entry_date)}</td><td>{p.weight_kg ?? "—"} kg</td><td>{p.waist_cm ?? "—"} cm</td></tr>)}</tbody>
          </table>
        </Card>
        <Card className="space-y-3">
          <p className="font-semibold text-ova-900">Doctor follow-ups</p>
          <p className="text-sm text-slate-600">Your plan includes {enr.care_plans.consults_included} consultations. Your doctor reviews progress and adjusts your plan.</p>
          <LinkButton href="/consult?context=pcod"><Stethoscope className="size-4" />Book consultation</LinkButton>
          {adjustments.length > 0 && (
            <div className="space-y-2 pt-2">
              <p className="text-sm font-semibold text-ova-900">Doctor-approved changes</p>
              {adjustments.map((a, i) => <Alert key={i} tone="info">{a.note} <span className="block text-xs opacity-70">{fmtDate(a.created_at.slice(0, 10))}</span></Alert>)}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
