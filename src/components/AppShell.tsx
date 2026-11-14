"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Activity, Baby, Bell, BookOpen, CalendarCheck, CalendarDays, ClipboardList, FileText, Flower2, HeartPulse, Home,
  LayoutDashboard, LogOut, Menu, Newspaper, Shield, Stethoscope, User, Users, X,
} from "lucide-react";
import { useUser } from "./UserProvider";
import { Logo } from "./Logo";
import { cx, Spinner } from "./ui";
import { supabase } from "@/lib/supabase";

type Item = { href: string; label: string; icon: React.ComponentType<{ className?: string }> };

const USER_NAV: Item[] = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/tracker", label: "Period tracker", icon: CalendarDays },
  { href: "/consult", label: "Consult a doctor", icon: Stethoscope },
  { href: "/appointments", label: "My appointments", icon: CalendarCheck },
  { href: "/pcod", label: "PCOD care", icon: Activity },
  { href: "/pregnancy", label: "Pregnancy planning", icon: Baby },
  { href: "/menopause", label: "Menopause care", icon: Flower2 },
  { href: "/learn", label: "Learn", icon: BookOpen },
  { href: "/records", label: "Health records", icon: FileText },
  { href: "/profile", label: "Profile & privacy", icon: User },
];
const DOCTOR_NAV: Item[] = [
  { href: "/doctor", label: "Doctor dashboard", icon: HeartPulse },
  { href: "/doctor/availability", label: "Availability", icon: ClipboardList },
];
const ADMIN_NAV: Item[] = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/doctors", label: "Doctor verification", icon: Shield },
  { href: "/admin/appointments", label: "Appointments", icon: CalendarCheck },
  { href: "/admin/content", label: "Content", icon: Newspaper },
  { href: "/admin/users", label: "Users", icon: Users },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, profile, loading, signOut } = useUser();
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace(`/login?next=${encodeURIComponent(path)}`);
    else if (profile && !profile.onboarded_at && profile.role === "user" && !path.startsWith("/doctor")) router.replace("/onboarding");
  }, [loading, user, profile, path, router]);

  useEffect(() => {
    if (!user) return;
    supabase().from("notifications").select("id", { count: "exact", head: true })
      .eq("user_id", user.id).is("read_at", null).lte("scheduled_for", new Date().toISOString())
      .then(({ count }) => setUnread(count ?? 0));
  }, [user, path]);

  useEffect(() => setOpen(false), [path]);

  if (loading || !user || !profile) return <Spinner />;

  const isActive = (href: string) =>
    href === "/doctor" || href === "/admin" ? path === href : path === href || path.startsWith(href + "/");

  const section = (title: string | null, items: Item[]) => (
    <div className="mb-4">
      {title && <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-ova-400">{title}</p>}
      {items.map(({ href, label, icon: Icon }) => (
        <Link key={href} href={href}
          className={cx("flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition",
            isActive(href) ? "bg-ova-600 text-white" : "text-ova-900/80 hover:bg-ova-50")}>
          <Icon className="size-4" /> {label}
        </Link>
      ))}
    </div>
  );

  const nav = (
    <nav className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto">
        {profile.role === "admin" && section("Admin", ADMIN_NAV)}
        {profile.role === "doctor" && section("Doctor portal", DOCTOR_NAV)}
        {section(profile.role === "user" ? null : "My health", USER_NAV)}
        {profile.role === "user" && (
          <Link href="/doctor" className="mx-3 mb-4 block rounded-xl border border-dashed border-ova-200 p-3 text-xs text-ova-700 hover:bg-ova-50">
            <Stethoscope className="mb-1 size-4" /> Are you a gynaecologist? <span className="font-semibold">Join Ova Cure</span>
          </Link>
        )}
      </div>
      <div className="border-t border-ova-100 pt-3">
        <p className="truncate px-3 text-sm font-semibold text-ova-900">{profile.full_name || "Welcome"}</p>
        <p className="truncate px-3 text-xs text-slate-500">{profile.phone ? `+${profile.phone}` : profile.email}</p>
        <button onClick={signOut} className="mt-2 flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-600 hover:bg-ova-50">
          <LogOut className="size-4" /> Sign out
        </button>
      </div>
    </nav>
  );

  return (
    <div className="flex min-h-screen">
      <aside className="no-print sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-ova-100 bg-white p-4 lg:flex">
        <div className="mb-6 px-2"><Logo href="/dashboard" /></div>
        {nav}
      </aside>

      {open && (
        <div className="no-print fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-ova-900/30" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col bg-white p-4">
            <div className="mb-6 flex items-center justify-between px-2">
              <Logo href="/dashboard" />
              <button onClick={() => setOpen(false)} aria-label="Close menu"><X className="size-5" /></button>
            </div>
            {nav}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-30 flex items-center justify-between border-b border-ova-100 bg-white/85 px-4 py-3 backdrop-blur lg:px-8">
          <div className="flex items-center gap-3">
            <button className="lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu"><Menu className="size-5" /></button>
            <span className="lg:hidden"><Logo size="sm" href="/dashboard" /></span>
          </div>
          <Link href="/notifications" className="relative rounded-full p-2 text-ova-700 hover:bg-ova-50" aria-label="Notifications">
            <Bell className="size-5" />
            {unread > 0 && <span className="absolute right-1 top-1 grid size-4 place-items-center rounded-full bg-blush-500 text-[10px] font-bold text-white">{unread}</span>}
          </Link>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
