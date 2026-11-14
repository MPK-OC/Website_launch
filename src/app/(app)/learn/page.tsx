"use client";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { GOAL_LABEL } from "@/lib/constants";
import { Chip, PageHeader, Spinner } from "@/components/ui";

interface Article { slug: string; title: string; summary: string; cover_emoji: string; read_minutes: number; segments: string[]; category: string }

function Library() {
  const initial = useSearchParams().get("segment") ?? "";
  const [seg, setSeg] = useState(initial);
  const [items, setItems] = useState<Article[] | null>(null);
  useEffect(() => {
    supabase().from("articles").select("slug,title,summary,cover_emoji,read_minutes,segments,category").eq("published", true).order("created_at")
      .then(({ data }) => setItems((data ?? []) as Article[]));
  }, []);
  if (!items) return <Spinner />;
  const list = seg ? items.filter((a) => a.segments.includes(seg)) : items;
  return (
    <div className="space-y-6">
      <PageHeader title="Learn" subtitle="Medically reviewed articles for every stage" />
      <div className="flex flex-wrap gap-2">
        <Chip active={!seg} onClick={() => setSeg("")}>All</Chip>
        {["track", "pcod", "ttc", "menopause"].map((s) => <Chip key={s} active={seg === s} onClick={() => setSeg(s)}>{GOAL_LABEL[s]}</Chip>)}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((a) => (
          <Link key={a.slug} href={`/learn/${a.slug}`} className="rounded-2xl border border-ova-100 bg-white p-5 transition hover:border-ova-300 hover:shadow-sm">
            <span className="text-3xl">{a.cover_emoji}</span>
            <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-ova-500">{a.category}</p>
            <p className="mt-1 font-semibold text-ova-900">{a.title}</p>
            <p className="mt-1 text-sm text-slate-600">{a.summary}</p>
            <p className="mt-3 text-xs text-slate-400">{a.read_minutes} min read</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function LearnPage() {
  return <Suspense fallback={<Spinner />}><Library /></Suspense>;
}
