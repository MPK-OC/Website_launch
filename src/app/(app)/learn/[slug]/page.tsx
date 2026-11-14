"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, Stethoscope } from "lucide-react";
import { supabase, track } from "@/lib/supabase";
import { Markdown } from "@/components/Markdown";
import { Card, Empty, LinkButton, Spinner } from "@/components/ui";

interface Article { slug: string; title: string; summary: string; body: string; cover_emoji: string; read_minutes: number; reviewed_by: string | null; video_url: string | null; segments: string[] }

export default function ArticlePage() {
  const { slug } = useParams<{ slug: string }>();
  const [a, setA] = useState<Article | null | undefined>(undefined);
  useEffect(() => {
    supabase().from("articles").select("*").eq("slug", slug).maybeSingle().then(({ data }) => {
      setA(data as Article | null);
      if (data) track("article_view", { slug });
    });
  }, [slug]);
  if (a === undefined) return <Spinner />;
  if (!a) return <Empty title="Article not found" action={<LinkButton href="/learn">Back to Learn</LinkButton>} />;
  const ctx = a.segments.includes("menopause") ? "menopause" : a.segments.includes("pcod") ? "pcod" : a.segments.includes("ttc") ? "ttc" : "period";
  return (
    <article className="mx-auto max-w-2xl">
      <Link href="/learn" className="mb-4 inline-flex items-center gap-1 text-sm text-ova-600"><ArrowLeft className="size-4" />Learn</Link>
      <span className="text-5xl">{a.cover_emoji}</span>
      <h1 className="mt-3 text-3xl font-bold text-ova-900">{a.title}</h1>
      <p className="mt-2 text-slate-600">{a.summary}</p>
      <p className="mt-2 text-xs text-slate-400">{a.read_minutes} min read{a.reviewed_by ? ` · Reviewed by: ${a.reviewed_by}` : ""}</p>
      {a.video_url && <a href={a.video_url} target="_blank" rel="noreferrer" className="mt-4 block text-sm font-semibold text-ova-600">▶ Watch the video</a>}
      <div className="mt-6"><Markdown text={a.body} /></div>
      <Card className="mt-10 flex flex-col items-start gap-3 bg-ova-50 sm:flex-row sm:items-center">
        <Stethoscope className="size-6 text-ova-600" />
        <p className="flex-1 text-sm text-ova-900">Have questions about this? A gynaecologist can give advice for your situation.</p>
        <LinkButton href={`/consult?context=${ctx}`}>Consult a doctor</LinkButton>
      </Card>
    </article>
  );
}
