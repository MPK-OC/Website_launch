// Ova Cure prediction engine (MVP, rule-based).
// These are ESTIMATES for education, not diagnoses. Later this module can be replaced by an ML model
// trained on logged cycles without changing the screens that use it.
import { addDays, diffDays, parseISO } from "./dates";

export type Phase = "menstrual" | "follicular" | "ovulatory" | "luteal";

export interface PeriodRow { id?: string; start_date: string; end_date: string | null }
export interface CycleProfileRow {
  avg_cycle_length: number;
  avg_period_length: number;
  last_period_start: string | null;
}
export interface LogRow { log_date: string; flow: string | null; symptoms: string[]; mood?: string | null; energy?: number | null; sleep_hours?: number | null; ovulation_test?: string | null }

export interface CycleStats {
  lastStart: string | null;
  cycleLengths: number[];
  periodLengths: number[];
  avgCycle: number;
  avgPeriod: number;
  nextPeriod: string | null;
  ovulation: string | null;
  fertileStart: string | null;
  fertileEnd: string | null;
  cycleDay: number | null;
  phase: Phase | null;
  daysUntilNext: number | null;
  daysLate: number;
  confidence: "low" | "medium" | "high";
  confidenceNote: string;
  variability: number;
}

const mean = (a: number[]) => a.reduce((s, x) => s + x, 0) / a.length;
const sd = (a: number[]) => (a.length < 2 ? 0 : Math.sqrt(mean(a.map((x) => (x - mean(a)) ** 2))));

export function computeStats(periodsIn: PeriodRow[], profile: CycleProfileRow | null, today: string): CycleStats {
  const periods = [...periodsIn].sort((a, b) => a.start_date.localeCompare(b.start_date));
  const starts = periods.map((p) => p.start_date);
  if (!starts.length && profile?.last_period_start) starts.push(profile.last_period_start);

  const cycleLengths: number[] = [];
  for (let i = 1; i < starts.length; i++) {
    const len = diffDays(starts[i - 1], starts[i]);
    if (len >= 15 && len <= 90) cycleLengths.push(len);
  }
  const recent = cycleLengths.slice(-6);
  const periodLengths = periods
    .filter((p) => p.end_date)
    .map((p) => diffDays(p.start_date, p.end_date!) + 1)
    .filter((n) => n >= 1 && n <= 15)
    .slice(-6);

  // Blend user-entered average with logged history: history dominates as it grows.
  const base = profile?.avg_cycle_length ?? 28;
  const avgCycle = recent.length
    ? Math.round((mean(recent) * recent.length + base) / (recent.length + 1))
    : base;
  const avgPeriod = periodLengths.length ? Math.round(mean(periodLengths)) : profile?.avg_period_length ?? 5;

  const variability = recent.length >= 2 ? Math.max(...recent) - Math.min(...recent) : 0;
  const s = sd(recent);
  let confidence: CycleStats["confidence"] = "low";
  if (recent.length >= 3 && s <= 2.5) confidence = "high";
  else if (recent.length >= 1 && s <= 5) confidence = "medium";
  const confidenceNote =
    recent.length === 0
      ? "Based on the cycle length you entered. Log 2–3 periods to improve accuracy."
      : `Based on ${recent.length} logged cycle${recent.length > 1 ? "s" : ""}${s ? ` (varies by about ±${Math.max(1, Math.round(s))} days)` : ""}.`;

  const lastStart = starts.length ? starts[starts.length - 1] : null;
  if (!lastStart) {
    return {
      lastStart, cycleLengths, periodLengths, avgCycle, avgPeriod, nextPeriod: null, ovulation: null,
      fertileStart: null, fertileEnd: null, cycleDay: null, phase: null, daysUntilNext: null, daysLate: 0,
      confidence: "low", confidenceNote: "Add your last period date to see predictions.", variability,
    };
  }

  const nextPeriod = addDays(lastStart, avgCycle);
  const ovulation = addDays(nextPeriod, -14);
  const cycleDay = diffDays(lastStart, today) + 1;
  const daysUntilNext = diffDays(today, nextPeriod);

  return {
    lastStart, cycleLengths, periodLengths, avgCycle, avgPeriod, nextPeriod, ovulation,
    fertileStart: addDays(ovulation, -5), fertileEnd: addDays(ovulation, 1),
    cycleDay, phase: phaseForDay(cycleDay, avgCycle, avgPeriod), daysUntilNext,
    daysLate: daysUntilNext < 0 ? -daysUntilNext : 0, confidence, confidenceNote, variability,
  };
}

export function phaseForDay(day: number, cycleLen: number, periodLen: number): Phase {
  const ov = cycleLen - 14;
  if (day <= periodLen) return "menstrual";
  if (day < ov - 1) return "follicular";
  if (day <= ov + 1) return "ovulatory";
  return "luteal";
}

/** What a calendar day looks like: logged period / predicted period / fertile / ovulation */
export function dayKind(
  date: string, stats: CycleStats, periods: PeriodRow[], logs: Map<string, LogRow>,
): "period" | "predicted" | "fertile" | "ovulation" | null {
  const log = logs.get(date);
  if (log?.flow && log.flow !== "none") return "period";
  for (const p of periods) {
    const end = p.end_date ?? addDays(p.start_date, stats.avgPeriod - 1);
    if (date >= p.start_date && date <= end) return "period";
  }
  if (!stats.nextPeriod) return null;
  // project 3 cycles ahead
  for (let k = 0; k < 3; k++) {
    const start = addDays(stats.nextPeriod, k * stats.avgCycle);
    const ov = addDays(start, -14);
    if (date === ov) return "ovulation";
    if (date >= addDays(ov, -5) && date <= addDays(ov, 1)) return "fertile";
    if (date >= start && date <= addDays(start, stats.avgPeriod - 1)) return "predicted";
  }
  return null;
}

// ---------- Hormone curves (educational, NOT lab values) ----------
const gauss = (x: number, mu: number, w: number) => Math.exp(-((x - mu) ** 2) / (2 * w * w));

export function hormoneLevels(day: number, cycleLen: number) {
  const ov = cycleLen - 14;
  const estrogen = 0.18 + 0.82 * gauss(day, ov - 1, 3.2) + 0.45 * gauss(day, ov + 7, 3.5);
  const progesterone = 0.08 + 0.92 * gauss(day, ov + 7, 3.2);
  const lh = 0.08 + 0.92 * gauss(day, ov, 0.9);
  return { estrogen: Math.min(estrogen, 1), progesterone, lh };
}

export const PHASE_INFO: Record<Phase, { label: string; color: string; bg: string; hormones: string; mood: string; energy: string; skin: string; appetite: string; tip: string }> = {
  menstrual: {
    label: "Menstrual phase", color: "#e85d90", bg: "bg-blush-50",
    hormones: "Oestrogen and progesterone are at their lowest.",
    mood: "You may feel more inward or tired. Be gentle with yourself.",
    energy: "Lower energy is common. Light walks, stretching or yoga can help cramps.",
    skin: "Skin may feel drier or more sensitive.",
    appetite: "Iron-rich food (spinach, dates, jaggery, dal) helps replace what you lose.",
    tip: "A warm compress and hydration can ease cramps.",
  },
  follicular: {
    label: "Follicular phase", color: "#9b66d8", bg: "bg-ova-50",
    hormones: "Oestrogen is rising steadily as follicles grow.",
    mood: "Many feel more positive, creative and social.",
    energy: "Energy builds — a good time for harder workouts or new projects.",
    skin: "Skin often looks clearer and brighter.",
    appetite: "Appetite is usually steady; focus on protein and fresh produce.",
    tip: "Great week to try strength training.",
  },
  ovulatory: {
    label: "Ovulatory phase", color: "#2fa58a", bg: "bg-emerald-50",
    hormones: "Oestrogen peaks and an LH surge triggers ovulation.",
    mood: "Confidence and libido are often at their highest.",
    energy: "Peak energy for most people.",
    skin: "Glowy skin, but some get mid-cycle breakouts.",
    appetite: "Appetite may dip slightly.",
    tip: "This is your most fertile time.",
  },
  luteal: {
    label: "Luteal phase", color: "#d4883a", bg: "bg-amber-50",
    hormones: "Progesterone rises, then both hormones fall before your period.",
    mood: "PMS symptoms like irritability or low mood may appear late in this phase.",
    energy: "Energy slowly declines; prioritise sleep.",
    skin: "Oilier skin and breakouts are common before a period.",
    appetite: "Cravings increase — complex carbs and magnesium (nuts, seeds, dark chocolate) help.",
    tip: "Reduce salt and caffeine to ease bloating.",
  },
};

// ---------- Irregularity flags ----------
export interface DetectedFlag { flag_type: string; severity: "info" | "warning" | "urgent"; message: string }

export function detectTrackerFlags(stats: CycleStats, periods: PeriodRow[], logs: LogRow[]): DetectedFlag[] {
  const out: DetectedFlag[] = [];
  const last3 = stats.cycleLengths.slice(-3);
  if (last3.some((l) => l < 21))
    out.push({ flag_type: "short_cycle", severity: "warning", message: "One of your recent cycles was shorter than 21 days. Frequent short cycles are worth discussing with a gynaecologist." });
  const lastLen = stats.cycleLengths[stats.cycleLengths.length - 1];
  if (lastLen && lastLen > 35)
    out.push({ flag_type: "long_cycle", severity: "warning", message: `Your last cycle was ${lastLen} days. Cycles longer than 35 days can be linked to PCOD, thyroid or stress — consider a consultation.` });
  if (stats.variability > 9)
    out.push({ flag_type: "irregular_cycles", severity: "info", message: `Your cycle length varies by ${stats.variability} days. Keep logging; if it stays irregular, talk to a doctor.` });
  if (stats.daysLate >= 7)
    out.push({ flag_type: "missed_period", severity: stats.daysLate >= 60 ? "urgent" : "warning", message: `Your period is ${stats.daysLate} days late. If pregnancy is possible, take a home test. Otherwise, consider consulting a gynaecologist.` });
  const lastPeriod = [...periods].sort((a, b) => a.start_date.localeCompare(b.start_date)).pop();
  if (lastPeriod?.end_date && diffDays(lastPeriod.start_date, lastPeriod.end_date) + 1 > 8)
    out.push({ flag_type: "long_period", severity: "warning", message: "Your last period lasted more than 8 days. Please consult a doctor about prolonged bleeding." });
  if (lastPeriod) {
    const inPeriod = logs.filter((l) => l.log_date >= lastPeriod.start_date && l.log_date <= addDays(lastPeriod.start_date, 10));
    const veryHeavy = inPeriod.filter((l) => l.flow === "very_heavy").length;
    const heavy = inPeriod.filter((l) => l.flow === "heavy" || l.flow === "very_heavy").length;
    if (veryHeavy >= 2 || heavy >= 4)
      out.push({ flag_type: "heavy_bleeding", severity: "warning", message: "You logged heavy bleeding on several days. If you soak a pad every hour, feel dizzy or faint, seek care urgently." });
  }
  return out;
}

export function nextPeriodLabel(stats: CycleStats): string {
  if (stats.daysUntilNext === null) return "Add your last period";
  if (stats.daysLate > 0) return `${stats.daysLate} day${stats.daysLate > 1 ? "s" : ""} late`;
  if (stats.daysUntilNext === 0) return "Expected today";
  return `in ${stats.daysUntilNext} day${stats.daysUntilNext > 1 ? "s" : ""}`;
}

export function isFertileToday(stats: CycleStats, today: string) {
  return !!stats.fertileStart && today >= stats.fertileStart && today <= stats.fertileEnd!;
}

export function monthsBetween(a: string, b: string) {
  const da = parseISO(a), db = parseISO(b);
  return (db.getFullYear() - da.getFullYear()) * 12 + (db.getMonth() - da.getMonth());
}
