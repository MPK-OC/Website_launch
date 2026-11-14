"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Siren, Stethoscope } from "lucide-react";
import { supabase, track } from "@/lib/supabase";
import { addDays, fmtDate, todayISO } from "@/lib/dates";
import { menoBand, MENO_LIFESTYLE, MENO_SYMPTOMS, SEVERITY } from "@/lib/constants";
import { monthsBetween } from "@/lib/cycle";
import { useUser } from "@/components/UserProvider";
import { Alert, Button, Card, cx, Disclaimer, LinkButton, PageHeader, Spinner, Stat, Textarea } from "@/components/ui";

interface MLog { log_date: string; symptoms: Record<string, number>; score: number; bleeding: boolean; notes: string | null }

export default function Menopause() {
  const { user, profile, refreshProfile } = useUser();
  const today = todayISO();
  const [logs, setLogs] = useState<MLog[]>([]);
  const [lastPeriod, setLastPeriod] = useState<string | null>(null);
  const [sev, setSev] = useState<Record<string, number>>({});
  const [bleeding, setBleeding] = useState(false);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    const sb = supabase();
    const [l, cp, pr] = await Promise.all([
      sb.from("menopause_logs").select("*").eq("user_id", user.id).gte("log_date", addDays(today, -90)).order("log_date"),
      sb.from("cycle_profiles").select("last_period_start").eq("user_id", user.id).maybeSingle(),
      sb.from("periods").select("start_date").eq("user_id", user.id).order("start_date", { ascending: false }).limit(1),
    ]);
    const rows = (l.data ?? []) as MLog[];
    setLogs(rows);
    setLastPeriod(pr.data?.[0]?.start_date ?? cp.data?.last_period_start ?? null);
    const todays = rows.find((r) => r.log_date === today);
    if (todays) { setSev(todays.symptoms); setBleeding(todays.bleeding); setNotes(todays.notes ?? ""); }
    setLoading(false);
  }, [user, today]);
  useEffect(() => { load(); }, [load]);

  const score = Object.values(sev).reduce((a, b) => a + b, 0);
  const monthsSince = lastPeriod ? monthsBetween(lastPeriod, today) : null;
  const postmenopausal = monthsSince !== null && monthsSince >= 12;
  const stage = monthsSince === null ? "Not sure" : postmenopausal ? "Postmenopause (12+ months without a period)" : "Perimenopause / menopause transition";

  const trend = useMemo(() => {
    const weeks: { label: string; avg: number }[] = [];
    for (let w = 7; w >= 0; w--) {
      const from = addDays(today, -7 * (w + 1) + 1), to = addDays(today, -7 * w);
      const inW = logs.filter((l) => l.log_date >= from && l.log_date <= to);
      weeks.push({ label: fmtDate(from), avg: inW.length ? inW.reduce((s, l) => s + l.score, 0) / inW.length : -1 });
    }
    return weeks;
  }, [logs, today]);

  const perSymptom = useMemo(() => MENO_SYMPTOMS.map(([k, l]) => {
    const recent = logs.slice(-14);
    return { k, l, avg: recent.length ? recent.reduce((s, r) => s + (r.symptoms[k] ?? 0), 0) / recent.length : 0 };
  }), [logs]);

  if (loading || !profile) return <Spinner />;

  async function save() {
    setBusy(true);
    const sb = supabase();
    await sb.from("menopause_logs").upsert({ user_id: user!.id, log_date: today, symptoms: sev, score, bleeding, notes: notes || null }, { onConflict: "user_id,log_date" });
    if (bleeding && postmenopausal) {
      await sb.from("health_flags").insert({ user_id: user!.id, flag_type: "postmenopausal_bleeding", severity: "urgent", source: "menopause", message: "Bleeding after menopause must always be checked by a doctor. Please book an urgent consultation." });
      await sb.from("notifications").insert({ user_id: user!.id, kind: "red_flag", title: "Please see a doctor about bleeding", body: "Bleeding after menopause needs a prompt check-up.", link: "/consult?context=menopause" });
    }
    if (score >= 16) {
      await sb.from("health_flags").insert({ user_id: user!.id, flag_type: "severe_menopause_symptoms", severity: "warning", source: "menopause", message: "Your menopause symptoms are severe. A specialist can help with effective treatment options." });
    }
    if (profile!.goal_mode !== "menopause") { await sb.from("profiles").update({ goal_mode: "menopause" }).eq("id", user!.id); refreshProfile(); }
    track("menopause_log", { score, bleeding });
    setMsg("Saved today's symptoms.");
    setBusy(false);
    load();
  }

  const band = menoBand(score);
  const maxTrend = 24;

  return (
    <div className="space-y-6">
      <PageHeader title="Menopause care" subtitle="Track symptoms, understand trends, and get expert support" action={<LinkButton href="/consult?context=menopause"><Stethoscope className="size-4" />Menopause consult</LinkButton>} />

      {bleeding && postmenopausal && (
        <Alert tone="urgent" title="Bleeding after menopause">
          <span className="flex items-start gap-2"><Siren className="mt-0.5 size-4 shrink-0" />Any bleeding 12 months or more after your last period should be checked by a doctor promptly. It is often harmless, but needs to be ruled out.</span>
          <div className="mt-2"><LinkButton href="/consult?context=menopause" variant="danger" className="py-1.5 text-xs">Book urgent consultation</LinkButton></div>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Stage (estimate)" value={<span className="text-base">{stage}</span>} sub={lastPeriod ? `Last period ${fmtDate(lastPeriod, { month: "short", year: "numeric" })}` : "Add last period in Profile"} />
        <Stat label="Today's symptom score" value={<span className={band.color}>{score}/24</span>} sub={band.label} />
        <Stat label="Days logged (90d)" value={logs.length} />
      </div>

      <div className="grid gap-5 lg:grid-cols-5">
        <Card className="space-y-4 lg:col-span-3">
          <p className="font-semibold text-ova-900">How are your symptoms today?</p>
          {MENO_SYMPTOMS.map(([k, l]) => (
            <div key={k} className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <span className="w-36 text-sm font-medium text-ova-900">{l}</span>
              <div className="flex flex-1 gap-1.5">
                {SEVERITY.map((s, i) => (
                  <button key={s} onClick={() => setSev({ ...sev, [k]: i })}
                    className={cx("flex-1 rounded-lg border py-1.5 text-xs font-medium",
                      (sev[k] ?? 0) === i ? ["border-slate-400 bg-slate-100", "border-emerald-500 bg-emerald-100 text-emerald-800", "border-amber-500 bg-amber-100 text-amber-800", "border-rose-500 bg-rose-100 text-rose-800"][i] : "border-ova-100")}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <label className="flex items-center gap-3 rounded-xl border border-rose-100 bg-rose-50/50 p-3 text-sm">
            <input type="checkbox" checked={bleeding} onChange={(e) => setBleeding(e.target.checked)} className="accent-rose-600" />
            I had bleeding or spotting today
          </label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (triggers, sleep, mood)…" />
          <div className="flex items-center gap-3">
            <Button onClick={save} loading={busy}>Save today</Button>
            {msg && <span className="text-sm text-emerald-700">{msg}</span>}
          </div>
          <p className={cx("text-sm", band.color)}>{band.advice}</p>
        </Card>

        <div className="space-y-5 lg:col-span-2">
          <Card>
            <p className="mb-4 font-semibold text-ova-900">Weekly average score</p>
            <div className="flex h-40 items-end gap-2">
              {trend.map((w) => (
                <div key={w.label} className="flex flex-1 flex-col items-center justify-end" style={{ height: "100%" }}>
                  {w.avg >= 0 && <span className="text-[10px] text-slate-500">{w.avg.toFixed(0)}</span>}
                  <div className={cx("w-full rounded-t", w.avg >= 16 ? "bg-rose-400" : w.avg >= 9 ? "bg-amber-400" : "bg-ova-400")} style={{ height: `${Math.max(w.avg, 0) / maxTrend * 100}%`, minHeight: w.avg >= 0 ? 4 : 0 }} />
                  <span className="mt-1 text-[9px] text-slate-400">{w.label}</span>
                </div>
              ))}
            </div>
          </Card>
          <Card>
            <p className="mb-3 font-semibold text-ova-900">Symptoms (last 14 logs)</p>
            <div className="space-y-2">
              {perSymptom.map(({ k, l, avg }) => (
                <div key={k} className="flex items-center gap-2 text-xs">
                  <span className="w-28 shrink-0">{l}</span>
                  <div className="h-2 flex-1 rounded-full bg-ova-50"><div className="h-full rounded-full bg-amber-400" style={{ width: `${(avg / 3) * 100}%` }} /></div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-slate-500">This summary is attached automatically when you book a menopause consultation.</p>
          </Card>
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-bold text-ova-900">Lifestyle guidance</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MENO_LIFESTYLE.map(([e, t, d]) => (
            <Card key={t}><span className="text-2xl">{e}</span><p className="mt-2 font-semibold text-ova-900">{t}</p><p className="mt-1 text-sm text-slate-600">{d}</p></Card>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-4 text-sm">
          <Link href="/learn/menopause-stages" className="font-semibold text-ova-600">Stages of menopause →</Link>
          <Link href="/learn/menopause-treatment-options" className="font-semibold text-ova-600">Treatment options incl. HRT →</Link>
          <Link href="/learn/bone-health-after-40" className="font-semibold text-ova-600">Bone health →</Link>
        </div>
      </div>
      <Disclaimer />
    </div>
  );
}
