"use client";
import { useEffect, useState } from "react";
import { Download, ShieldCheck, Trash2 } from "lucide-react";
import { supabase, track } from "@/lib/supabase";
import { fmtDateTime, todayISO } from "@/lib/dates";
import { CONTRACEPTION, HEALTH_GOALS } from "@/lib/constants";
import { useUser } from "@/components/UserProvider";
import { Alert, Badge, Button, Card, Field, Input, PageHeader, Select, Spinner } from "@/components/ui";

const TABLES = ["profiles", "cycle_profiles", "periods", "daily_logs", "menopause_logs", "health_flags", "appointments", "prescriptions", "health_records",
  "assessments", "plan_enrollments", "plan_checkins", "progress_entries", "ttc_journeys", "ttc_checklist", "consents"] as const;

export default function Profile() {
  const { user, profile, refreshProfile, signOut } = useUser();
  const [f, setF] = useState({ full_name: "", date_of_birth: "", city: "", language: "en", goal_mode: "track" });
  const [c, setC] = useState({ avg_cycle_length: 28, avg_period_length: 5, contraception: "none", last_period_start: "", reminders: { period: true, fertile: true, daily_log: true } });
  const [consents, setConsents] = useState<{ consent_type: string; granted: boolean; created_at: string }[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!profile || !user) return;
    setF({ full_name: profile.full_name ?? "", date_of_birth: profile.date_of_birth ?? "", city: profile.city ?? "", language: profile.language, goal_mode: profile.goal_mode });
    supabase().from("cycle_profiles").select("*").eq("user_id", user.id).maybeSingle().then(({ data }) => data && setC({
      avg_cycle_length: data.avg_cycle_length, avg_period_length: data.avg_period_length, contraception: data.contraception ?? "none",
      last_period_start: data.last_period_start ?? "", reminders: data.reminders,
    }));
    supabase().from("consents").select("consent_type,granted,created_at").eq("user_id", user.id).order("created_at", { ascending: false })
      .then(({ data }) => setConsents(data ?? []));
  }, [profile, user]);

  if (!profile || !user) return <Spinner />;
  const latest = (t: string) => consents.find((x) => x.consent_type === t);

  async function save() {
    setBusy(true);
    await supabase().from("profiles").update({ ...f, date_of_birth: f.date_of_birth || null, city: f.city || null }).eq("id", user!.id);
    await supabase().from("cycle_profiles").upsert({ user_id: user!.id, ...c, last_period_start: c.last_period_start || null });
    await refreshProfile();
    setBusy(false);
    setMsg("Profile saved.");
  }
  async function setConsent(type: string, granted: boolean) {
    await supabase().from("consents").insert({ user_id: user!.id, consent_type: type, granted });
    const { data } = await supabase().from("consents").select("consent_type,granted,created_at").eq("user_id", user!.id).order("created_at", { ascending: false });
    setConsents(data ?? []);
  }
  async function exportData() {
    const sb = supabase();
    const out: Record<string, unknown> = { exported_at: new Date().toISOString() };
    for (const t of TABLES) out[t] = (await sb.from(t).select("*").eq(t === "profiles" ? "id" : "user_id", user!.id)).data;
    const blob = new Blob([JSON.stringify(out, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `ova-cure-my-data-${todayISO()}.json`;
    a.click();
    track("data_export");
  }
  async function deleteAccount() {
    setBusy(true);
    const { error } = await supabase().rpc("delete_my_account");
    if (error) { setBusy(false); return setMsg(error.message); }
    await signOut();
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="Profile & privacy" subtitle={profile.phone ? `+${profile.phone}` : profile.email ?? ""} action={<Badge tone="ova" className="capitalize">{profile.role}</Badge>} />
      <Card className="space-y-4">
        <p className="font-semibold text-ova-900">About you</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name"><Input value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} /></Field>
          <Field label="Date of birth"><Input type="date" value={f.date_of_birth} onChange={(e) => setF({ ...f, date_of_birth: e.target.value })} /></Field>
          <Field label="City"><Input value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} /></Field>
          <Field label="Language"><Select value={f.language} onChange={(e) => setF({ ...f, language: e.target.value })}><option value="en">English</option><option value="hi">हिन्दी (coming soon)</option></Select></Field>
          <Field label="Current goal">
            <Select value={f.goal_mode} onChange={(e) => setF({ ...f, goal_mode: e.target.value })}>{HEALTH_GOALS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select>
          </Field>
        </div>
      </Card>
      <Card className="space-y-4">
        <p className="font-semibold text-ova-900">Cycle settings</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Usual cycle length (days)"><Input type="number" min={15} max={90} value={c.avg_cycle_length} onChange={(e) => setC({ ...c, avg_cycle_length: Number(e.target.value) })} /></Field>
          <Field label="Usual period length (days)"><Input type="number" min={1} max={15} value={c.avg_period_length} onChange={(e) => setC({ ...c, avg_period_length: Number(e.target.value) })} /></Field>
          <Field label="Last period start (onboarding)"><Input type="date" value={c.last_period_start} onChange={(e) => setC({ ...c, last_period_start: e.target.value })} /></Field>
          <Field label="Contraception"><Select value={c.contraception} onChange={(e) => setC({ ...c, contraception: e.target.value })}>{CONTRACEPTION.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select></Field>
        </div>
        <p className="text-sm font-medium text-ova-900">Reminders</p>
        <div className="flex flex-wrap gap-4 text-sm">
          {([["period", "Upcoming period"], ["fertile", "Fertile window"], ["daily_log", "Daily logging nudge"]] as const).map(([k, l]) => (
            <label key={k} className="flex items-center gap-2"><input type="checkbox" className="accent-ova-600" checked={c.reminders[k]} onChange={(e) => setC({ ...c, reminders: { ...c.reminders, [k]: e.target.checked } })} />{l}</label>
          ))}
        </div>
      </Card>
      {msg && <Alert tone="success">{msg}</Alert>}
      <Button onClick={save} loading={busy}>Save changes</Button>

      <Card className="space-y-3">
        <p className="flex items-center gap-2 font-semibold text-ova-900"><ShieldCheck className="size-5 text-ova-600" />Consent (DPDP Act 2023)</p>
        {[["health_data", "Process my health data for tracking & predictions"], ["marketing", "Tips and offers"]].map(([k, l]) => {
          const cur = latest(k);
          return (
            <div key={k} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-ova-100 p-3 text-sm">
              <span>{l}<span className="block text-xs text-slate-500">{cur ? `${cur.granted ? "Granted" : "Withdrawn"} · ${fmtDateTime(cur.created_at)}` : "Not set"}</span></span>
              <Button variant={cur?.granted ? "secondary" : "primary"} className="py-1.5 text-xs" onClick={() => setConsent(k, !cur?.granted)}>{cur?.granted ? "Withdraw" : "Grant"}</Button>
            </div>
          );
        })}
        <p className="text-xs text-slate-500">Your data is shared with a doctor only when you book a consultation and choose to share it.</p>
      </Card>

      <Card className="space-y-4 border-rose-100">
        <p className="font-semibold text-ova-900">Your data</p>
        <Button variant="secondary" onClick={exportData}><Download className="size-4" />Download all my data (JSON)</Button>
        <div className="rounded-xl bg-rose-50 p-4">
          <p className="font-semibold text-rose-800">Delete my account</p>
          <p className="mt-1 text-sm text-rose-700">This permanently deletes your profile, logs, records and appointments. Type DELETE to confirm.</p>
          <div className="mt-3 flex gap-2">
            <Input value={confirmDelete} onChange={(e) => setConfirmDelete(e.target.value)} placeholder="DELETE" className="max-w-40" />
            <Button variant="danger" disabled={confirmDelete !== "DELETE"} loading={busy} onClick={deleteAccount}><Trash2 className="size-4" />Delete everything</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
