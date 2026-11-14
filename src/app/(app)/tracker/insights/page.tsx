"use client";
import { useMemo } from "react";
import { useTracker } from "@/lib/useTracker";
import { fmtDate } from "@/lib/dates";
import { MOODS, SYMPTOMS } from "@/lib/constants";
import { Card, Disclaimer, Empty, LinkButton, PageHeader, Spinner, Stat } from "@/components/ui";

export default function Insights() {
  const t = useTracker();

  const { cycles, symptomTop, moodTop, logs30 } = useMemo(() => {
    const sorted = [...t.periods].sort((a, b) => a.start_date.localeCompare(b.start_date));
    const cycles = sorted.slice(1).map((p, i) => ({
      start: sorted[i].start_date,
      len: Math.round((new Date(p.start_date).getTime() - new Date(sorted[i].start_date).getTime()) / 86400000),
    })).filter((c) => c.len >= 15 && c.len <= 90).slice(-8);
    const sc: Record<string, number> = {}, mc: Record<string, number> = {};
    t.logs.forEach((l) => { l.symptoms?.forEach((s) => (sc[s] = (sc[s] ?? 0) + 1)); if (l.mood) mc[l.mood] = (mc[l.mood] ?? 0) + 1; });
    const cutoff = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    return {
      cycles,
      symptomTop: Object.entries(sc).sort((a, b) => b[1] - a[1]).slice(0, 8),
      moodTop: Object.entries(mc).sort((a, b) => b[1] - a[1]).slice(0, 5),
      logs30: t.logs.filter((l) => l.log_date >= cutoff).length,
    };
  }, [t.periods, t.logs]);

  if (t.loading) return <Spinner />;
  const maxLen = Math.max(40, ...cycles.map((c) => c.len));
  const maxSym = Math.max(1, ...symptomTop.map((s) => s[1]));
  const name = (list: readonly (readonly string[])[], k: string) => list.find((x) => x[0] === k)?.[1] ?? k;

  return (
    <div className="space-y-6">
      <PageHeader title="Cycle insights" subtitle="Your patterns over time" action={<LinkButton href="/tracker/report" variant="secondary">Doctor report (PDF)</LinkButton>} />
      <div className="grid gap-4 sm:grid-cols-4">
        <Stat label="Average cycle" value={`${t.stats.avgCycle} d`} />
        <Stat label="Average period" value={`${t.stats.avgPeriod} d`} />
        <Stat label="Variation" value={`${t.stats.variability} d`} sub="max − min of recent cycles" />
        <Stat label="Days logged (30d)" value={logs30} sub={logs30 >= 12 ? "Great consistency" : "Aim for 3+ per week"} />
      </div>

      <Card>
        <h2 className="mb-1 font-semibold text-ova-900">Cycle length trend</h2>
        <p className="mb-5 text-xs text-slate-500">Green band = typical range (21–35 days)</p>
        {cycles.length === 0 ? (
          <Empty title="Not enough data yet" text="Log at least two periods to see your cycle length trend." />
        ) : (
          <div className="relative flex h-56 items-end gap-3 border-b border-ova-100 pl-2">
            <div className="absolute inset-x-0 bg-emerald-50" style={{ bottom: `${(21 / maxLen) * 100}%`, height: `${((35 - 21) / maxLen) * 100}%` }} />
            {cycles.map((c) => (
              <div key={c.start} className="relative flex flex-1 flex-col items-center justify-end" style={{ height: "100%" }}>
                <span className="mb-1 text-xs font-semibold text-ova-900">{c.len}</span>
                <div className={`w-full max-w-12 rounded-t-lg ${c.len < 21 || c.len > 35 ? "bg-amber-400" : "bg-ova-500"}`} style={{ height: `${(c.len / maxLen) * 100}%` }} />
                <span className="absolute -bottom-6 text-[11px] text-slate-500">{fmtDate(c.start)}</span>
              </div>
            ))}
          </div>
        )}
        <div className="h-6" />
      </Card>

      <div className="grid gap-5 md:grid-cols-2">
        <Card>
          <h2 className="mb-4 font-semibold text-ova-900">Most frequent symptoms</h2>
          {symptomTop.length === 0 ? <p className="text-sm text-slate-500">No symptoms logged yet.</p> : (
            <div className="space-y-2.5">
              {symptomTop.map(([k, n]) => (
                <div key={k} className="flex items-center gap-3 text-sm">
                  <span className="w-32 shrink-0 text-ova-900">{name(SYMPTOMS, k)}</span>
                  <div className="h-2.5 flex-1 rounded-full bg-ova-50"><div className="h-full rounded-full bg-blush-400" style={{ width: `${(n / maxSym) * 100}%` }} /></div>
                  <span className="w-8 text-right text-xs text-slate-500">{n}×</span>
                </div>
              ))}
            </div>
          )}
        </Card>
        <Card>
          <h2 className="mb-4 font-semibold text-ova-900">Mood pattern</h2>
          {moodTop.length === 0 ? <p className="text-sm text-slate-500">No moods logged yet.</p> : (
            <div className="flex flex-wrap gap-3">
              {moodTop.map(([k, n]) => (
                <div key={k} className="rounded-xl bg-ova-50 px-4 py-3 text-center">
                  <p className="text-2xl">{MOODS.find((m) => m[0] === k)?.[2]}</p>
                  <p className="text-sm font-semibold text-ova-900">{name(MOODS, k)}</p>
                  <p className="text-xs text-slate-500">{n} days</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
      <Disclaimer />
    </div>
  );
}
