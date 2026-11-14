import Link from "next/link";
import { cx } from "@/lib/cx";

/** Ova Cure wordmark — recreated from the original logo so colours can change freely. */
export function Logo({ size = "md", tile = false, href = "/" }: { size?: "sm" | "md" | "lg"; tile?: boolean; href?: string | null }) {
  const s = { sm: "text-2xl", md: "text-3xl", lg: "text-6xl" }[size];
  const mark = (
    <span className={cx("inline-flex items-end leading-none", tile && "rounded-2xl bg-ova-500 px-3 pt-1.5 pb-2.5")}>
      <span className={cx("font-brand", s, tile ? "text-white" : "text-ova-600")}>Ova</span>
      <span className={cx("font-brand -ml-0.5 translate-y-[0.35em]", size === "lg" ? "text-2xl" : "text-sm", tile ? "text-white" : "text-blush-500")}>Cure.</span>
    </span>
  );
  return href ? <Link href={href} aria-label="Ova Cure home">{mark}</Link> : mark;
}
