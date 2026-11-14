"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase, track } from "@/lib/supabase";
import { addDays, diffDays, fmtDate, todayISO } from "@/lib/dates";
import { FLOWS, MOODS, SYMPTOMS } from "@/lib/constants";
import { useUser } from "@/components/UserProvider";
import { Alert, Button, Card, Chip, cx, Field, Input, PageHeader, Spinner, Textarea } from "@/components/ui";

const EMPTY = { flow: "none", symptoms: [] as string[], mood: "", sleep_hours: "", energy: 0, medication: "", sexual_activity: "", ovulation_test: "", notes: "" };

function LogForm() {
  const { user, profile } = useUser();
  const router = useRouter();
  const params = useSearchParams();
  const date = params.get("date") || todayISO();
  const [f, setF] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof typeof EMPTY>(k: K, v: (typeof EMPTY)[K]) => setF((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    if (!user) return;
    supabase().from("daily_logs").select("*").eq("user_id", user.id).eq("log_date", date).maybeSingle().then(({ data }) => {
      if (data) setF({
        flow: data.flow ?? "none", symptoms: data.symptoms ?? [], mood: data.mood ?? "", sleep_hours: data.sleep_hours?.toString() ?? "",
        energy: data.energy ?? 0, medication: data.medication ?? "", sexual_activity: data.sexual_activity ?? "",
        ovulation_test: data.ovulation_test ?? "", notes: data.notes ?? "",
      });
      else setF(EMPTY);
      setLoading(false);
    });
  }, [user, date]);

  async function save() {
    setBusy(true);
    setError(null);
    const sb = supabase();
    const uid = user!.id;
    const { error } = await sb.from("daily_logs").upsert({
      user_id: uid, log_date: date, flow: f.flow, symptoms: f.symptoms, mood: f.mood || null,
      sleep_hours: f.sleep_hours ? Number(f.sleep_hours) : null, energy: f.energy || null, medication: f.medication || null,
      sexual_activity: f.sexual_activity || null, ovulation_test: f.ovulation_test || null, notes: f.notes || null,
    }, { onConflict: "user_id,log_date" });
    if (error) { setBusy(false); return setError(error.message); }

    // Bleeding logged => attach to the current period or start a new one automatically.
    if (["light", "medium", "heavy", "very_heavy"].includes(f.flow)) {
      const { data: recent } = await sb.from("periods").select("id,start_date,end_date").eq("user_id", uid)
        .lte("start_date", date).gte("start_date", addDays(date, -10)).order("start_date", { ascending: false }).limit(1);
      const p = recent?.[0];
      if (!p) await sb.from("periods").insert({ user_id: uid, start_date: date, end_date: date });
      else if (!p.end_date || p.end_date < date) {
        if (diffDays(p.start_date, date) <= 10) await sb.from("periods").update({ end_date: date }).eq("id", p.id);
      }
    }
    track("daily_log_saved", { flow: f.flow, symptoms: f.symptoms.length });
    router.push("/tracker");
  }

  if (loading) return <Spinner />;
  const toggleSymptom = (k: string) => set("symptoms", f.symptoms.includes(k) ? f.symptoms.filter((x) => x !== k) : [...f.symptoms, k]);

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader title="Daily log" subtitle={fmtDate(date, { weekday: "long", day: "numeric", month: "long", year: "numeric" })} />

      <Card>
        <h2 className="mb-3 font-semibold text-ova-900">Period flow</h2>
        <div className="flex flex-wrap gap-2">
          {FLOWS.map(([k, l]) => <Chip key={k} active={f.flow === k} onClick={() => set("flow", k)}>{l}</Chip>)}
        </div>
      </Card>

      <Card>
        <h2 className="mb-3 font-semibold text-ova-900">Symptoms</h2>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {SYMPTOMS.map(([k, l, e]) => (
            <button key={k} type="button" onClick={() => toggleSymptom(k)}
              className={cx("rounded-xl border p-3 text-center text-xs font-medium transition",
                f.symptoms.includes(k) ? "border-ova-600 bg-ova-50 text-ova-800 ring-2 ring-ova-100" : "border-ova-100 hover:border-ova-300")}>
              <span className="mb-1 block text-xl">{e}</span>{l}
            </button>
          ))}
        </div>
      </Card>

      <Card>
        <h2 className="mb-3 font-semibold text-ova-900">Mood</h2>
        <div className="flex flex-wrap gap-2">
          {MOODS.map(([k, l, e]) => <Chip key={k} active={f.mood === k} onClick={() => set("mood", f.mood === k ? "" : k)}>{e} {l}</Chip>)}
        </div>
      </Card>

      <Card className="grid gap-4 sm:grid-cols-2">
        <Field label="Energy">
          <div className="flex gap-1.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" onClick={() => set("energy", n)}
                className={cx("grid size-10 place-items-center rounded-xl border text-sm font-semibold", f.energy >= n ? "border-amber-400 bg-amber-100 text-amber-800" : "border-ova-100")}>{n}</button>
            ))}
          </div>
        </Field>
        <Field label="Sleep (hours)"><Input type="number" step="0.5" min={0} max={24} value={f.sleep_hours} onChange={(e) => set("sleep_hours", e.target.value)} placeholder="7.5" /></Field>
        <Field label="Medication taken"><Input value={f.medication} onChange={(e) => set("medication", e.target.value)} placeholder="e.g. Meftal, iron tablet" /></Field>
        <Field label="Sexual activity">
          <div className="flex flex-wrap gap-2">
            {[["none", "None"], ["protected", "Protected"], ["unprotected", "Unprotected"]].map(([k, l]) => (
              <Chip key={k} active={f.sexual_activity === k} onClick={() => set("sexual_activity", f.sexual_activity === k ? "" : k)}>{l}</Chip>
            ))}
          </div>
        </Field>
        {(profile?.goal_mode === "ttc" || f.ovulation_test) && (
          <Field label="Ovulation test (optional)">
            <div className="flex gap-2">
              {[["positive", "Positive"], ["negative", "Negative"]].map(([k, l]) => (
                <Chip key={k} active={f.ovulation_test === k} onClick={() => set("ovulation_test", f.ovulation_test === k ? "" : k)}>{l}</Chip>
              ))}
            </div>
          </Field>
        )}
        <div className="sm:col-span-2"><Field label="Notes"><Textarea value={f.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Anything else you noticed…" /></Field></div>
      </Card>

      {f.flow === "very_heavy" && (
        <Alert tone="warning" title="Very heavy bleeding">If you are soaking a pad every hour for several hours, or feel dizzy or faint, please seek medical care urgently.</Alert>
      )}
      {error && <Alert tone="urgent">{error}</Alert>}

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={() => router.back()}>Cancel</Button>
        <Button onClick={save} loading={busy}>Save log</Button>
      </div>
    </div>
  );
}

export default function LogPage() {
  return <Suspense fallback={<Spinner />}><LogForm /></Suspense>;
}
