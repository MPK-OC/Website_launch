"use client";
import { useCallback, useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useMyDoctor } from "@/lib/useDoctor";
import { Alert, Button, Card, Empty, Field, Input, PageHeader, Select, Spinner } from "@/components/ui";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
interface Row { id: string; weekday: number; start_time: string; end_time: string; slot_minutes: number }

export default function Availability() {
  const { doctor, loading } = useMyDoctor();
  const [rows, setRows] = useState<Row[]>([]);
  const [f, setF] = useState({ weekdays: [1, 2, 3, 4, 5] as number[], start_time: "10:00", end_time: "13:00", slot_minutes: 20 });
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!doctor) return;
    const { data } = await supabase().from("doctor_availability").select("*").eq("doctor_id", doctor.id).order("weekday").order("start_time");
    setRows((data ?? []) as Row[]);
  }, [doctor]);
  useEffect(() => { load(); }, [load]);

  if (loading) return <Spinner />;
  if (doctor?.verification_status !== "verified") return <Alert tone="info">You can set availability once your doctor profile is verified.</Alert>;

  async function add() {
    setErr(null);
    if (f.end_time <= f.start_time) return setErr("End time must be after start time.");
    const { error } = await supabase().from("doctor_availability").insert(
      f.weekdays.map((w) => ({ doctor_id: doctor!.id, weekday: w, start_time: f.start_time, end_time: f.end_time, slot_minutes: f.slot_minutes })),
    );
    if (error) return setErr(error.message);
    load();
  }
  async function remove(id: string) {
    await supabase().from("doctor_availability").delete().eq("id", id);
    load();
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader title="Availability" subtitle="Weekly recurring slots that patients can book (your local time)" />
      <Card className="space-y-4">
        <p className="font-semibold text-ova-900">Add time block</p>
        <div className="flex flex-wrap gap-2">
          {DAYS.map((d, i) => (
            <label key={d} className="flex items-center gap-1.5 rounded-lg border border-ova-100 px-2.5 py-1.5 text-sm">
              <input type="checkbox" className="accent-ova-600" checked={f.weekdays.includes(i)} onChange={(e) => setF({ ...f, weekdays: e.target.checked ? [...f.weekdays, i] : f.weekdays.filter((x) => x !== i) })} />{d.slice(0, 3)}
            </label>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="From"><Input type="time" value={f.start_time} onChange={(e) => setF({ ...f, start_time: e.target.value })} /></Field>
          <Field label="To"><Input type="time" value={f.end_time} onChange={(e) => setF({ ...f, end_time: e.target.value })} /></Field>
          <Field label="Slot length">
            <Select value={f.slot_minutes} onChange={(e) => setF({ ...f, slot_minutes: Number(e.target.value) })}>{[10, 15, 20, 30, 45].map((m) => <option key={m} value={m}>{m} min</option>)}</Select>
          </Field>
        </div>
        {err && <Alert tone="urgent">{err}</Alert>}
        <Button onClick={add} disabled={!f.weekdays.length}>Add</Button>
      </Card>
      {rows.length === 0 ? <Empty title="No availability yet" text="Patients can't book you until you add time blocks." /> : (
        <Card>
          {DAYS.map((d, i) => {
            const r = rows.filter((x) => x.weekday === i);
            if (!r.length) return null;
            return (
              <div key={d} className="flex flex-wrap items-center gap-2 border-b border-ova-50 py-3 last:border-0">
                <span className="w-28 font-medium text-ova-900">{d}</span>
                {r.map((x) => (
                  <span key={x.id} className="inline-flex items-center gap-2 rounded-lg bg-ova-50 px-3 py-1 text-sm">
                    {x.start_time.slice(0, 5)}–{x.end_time.slice(0, 5)} · {x.slot_minutes}m
                    <button onClick={() => remove(x.id)} aria-label="Remove" className="text-slate-400 hover:text-rose-600"><Trash2 className="size-3.5" /></button>
                  </span>
                ))}
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}
