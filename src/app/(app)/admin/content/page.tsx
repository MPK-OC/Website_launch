"use client";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { GOAL_LABEL } from "@/lib/constants";
import { AdminGuard } from "@/components/AdminGuard";
import { Markdown } from "@/components/Markdown";
import { Alert, Badge, Button, Card, Chip, Field, Input, PageHeader, Spinner, Textarea } from "@/components/ui";

interface Article { id?: string; slug: string; title: string; summary: string; body: string; category: string; segments: string[]; cover_emoji: string; read_minutes: number; reviewed_by: string; video_url: string; published: boolean }
const BLANK: Article = { slug: "", title: "", summary: "", body: "", category: "basics", segments: ["track"], cover_emoji: "🌸", read_minutes: 3, reviewed_by: "", video_url: "", published: false };

function Content() {
  const [rows, setRows] = useState<Article[] | null>(null);
  const [edit, setEdit] = useState<Article | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const load = useCallback(async () => {
    const { data } = await supabase().from("articles").select("*").order("created_at", { ascending: false });
    setRows((data ?? []) as Article[]);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function save() {
    if (!edit) return;
    setErr(null);
    const slug = edit.slug || edit.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const row = { ...edit, slug, video_url: edit.video_url || null, reviewed_by: edit.reviewed_by || null };
    const { error } = edit.id ? await supabase().from("articles").update(row).eq("id", edit.id) : await supabase().from("articles").insert(row);
    if (error) return setErr(error.message);
    setEdit(null);
    load();
  }
  if (!rows) return <Spinner />;

  if (edit) return (
    <div className="space-y-5">
      <PageHeader title={edit.id ? "Edit article" : "New article"} action={<Button variant="ghost" onClick={() => setEdit(null)}>Back</Button>} />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="space-y-3">
          <div className="grid grid-cols-[80px_1fr] gap-3">
            <Field label="Emoji"><Input value={edit.cover_emoji} onChange={(e) => setEdit({ ...edit, cover_emoji: e.target.value })} /></Field>
            <Field label="Title"><Input value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></Field>
          </div>
          <Field label="Summary"><Input value={edit.summary} onChange={(e) => setEdit({ ...edit, summary: e.target.value })} /></Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Slug"><Input value={edit.slug} onChange={(e) => setEdit({ ...edit, slug: e.target.value })} placeholder="auto" /></Field>
            <Field label="Category"><Input value={edit.category} onChange={(e) => setEdit({ ...edit, category: e.target.value })} /></Field>
            <Field label="Read min"><Input type="number" value={edit.read_minutes} onChange={(e) => setEdit({ ...edit, read_minutes: Number(e.target.value) })} /></Field>
          </div>
          <Field label="Segments">
            <div className="flex flex-wrap gap-2">{["track", "pcod", "ttc", "menopause"].map((s) => (
              <Chip key={s} active={edit.segments.includes(s)} onClick={() => setEdit({ ...edit, segments: edit.segments.includes(s) ? edit.segments.filter((x) => x !== s) : [...edit.segments, s] })}>{GOAL_LABEL[s]}</Chip>
            ))}</div>
          </Field>
          <Field label="Body" hint="Use ## for headings, - for bullet lists, **bold**"><Textarea rows={14} value={edit.body} onChange={(e) => setEdit({ ...edit, body: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Medically reviewed by"><Input value={edit.reviewed_by} onChange={(e) => setEdit({ ...edit, reviewed_by: e.target.value })} placeholder="Dr. …" /></Field>
            <Field label="Video URL (optional)"><Input value={edit.video_url} onChange={(e) => setEdit({ ...edit, video_url: e.target.value })} /></Field>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-ova-600" checked={edit.published} onChange={(e) => setEdit({ ...edit, published: e.target.checked })} />Published</label>
          {err && <Alert tone="urgent">{err}</Alert>}
          <Button onClick={save}>Save article</Button>
        </Card>
        <Card>
          <p className="mb-2 text-xs font-semibold uppercase text-slate-400">Preview</p>
          <span className="text-4xl">{edit.cover_emoji}</span>
          <h2 className="mt-2 text-2xl font-bold text-ova-900">{edit.title || "Untitled"}</h2>
          <p className="text-slate-600">{edit.summary}</p>
          <div className="mt-4"><Markdown text={edit.body} /></div>
        </Card>
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      <PageHeader title="Content" subtitle="Articles shown in Learn and on dashboards" action={<Button onClick={() => setEdit({ ...BLANK })}>New article</Button>} />
      <Card className="p-0">
        {rows.map((a) => (
          <button key={a.id} onClick={() => setEdit({ ...BLANK, ...a, reviewed_by: a.reviewed_by ?? "", video_url: a.video_url ?? "" })} className="flex w-full items-center gap-3 border-b border-ova-50 p-4 text-left last:border-0 hover:bg-ova-50/50">
            <span className="text-2xl">{a.cover_emoji}</span>
            <span className="flex-1"><span className="block font-semibold text-ova-900">{a.title}</span><span className="text-xs text-slate-500">{a.segments.map((s) => GOAL_LABEL[s]).join(", ")} · reviewed by {a.reviewed_by || "—"}</span></span>
            <Badge tone={a.published ? "green" : "gray"}>{a.published ? "Published" : "Draft"}</Badge>
          </button>
        ))}
      </Card>
    </div>
  );
}

export default function AdminContent() {
  return <AdminGuard><Content /></AdminGuard>;
}
