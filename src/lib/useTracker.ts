"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase";
import { addDays, todayISO } from "./dates";
import { computeStats, detectTrackerFlags, type CycleProfileRow, type LogRow, type PeriodRow } from "./cycle";
import { useUser } from "@/components/UserProvider";

export interface Flag { id: string; flag_type: string; severity: "info" | "warning" | "urgent"; message: string; source: string; created_at: string }

/** Loads everything the tracker screens need and keeps irregularity flags in sync. */
export function useTracker() {
  const { user } = useUser();
  const [profile, setProfile] = useState<CycleProfileRow | null>(null);
  const [periods, setPeriods] = useState<PeriodRow[]>([]);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [flags, setFlags] = useState<Flag[]>([]);
  const [loading, setLoading] = useState(true);
  const today = todayISO();

  const load = useCallback(async () => {
    if (!user) return;
    const sb = supabase();
    const since = addDays(today, -400);
    const [cp, pr, lg, fl] = await Promise.all([
      sb.from("cycle_profiles").select("*").eq("user_id", user.id).maybeSingle(),
      sb.from("periods").select("id,start_date,end_date").eq("user_id", user.id).order("start_date"),
      sb.from("daily_logs").select("*").eq("user_id", user.id).gte("log_date", since).order("log_date"),
      sb.from("health_flags").select("*").eq("user_id", user.id).eq("resolved", false).order("created_at", { ascending: false }),
    ]);
    setProfile(cp.data as CycleProfileRow | null);
    setPeriods((pr.data ?? []) as PeriodRow[]);
    setLogs((lg.data ?? []) as LogRow[]);
    setFlags((fl.data ?? []) as Flag[]);
    setLoading(false);
  }, [user, today]);

  useEffect(() => { load(); }, [load]);

  const stats = useMemo(() => computeStats(periods, profile, today), [periods, profile, today]);
  const logMap = useMemo(() => new Map(logs.map((l) => [l.log_date, l])), [logs]);

  // Sync tracker flags: raise new ones, resolve ones that no longer apply.
  useEffect(() => {
    if (loading || !user) return;
    const detected = detectTrackerFlags(stats, periods, logs);
    const open = flags.filter((f) => f.source === "tracker");
    const toAdd = detected.filter((d) => !open.some((o) => o.flag_type === d.flag_type));
    const toResolve = open.filter((o) => !detected.some((d) => d.flag_type === o.flag_type));
    if (!toAdd.length && !toResolve.length) return;
    (async () => {
      const sb = supabase();
      if (toAdd.length) await sb.from("health_flags").insert(toAdd.map((f) => ({ ...f, user_id: user.id, source: "tracker" })));
      if (toResolve.length) await sb.from("health_flags").update({ resolved: true }).in("id", toResolve.map((f) => f.id));
      const { data } = await sb.from("health_flags").select("*").eq("user_id", user.id).eq("resolved", false).order("created_at", { ascending: false });
      setFlags((data ?? []) as Flag[]);
    })();
  }, [loading, stats, periods, logs, flags, user]);

  return { loading, profile, periods, logs, logMap, flags, stats, today, reload: load };
}

/** Summary attached to consultations / reports (patient chooses to share). */
export function buildCycleSnapshot(t: ReturnType<typeof useTracker>) {
  const recentLogs = t.logs.slice(-60);
  const symptomCounts: Record<string, number> = {};
  recentLogs.forEach((l) => l.symptoms?.forEach((s) => (symptomCounts[s] = (symptomCounts[s] ?? 0) + 1)));
  return {
    generated_at: new Date().toISOString(),
    last_period_start: t.stats.lastStart,
    avg_cycle_length: t.stats.avgCycle,
    avg_period_length: t.stats.avgPeriod,
    recent_cycle_lengths: t.stats.cycleLengths.slice(-6),
    next_period_estimate: t.stats.nextPeriod,
    days_late: t.stats.daysLate,
    top_symptoms_60d: Object.entries(symptomCounts).sort((a, b) => b[1] - a[1]).slice(0, 6),
    open_flags: t.flags.map((f) => f.message),
  };
}
