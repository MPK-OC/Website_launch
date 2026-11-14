"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { CalendarCheck, Plus, Video } from "lucide-react";
import { useUser } from "@/components/UserProvider";
import { useTracker } from "@/lib/useTracker";
import { supabase } from "@/lib/supabase";
import { fmtDate, fmtDateTime } from "@/lib/dates";
import { isFertileToday, nextPeriodLabel, PHASE_INFO } from "@/lib/cycle";
import { FlagList, QuickLinks } from "@/components/tracker";
import { Badge, Card, Disclaimer, LinkButton, Spinner } from "@/components/ui";

interface Appt { id: string; scheduled_at: string; mode: string; status: string; doctors: { full_name: string } | null }
interface Article { slug: string; title: string; summary: string; cover_emoji: string; read_minutes: number }

export default function Dashboard() {
  const { profile, user } = useUser();
  const t = useTracker();
  const [appt, setAppt] = useState<Appt | null>(null);
  const [articles, setArticles] = useState<Article[]>([]);

  useEffect(() => {
    if (!user || !profile) return;
    const sb = supabase();
    sb.from("appointments").select("id,scheduled_at,mode,status,doctors(full_name)").eq("user_id", user.id)
      .in("status", ["confirmed", "requested", "in_progress"]).gte("scheduled_at", new Date(Date.now() - 3600e3).toISOString())
      .order("scheduled_at").limit(1).then(({ data }) => setAppt((data?.[0] as unknown as Appt) ?? null));
    sb.from("articles").select("slug,title,summary,cover_emoji,read_minutes").contains("segments", [profile.goal_mode]).limit(3)
      .then(({ data }) => setArticles((data ?? []) as Article[]));
  }, [user, profile]);

  if (t.loading || !profile) return <Spinner />;
  const s = t.stats;
  const phase = s.phase ? PHASE_INFO[s.phase] : null;
  const todayLogged = t.logMap.has(t.today);
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ova-900 sm:text-3xl">{greet}, {profile.full_name?.split(" ")[0] || "there"} 💜</h1>
        <p className="mt-1 text-sm text-slate-600">{new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}</p>
      </div>

      <FlagList flags={t.flags} />

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Cycle ring */}
        <Card className="lg:col-span-2">
          {profile.goal_mode === "menopause" ? (
            <div className="flex flex-col items-start gap-3">
              <Badge tone="amber">Menopause care</Badge>
              <h2 className="text-xl font-bold text-ova-900">How are you feeling today?</h2>
              <p className="text-sm text-slate-600">Log hot flashes, sleep and mood to track your symptom score over time.</p>
              <LinkButton href="/menopause">Log today&apos;s symptoms</LinkButton>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-6 sm:flex-row">
              <div className="relative grid size-44 shrink-0 place-items-center rounded-full p-3"
                style={{ background: `conic-gradient(${phase?.color ?? "#c7a5f0"} ${Math.min(100, ((s.cycleDay ?? 0) / s.avgCycle) * 100)}%, #efe5fc 0)` }}>
                <div className="grid size-full place-items-center rounded-full bg-white text-center">
                  <div>
                    <p className="text-xs text-slate-500">Next period</p>
                    <p className="text-2xl font-extrabold text-ova-900">{nextPeriodLabel(s)}</p>
                    {s.cycleDay && <p className="text-xs font-semibold" style={{ color: phase?.color }}>Cycle day {s.cycleDay}</p>}
                  </div>
                </div>
              </div>
              <div className="flex-1 space-y-3">
                {phase && <Badge tone="ova">{phase.label}</Badge>}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-xl bg-blush-50 p-3"><p className="text-xs text-slate-500">Expected</p><p className="font-bold text-ova-900">{fmtDate(s.nextPeriod, { day: "numeric", month: "short", weekday: "short" })}</p></div>
                  <div className="rounded-xl bg-emerald-50 p-3"><p className="text-xs text-slate-500">Fertile window</p><p className="font-bold text-emerald-800">{s.fertileStart ? `${fmtDate(s.fertileStart)} – ${fmtDate(s.fertileEnd)}` : "—"}</p></div>
                </div>
                <p className="text-xs text-slate-500">Confidence: <b className="capitalize text-ova-700">{s.confidence}</b> · {s.confidenceNote}</p>
                {isFertileToday(s, t.today) && <p className="text-sm font-medium text-emerald-700">🌿 You are likely in your fertile window today.</p>}
                {phase && <p className="text-sm text-slate-700">💡 {phase.tip}</p>}
              </div>
            </div>
          )}
        </Card>

        {/* Today */}
        <Card className="flex flex-col justify-between bg-gradient-to-br from-ova-600 to-ova-800 text-white">
          <div>
            <p className="text-sm text-ova-100">Today&apos;s log</p>
            <p className="mt-1 text-xl font-bold">{todayLogged ? "Logged ✓ Nice work!" : "How do you feel today?"}</p>
            <p className="mt-2 text-sm text-ova-100">Daily logs make your predictions and insights more accurate.</p>
          </div>
          <Link href="/tracker/log" className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-ova-700 hover:bg-ova-50">
            <Plus className="size-4" /> {todayLogged ? "Edit today" : "Log symptoms"}
          </Link>
        </Card>
      </div>

      {appt && (
        <Card className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <CalendarCheck className="size-8 text-ova-600" />
          <div className="flex-1">
            <p className="font-semibold text-ova-900">Upcoming consultation with {appt.doctors?.full_name}</p>
            <p className="text-sm text-slate-600">{fmtDateTime(appt.scheduled_at)} · {appt.mode}</p>
          </div>
          <LinkButton href={`/appointments/${appt.id}`}><Video className="size-4" />Open</LinkButton>
        </Card>
      )}

      <QuickLinks items={[
        ["/consult", "🩺", "Consult a gynaecologist"],
        ["/pcod", "🌿", "PCOD care"],
        ["/pregnancy", "👶", "Pregnancy planning"],
        ["/menopause", "🌺", "Menopause care"],
      ]} />

      {articles.length > 0 && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold text-ova-900">For you</h2>
            <Link href="/learn" className="text-sm font-semibold text-ova-600">See all</Link>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {articles.map((a) => (
              <Link key={a.slug} href={`/learn/${a.slug}`} className="rounded-2xl border border-ova-100 bg-white p-5 hover:border-ova-300">
                <span className="text-3xl">{a.cover_emoji}</span>
                <p className="mt-3 font-semibold text-ova-900">{a.title}</p>
                <p className="mt-1 line-clamp-2 text-sm text-slate-600">{a.summary}</p>
                <p className="mt-2 text-xs text-slate-400">{a.read_minutes} min read</p>
              </Link>
            ))}
          </div>
        </div>
      )}

      <Disclaimer />
    </div>
  );
}
