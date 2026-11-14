"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ClipboardList, FileText, Pill, Stethoscope } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { fmtDateTime } from "@/lib/dates";
import { useUser } from "@/components/UserProvider";
import { Badge, Card, Empty, LinkButton, PageHeader, Spinner } from "@/components/ui";

interface Rec { id: string; record_type: string; title: string; appointment_id: string | null; data: Record<string, unknown>; created_at: string }

const ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  prescription: Pill, consult_summary: Stethoscope, cycle_report: FileText, symptom_report: FileText, assessment: ClipboardList, upload: FileText,
};

export default function Records() {
  const { user } = useUser();
  const [rows, setRows] = useState<Rec[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => {
    if (!user) return;
    supabase().from("health_records").select("*").eq("user_id", user.id).order("created_at", { ascending: false })
      .then(({ data }) => setRows((data ?? []) as Rec[]));
  }, [user]);
  if (!rows) return <Spinner />;
  return (
    <div className="space-y-6">
      <PageHeader title="Health records" subtitle="Prescriptions, consultation summaries, cycle reports and assessments — in one private place"
        action={<LinkButton href="/tracker/report" variant="secondary">Create cycle report</LinkButton>} />
      {rows.length === 0 ? <Empty title="No records yet" text="Prescriptions from consultations and reports you save will appear here." /> : (
        <div className="space-y-3">
          {rows.map((r) => {
            const Icon = ICON[r.record_type] ?? FileText;
            return (
              <Card key={r.id}>
                <button className="flex w-full items-center gap-4 text-left" onClick={() => setOpen(open === r.id ? null : r.id)}>
                  <div className="grid size-10 place-items-center rounded-xl bg-ova-50"><Icon className="size-5 text-ova-600" /></div>
                  <div className="flex-1">
                    <p className="font-semibold text-ova-900">{r.title}</p>
                    <p className="text-xs text-slate-500">{fmtDateTime(r.created_at)}</p>
                  </div>
                  <Badge tone="gray" className="capitalize">{r.record_type.replace("_", " ")}</Badge>
                </button>
                {open === r.id && (
                  <div className="mt-4 border-t border-ova-50 pt-4 text-sm">
                    {r.appointment_id && <Link href={`/appointments/${r.appointment_id}`} className="mb-2 block font-semibold text-ova-600">Open consultation →</Link>}
                    {r.record_type === "prescription" && Array.isArray(r.data.medicines) ? (
                      <ul className="space-y-1">{(r.data.medicines as { name: string; dose: string; frequency: string; duration: string }[]).map((m, i) => <li key={i}>• <b>{m.name}</b> {m.dose} — {m.frequency}, {m.duration}</li>)}</ul>
                    ) : (
                      <dl className="grid gap-1 sm:grid-cols-2">
                        {Object.entries(r.data).filter(([, v]) => v !== null && typeof v !== "object").map(([k, v]) => (
                          <div key={k}><dt className="inline capitalize text-slate-500">{k.replace(/_/g, " ")}: </dt><dd className="inline">{String(v)}</dd></div>
                        ))}
                      </dl>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
