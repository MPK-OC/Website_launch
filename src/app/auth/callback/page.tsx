"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { EmailOtpType } from "@supabase/supabase-js";
import { supabase, track } from "@/lib/supabase";
import { Logo } from "@/components/Logo";
import { Alert } from "@/components/ui";

/** Landing page for the sign-in link in Supabase's emails. Creates the session, then goes to `next`. */
function Callback() {
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const raw = params.get("next") || "/dashboard";
    const next = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/dashboard"; // same-site only
    const sb = supabase();

    (async () => {
      const linkError = params.get("error_description");
      if (linkError) return setError(linkError);

      const code = params.get("code");
      const tokenHash = params.get("token_hash");
      const type = params.get("type") as EmailOtpType | null;

      let err: { message: string } | null = null;
      if (code) ({ error: err } = await sb.auth.exchangeCodeForSession(code));
      else if (tokenHash && type) ({ error: err } = await sb.auth.verifyOtp({ token_hash: tokenHash, type }));
      if (err) return setError(err.message);

      // Older links put the session in the URL hash; the client picks that up on its own.
      const { data } = await sb.auth.getSession();
      if (!data.session) return setError("This sign-in link is invalid or has expired.");

      track("login", { method: "email_link" });
      window.location.replace(next); // full reload so proxy.ts sees the new session cookie
    })();
  }, [params]);

  return (
    <div className="w-full max-w-md rounded-3xl border border-ova-100 bg-white p-8 text-center shadow-xl shadow-ova-900/5">
      <Logo tile size="md" />
      {error ? (
        <div className="mt-6 space-y-4 text-left">
          <Alert tone="urgent">{error}</Alert>
          <a href="/login" className="block text-center text-sm text-ova-600 hover:underline">Back to sign in</a>
        </div>
      ) : (
        <p className="mt-6 text-sm text-slate-600">Signing you in…</p>
      )}
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <div className="grid min-h-screen place-items-center bg-gradient-to-br from-ova-50 via-cream to-blush-50 px-4 py-10">
      <Suspense><Callback /></Suspense>
    </div>
  );
}
