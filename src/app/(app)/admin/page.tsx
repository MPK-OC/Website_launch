"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { AdminGuard } from "@/components/AdminGuard";
import { Card, PageHeader, Spinner, Stat } from "@/components/ui";

interface Metrics {
  users: number; onboarded: number; doctorsVerified: number; doctorsPending: number;
  appts: Record<string, number>; patientsWithConsult: number; activePlans: number;
  events: Record<string, number>; activeLoggers7d: number; goals: Record<string, number>;
}

/** Product analytics for MVP success metrics. Uses the events table — admins never read raw health logs. */
function Overview() {
  const [m, setM] = useState<Metrics | null>(null);
  useEffect(() => {
    (async () => {
      const sb = supabase();
      const since30 = new Date(Date.now() - 30 * 864e5).toISOString();
      const since7 = new Date(Date.now() - 7 * 864e5).toISOString();
      const [profiles, docs, appts, plans, events, ev7] = await Promise.all([
        sb.from("profiles").select("role,goal_mode,onboarded_at"),
        sb.from("doctors").select("verification_status"),
        sb.from("appointments").select("status,user_id"),
        sb.from("plan_enrollments").select("id", { count: "exact", head: true }).eq("status", "active"),
        sb.from("events").select("name").gte("created_at", since30),
        sb.from("events").select("user_id").eq("name", "daily_log_saved").gte("created_at", since7),
      ]);
      const p = profiles.data ?? [];
      const count = <T,>(arr: T[], key: (x: T) => string) => arr.reduce<Record<string, number>>((acc, x) => { const k = key(x); acc[k] = (acc[k] ?? 0) + 1; return acc; }, {});
      setM({
        users: p.filter((x) => x.role === "user").length,
        onboarded: p.filter((x) => x.role === "user" && x.onboarded_at).length,
        doctorsVerified: (docs.data ?? []).filter((d) => d.verification_status === "verified").length,
        doctorsPending: (docs.data ?? []).filter((d) => d.verification_status === "pending").length,
        appts: count(appts.data ?? [], (a) => a.status),
        patientsWithConsult: new Set((appts.data ?? []).map((a) => a.user_id)).size,
        activePlans: plans.count ?? 0,
        events: count(events.data ?? [], (e) => e.name),
        activeLoggers7d: new Set((ev7.data ?? []).map((e) => e.user_id)).size,
        goals: count(p.filter((x) => x.role === "user"), (x) => x.goal_mode),
      });
    })();
  }, []);
  if (!m) return <Spinner />;
  const totalAppts = Object.values(m.appts).reduce((a, b) => a + b, 0);
  const conv = m.onboarded ? Math.round((m.patientsWithConsult / m.onboarded) * 100) : 0;

  return (
    <div className="space-y-6">
      <PageHeader title="Admin overview" subtitle="MVP success metrics" />
      <div className="grid gap-4 sm:grid-cols-4">
        <Stat label="Users (onboarded)" value={`${m.onboarded}/${m.users}`} />
        <Stat label="Active loggers (7d)" value={m.activeLoggers7d} sub="users who logged a day" />
        <Stat label="Consult conversion" value={`${conv}%`} sub={`${m.patientsWithConsult} users booked`} />
        <Stat label="Active PCOD plans" value={m.activePlans} />
      </div>
      <div className="grid gap-4 sm:grid-cols-4">
        <Stat label="Appointments" value={totalAppts} sub={Object.entries(m.appts).map(([k, v]) => `${k} ${v}`).join(" · ")} />
        <Stat label="Verified doctors" value={m.doctorsVerified} />
        <Link href="/admin/doctors"><Stat label="Pending verification" value={<span className={m.doctorsPending ? "text-amber-600" : ""}>{m.doctorsPending}</span>} sub="click to review" /></Link>
        <Stat label="Segments" value={<span className="text-base">{Object.entries(m.goals).map(([k, v]) => `${k}: ${v}`).join(", ") || "—"}</span>} />
      </div>
      <Card>
        <p className="mb-3 font-semibold text-ova-900">Events (last 30 days)</p>
        <div className="grid gap-2 sm:grid-cols-3">
          {Object.entries(m.events).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
            <div key={k} className="flex justify-between rounded-lg bg-ova-50 px-3 py-2 text-sm"><span>{k}</span><b>{v}</b></div>
          ))}
          {!Object.keys(m.events).length && <p className="text-sm text-slate-500">No events yet.</p>}
        </div>
      </Card>
    </div>
  );
}

export default function AdminPage() {
  return <AdminGuard><Overview /></AdminGuard>;
}
