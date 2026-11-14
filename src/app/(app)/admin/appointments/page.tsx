"use client";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { fmtDateTime } from "@/lib/dates";
import { GOAL_LABEL } from "@/lib/constants";
import { AdminGuard } from "@/components/AdminGuard";
import { Badge, Button, Card, Chip, Empty, PageHeader, Spinner } from "@/components/ui";

interface Row { id: string; scheduled_at: string; status: string; mode: string; context: string; fee: number; payment_status: string; profiles: { full_name: string | null } | null; doctors: { full_name: string } | null }

function Appointments() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [filter, setFilter] = useState("");
  const load = useCallback(async () => {
    const { data } = await supabase().from("appointments").select("id,scheduled_at,status,mode,context,fee,payment_status,profiles(full_name),doctors(full_name)").order("scheduled_at", { ascending: false }).limit(200);
    setRows((data ?? []) as unknown as Row[]);
  }, []);
  useEffect(() => { load(); }, [load]);
  async function cancel(id: string) {
    await supabase().from("appointments").update({ status: "cancelled", cancel_reason: "Cancelled by Ova Cure support" }).eq("id", id);
    load();
  }
  if (!rows) return <Spinner />;
  const list = rows.filter((r) => !filter || r.status === filter);
  return (
    <div className="space-y-5">
      <PageHeader title="Appointments" subtitle="All consultations across doctors" />
      <div className="flex flex-wrap gap-2">
        {["", "confirmed", "in_progress", "completed", "cancelled", "no_show"].map((s) => <Chip key={s} active={filter === s} onClick={() => setFilter(s)}>{s || "All"}</Chip>)}
      </div>
      {list.length === 0 ? <Empty title="No appointments" /> : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-ova-50 text-left text-xs text-slate-500"><tr><th className="p-3">When</th><th>Patient</th><th>Doctor</th><th>Type</th><th>Fee</th><th>Status</th><th /></tr></thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.id} className="border-t border-ova-50">
                  <td className="p-3">{fmtDateTime(r.scheduled_at)}</td>
                  <td>{r.profiles?.full_name ?? "—"}</td>
                  <td>{r.doctors?.full_name}</td>
                  <td>{GOAL_LABEL[r.context]} · {r.mode}</td>
                  <td>₹{r.fee} <span className="text-xs text-slate-400">{r.payment_status}</span></td>
                  <td><Badge tone={r.status === "completed" ? "green" : r.status === "cancelled" ? "gray" : "ova"}>{r.status}</Badge></td>
                  <td className="pr-3 text-right">{["confirmed", "requested"].includes(r.status) && <Button variant="ghost" className="py-1 text-xs text-rose-600" onClick={() => cancel(r.id)}>Cancel</Button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

export default function AdminAppointments() {
  return <AdminGuard><Appointments /></AdminGuard>;
}
