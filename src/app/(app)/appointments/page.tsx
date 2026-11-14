"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { fmtDateTime } from "@/lib/dates";
import { GOAL_LABEL } from "@/lib/constants";
import { useUser } from "@/components/UserProvider";
import { Badge, Card, Empty, LinkButton, PageHeader, Spinner } from "@/components/ui";

interface Row { id: string; scheduled_at: string; mode: string; status: string; context: string; doctors: { full_name: string; qualification: string } | null }

const STATUS_TONE: Record<string, "ova" | "green" | "amber" | "red" | "gray"> = {
  requested: "amber", confirmed: "ova", in_progress: "green", completed: "green", cancelled: "gray", no_show: "red",
};

export default function Appointments() {
  const { user } = useUser();
  const [rows, setRows] = useState<Row[] | null>(null);
  useEffect(() => {
    if (!user) return;
    supabase().from("appointments").select("id,scheduled_at,mode,status,context,doctors(full_name,qualification)")
      .eq("user_id", user.id).order("scheduled_at", { ascending: false })
      .then(({ data }) => setRows((data ?? []) as unknown as Row[]));
  }, [user]);
  if (!rows) return <Spinner />;
  const now = Date.now() - 3600e3;
  const upcoming = rows.filter((r) => new Date(r.scheduled_at).getTime() >= now && ["confirmed", "requested", "in_progress"].includes(r.status)).reverse();
  const past = rows.filter((r) => !upcoming.includes(r));

  const list = (items: Row[]) => (
    <div className="space-y-3">
      {items.map((r) => (
        <Link key={r.id} href={`/appointments/${r.id}`}>
          <Card className="flex flex-wrap items-center gap-3 transition hover:border-ova-300">
            <div className="flex-1">
              <p className="font-semibold text-ova-900">{r.doctors?.full_name}</p>
              <p className="text-sm text-slate-600">{fmtDateTime(r.scheduled_at)} · <span className="capitalize">{r.mode}</span> · {GOAL_LABEL[r.context]}</p>
            </div>
            <Badge tone={STATUS_TONE[r.status]} className="capitalize">{r.status.replace("_", " ")}</Badge>
          </Card>
        </Link>
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader title="My appointments" action={<LinkButton href="/consult">Book a consultation</LinkButton>} />
      {rows.length === 0 ? <Empty title="No consultations yet" text="Book a verified gynaecologist in a few taps." action={<LinkButton href="/consult">Find a doctor</LinkButton>} /> : (
        <>
          <section><h2 className="mb-3 font-semibold text-ova-900">Upcoming</h2>{upcoming.length ? list(upcoming) : <p className="text-sm text-slate-500">Nothing upcoming.</p>}</section>
          {past.length > 0 && <section><h2 className="mb-3 font-semibold text-ova-900">Past</h2>{list(past)}</section>}
        </>
      )}
    </div>
  );
}
