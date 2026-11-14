"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Stethoscope } from "lucide-react";
import { supabase, track } from "@/lib/supabase";
import { addDays, todayISO } from "@/lib/dates";
import { CONTRACEPTION, HEALTH_GOALS } from "@/lib/constants";
import { useUser } from "@/components/UserProvider";
import { Logo } from "@/components/Logo";
import { Alert, Button, Card, cx, Field, Input, Select, Spinner } from "@/components/ui";

type Goal = "track" | "pcod" | "ttc" | "menopause";

export default function Onboarding() {
  const { user, profile, loading, refreshProfile } = useUser();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [f, setF] = useState({
    full_name: "", date_of_birth: "", city: "", language: "en",
    goal: "track" as Goal, last_period_start: "", unsure_date: false, avg_cycle_length: 28, avg_period_length: 5,
    contraception: "none", consent_terms: false, consent_health: false, consent_marketing: false,
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
    if (profile?.onboarded_at) router.replace("/dashboard");
  }, [loading, user, profile, router]);

  if (loading || !user) return <Spinner />;

  async function finish() {
    setError(null);
    if (!f.consent_terms || !f.consent_health) return setError("Please accept the terms and health-data consent to continue.");
    setBusy(true);
    const sb = supabase();
    const uid = user!.id;
    const lastStart = f.unsure_date ? null : f.last_period_start || null;
    const r1 = await sb.from("profiles").update({
      full_name: f.full_name.trim(), date_of_birth: f.date_of_birth || null, city: f.city || null,
      language: f.language, goal_mode: f.goal, onboarded_at: new Date().toISOString(),
    }).eq("id", uid);
    if (r1.error) { setBusy(false); return setError(r1.error.message); }
    await sb.from("cycle_profiles").upsert({
      user_id: uid, avg_cycle_length: f.avg_cycle_length, avg_period_length: f.avg_period_length,
      last_period_start: lastStart, contraception: f.contraception, health_goals: [f.goal],
    });
    if (lastStart && f.goal !== "menopause") {
      await sb.from("periods").upsert({ user_id: uid, start_date: lastStart, end_date: addDays(lastStart, f.avg_period_length - 1) }, { onConflict: "user_id,start_date" });
    }
    await sb.from("consents").insert([
      { user_id: uid, consent_type: "terms", granted: true },
      { user_id: uid, consent_type: "privacy", granted: true },
      { user_id: uid, consent_type: "health_data", granted: true },
      { user_id: uid, consent_type: "marketing", granted: f.consent_marketing },
    ]);
    if (f.goal === "ttc") await sb.from("ttc_journeys").insert({ user_id: uid });
    await sb.from("notifications").insert({
      user_id: uid, kind: "welcome", title: "Welcome to Ova Cure 💜", body: "Log how you feel today to start building your insights.", link: "/tracker/log",
    });
    track("onboarding_completed", { goal: f.goal });
    await refreshProfile();
    router.replace(f.goal === "pcod" ? "/pcod" : f.goal === "menopause" ? "/menopause" : f.goal === "ttc" ? "/pregnancy" : "/dashboard");
  }

  const steps = ["About you", "Your goal", "Your cycle", "Consent"];
  const canNext = [f.full_name.trim().length > 1, true, f.goal === "menopause" || f.unsure_date || !!f.last_period_start, true][step];

  return (
    <div className="min-h-screen bg-gradient-to-br from-ova-50 via-cream to-blush-50 px-4 py-10">
      <div className="mx-auto max-w-xl">
        <div className="mb-8 flex items-center justify-between">
          <Logo href={null} />
          <span className="text-sm text-slate-500">Step {step + 1} of {steps.length}</span>
        </div>
        <div className="mb-6 flex gap-2">
          {steps.map((s, i) => <div key={s} className={cx("h-1.5 flex-1 rounded-full", i <= step ? "bg-ova-600" : "bg-ova-100")} />)}
        </div>

        <Card className="p-7">
          {step === 0 && (
            <div className="space-y-4">
              <h1 className="text-2xl font-bold text-ova-900">Let&apos;s get to know you</h1>
              <Field label="Your name"><Input value={f.full_name} onChange={(e) => set("full_name", e.target.value)} placeholder="Priya" autoFocus /></Field>
              <Field label="Date of birth" hint="Helps us personalise insights (we only show your age to doctors).">
                <Input type="date" max={todayISO()} value={f.date_of_birth} onChange={(e) => set("date_of_birth", e.target.value)} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="City (optional)"><Input value={f.city} onChange={(e) => set("city", e.target.value)} placeholder="Delhi" /></Field>
                <Field label="Language">
                  <Select value={f.language} onChange={(e) => set("language", e.target.value)}>
                    <option value="en">English</option><option value="hi">हिन्दी (coming soon)</option>
                  </Select>
                </Field>
              </div>
              <button onClick={() => router.push("/doctor")} className="flex w-full items-center gap-3 rounded-xl border border-dashed border-ova-200 p-3 text-left text-sm text-ova-700 hover:bg-ova-50">
                <Stethoscope className="size-5" /><span>I&apos;m a gynaecologist — <b>apply to join as a doctor</b></span>
              </button>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-3">
              <h1 className="text-2xl font-bold text-ova-900">What brings you to Ova Cure?</h1>
              <p className="text-sm text-slate-600">You can switch any time from your profile.</p>
              {HEALTH_GOALS.map(([k, label, emoji, desc]) => (
                <button key={k} onClick={() => set("goal", k as Goal)}
                  className={cx("flex w-full items-start gap-4 rounded-2xl border p-4 text-left transition",
                    f.goal === k ? "border-ova-600 bg-ova-50 ring-4 ring-ova-100" : "border-ova-100 hover:border-ova-300")}>
                  <span className="text-2xl">{emoji}</span>
                  <span><span className="block font-semibold text-ova-900">{label}</span><span className="text-sm text-slate-600">{desc}</span></span>
                </button>
              ))}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h1 className="text-2xl font-bold text-ova-900">{f.goal === "menopause" ? "Your periods" : "Tell us about your cycle"}</h1>
              <Field label={f.goal === "menopause" ? "When did your last period start? (approx.)" : "When did your last period start?"}>
                <Input type="date" max={todayISO()} disabled={f.unsure_date} value={f.last_period_start} onChange={(e) => set("last_period_start", e.target.value)} />
              </Field>
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input type="checkbox" checked={f.unsure_date} onChange={(e) => set("unsure_date", e.target.checked)} className="accent-ova-600" />
                I don&apos;t remember / not sure
              </label>
              {f.goal !== "menopause" && (
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Usual cycle length (days)" hint="Typical: 21–35">
                    <Input type="number" min={15} max={90} value={f.avg_cycle_length} onChange={(e) => set("avg_cycle_length", Number(e.target.value))} />
                  </Field>
                  <Field label="Usual period length (days)" hint="Typical: 3–7">
                    <Input type="number" min={1} max={15} value={f.avg_period_length} onChange={(e) => set("avg_period_length", Number(e.target.value))} />
                  </Field>
                </div>
              )}
              <Field label="Contraception">
                <Select value={f.contraception} onChange={(e) => set("contraception", e.target.value)}>
                  {CONTRACEPTION.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </Select>
              </Field>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <ShieldCheck className="size-10 text-ova-600" />
              <h1 className="text-2xl font-bold text-ova-900">Your privacy comes first</h1>
              <p className="text-sm text-slate-600">Reproductive health data is sensitive. We encrypt it, never sell it, and only share it with a doctor when you book a consultation and agree to share.</p>
              {[
                ["consent_terms", "I agree to the Terms of Use and Privacy Policy.", true],
                ["consent_health", "I consent to Ova Cure processing my health data to provide tracking, predictions and care (DPDP Act 2023).", true],
                ["consent_marketing", "Send me helpful tips and offers (optional).", false],
              ].map(([k, label, req]) => (
                <label key={k as string} className="flex items-start gap-3 rounded-xl border border-ova-100 p-3 text-sm">
                  <input type="checkbox" className="mt-0.5 accent-ova-600" checked={f[k as "consent_terms"]} onChange={(e) => set(k as "consent_terms", e.target.checked)} />
                  <span>{label as string} {req ? <span className="text-rose-500">*</span> : null}</span>
                </label>
              ))}
              <p className="text-xs text-slate-500">Predictions are estimates and not a diagnosis or contraception method. You can withdraw consent or delete all your data from Profile at any time.</p>
            </div>
          )}

          {error && <div className="mt-4"><Alert tone="urgent">{error}</Alert></div>}

          <div className="mt-7 flex justify-between">
            <Button variant="ghost" onClick={() => setStep((s) => s - 1)} disabled={step === 0}>Back</Button>
            {step < steps.length - 1
              ? <Button onClick={() => setStep((s) => s + 1)} disabled={!canNext}>Continue</Button>
              : <Button onClick={finish} loading={busy}>Finish setup</Button>}
          </div>
        </Card>
      </div>
    </div>
  );
}
