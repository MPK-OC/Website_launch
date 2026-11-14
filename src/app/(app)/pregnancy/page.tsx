"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Baby, CheckCircle2, Circle, Stethoscope } from "lucide-react";
import { supabase, track } from "@/lib/supabase";
import { addDays, ageFrom, diffDays, fmtDate, parseISO } from "@/lib/dates";
import { TTC_CHECKLIST } from "@/lib/constants";
import { monthsBetween } from "@/lib/cycle";
import { useTracker } from "@/lib/useTracker";
import { useUser } from "@/components/UserProvider";
import { Alert, Button, Card, cx, Disclaimer, LinkButton, PageHeader, Spinner, Stat, Textarea } from "@/components/ui";

interface Journey { id: string; started_on: string; notes: string | null }

function chance(date: string, ovulation: string | null, avgCycle: number) {
  if (!ovulation) return 0;
  // map to the nearest projected ovulation
  let off = diffDays(ovulation, date);
  off = ((off % avgCycle) + avgCycle) % avgCycle;
  if (off > avgCycle / 2) off -= avgCycle;
  if (off === 0) return 4;
  if (off === -1 || off === -2) return 3;
  if (off >= -5 && off <= 1) return 2;
  return 1;
}
const CHANCE = [
  ["", ""], ["Low", "bg-slate-100 text-slate-500"], ["Medium", "bg-emerald-100 text-emerald-700"],
  ["High", "bg-emerald-300 text-emerald-900"], ["Peak", "bg-emerald-600 text-white"],
];

export default function Pregnancy() {
  const { user, profile, refreshProfile } = useUser();
  const t = useTracker();
  const [journey, setJourney] = useState<Journey | null>(null);
  const [check, setCheck] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const sb = supabase();
    const [j, c] = await Promise.all([
      sb.from("ttc_journeys").select("*").eq("user_id", user.id).eq("is_active", true).maybeSingle(),
      sb.from("ttc_checklist").select("item_key,done").eq("user_id", user.id),
    ]);
    setJourney(j.data as Journey | null);
    setNotes(j.data?.notes ?? "");
    setCheck(Object.fromEntries((c.data ?? []).map((r) => [r.item_key, r.done])));
    setLoading(false);
  }, [user]);
  useEffect(() => { load(); }, [load]);

  if (loading || t.loading || !profile) return <Spinner />;

  async function start() {
    await supabase().from("ttc_journeys").insert({ user_id: user!.id });
    await supabase().from("profiles").update({ goal_mode: "ttc" }).eq("id", user!.id);
    track("ttc_mode_on");
    await refreshProfile();
    load();
  }
  async function stop(reason: string) {
    await supabase().from("ttc_journeys").update({ is_active: false, notes: `${notes}\n[Ended: ${reason}]`.trim() }).eq("id", journey!.id);
    await supabase().from("profiles").update({ goal_mode: "track" }).eq("id", user!.id);
    track("ttc_mode_off", { reason });
    await refreshProfile();
    load();
  }
  async function toggle(k: string) {
    const done = !check[k];
    setCheck({ ...check, [k]: done });
    await supabase().from("ttc_checklist").upsert({ user_id: user!.id, item_key: k, done, done_at: done ? new Date().toISOString() : null });
  }
  async function saveNotes() {
    await supabase().from("ttc_journeys").update({ notes }).eq("id", journey!.id);
    setSaved(true); setTimeout(() => setSaved(false), 2000);
  }

  if (!journey) return (
    <div className="space-y-6">
      <PageHeader title="Pregnancy planning" subtitle="Prepare your body and know your best days to conceive" />
      <Card className="flex flex-col items-center gap-4 py-10 text-center">
        <div className="grid size-16 place-items-center rounded-full bg-sky-100"><Baby className="size-8 text-sky-700" /></div>
        <p className="text-xl font-bold text-ova-900">Switch to Trying to Conceive mode</p>
        <p className="max-w-md text-sm text-slate-600">Get a day-by-day fertile window, log ovulation tests, follow a preconception checklist and track your journey.</p>
        <Button onClick={start}>Turn on TTC mode</Button>
      </Card>
      <Disclaimer />
    </div>
  );

  const s = t.stats;
  const months = monthsBetween(journey.started_on, t.today);
  const age = ageFrom(profile.date_of_birth);
  const seekHelp = (age && age >= 35 && months >= 6) || months >= 12;
  const days = Array.from({ length: 14 }, (_, i) => addDays(t.today, i));
  const doneCount = TTC_CHECKLIST.filter(([k]) => check[k]).length;
  const posTests = t.logs.filter((l) => l.ovulation_test === "positive" && l.log_date >= journey.started_on).length;

  return (
    <div className="space-y-6">
      <PageHeader title="Pregnancy planning" subtitle={`Trying to conceive since ${fmtDate(journey.started_on, { day: "numeric", month: "short", year: "numeric" })}`}
        action={<LinkButton href={`/tracker/log?date=${t.today}`} variant="secondary">Log ovulation test</LinkButton>} />

      {seekHelp && (
        <Alert tone="warning" title="It may be time to talk to a fertility doctor">
          Doctors recommend a check-up after 12 months of trying (or 6 months if you are over 35). This is common and very treatable.
          <div className="mt-2"><LinkButton href="/consult?context=ttc" className="py-1.5 text-xs">Book a preconception consultation</LinkButton></div>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-4">
        <Stat label="Months trying" value={months} />
        <Stat label="Next ovulation (est.)" value={fmtDate(s.ovulation)} sub={s.confidence + " confidence"} />
        <Stat label="Fertile window" value={s.fertileStart ? `${fmtDate(s.fertileStart)}–${fmtDate(s.fertileEnd)}` : "—"} />
        <Stat label="Positive OPKs" value={posTests} sub="since you started" />
      </div>

      <Card>
        <p className="mb-3 font-semibold text-ova-900">Your next 14 days</p>
        <div className="grid grid-cols-7 gap-2">
          {days.map((d) => {
            const c = chance(d, s.ovulation, s.avgCycle);
            const log = t.logMap.get(d);
            return (
              <div key={d} className={cx("rounded-xl p-2 text-center", CHANCE[c][1])}>
                <p className="text-[10px] uppercase opacity-80">{parseISO(d).toLocaleDateString("en-IN", { weekday: "short" })}</p>
                <p className="text-lg font-bold">{parseISO(d).getDate()}</p>
                <p className="text-[10px] font-semibold">{CHANCE[c][0]}</p>
                {log?.ovulation_test === "positive" && <p className="text-[10px]">OPK +</p>}
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-slate-500">Chance of conception by day (estimate). Sex every 1–2 days during the green days gives the best chances. A positive ovulation test usually means ovulation in the next 12–36 hours.</p>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <p className="font-semibold text-ova-900">Preconception checklist</p>
            <span className="text-sm text-slate-500">{doneCount}/{TTC_CHECKLIST.length}</span>
          </div>
          <div className="space-y-2">
            {TTC_CHECKLIST.map(([k, label, hint]) => (
              <button key={k} onClick={() => toggle(k)} className="flex w-full items-start gap-3 rounded-xl p-2 text-left hover:bg-ova-50">
                {check[k] ? <CheckCircle2 className="size-5 shrink-0 text-emerald-600" /> : <Circle className="size-5 shrink-0 text-ova-300" />}
                <span><span className={cx("block text-sm font-medium", check[k] && "text-slate-400 line-through")}>{label}</span><span className="text-xs text-slate-500">{hint}</span></span>
              </button>
            ))}
          </div>
        </Card>
        <div className="space-y-5">
          <Card className="space-y-3">
            <p className="font-semibold text-ova-900">Journey notes</p>
            <Textarea rows={5} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Cycle observations, questions for your doctor…" />
            <Button variant="secondary" onClick={saveNotes}>{saved ? "Saved ✓" : "Save notes"}</Button>
          </Card>
          <Card className="space-y-3">
            <p className="font-semibold text-ova-900">Talk to a doctor</p>
            <p className="text-sm text-slate-600">A preconception consult reviews your health, medicines and tests. Your cycle data is shared automatically.</p>
            <LinkButton href="/consult?context=ttc"><Stethoscope className="size-4" />Book preconception consult</LinkButton>
            <div className="flex flex-wrap gap-3 pt-1 text-sm">
              <Link href="/learn/how-conception-works" className="font-semibold text-ova-600">How conception works →</Link>
              <Link href="/learn/preconception-checklist" className="font-semibold text-ova-600">Getting ready →</Link>
            </div>
          </Card>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => stop("pregnant")}>🎉 I&apos;m pregnant</Button>
            <Button variant="ghost" onClick={() => stop("paused")}>Pause TTC mode</Button>
          </div>
        </div>
      </div>
      <Disclaimer />
    </div>
  );
}
