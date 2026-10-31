"use client";

import { buildCoverLetterPrompt, DOC_LANGUAGES, ruleCoverLetter, type CoverLetter, type KeywordMatch, type Resume } from "@cvtuner/core";
import { useMemo, useState } from "react";
import { aiChat } from "@/lib/ai";
import { downloadBlob, fileBase } from "@/lib/files";
import type { Settings } from "@/lib/store";
import { Button, Card } from "./ui";

interface Props {
  resume: Resume;
  jd: string;
  keywords: KeywordMatch[];
  gaps: string[];
  title?: string;
  company?: string;
  settings: Settings;
  useAi: boolean;
  /** edited/AI paragraphs; undefined = use the rule-based draft */
  value?: string[];
  onChange: (paragraphs: string[] | undefined) => void;
}

export function CoverLetterCard({ resume, jd, keywords, gaps, title, company, settings, useAi, value, onChange }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [raw, setRaw] = useState<string | null>(null);
  const base = useMemo(() => ruleCoverLetter(resume, keywords, { jobTitle: title, company, tone: settings.tone }), [resume, keywords, title, company, settings.tone]);
  const letter: CoverLetter = { ...base, paragraphs: value ?? base.paragraphs };
  const text = letter.paragraphs.join("\n\n");
  const style = { template: settings.template, lang: settings.lang };
  const name = `${fileBase(resume.basics.name, company, title)}_Cover_Letter`;

  const writeWithAi = async () => {
    setBusy(true);
    setError(null);
    try {
      const reply = await aiChat(
        settings.ai,
        buildCoverLetterPrompt({ resume, jd, jobTitle: title, company, gaps, language: DOC_LANGUAGES[settings.lang]?.name ?? "English", tone: settings.tone }),
      );
      const paragraphs = reply
        .replace(/```[a-z]*|```/g, "")
        .split(/\n\s*\n/)
        .map((p) => p.replace(/\s+/g, " ").trim())
        .filter((p) => p && !/^(dear|sincerely|best regards|regards)/i.test(p));
      if (!paragraphs.length) throw new Error("The model returned an empty letter.");
      onChange(paragraphs);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const pdf = async () => {
    const { renderLetterPdf } = await import("@cvtuner/render");
    const bytes = await renderLetterPdf(letter, resume, style);
    downloadBlob(new Blob([bytes as BlobPart], { type: "application/pdf" }), `${name}.pdf`);
  };
  const docx = async () => {
    const { renderLetterDocx } = await import("@cvtuner/render");
    downloadBlob(await renderLetterDocx(letter, resume, style), `${name}.docx`);
  };

  return (
    <Card
      title="Cover letter"
      actions={
        <>
          {useAi ? (
            <Button variant="ghost" onClick={writeWithAi} disabled={busy}>
              {busy ? "Writing…" : "Write with AI"}
            </Button>
          ) : null}
          {value ? (
            <Button variant="ghost" onClick={() => onChange(undefined)}>
              Reset
            </Button>
          ) : null}
          <Button variant="primary" onClick={pdf}>
            PDF
          </Button>
          <Button onClick={docx}>Word</Button>
        </>
      }
    >
      {error ? <p className="mb-2 text-sm text-red-600">{error}</p> : null}
      <p className="muted mb-2 text-xs">
        {letter.greeting} … {letter.closing} {letter.signature} are added automatically. Edit the body freely.
      </p>
      <textarea
        className="field min-h-64 resize-y text-sm leading-relaxed"
        value={raw ?? text}
        onChange={(e) => setRaw(e.target.value)}
        onBlur={() => {
          if (raw !== null) onChange(raw.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean));
          setRaw(null);
        }}
        aria-label="Cover letter body"
      />
    </Card>
  );
}
