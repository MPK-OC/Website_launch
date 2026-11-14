"use client";
import { useCallback, useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { fmtDateTime } from "@/lib/dates";
import { GOAL_LABEL } from "@/lib/constants";
import type { DoctorRow } from "@/lib/useDoctor";
import { AdminGuard } from "@/components/AdminGuard";
import { Badge, Button, Card, Chip, Empty, Input, PageHeader, Spinner } from "@/components/ui";

type Row = DoctorRow & { created_at: string; is_demo: boolean };
const TONE = { pending: "amber", verified: "green", rejected: "red", suspended: "gray" } as const;

function Doctors() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [filter, setFilter] = useState("pending");
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const { data } = await supabase().from("doctors").select("*").order("created_at", { ascending: false });
    setRows((data ?? []) as Row[]);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function review(id: string, approve: boolean) {
    await supabase().rpc("review_doctor", { p_doctor: id, p_approve: approve, p_note: notes[id] || null });
    load();
  }
  async function suspend(id: string) {
    await supabase().from("doctors").update({ verification_status: "suspended" }).eq("id", id);
    load();
  }

  if (!rows) return <Spinner />;
  const list = rows.filter((r) => !filter || r.verification_status === filter);
  return (
    <div className="space-y-5">
      <PageHeader title="Doctor verification" subtitle="Verify registration on the NMC Indian Medical Register before approving." />
      <div className="flex flex-wrap gap-2">
        {["pending", "verified", "rejected", "suspended", ""].map((s) => <Chip key={s} active={filter === s} onClick={() => setFilter(s)}>{s || "All"} ({s ? rows.filter((r) => r.verification_status === s).length : rows.length})</Chip>)}
      </div>
      {list.length === 0 ? <Empty title="Nothing here" /> : list.map((d) => (
        <Card key={d.id} className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-bold text-ova-900">{d.full_name} {d.is_demo && <Badge tone="amber">demo</Badge>}</p>
              <p className="text-sm text-slate-600">{d.qualification} · {d.experience_years} yrs · {d.gender}</p>
              <p className="text-sm">Reg. <b>{d.registration_number}</b> · {d.medical_council}</p>
              <p className="text-xs text-slate-500">Applied {fmtDateTime(d.created_at)} · ₹{d.consultation_fee} · {d.languages.join(", ")} · {d.specialties.map((s) => GOAL_LABEL[s] ?? s).join(", ")}</p>
            </div>
            <Badge tone={TONE[d.verification_status]} className="capitalize">{d.verification_status}</Badge>
          </div>
          {d.bio && <p className="text-sm text-slate-700">{d.bio}</p>}
          <a href="https://www.nmc.org.in/information-desk/indian-medical-register/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold text-ova-600">
            Check on NMC Indian Medical Register <ExternalLink className="size-3.5" />
          </a>
          {d.verification_status === "pending" && (
            <div className="flex flex-wrap gap-2">
              <Input className="max-w-sm" placeholder="Note to doctor (optional / reason)" value={notes[d.id] ?? ""} onChange={(e) => setNotes({ ...notes, [d.id]: e.target.value })} />
              <Button onClick={() => review(d.id, true)}>Approve</Button>
              <Button variant="secondary" onClick={() => review(d.id, false)}>Reject</Button>
            </div>
          )}
          {d.verification_status === "verified" && <Button variant="ghost" className="text-rose-600" onClick={() => suspend(d.id)}>Suspend</Button>}
          {(d.verification_status === "suspended" || d.verification_status === "rejected") && <Button variant="secondary" onClick={() => review(d.id, true)}>Re-approve</Button>}
        </Card>
      ))}
    </div>
  );
}

export default function AdminDoctors() {
  return <AdminGuard><Doctors /></AdminGuard>;
}
