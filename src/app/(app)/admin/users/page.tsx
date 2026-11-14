"use client";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { fmtDateTime } from "@/lib/dates";
import { GOAL_LABEL } from "@/lib/constants";
import { AdminGuard } from "@/components/AdminGuard";
import { useUser } from "@/components/UserProvider";
import { Card, Input, PageHeader, Select, Spinner } from "@/components/ui";

interface Row { id: string; full_name: string | null; phone: string | null; email: string | null; role: string; goal_mode: string; created_at: string; onboarded_at: string | null }

/** Account list for support. Shows account metadata only — no health data. */
function Users() {
  const { user } = useUser();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [q, setQ] = useState("");
  const load = useCallback(async () => {
    const { data } = await supabase().from("profiles").select("id,full_name,phone,email,role,goal_mode,created_at,onboarded_at").order("created_at", { ascending: false });
    setRows((data ?? []) as Row[]);
  }, []);
  useEffect(() => { load(); }, [load]);
  async function setRole(id: string, role: string) {
    await supabase().from("profiles").update({ role }).eq("id", id);
    load();
  }
  if (!rows) return <Spinner />;
  const list = rows.filter((r) => !q || [r.full_name, r.phone, r.email].some((x) => x?.toLowerCase().includes(q.toLowerCase())));
  return (
    <div className="space-y-5">
      <PageHeader title="Users" subtitle={`${rows.length} accounts`} />
      <Input placeholder="Search name, phone or email" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" />
      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[680px] text-sm">
          <thead className="bg-ova-50 text-left text-xs text-slate-500"><tr><th className="p-3">Name</th><th>Contact</th><th>Goal</th><th>Joined</th><th>Role</th></tr></thead>
          <tbody>
            {list.map((r) => (
              <tr key={r.id} className="border-t border-ova-50">
                <td className="p-3 font-medium">{r.full_name ?? "—"}{!r.onboarded_at && <span className="ml-1 text-xs text-amber-600">(not onboarded)</span>}</td>
                <td>{r.phone ? `+${r.phone}` : r.email}</td>
                <td>{GOAL_LABEL[r.goal_mode]}</td>
                <td>{fmtDateTime(r.created_at)}</td>
                <td className="pr-3">
                  <Select value={r.role} disabled={r.id === user?.id} onChange={(e) => setRole(r.id, e.target.value)} className="py-1.5">
                    <option value="user">user</option><option value="doctor">doctor</option><option value="admin">admin</option>
                  </Select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <p className="text-xs text-slate-500">To make someone a doctor, use Doctor verification (it checks registration). Changing role here is for support only.</p>
    </div>
  );
}

export default function AdminUsers() {
  return <AdminGuard><Users /></AdminGuard>;
}
