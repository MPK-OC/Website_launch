"use client";
import { useState } from "react";
import { Printer, Save } from "lucide-react";
import { buildCycleSnapshot, useTracker } from "@/lib/useTracker";
import { supabase, track } from "@/lib/supabase";
import { ageFrom, fmtDate } from "@/lib/dates";
import { SYMPTOMS } from "@/lib/constants";
import { useUser } from "@/components/UserProvider";
import { Logo } from "@/components/Logo";
import { Alert, Button, Spinner } from "@/components/ui";

/** Doctor-ready cycle summary. "Download PDF" uses the browser's Save as PDF — free, no server needed. */
export default function Report() {
  const { profile, user } = useUser();
  const t = useTracker();
  const [saved, setSaved] = useState(false);
  if (t.loading || !profile) return <Spinner />;
  const snap = buildCycleSnapshot(t);
  const sym = (k: string) => SYMPTOMS.find((s) => s[0] === k)?.[1] ?? k;
  const periods = [...t.periods].sort((a, b) => b.start_date.localeCompare(a.start_date)).slice(0, 8);

  async function saveToRecords() {
    await supabase().from("health_records").insert({ user_id: user!.id, record_type: "cycle_report", title: `Cycle report — ${fmtDate(t.today, { day: "numeric", month: "short", year: "numeric" })}`, data: snap, created_by: user!.id });
    track("cycle_report_saved");
    setSaved(true);
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="no-print mb-4 flex flex-wrap justify-end gap-2">
        <Button variant="secondary" onClick={saveToRecords} disabled={saved}><Save className="size-4" />{saved ? "Saved to records" : "Save to health records"}</Button>
        <Button onClick={() => window.print()}><Printer className="size-4" />Download / print PDF</Button>
      </div>
      {saved && <div className="no-print mb-4"><Alert tone="success">Report saved to your health records.</Alert></div>}

      <div className="rounded-2xl border border-ova-100 bg-white p-8 print:border-0 print:p-0">
        <div className="flex items-start justify-between border-b border-ova-100 pb-4">
          <div>
            <Logo href={null} />
            <p className="mt-2 text-lg font-bold text-ova-900">Menstrual cycle summary</p>
            <p className="text-xs text-slate-500">Generated {new Date().toLocaleString("en-IN")}</p>
          </div>
          <div className="text-right text-sm">
            <p className="font-semibold">{profile.full_name}</p>
            <p className="text-slate-600">{ageFrom(profile.date_of_birth) ? `${ageFrom(profile.date_of_birth)} years` : ""}</p>
            <p className="text-slate-600">{profile.phone ? `+${profile.phone}` : profile.email}</p>
          </div>
        </div>

        <table className="mt-5 w-full text-sm">
          <tbody className="[&_td]:py-1.5 [&_td:first-child]:text-slate-500">
            <tr><td>Last period started</td><td className="font-semibold">{fmtDate(snap.last_period_start, { day: "numeric", month: "short", year: "numeric" })}</td></tr>
            <tr><td>Average cycle length</td><td className="font-semibold">{snap.avg_cycle_length} days</td></tr>
            <tr><td>Average period length</td><td className="font-semibold">{snap.avg_period_length} days</td></tr>
            <tr><td>Recent cycle lengths</td><td className="font-semibold">{snap.recent_cycle_lengths.join(", ") || "—"}</td></tr>
            <tr><td>Next period (estimate)</td><td className="font-semibold">{fmtDate(snap.next_period_estimate, { day: "numeric", month: "short", year: "numeric" })}{snap.days_late ? ` (${snap.days_late} days late)` : ""}</td></tr>
            <tr><td>Prediction confidence</td><td className="font-semibold capitalize">{t.stats.confidence}</td></tr>
          </tbody>
        </table>

        <h3 className="mt-6 font-semibold text-ova-900">Period history</h3>
        <table className="mt-2 w-full text-sm">
          <thead><tr className="border-b border-ova-100 text-left text-slate-500"><th className="py-1.5">Start</th><th>End</th><th>Days</th></tr></thead>
          <tbody>
            {periods.map((p) => (
              <tr key={p.start_date} className="border-b border-ova-50">
                <td className="py-1.5">{fmtDate(p.start_date, { day: "numeric", month: "short", year: "numeric" })}</td>
                <td>{fmtDate(p.end_date, { day: "numeric", month: "short", year: "numeric" })}</td>
                <td>{p.end_date ? Math.round((new Date(p.end_date).getTime() - new Date(p.start_date).getTime()) / 86400000) + 1 : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h3 className="mt-6 font-semibold text-ova-900">Most frequent symptoms (last 60 days)</h3>
        <p className="mt-1 text-sm">{snap.top_symptoms_60d.length ? snap.top_symptoms_60d.map(([k, n]) => `${sym(k)} (${n}×)`).join(", ") : "None logged"}</p>

        <h3 className="mt-6 font-semibold text-ova-900">Flags raised by the app</h3>
        {snap.open_flags.length ? <ul className="mt-1 list-disc pl-5 text-sm">{snap.open_flags.map((f) => <li key={f}>{f}</li>)}</ul> : <p className="mt-1 text-sm">None</p>}

        <p className="mt-8 border-t border-ova-100 pt-3 text-[11px] text-slate-500">
          Self-reported data from the Ova Cure app. Predictions are estimates and not a clinical diagnosis.
        </p>
      </div>
    </div>
  );
}
