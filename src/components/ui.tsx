"use client";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

import { cx } from "@/lib/cx";
export { cx };

type Variant = "primary" | "secondary" | "ghost" | "danger" | "blush";
const variants: Record<Variant, string> = {
  primary: "bg-ova-600 text-white hover:bg-ova-700 shadow-sm shadow-ova-600/20",
  secondary: "bg-white text-ova-700 border border-ova-200 hover:bg-ova-50",
  ghost: "text-ova-700 hover:bg-ova-50",
  danger: "bg-rose-600 text-white hover:bg-rose-700",
  blush: "bg-blush-500 text-white hover:bg-blush-400",
};
const btnBase = "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed";

export function Button({ variant = "primary", loading, className, children, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; loading?: boolean }) {
  return (
    <button {...p} disabled={p.disabled || loading} className={cx(btnBase, variants[variant], className)}>
      {loading && <Loader2 className="size-4 animate-spin" />}
      {children}
    </button>
  );
}

export function LinkButton({ href, variant = "primary", className, children }: { href: string; variant?: Variant; className?: string; children: ReactNode }) {
  return <Link href={href} className={cx(btnBase, variants[variant], className)}>{children}</Link>;
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx("rounded-2xl border border-ova-100 bg-white p-5 shadow-sm shadow-ova-900/[0.03]", className)}>{children}</div>;
}

export function Badge({ tone = "ova", children, className }: { tone?: "ova" | "green" | "amber" | "red" | "gray" | "blush"; children: ReactNode; className?: string }) {
  const tones = {
    ova: "bg-ova-100 text-ova-700", green: "bg-emerald-100 text-emerald-700", amber: "bg-amber-100 text-amber-800",
    red: "bg-rose-100 text-rose-700", gray: "bg-slate-100 text-slate-600", blush: "bg-blush-100 text-blush-500",
  };
  return <span className={cx("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold", tones[tone], className)}>{children}</span>;
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ova-900">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

const inputCls = "w-full rounded-xl border border-ova-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-ova-500 focus:ring-4 focus:ring-ova-100";
export function Input(p: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...p} className={cx(inputCls, p.className)} />;
}
export function Textarea(p: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={3} {...p} className={cx(inputCls, p.className)} />;
}
export function Select(p: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...p} className={cx(inputCls, p.className)} />;
}

export function Chip({ active, onClick, children, className }: { active?: boolean; onClick?: () => void; children: ReactNode; className?: string }) {
  return (
    <button type="button" onClick={onClick}
      className={cx("rounded-full border px-3.5 py-1.5 text-sm font-medium transition",
        active ? "border-ova-600 bg-ova-600 text-white" : "border-ova-200 bg-white text-ova-800 hover:border-ova-400", className)}>
      {children}
    </button>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ova-900 sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-600">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Spinner({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-sm text-ova-600">
      <Loader2 className="size-5 animate-spin" /> {label}
    </div>
  );
}

export function Empty({ title, text, action }: { title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-ova-200 bg-ova-50/50 p-8 text-center">
      <p className="font-semibold text-ova-900">{title}</p>
      {text && <p className="mx-auto mt-1 max-w-md text-sm text-slate-600">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Alert({ tone = "info", title, children }: { tone?: "info" | "warning" | "urgent" | "success"; title?: string; children: ReactNode }) {
  const t = {
    info: "border-ova-200 bg-ova-50 text-ova-900", warning: "border-amber-200 bg-amber-50 text-amber-900",
    urgent: "border-rose-200 bg-rose-50 text-rose-900", success: "border-emerald-200 bg-emerald-50 text-emerald-900",
  }[tone];
  return (
    <div className={cx("rounded-xl border p-4 text-sm", t)}>
      {title && <p className="mb-1 font-semibold">{title}</p>}
      <div className="leading-relaxed">{children}</div>
    </div>
  );
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: string }) {
  return (
    <div className="rounded-2xl border border-ova-100 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-ova-900">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

export function Disclaimer({ className }: { className?: string }) {
  return (
    <p className={cx("text-xs leading-relaxed text-slate-500", className)}>
      Ova Cure predictions and insights are estimates for education only — not a diagnosis or a contraceptive method.
      Always consult a qualified doctor for medical advice. In an emergency call 112.
    </p>
  );
}
