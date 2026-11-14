"use client";
import Link from "next/link";
import { useState } from "react";
import { AlertTriangle, ChevronLeft, ChevronRight, Info, Siren } from "lucide-react";
import { dayKind, hormoneLevels, PHASE_INFO, type CycleStats, type LogRow, type PeriodRow } from "@/lib/cycle";
import { monthMatrix, todayISO } from "@/lib/dates";
import type { Flag } from "@/lib/useTracker";
import { cx, LinkButton } from "./ui";

const KIND_STYLE = {
  period: "bg-blush-500 text-white",
  predicted: "border-2 border-dashed border-blush-400 text-blush-500",
  fertile: "bg-emerald-100 text-emerald-800",
  ovulation: "bg-emerald-500 text-white",
};

export function CycleCalendar({ stats, periods, logMap, onPick, selected }: {
  stats: CycleStats; periods: PeriodRow[]; logMap: Map<string, LogRow>; onPick?: (d: string) => void; selected?: string;
}) {
  const now = new Date();
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const cells = monthMatrix(ym.y, ym.m);
  const today = todayISO();
  const move = (d: number) => setYm(({ y, m }) => { const nm = m + d; return { y: y + Math.floor(nm / 12), m: ((nm % 12) + 12) % 12 }; });

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <button onClick={() => move(-1)} className="rounded-lg p-1.5 hover:bg-ova-50" aria-label="Previous month"><ChevronLeft className="size-5" /></button>
        <p className="font-semibold text-ova-900">{new Date(ym.y, ym.m).toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</p>
        <button onClick={() => move(1)} className="rounded-lg p-1.5 hover:bg-ova-50" aria-label="Next month"><ChevronRight className="size-5" /></button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-slate-400">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => <div key={i} className="py-1">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (!d) return <div key={i} />;
          const kind = dayKind(d, stats, periods, logMap);
          const logged = logMap.has(d);
          return (
            <button key={d} onClick={() => onPick?.(d)}
              className={cx("relative grid aspect-square place-items-center rounded-full text-sm transition hover:ring-2 hover:ring-ova-300",
                kind ? KIND_STYLE[kind] : "text-ova-900",
                d === today && "ring-2 ring-ova-600",
                selected === d && "ring-2 ring-offset-1 ring-ova-900")}>
              {Number(d.slice(8))}
              {logged && <span className="absolute bottom-1 size-1 rounded-full bg-ova-600" />}
            </button>
          );
        })}
      </div>
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-600">
        <Legend cls="bg-blush-500" label="Period" />
        <Legend cls="border-2 border-dashed border-blush-400" label="Predicted period" />
        <Legend cls="bg-emerald-100" label="Fertile window" />
        <Legend cls="bg-emerald-500" label="Ovulation (est.)" />
        <span className="flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-ova-600" />Logged</span>
      </div>
    </div>
  );
}
const Legend = ({ cls, label }: { cls: string; label: string }) => <span className="flex items-center gap-1.5"><span className={cx("size-3 rounded-full", cls)} />{label}</span>;

/** Educational hormone curve for the user's cycle length, with a marker on today. */
export function HormoneChart({ cycleLen, day }: { cycleLen: number; day: number | null }) {
  const W = 600, H = 180, P = 24;
  const x = (d: number) => P + ((d - 1) / (cycleLen - 1)) * (W - 2 * P);
  const y = (v: number) => H - P - v * (H - 2 * P);
  const path = (key: "estrogen" | "progesterone" | "lh") =>
    Array.from({ length: cycleLen * 2 }, (_, i) => 1 + (i * (cycleLen - 1)) / (cycleLen * 2 - 1))
      .map((d, i) => `${i ? "L" : "M"}${x(d).toFixed(1)},${y(hormoneLevels(d, cycleLen)[key]).toFixed(1)}`).join(" ");
  const ov = cycleLen - 14;
  const today = day && day <= cycleLen ? day : null;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Typical hormone levels across your cycle">
        <rect x={x(1)} y={P} width={x(5) - x(1)} height={H - 2 * P} fill="#ffe1ec" opacity="0.6" />
        <rect x={x(ov - 1)} y={P} width={x(ov + 1) - x(ov - 1)} height={H - 2 * P} fill="#d1fae5" opacity="0.7" />
        <path d={path("estrogen")} fill="none" stroke="#9b66d8" strokeWidth="3" strokeLinecap="round" />
        <path d={path("progesterone")} fill="none" stroke="#f0a04b" strokeWidth="3" strokeLinecap="round" />
        <path d={path("lh")} fill="none" stroke="#2fa58a" strokeWidth="2" strokeDasharray="4 4" />
        {today && (
          <g>
            <line x1={x(today)} x2={x(today)} y1={P - 8} y2={H - P} stroke="#2f1a4b" strokeWidth="1.5" />
            <text x={x(today)} y={P - 11} textAnchor="middle" fontSize="11" fontWeight="700" fill="#2f1a4b">Today</text>
          </g>
        )}
        {[1, Math.round(cycleLen / 2), cycleLen].map((d) => (
          <text key={d} x={x(d)} y={H - 6} textAnchor="middle" fontSize="11" fill="#94a3b8">Day {d}</text>
        ))}
      </svg>
      <div className="mt-1 flex flex-wrap gap-4 text-xs text-slate-600">
        <span className="flex items-center gap-1.5"><span className="h-1 w-4 rounded bg-ova-500" />Oestrogen</span>
        <span className="flex items-center gap-1.5"><span className="h-1 w-4 rounded bg-[#f0a04b]" />Progesterone</span>
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 border-t-2 border-dashed border-emerald-600" />LH</span>
      </div>
      <p className="mt-2 text-xs text-slate-500">General educational curves based on cycle day — not lab measurements.</p>
    </div>
  );
}

export function PhaseCard({ stats }: { stats: CycleStats }) {
  if (!stats.phase) return null;
  const p = PHASE_INFO[stats.phase];
  return (
    <div className={cx("rounded-2xl p-5", p.bg)}>
      <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: p.color }}>Day {stats.cycleDay} · {p.label}</p>
      <p className="mt-1 text-sm text-ova-900">{p.hormones}</p>
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        {([["Mood", p.mood], ["Energy", p.energy], ["Skin", p.skin], ["Appetite", p.appetite]] as const).map(([k, v]) => (
          <div key={k}><dt className="font-semibold text-ova-900">{k}</dt><dd className="text-slate-700">{v}</dd></div>
        ))}
      </dl>
    </div>
  );
}

export function FlagList({ flags, context = "period" }: { flags: Flag[]; context?: string }) {
  if (!flags.length) return null;
  return (
    <div className="space-y-3">
      {flags.map((f) => {
        const Icon = f.severity === "urgent" ? Siren : f.severity === "warning" ? AlertTriangle : Info;
        const tone = f.severity === "urgent" ? "border-rose-200 bg-rose-50 text-rose-900" : f.severity === "warning" ? "border-amber-200 bg-amber-50 text-amber-900" : "border-ova-200 bg-ova-50 text-ova-900";
        return (
          <div key={f.id} className={cx("flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center", tone)}>
            <Icon className="size-5 shrink-0" />
            <p className="flex-1 text-sm">{f.message}</p>
            {f.severity !== "info" && (
              <LinkButton href={`/consult?context=${context}`} variant={f.severity === "urgent" ? "danger" : "primary"} className="shrink-0 py-2 text-xs">
                {f.severity === "urgent" ? "Consult urgently" : "Talk to a doctor"}
              </LinkButton>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function QuickLinks({ items }: { items: [string, string, string][] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {items.map(([href, emoji, label]) => (
        <Link key={href} href={href} className="rounded-2xl border border-ova-100 bg-white p-4 text-sm font-semibold text-ova-900 transition hover:border-ova-300 hover:shadow-sm">
          <span className="mb-2 block text-2xl">{emoji}</span>{label}
        </Link>
      ))}
    </div>
  );
}
