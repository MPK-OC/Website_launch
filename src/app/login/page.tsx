"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Mail, Phone } from "lucide-react";
import { supabase, SUPABASE_CONFIGURED, track } from "@/lib/supabase";
import { Logo } from "@/components/Logo";
import { Alert, Button, Chip, Field, Input } from "@/components/ui";

function LoginForm() {
  const params = useSearchParams();
  const next = params.get("next") || "/dashboard";
  const [method, setMethod] = useState<"phone" | "email">("phone");
  const [value, setValue] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"enter" | "verify">("enter");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const target = method === "phone" ? `+91${value.replace(/\D/g, "").slice(-10)}` : value.trim().toLowerCase();

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (method === "phone" && value.replace(/\D/g, "").length < 10) return setError("Enter a 10-digit mobile number.");
    setBusy(true);
    const { error } = await supabase().auth.signInWithOtp(method === "phone" ? { phone: target } : { email: target });
    setBusy(false);
    if (error) {
      if (method === "phone" && /sms|provider|twilio/i.test(error.message))
        return setError("Real SMS is not enabled in test mode. Use a test number 99999 00001 – 99999 00005 (OTP 123456), or sign in with Email.");
      return setError(error.message);
    }
    setStep("verify");
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const { error } = await supabase().auth.verifyOtp(
      method === "phone" ? { phone: target, token: code, type: "sms" } : { email: target, token: code, type: "email" },
    );
    if (error) { setBusy(false); return setError(error.message); }
    track("login", { method });
    window.location.href = next; // full reload so proxy.ts sees the new session cookie
  }

  return (
    <div className="w-full max-w-md rounded-3xl border border-ova-100 bg-white p-8 shadow-xl shadow-ova-900/5">
      <div className="mb-6 text-center">
        <Logo tile size="md" />
        <h1 className="mt-5 text-2xl font-bold text-ova-900">{step === "enter" ? "Welcome to Ova Cure" : "Enter the code"}</h1>
        <p className="mt-1 text-sm text-slate-600">
          {step === "enter" ? "Sign in or create an account with a one-time code." : `We sent a 6-digit code to ${method === "phone" ? target : target}.`}
        </p>
      </div>

      {!SUPABASE_CONFIGURED && (
        <div className="mb-4"><Alert tone="warning" title="Backend not configured">Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local (see README).</Alert></div>
      )}

      {step === "enter" ? (
        <form onSubmit={send} className="space-y-4">
          <div className="flex gap-2">
            <Chip active={method === "phone"} onClick={() => { setMethod("phone"); setValue(""); }}><Phone className="mr-1 inline size-3.5" />Mobile</Chip>
            <Chip active={method === "email"} onClick={() => { setMethod("email"); setValue(""); }}><Mail className="mr-1 inline size-3.5" />Email</Chip>
          </div>
          {method === "phone" ? (
            <Field label="Mobile number" hint="Testing: use 99999 00001 – 00005 with code 123456 (no SMS is sent).">
              <div className="flex">
                <span className="inline-flex items-center rounded-l-xl border border-r-0 border-ova-200 bg-ova-50 px-3 text-sm text-ova-800">+91</span>
                <Input className="rounded-l-none" inputMode="numeric" autoFocus placeholder="98765 43210" value={value} onChange={(e) => setValue(e.target.value)} />
              </div>
            </Field>
          ) : (
            <Field label="Email address" hint="Locally, emails land in Mailpit: http://127.0.0.1:58324">
              <Input type="email" autoFocus required placeholder="you@example.com" value={value} onChange={(e) => setValue(e.target.value)} />
            </Field>
          )}
          {error && <Alert tone="urgent">{error}</Alert>}
          <Button type="submit" loading={busy} className="w-full">Send code</Button>
          <p className="text-center text-xs text-slate-500">By continuing you agree to our Terms and Privacy Policy. You&apos;ll confirm health-data consent next.</p>
        </form>
      ) : (
        <form onSubmit={verify} className="space-y-4">
          <Input inputMode="numeric" autoFocus maxLength={6} placeholder="••••••" value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} className="text-center text-2xl tracking-[0.5em]" />
          {error && <Alert tone="urgent">{error}</Alert>}
          <Button type="submit" loading={busy} disabled={code.length !== 6} className="w-full">Verify & continue</Button>
          <button type="button" onClick={() => { setStep("enter"); setCode(""); }} className="w-full text-sm text-ova-600 hover:underline">Change {method === "phone" ? "number" : "email"}</button>
        </form>
      )}
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="grid min-h-screen place-items-center bg-gradient-to-br from-ova-50 via-cream to-blush-50 px-4 py-10">
      <Suspense><LoginForm /></Suspense>
    </div>
  );
}
