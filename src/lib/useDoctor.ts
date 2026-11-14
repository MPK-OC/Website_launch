"use client";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabase";
import { useUser } from "@/components/UserProvider";

export interface DoctorRow {
  id: string; user_id: string; full_name: string; gender: string | null; qualification: string; registration_number: string;
  medical_council: string; experience_years: number; languages: string[]; specialties: string[]; consultation_fee: number;
  bio: string | null; verification_status: "pending" | "verified" | "rejected" | "suspended"; verification_note: string | null;
  is_accepting: boolean; rating_avg: number; rating_count: number;
}

/** The logged-in user's doctor record (null if they never applied). */
export function useMyDoctor() {
  const { user } = useUser();
  const [doctor, setDoctor] = useState<DoctorRow | null>(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase().from("doctors").select("*").eq("user_id", user.id).maybeSingle();
    setDoctor(data as DoctorRow | null);
    setLoading(false);
  }, [user]);
  useEffect(() => { load(); }, [load]);
  return { doctor, loading, reload: load };
}
