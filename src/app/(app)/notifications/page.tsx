"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { fmtDateTime } from "@/lib/dates";
import { useUser } from "@/components/UserProvider";
import { Button, Card, cx, Empty, PageHeader, Spinner } from "@/components/ui";

interface N { id: string; kind: string; title: string; body: string | null; link: string | null; scheduled_for: string; read_at: string | null }

/** In-app notifications. In production a scheduled job also sends these as push / WhatsApp / SMS. */
export default function Notifications() {
  const { user } = useUser();
  const [rows, setRows] = useState<N[] | null>(null);
  useEffect(() => {
    if (!user) return;
    supabase().from("notifications").select("*").eq("user_id", user.id).lte("scheduled_for", new Date().toISOString())
      .order("scheduled_for", { ascending: false }).limit(50).then(({ data }) => setRows((data ?? []) as N[]));
  }, [user]);
  async function markAll() {
    await supabase().from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", user!.id).is("read_at", null);
    setRows((r) => r?.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })) ?? null);
  }
  if (!rows) return <Spinner />;
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader title="Notifications" action={rows.some((r) => !r.read_at) && <Button variant="secondary" onClick={markAll}>Mark all read</Button>} />
      {rows.length === 0 ? <Empty title="You're all caught up" /> : rows.map((n) => {
        const inner = (
          <Card className={cx("transition", !n.read_at && "border-ova-300 bg-ova-50/60")}>
            <p className="font-semibold text-ova-900">{n.title}</p>
            {n.body && <p className="text-sm text-slate-600">{n.body}</p>}
            <p className="mt-1 text-xs text-slate-400">{fmtDateTime(n.scheduled_for)}</p>
          </Card>
        );
        return n.link ? <Link key={n.id} href={n.link} className="block">{inner}</Link> : <div key={n.id}>{inner}</div>;
      })}
    </div>
  );
}
