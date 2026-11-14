"use client";
import Link from "next/link";
import { useState } from "react";
import { BarChart3, Droplet, FileDown, Plus } from "lucide-react";
import { useTracker } from "@/lib/useTracker";
import { supabase, track } from "@/lib/supabase";
import { addDays, fmtDate } from "@/lib/dates";
import { nextPeriodLabel } from "@/lib/cycle";
import { FLOWS, MOODS, SYMPTOMS } from "@/lib/constants";
import { useUser } from "@/components/UserProvider";
import { CycleCalendar, FlagList, HormoneChart, PhaseCard } from "@/components/tracker";
import { Badge, Button, Card, Disclaimer, LinkButton, PageHeader, Spinner, Stat } from "@/components/ui";

export default function TrackerPage() {
  const { user } = useUser();
  const t = useTracker();
  const [selected, setSelected] = useState<string>(t.today);
  const [busy, setBusy] = useState(false);

  if (t.loading) return <Spinner />;
  const s = t.stats;
  const sel = t.logMap.get(selected);
  const openPeriod = [...t.periods].reverse().find((p) => p.start_date <= t.today && (!p.end_date || p.end_date >= addDays(t.today, -1)));

  async function periodStarted() {
    setBusy(true);
    await supabase().from("periods").upsert({ user_id: user!.id, start_date: t.today, end_date: null }, { onConflict: "user_id,start_date" });
    await supabase().from("daily_logs").upsert({ user_id: user!.id, log_date: t.today, flow: "medium" }, { onConflict: "user_id,log_date" });
    track("period_started");
    await t.reload();
    setBusy(false);
  }
  async function periodEnded() {
    if (!openPeriod?.id) return;
    setBusy(true);
    await supabase().from("periods").update({ end_date: t.today }).eq("id", openPeriod.id);
    await t.reload();
    setBusy(false);
  }

  const label = (list: readonly (readonly string[])[], k: string) => list.find((x) => x[0] === k)?.[1] ?? k;

  return (
    <div className="space-y-6">
      <PageHeader title="Period tracker" subtitle="Cycle and hormone insights"
        action={
          <div className="flex flex-wrap gap-2">
            {openPeriod && !openPeriod.end_date
              ? <Button variant="secondary" onClick={periodEnded} loading={busy}><Droplet className="size-4" />Period ended today</Button>
              : <Button variant="blush" onClick={periodStarted} loading={busy}><Droplet className="size-4" />Period started today</Button>}
            <LinkButton href={`/tracker/log?date=${t.today}`}><Plus className="size-4" />Log today</LinkButton>
          </div>
        } />

      <FlagList flags={t.flags} />

      <div className="grid gap-4 sm:grid-cols-4">
        <Stat label="Next period" value={nextPeriodLabel(s)} sub={fmtDate(s.nextPeriod, { weekday: "short", day: "numeric", month: "short" })} />
        <Stat label="Ovulation (est.)" value={fmtDate(s.ovulation)} sub={s.fertileStart ? `Fertile ${fmtDate(s.fertileStart)}–${fmtDate(s.fertileEnd)}` : undefined} />
        <Stat label="Avg cycle" value={`${s.avgCycle} days`} sub={`Period ~${s.avgPeriod} days`} />
        <Stat label="Confidence" value={<span className="capitalize">{s.confidence}</span>} sub={`${s.cycleLengths.length} cycles logged`} />
      </div>
      <p className="-mt-3 text-xs text-slate-500">{s.confidenceNote}</p>

      <div className="grid gap-5 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CycleCalendar stats={s} periods={t.periods} logMap={t.logMap} selected={selected} onPick={setSelected} />
        </Card>
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-ova-900">{fmtDate(selected, { weekday: "long", day: "numeric", month: "long" })}</p>
            {selected <= t.today && <Link href={`/tracker/log?date=${selected}`} className="text-sm font-semibold text-ova-600">{sel ? "Edit" : "Add log"}</Link>}
          </div>
          {sel ? (
            <div className="mt-4 space-y-3 text-sm">
              {sel.flow && sel.flow !== "none" && <p><span className="text-slate-500">Flow:</span> <Badge tone="blush">{label(FLOWS, sel.flow)}</Badge></p>}
              {sel.mood && <p><span className="text-slate-500">Mood:</span> {label(MOODS, sel.mood)}</p>}
              {sel.symptoms?.length > 0 && (
                <div className="flex flex-wrap gap-1.5">{sel.symptoms.map((x) => <Badge key={x}>{label(SYMPTOMS, x)}</Badge>)}</div>
              )}
              {sel.energy && <p><span className="text-slate-500">Energy:</span> {"⚡".repeat(sel.energy)}</p>}
              {sel.sleep_hours != null && <p><span className="text-slate-500">Sleep:</span> {sel.sleep_hours} h</p>}
              {sel.ovulation_test && <p><span className="text-slate-500">Ovulation test:</span> {sel.ovulation_test}</p>}
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-500">{selected > t.today ? "Future date — predictions shown on the calendar." : "Nothing logged for this day."}</p>
          )}
          <div className="mt-6 grid grid-cols-2 gap-2">
            <LinkButton href="/tracker/insights" variant="secondary" className="text-xs"><BarChart3 className="size-4" />Insights</LinkButton>
            <LinkButton href="/tracker/report" variant="secondary" className="text-xs"><FileDown className="size-4" />Doctor report</LinkButton>
          </div>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-semibold text-ova-900">Your hormone phase</h2>
          <HormoneChart cycleLen={s.avgCycle} day={s.cycleDay} />
        </Card>
        <PhaseCard stats={s} />
      </div>
      <Disclaimer />
    </div>
  );
}
