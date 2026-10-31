import { bulletPriorities, dropBullets, removableBulletCount, type Resume } from "@cvtuner/core";
import { DENSITY, type LayoutOptions } from "./options";
import { countPdfPages, renderPdf } from "./pdf";

export interface FitOptions {
  /** pages to aim for (default 2) */
  targetPages?: number;
  /** pages never to exceed (default 3, max 3) */
  maxPages?: number;
  /** JD keywords used to decide which bullets matter */
  keywords?: string[];
  /** bullet texts that must be kept if at all possible (e.g. accepted tailored bullets) */
  protect?: string[];
}

export interface FitResult {
  resume: Resume;
  layout: LayoutOptions;
  pdf: Uint8Array;
  pages: number;
  droppedBullets: number;
  /** true when the target was met; false means we stopped at maxPages */
  metTarget: boolean;
}

type Renderer = (resume: Resume, layout: LayoutOptions) => Promise<Uint8Array>;

/**
 * Fits the resume into `targetPages` (2 by default) and never exceeds `maxPages` (3).
 * Order of operations: tighten layout density first, then drop the least relevant bullets
 * (binary search, so only ~log2(n) renders), keeping at least one bullet per role.
 */
export async function fitToPages(resume: Resume, opts: FitOptions = {}, render: Renderer = renderPdf): Promise<FitResult> {
  const target = Math.max(1, opts.targetPages ?? 2);
  const max = Math.min(3, Math.max(target, opts.maxPages ?? 3));
  const order = bulletPriorities(resume, opts.keywords ?? [], opts.protect);
  const removable = removableBulletCount(resume);

  const attempt = async (drop: number, layout: LayoutOptions) => {
    const r = drop ? dropBullets(resume, order, drop) : resume;
    const pdf = await render(r, layout);
    return { resume: r, layout, pdf, pages: countPdfPages(pdf), droppedBullets: drop };
  };

  let best: Awaited<ReturnType<typeof attempt>> | null = null;
  for (const layout of DENSITY) {
    const res = await attempt(0, layout);
    if (res.pages <= target) return { ...res, metTarget: true };
    best = res;
  }
  const dense = DENSITY[DENSITY.length - 1]!;

  // binary search the smallest number of dropped bullets that reaches `limit` pages
  const search = async (limit: number) => {
    let lo = 1;
    let hi = removable;
    let found: Awaited<ReturnType<typeof attempt>> | null = null;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const res = await attempt(mid, dense);
      if (res.pages <= limit) {
        found = res;
        hi = mid - 1;
      } else lo = mid + 1;
    }
    return found;
  };

  const atTarget = removable ? await search(target) : null;
  if (atTarget) return { ...atTarget, metTarget: true };
  // target not reachable without gutting the resume: allow up to maxPages, as long as nothing more is dropped than needed
  if (best && best.pages <= max) return { ...best, metTarget: false };
  const atMax = removable ? await search(max) : null;
  if (atMax) return { ...atMax, metTarget: false };
  const last = await attempt(removable, dense);
  return { ...last, metTarget: last.pages <= target };
}
