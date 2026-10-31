"use client";

import type { Resume } from "@cvtuner/core";
import type { FitResult } from "@cvtuner/render";
import { useEffect, useRef, useState } from "react";
import { downloadBlob, fileBase } from "@/lib/files";
import { Button } from "./ui";

interface Props {
  resume: Resume;
  maxPages: 2 | 3;
  keywords: string[];
  protect: string[];
  title?: string;
  company?: string;
}

/**
 * The signature: the real rendered resume on a white plate, captioned in mono the way
 * the catalogue captions a sample. Renders in the browser, fitted to the page limit.
 */
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
    <section className="card">
      <div className="card-head">
        <h2>
          Preview
          {busy ? <span className="text-muted ml-2 text-xs font-normal">updating</span> : null}
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="primary"
            disabled={!fit}
            onClick={() => fit && downloadBlob(new Blob([fit.pdf as BlobPart], { type: "application/pdf" }), `${base}.pdf`)}
          >
            Download PDF
          </Button>
          <Button disabled={!fit} onClick={downloadDocx}>
            Word
          </Button>
        </div>
      </div>

      {error ? (
        <div className="card-body">
          <p className="text-sm" role="alert">
            <span className="text-warn font-medium">The preview did not build.</span> {error}
          </p>
          <p className="text-muted mt-1 text-xs">Your profile is unchanged. Edit a line in Changes, or re-tune to try again.</p>
        </div>
      ) : url ? (
        <>
          <iframe
            src={`${url}#toolbar=0&navpanes=0&view=FitH`}
            title="Resume preview"
            className="sheet hidden h-[760px] w-full border-0 sm:block"
          />
          {/* phones cannot be trusted to render a PDF in a frame, so the sheet is
              set in type instead of left as an empty box, and opens full screen */}
          <div className="sheet p-6 sm:hidden">
            <p className="font-display text-xl leading-tight font-bold">{resume.basics.name || "Your resume"}</p>
            {resume.basics.label ? <p className="text-sm opacity-70">{resume.basics.label}</p> : null}
            <p className="border-rule mt-4 border-t pt-3">
              <a href={url} target="_blank" rel="noreferrer" className="btn">
                Open the resume
              </a>
            </p>
          </div>
        </>
      ) : (
        <div className="p-4 sm:p-6">
          <div className="skeleton mx-auto h-[420px] w-full max-w-[480px]" />
          <p className="text-muted mt-3 text-center text-xs">Building the preview</p>
        </div>
      )}

      {/* the caption bar: what this sheet is, at one to one */}
      <div className="plate-caption">
        <span className="text-muted">
          {title ?? "Your resume"}
          {company ? <span className="text-ink"> at {company}</span> : null}
        </span>
        <span className="flex items-center gap-3">
          {fit && fit.droppedBullets > 0 ? (
            <span className="text-muted">
              {fit.droppedBullets} less relevant line{fit.droppedBullets > 1 ? "s" : ""} left out
            </span>
          ) : null}
          {fit ? (
            <span className={`code ${fit.metTarget ? "" : "text-warn"}`}>
              {fit.pages} / {maxPages} page{maxPages > 1 ? "s" : ""}
            </span>
          ) : (
            <span className="text-muted">fitting to {maxPages} pages</span>
          )}
        </span>
      </div>
    </section>
  );
}
