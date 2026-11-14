"use client";
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

export const SUPABASE_CONFIGURED = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

/** Fixed cookie name so the browser (via /sb) and proxy.ts (direct URL) share the same session. */
export const AUTH_COOKIE = "sb-ovacure-auth-token";

let client: SupabaseClient | null = null;

/** Browser Supabase client. Requests go to <this site>/sb/* which next.config.ts forwards to Supabase. */
export function supabase(): SupabaseClient {
  if (!client) {
    const url = typeof window !== "undefined"
      ? `${window.location.origin}/sb`
      : process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://localhost:58321";
    client = createBrowserClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "missing-key", {
      cookieOptions: { name: AUTH_COOKIE },
    });
  }
  return client;
}

/** Lightweight product analytics (events table, readable by admins). Never blocks the UI. */
export function track(name: string, props: Record<string, unknown> = {}) {
  const sb = supabase();
  sb.auth.getUser().then(({ data }) => {
    if (data.user) sb.from("events").insert({ user_id: data.user.id, name, props }).then(() => {});
  });
}
