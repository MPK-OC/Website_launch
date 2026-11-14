"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase, SUPABASE_CONFIGURED } from "@/lib/supabase";

export interface Profile {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  date_of_birth: string | null;
  city: string | null;
  language: string;
  role: "user" | "doctor" | "admin";
  goal_mode: "track" | "pcod" | "ttc" | "menopause";
  onboarded_at: string | null;
}

interface Ctx {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const UserCtx = createContext<Ctx>({
  user: null, profile: null, loading: true, refreshProfile: async () => {}, signOut: async () => {},
});

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (u: User | null) => {
    if (!u) { setProfile(null); return; }
    const { data } = await supabase().from("profiles").select("*").eq("id", u.id).maybeSingle();
    setProfile(data as Profile | null);
  }, []);

  useEffect(() => {
    if (!SUPABASE_CONFIGURED) { setLoading(false); return; }
    const sb = supabase();
    sb.auth.getUser().then(async ({ data }) => {
      setUser(data.user);
      await loadProfile(data.user);
      setLoading(false);
    });
    const { data: sub } = sb.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        setUser(session?.user ?? null);
        loadProfile(session?.user ?? null);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [loadProfile]);

  const refreshProfile = useCallback(() => loadProfile(user), [loadProfile, user]);
  const signOut = useCallback(async () => {
    await supabase().auth.signOut();
    setUser(null);
    setProfile(null);
    window.location.href = "/";
  }, []);

  return (
    <UserCtx.Provider value={{ user, profile, loading, refreshProfile, signOut }}>{children}</UserCtx.Provider>
  );
}

export const useUser = () => useContext(UserCtx);
