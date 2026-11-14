"use client";
import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BadgeCheck, Languages, Star } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { GOAL_LABEL } from "@/lib/constants";
import { Badge, Card, Chip, Empty, PageHeader, Spinner } from "@/components/ui";
import { DoctorAvatar, type Doctor } from "@/components/doctor";

function Directory() {
  const params = useSearchParams();
  const context = params.get("context") ?? "";
  const [doctors, setDoctors] = useState<Doctor[] | null>(null);
  const [femaleOnly, setFemaleOnly] = useState(false);
  const [spec, setSpec] = useState<string>(["pcod", "ttc", "menopause", "period"].includes(context) ? context : "");

  useEffect(() => {
    supabase().from("doctors").select("*").eq("verification_status", "verified").eq("is_accepting", true)
      .order("rating_avg", { ascending: false }).then(({ data }) => setDoctors((data ?? []) as Doctor[]));
  }, []);

  const list = useMemo(() => (doctors ?? []).filter((d) =>
    (!femaleOnly || d.gender === "female") && (!spec || d.specialties.includes(spec))), [doctors, femaleOnly, spec]);

  if (!doctors) return <Spinner />;
  return (
    <div className="space-y-6">
      <PageHeader title="Consult a gynaecologist" subtitle="Verified OB-GYNs · video, audio or chat · your cycle summary attached automatically" />
      <div className="flex flex-wrap gap-2">
        <Chip active={!spec} onClick={() => setSpec("")}>All</Chip>
        {["period", "pcod", "ttc", "menopause"].map((s) => <Chip key={s} active={spec === s} onClick={() => setSpec(s)}>{GOAL_LABEL[s]}</Chip>)}
        <span className="mx-1 w-px bg-ova-100" />
        <Chip active={femaleOnly} onClick={() => setFemaleOnly(!femaleOnly)}>👩‍⚕️ Female doctor only</Chip>
      </div>

      {list.length === 0 ? <Empty title="No doctors match" text="Try removing a filter." /> : (
        <div className="grid gap-4 md:grid-cols-2">
          {list.map((d) => (
            <Card key={d.id} className="flex flex-col">
              <div className="flex gap-4">
                <DoctorAvatar d={d} />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 font-bold text-ova-900">{d.full_name}<BadgeCheck className="size-4 text-ova-600" /></p>
                  <p className="text-sm text-slate-600">{d.qualification}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-x-3 text-xs text-slate-500">
                    <span>{d.experience_years} yrs exp.</span>
                    <span className="flex items-center gap-1"><Star className="size-3.5 fill-amber-400 text-amber-400" />{d.rating_avg || "New"} {d.rating_count ? `(${d.rating_count})` : ""}</span>
                    <span className="flex items-center gap-1"><Languages className="size-3.5" />{d.languages.join(", ")}</span>
                  </p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {d.specialties.map((s) => <Badge key={s} tone="gray">{GOAL_LABEL[s] ?? s}</Badge>)}
                {d.is_demo && <Badge tone="amber">Demo profile</Badge>}
              </div>
              {d.bio && <p className="mt-3 line-clamp-2 text-sm text-slate-600">{d.bio}</p>}
              <div className="mt-auto flex items-center justify-between pt-4">
                <p className="text-lg font-bold text-ova-900">₹{d.consultation_fee}<span className="text-xs font-normal text-slate-500"> / consult</span></p>
                <Link href={`/consult/${d.id}${context ? `?context=${context}` : ""}`} className="rounded-xl bg-ova-600 px-4 py-2 text-sm font-semibold text-white hover:bg-ova-700">Book</Link>
              </div>
            </Card>
          ))}
        </div>
      )}
      <p className="text-xs text-slate-500">All doctors are registered medical practitioners verified against their Medical Council registration. Consultations follow the Telemedicine Practice Guidelines, 2020. Not for emergencies — call 112.</p>
    </div>
  );
}

export default function ConsultPage() {
  return <Suspense fallback={<Spinner />}><Directory /></Suspense>;
}
