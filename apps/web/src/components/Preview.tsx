"use client";

import type { Resume } from "@cvtuner/core";
import type { FitResult } from "@cvtuner/render";
import { useEffect, useRef, useState } from "react";
import { downloadBlob, fileBase } from "@/lib/files";
import { Badge, Button, Card } from "./ui";

interface Props {
  resume: Resume;
  maxPages: 2 | 3;
  keywords: string[];
  protect: string[];
  title?: string;
  company?: string;
}

/** Renders the tuned resume in the browser, fitted to the page limit, and offers PDF/DOCX downloads. */
export function Preview({ resume, maxPages, keywords, protect, title, company }: Props) {
  const [fit, setFit] = useState<FitResult | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = useRef(0);

  const key = JSON.stringify([resume, maxPages, keywords, protect]);
  useEffect(() => {
    const id = ++run.current;
    setBusy(true);
    const t = setTimeout(async () => {
      try {
        const { fitToPages } = await import("@cvtuner/render");
        // 2 pages is the target; "Up to 3" lets content run to 3 instead of trimming to 2
        const res = await fitToPages(resume, { targetPages: maxPages, maxPages, keywords, protect });
        if (id !== run.current) return;
        setFit(res);
        setError(null);
        setUrl((old) => {
          if (old) URL.revokeObjectURL(old);
          return URL.createObjectURL(new Blob([res.pdf as BlobPart], { type: "application/pdf" }));
        });
      } catch (e) {
        if (id === run.current) setError((e as Error).message);
      } finally {
        if (id === run.current) setBusy(false);
      }
    }, 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => () => void (url && URL.revokeObjectURL(url)), [url]);

  const base = fileBase(resume.basics.name, company, title);

  const downloadDocx = async () => {
    if (!fit) return;
    const { renderDocx } = await import("@cvtuner/render");
    downloadBlob(await renderDocx(fit.resume, fit.layout), `${base}.docx`);
  };

  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          Preview
          {fit ? (
            <Badge tone={fit.metTarget ? "good" : "warn"}>
              {fit.pages} / {maxPages} page{maxPages > 1 ? "s" : ""}
            </Badge>
          ) : null}
          {busy ? <span className="muted text-xs font-normal">Updating…</span> : null}
        </span>
      }
      actions={
        <>
          <Button variant="primary" disabled={!fit} onClick={() => fit && downloadBlob(new Blob([fit.pdf as BlobPart], { type: "application/pdf" }), `${base}.pdf`)}>
            PDF
          </Button>
          <Button disabled={!fit} onClick={downloadDocx}>
            Word
          </Button>
        </>
      }
    >
      {fit && fit.droppedBullets > 0 ? (
        <p className="muted mb-2 text-xs">
          {fit.droppedBullets} less relevant line{fit.droppedBullets > 1 ? "s were" : " was"} left out to fit {maxPages} pages. Your profile is unchanged.
        </p>
      ) : null}
      {error ? <p className="text-sm text-red-600">Preview failed: {error}</p> : null}
      {url ? (
        <>
          <iframe src={`${url}#toolbar=0&navpanes=0&view=FitH`} title="Resume preview" className="hidden h-[780px] w-full rounded-lg border border-[var(--border)] bg-white sm:block" />
          <a href={url} target="_blank" rel="noreferrer" className="block rounded-lg border border-dashed border-[var(--border)] p-6 text-center text-sm font-medium text-brand-600 sm:hidden">
            Open PDF preview
          </a>
        </>
      ) : (
        <div className="grid h-60 place-items-center rounded-lg border border-dashed border-[var(--border)]">
          <span className="muted text-sm">Building preview…</span>
        </div>
      )}
    </Card>
  );
}
