import { Fragment } from "react";

/** Tiny safe renderer for article bodies: "## heading", "- list", "**bold**", paragraphs. No HTML injection. */
function inline(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : <Fragment key={i}>{part}</Fragment>);
}

export function Markdown({ text }: { text: string }) {
  const blocks = text.replace(/\r/g, "").split(/\n\s*\n/);
  return (
    <div className="prose-ova text-[15px] text-slate-700">
      {blocks.map((b, i) => {
        const lines = b.split("\n").filter(Boolean);
        if (lines[0]?.startsWith("## ")) return (
          <Fragment key={i}>
            <h2>{lines[0].slice(3)}</h2>
            {lines.length > 1 && <Markdown text={lines.slice(1).join("\n")} />}
          </Fragment>
        );
        if (lines.every((l) => l.startsWith("- "))) return <ul key={i}>{lines.map((l, j) => <li key={j}>{inline(l.slice(2))}</li>)}</ul>;
        return <p key={i}>{inline(lines.join(" "))}</p>;
      })}
    </div>
  );
}
