"use client";

import { useEffect, useRef, useState } from "react";
import { ExtensionCard } from "./ExtensionCard";
import { Button } from "./ui";

/** Reads the job description on a portal page and sends it to CVTuner, entirely in the user's browser. */
const BOOKMARKLET = `javascript:(()=>{const q=s=>document.querySelector(s);const el=q('#job-details')||q('.jobs-description__content')||q('.jobs-description')||q('.description__text')||q('#jobDescriptionText')||q('.job-desc')||q('[class*=JDC]')||q('main')||document.body;const sel=String(getSelection()).trim();const t=(sel.length>80?sel:el.innerText).slice(0,20000);const h=q('h1');window.open('https://techswitch.in/cvtuner/share#'+new URLSearchParams({text:t,url:location.href,title:h?h.innerText.trim():document.title}).toString(),'_blank')})()`;

/**
 * LinkedIn, Naukri and Indeed don't let servers read their pages. The user can, so this walks them
 * through bringing the description in: open, copy, paste (cleaned automatically) — or the bookmark button.
 */
export function PortalHelp({ url, onText, hasJsearch, onOpenSettings }: { url: string; onText: (t: string) => void; hasJsearch: boolean; onOpenSettings: () => void }) {
  const site = (() => {
    try {
      return new URL(url).hostname.replace(/^(www|in|uk|ca|au|m)\./, "").split(".")[0]!.toLowerCase();
    } catch {
      return "this site";
    }
  })();
  const BRANDS: Record<string, string> = { linkedin: "LinkedIn", naukri: "Naukri", indeed: "Indeed", glassdoor: "Glassdoor", foundit: "foundit", monster: "Monster", instahyre: "Instahyre", shine: "Shine", ziprecruiter: "ZipRecruiter" };
  const name = BRANDS[site] ?? site.charAt(0).toUpperCase() + site.slice(1);
  const [msg, setMsg] = useState<string | null>(null);
  const bm = useRef<HTMLAnchorElement>(null);
  // React blocks javascript: URLs in JSX, so the bookmark link gets its href directly
  useEffect(() => {
    bm.current?.setAttribute("href", BOOKMARKLET);
  }, []);

  const paste = async () => {
    try {
      const t = await navigator.clipboard.readText();
      if (!t.trim()) return setMsg("The clipboard is empty. Copy the job page first.");
      onText(t);
    } catch {
      setMsg("Your browser didn't allow reading the clipboard. Click in the box below and press Ctrl+V (⌘V on Mac).");
    }
  };

  return (
    <div className="border-ink mb-3 border-2 p-3 text-sm" role="region" aria-label={`Bring in the ${name} job`}>
      <p className="font-medium">{name} doesn&apos;t let apps read its job pages. Bring the job in yourself in two steps:</p>
      <ol className="mt-2 flex flex-col gap-2">
        <li className="flex flex-wrap items-center gap-2">
          <span className="code text-muted">1</span>
          <a href={url} target="_blank" rel="noreferrer" className="btn">
            Open the job on {name} ↗
          </a>
          <span className="text-muted text-xs">then press Ctrl+A and Ctrl+C (⌘A, ⌘C on Mac) to copy the page.</span>
        </li>
        <li className="flex flex-wrap items-center gap-2">
          <span className="code text-muted">2</span>
          <Button variant="primary" onClick={paste}>
            Paste the copied page
          </Button>
          <span className="text-muted text-xs">CVTuner keeps only the job description.</span>
        </li>
      </ol>
      {msg ? <p className="text-warn mt-2 text-xs">{msg}</p> : null}
      <div className="border-rule mt-3 flex flex-col gap-2 border-t pt-3 text-xs">
        <ExtensionCard compact />
        <p>
          <span className="font-medium">Faster next time:</span> drag{" "}
          <a ref={bm} className="btn" onClick={(e) => e.preventDefault()} title="Drag me to your bookmarks bar">
            Send to CVTuner
          </a>{" "}
          to your bookmarks bar. On any job page, click it and the job opens here, already pasted.
        </p>
        <p className="text-muted">On a phone, use the share button in the {name} app and pick CVTuner (install CVTuner from the browser menu first).</p>
        {!hasJsearch ? (
          <p className="text-muted">
            With a free JSearch key, links that include the job title are found automatically.{" "}
            <button type="button" className="underline" onClick={onOpenSettings}>
              Add a key
            </button>
          </p>
        ) : null}
      </div>
    </div>
  );
}
