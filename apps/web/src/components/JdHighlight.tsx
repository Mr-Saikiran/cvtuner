import type { KeywordMatch } from "@cvtuner/core";
import { escapeRegExp } from "@cvtuner/core";
import { useMemo } from "react";

/** Shows the JD with every detected keyword marked: green = in your resume, red = missing, amber = you confirmed it. */
export function JdHighlight({ text, keywords }: { text: string; keywords: KeywordMatch[] }) {
  const parts = useMemo(() => {
    if (!keywords.length) return [{ text, kw: undefined as KeywordMatch | undefined }];
    const byName = new Map(keywords.map((k) => [k.name.toLowerCase(), k]));
    const names = [...byName.keys()].sort((a, b) => b.length - a.length).map(escapeRegExp);
    const re = new RegExp(`(?<![A-Za-z0-9])(${names.join("|")})(?![A-Za-z0-9])`, "gi");
    const out: { text: string; kw?: KeywordMatch }[] = [];
    let last = 0;
    for (const m of text.matchAll(re)) {
      if (m.index! > last) out.push({ text: text.slice(last, m.index) });
      out.push({ text: m[0], kw: byName.get(m[0].toLowerCase()) });
      last = m.index! + m[0].length;
    }
    out.push({ text: text.slice(last) });
    return out;
  }, [text, keywords]);

  return (
    <div
      className="field max-h-[460px] min-h-[280px] overflow-auto text-sm leading-relaxed whitespace-pre-wrap lg:min-h-[360px]"
      tabIndex={0}
      aria-label="Job description with highlighted keywords"
    >
      {parts.map((p, i) =>
        p.kw ? (
          <mark key={i} className={p.kw.coverage === "covered" ? "kw-covered" : p.kw.confirmed ? "kw-confirmed" : "kw-missing"} title={p.kw.coverage === "covered" ? "In your resume" : p.kw.confirmed ? "Confirmed by you" : "Missing"}>
            {p.text}
          </mark>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </div>
  );
}
