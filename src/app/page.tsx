import Link from "next/link";
import { Activity, Baby, CalendarDays, Flower2, Lock, ShieldCheck, Sparkles, Stethoscope, Video } from "lucide-react";
import { Logo } from "@/components/Logo";

const FEATURES = [
  { icon: CalendarDays, title: "Period tracker", text: "Effortless daily logging, next period & fertile window predictions with a confidence score, and your hormone phase explained.", color: "bg-blush-100 text-blush-500" },
  { icon: Stethoscope, title: "Online gynaecologists", text: "Book verified OB-GYNs by video, audio or chat. Your cycle summary is attached automatically. Female doctors on request.", color: "bg-ova-100 text-ova-700" },
  { icon: Activity, title: "PCOD care plans", text: "3 and 6 month programmes: doctor follow-ups, Indian low-GI diet, home workouts and progress tracking.", color: "bg-emerald-100 text-emerald-700" },
  { icon: Baby, title: "Pregnancy planning", text: "Trying-to-conceive mode with a day-by-day fertile view, ovulation test logging and a preconception checklist.", color: "bg-sky-100 text-sky-700" },
  { icon: Flower2, title: "Menopause care", text: "Track hot flashes, sleep and mood, get a symptom score to share with your doctor, and red-flag alerts.", color: "bg-amber-100 text-amber-700" },
];

const STEPS = [
  ["Track", "Log your period, symptoms and mood in seconds."],
  ["Understand", "See predictions, your hormone phase and patterns over time."],
  ["Get care", "When something looks off, book a gynaecologist in one tap — with your data ready."],
];

export default function Landing() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-ova-100/70 bg-cream/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Logo />
          <nav className="hidden items-center gap-7 text-sm font-medium text-ova-900/80 md:flex">
            <a href="#features" className="hover:text-ova-600">Features</a>
            <a href="#how" className="hover:text-ova-600">How it works</a>
            <a href="#doctors" className="hover:text-ova-600">For doctors</a>
            <a href="#privacy" className="hover:text-ova-600">Privacy</a>
          </nav>
          <Link href="/login" className="rounded-xl bg-ova-600 px-4 py-2 text-sm font-semibold text-white hover:bg-ova-700">Sign in</Link>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="pointer-events-none absolute -right-32 -top-32 size-[28rem] rounded-full bg-ova-200/50 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-40 -left-24 size-[24rem] rounded-full bg-blush-100 blur-3xl" />
          <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 md:grid-cols-2 md:py-24">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-semibold text-ova-700 ring-1 ring-ova-100">
                <Sparkles className="size-3.5" /> Women&apos;s health, at every stage
              </span>
              <h1 className="mt-5 text-4xl font-extrabold leading-[1.1] tracking-tight text-ova-900 sm:text-5xl">
                Understand your body.<br /><span className="text-ova-600">Get expert care.</span>
              </h1>
              <p className="mt-5 max-w-lg text-lg leading-relaxed text-slate-600">
                Ova Cure brings cycle tracking, PCOD care, pregnancy planning and menopause support together with
                verified gynaecologists — so every insight leads to real care.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/login" className="rounded-xl bg-ova-600 px-6 py-3 font-semibold text-white shadow-lg shadow-ova-600/25 hover:bg-ova-700">Start tracking — it&apos;s free</Link>
                <Link href="/login?next=/consult" className="rounded-xl border border-ova-200 bg-white px-6 py-3 font-semibold text-ova-700 hover:bg-ova-50">Talk to a gynaecologist</Link>
              </div>
              <p className="mt-4 flex items-center gap-1.5 text-xs text-slate-500"><Lock className="size-3.5" /> Private by design. Your health data is never sold.</p>
            </div>

            {/* Phone mock */}
            <div className="relative mx-auto w-full max-w-sm">
              <div className="rounded-[2.5rem] border-8 border-ova-900 bg-white p-5 shadow-2xl shadow-ova-900/20">
                <div className="flex items-center justify-between"><Logo size="sm" href={null} /><span className="text-xs text-slate-400">Today</span></div>
                <div className="mx-auto mt-6 grid size-48 place-items-center rounded-full bg-[conic-gradient(#e85d90_0_18%,#9b66d8_18%_45%,#2fa58a_45%_55%,#f0b46a_55%_100%)] p-3">
                  <div className="grid size-full place-items-center rounded-full bg-white text-center">
                    <div>
                      <p className="text-xs text-slate-500">Next period</p>
                      <p className="text-3xl font-extrabold text-ova-900">in 9 days</p>
                      <p className="text-xs font-semibold text-ova-600">Day 19 · Luteal</p>
                    </div>
                  </div>
                </div>
                <div className="mt-6 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-xl bg-emerald-50 p-3"><p className="text-slate-500">Fertile window</p><p className="font-bold text-emerald-700">Ended</p></div>
                  <div className="rounded-xl bg-ova-50 p-3"><p className="text-slate-500">Confidence</p><p className="font-bold text-ova-700">High</p></div>
                </div>
                <div className="mt-3 rounded-xl bg-blush-50 p-3 text-xs text-blush-500"><b>Tip:</b> cravings rising? Try nuts & dark chocolate.</div>
                <div className="mt-3 flex items-center gap-2 rounded-xl bg-ova-600 p-3 text-xs font-semibold text-white"><Video className="size-4" /> Consult a gynaecologist</div>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="text-center text-3xl font-bold text-ova-900">One app for every stage</h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-slate-600">From your first period to menopause — tracking that connects to real care.</p>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, text, color }) => (
              <div key={title} className="rounded-2xl border border-ova-100 bg-white p-6 transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-ova-900/5">
                <div className={`grid size-11 place-items-center rounded-xl ${color}`}><Icon className="size-5" /></div>
                <h3 className="mt-4 text-lg font-bold text-ova-900">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{text}</p>
              </div>
            ))}
            <div className="rounded-2xl bg-ova-600 p-6 text-white">
              <ShieldCheck className="size-8" />
              <h3 className="mt-4 text-lg font-bold">Clinically safe</h3>
              <p className="mt-2 text-sm leading-relaxed text-ova-100">Predictions are estimates, never diagnoses. Red-flag symptoms are escalated to a doctor.</p>
            </div>
          </div>
        </section>

        {/* How */}
        <section id="how" className="bg-ova-900 py-16 text-white">
          <div className="mx-auto max-w-6xl px-4">
            <h2 className="text-center text-3xl font-bold">From tracking to care</h2>
            <div className="mt-10 grid gap-6 md:grid-cols-3">
              {STEPS.map(([t, d], i) => (
                <div key={t} className="rounded-2xl bg-white/5 p-6 ring-1 ring-white/10">
                  <span className="font-brand text-4xl text-blush-300">{i + 1}.</span>
                  <h3 className="mt-2 text-xl font-bold">{t}</h3>
                  <p className="mt-2 text-sm text-ova-100">{d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Doctors */}
        <section id="doctors" className="mx-auto max-w-6xl px-4 py-16">
          <div className="grid items-center gap-8 rounded-3xl bg-gradient-to-br from-ova-100 to-blush-50 p-8 md:grid-cols-2 md:p-12">
            <div>
              <h2 className="text-3xl font-bold text-ova-900">Are you a gynaecologist?</h2>
              <p className="mt-3 text-slate-700">Join Ova Cure to consult patients online. Get a patient summary with cycle data before every call, write e-prescriptions, and schedule follow-ups — all in one dashboard.</p>
              <Link href="/login?next=/doctor" className="mt-6 inline-block rounded-xl bg-ova-600 px-6 py-3 font-semibold text-white hover:bg-ova-700">Apply as a doctor</Link>
            </div>
            <ul className="space-y-3 text-sm text-ova-900">
              {["Registration verified with NMC / State Medical Council", "Set your own availability and fees", "Video, audio or chat consultations", "Follows Telemedicine Practice Guidelines 2020"].map((x) => (
                <li key={x} className="flex items-start gap-2 rounded-xl bg-white/70 p-3"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-ova-600" />{x}</li>
              ))}
            </ul>
          </div>
        </section>

        <section id="privacy" className="mx-auto max-w-4xl px-4 pb-16 text-center">
          <Lock className="mx-auto size-8 text-ova-600" />
          <h2 className="mt-3 text-2xl font-bold text-ova-900">Your data, your control</h2>
          <p className="mt-3 text-slate-600">Encrypted in transit and at rest. Consent-based sharing with doctors. One-tap account deletion. Built to comply with India&apos;s DPDP Act 2023.</p>
        </section>
      </main>

      <footer className="border-t border-ova-100 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-slate-500 md:flex-row md:items-center md:justify-between">
          <Logo size="sm" />
          <p className="max-w-xl text-xs">Ova Cure provides health information and access to registered doctors. It is not a substitute for emergency care. In an emergency call 112.</p>
          <p className="text-xs">© 2026 Ova Cure</p>
        </div>
      </footer>
    </div>
  );
}
