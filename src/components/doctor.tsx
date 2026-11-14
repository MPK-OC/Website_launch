export interface Doctor {
  id: string; full_name: string; gender: string | null; qualification: string; experience_years: number; languages: string[];
  specialties: string[]; consultation_fee: number; bio: string | null; rating_avg: number; rating_count: number;
  registration_number: string; medical_council: string; is_demo: boolean; photo_url: string | null;
}

export function DoctorAvatar({ d, size = "size-14" }: { d: Pick<Doctor, "full_name" | "gender">; size?: string }) {
  const initials = d.full_name.replace(/^Dr\.?\s*/i, "").split(" ").map((x) => x[0]).slice(0, 2).join("");
  return <div className={`${size} grid shrink-0 place-items-center rounded-2xl ${d.gender === "female" ? "bg-blush-100 text-blush-500" : "bg-ova-100 text-ova-700"} text-lg font-bold`}>{initials}</div>;
}
