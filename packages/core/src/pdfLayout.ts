/**
 * Rebuilds readable text from positioned PDF text items (pdf.js getTextContent):
 * finds a sidebar column, orders each column top to bottom, rejoins letter-spaced words
 * ("D a t a" → "Data") and merges wrapped lines back into one bullet each.
 */
export interface PdfItem {
  str: string;
  x: number;
  /** baseline, PDF coordinates (0 at the bottom) */
  y: number;
  w: number;
  /** font size */
  h: number;
}

export interface PdfPage {
  width: number;
  items: PdfItem[];
}

interface Line {
  x: number;
  y: number;
  h: number;
  w: number;
  text: string;
  /** width of the last physical line merged into this one */
  lastW?: number;
}

const letterSpaced = (s: string) => /^(\S )+\S$/.test(s.trim());

function toLines(items: PdfItem[]): Line[] {
  const sorted = items.filter((i) => i.str.trim()).sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: { items: PdfItem[]; y: number; h: number }[] = [];
  for (const it of sorted) {
    const line = lines.find((l) => Math.abs(l.y - it.y) < Math.max(2, Math.min(l.h, it.h) * 0.45));
    if (line) {
      line.items.push(it);
      line.h = Math.max(line.h, it.h);
    } else lines.push({ items: [it], y: it.y, h: it.h });
  }
  return lines.map((l) => {
    const its = l.items.sort((a, b) => a.x - b.x);
    let text = "";
    let end = -Infinity;
    for (const it of its) {
      const s = letterSpaced(it.str) ? it.str.replace(/ /g, "") : it.str;
      const gap = it.x - end;
      // pdf.js splits words and even parts of words into items; only a real gap is a space
      text += text && gap > l.h * 0.18 && !/\s$/.test(text) && !/^\s/.test(s) ? ` ${s}` : s;
      end = it.x + it.w;
    }
    const x = its[0]!.x;
    return { x, y: l.y, h: l.h, w: end - x, text: text.replace(/\s+/g, " ").trim() };
  });
}

/**
 * A vertical split with little text crossing it and real text on both sides. Header bands
 * may run over a sidebar, so a few crossing lines are allowed; they are placed by their centre.
 */
function findSplit(lines: { x: number; w: number }[], width: number): number | null {
  let best: { x: number; cross: number } | null = null;
  for (let x = width * 0.22; x <= width * 0.5; x += 2) {
    const left = lines.filter((l) => l.x + l.w <= x).length;
    const right = lines.filter((l) => l.x >= x).length;
    if (left < 6 || right < 6) continue;
    const cross = lines.filter((l) => l.x < x - 1 && l.x + l.w > x + 1).length;
    if (!best || cross < best.cross) best = { x, cross };
  }
  return best && best.cross <= Math.max(2, lines.length * 0.15) ? best.x : null;
}

const SENTENCE_END = /[.!?:;]$/;
const CONTINUES = /[,&/(+-]$|\b(and|or|of|to|for|with|the|a|an|in|on|by|via|using|from|into|across)$/i;
const STARTS_ACTION = /^(Led|Drove|Built|Setup|Set|Architected|Designed|Developed|Managed|Maintaining|Maintained|Managing|Implemented|Implementing|Created|Creating|Collaborated|Using|Used|Owned|Delivered|Improved|Reduced|Saved|Migrated|Migrating|Automated|Configured|Configuring|Monitoring|Monitored|Encrypting|Combining|Writing|Building|Performed|Horizontal|Potential|Collaborate|Change|Ran|Run|Rolled|Negotiated|Coordinated|Handled|Trained|Mentored|Launched|Increased|Analyzed|Analysed|Supported|Prepared|Conducted|Achieved|Optimized|Optimised|Established|Spearheaded|Oversaw|Streamlined|Securing|Secured|Developing|Leading|Responsible)\b/;

/** Merges a wrapped line into the one above when it plainly continues it. */
function mergeWrapped(lines: Line[]): Line[] {
  // "full width" is judged within a block of the same indent and font size, not the whole column
  const blockKey = (l: Line) => `${Math.round(l.x / 3)}|${Math.round(l.h)}`;
  const blockMax = new Map<string, number>();
  for (const l of lines) blockMax.set(blockKey(l), Math.max(blockMax.get(blockKey(l)) ?? 0, l.w));
  const out: Line[] = [];
  for (const l of lines) {
    const prev = out[out.length - 1];
    const sameBlock = prev && Math.abs(prev.h - l.h) < 0.6 && Math.abs(prev.x - l.x) < 3 && prev.y - l.y < l.h * 2;
    if (prev && sameBlock) {
      // comma-separated lists (skills, tech stack) wrap anywhere, even mid-skill
      const dense = (t: string) => (t.match(/,/g)?.length ?? 0) / Math.max(1, t.split(/\s+/).length) >= 0.2;
      const list = dense(prev.text) && (dense(l.text) || /^\S+( \S+){0,3}$/.test(l.text)) && !SENTENCE_END.test(prev.text);
      if (list) {
        prev.text = `${prev.text} ${l.text}`;
        prev.y = l.y;
        prev.lastW = l.w;
        continue;
      }
      if (prev.text.length > 40) {
        // a line that stops well short of the block's edge ended its bullet
        const prevFull = (prev.lastW ?? prev.w) > (blockMax.get(blockKey(l)) ?? prev.w) * 0.72;
        const startsNew = SENTENCE_END.test(prev.text) || STARTS_ACTION.test(l.text) || !prevFull;
        const continues = /^[a-z(]/.test(l.text) || CONTINUES.test(prev.text);
        if (continues || !startsNew) {
          prev.text = `${prev.text} ${l.text}`;
          prev.y = l.y;
          prev.lastW = l.w;
          continue;
        }
      }
    }
    out.push({ ...l });
  }
  return out;
}

export function layoutPdfText(pages: PdfPage[]): string {
  const main: string[] = [];
  // sidebars go after all main text, so page 2 of the experience still follows page 1
  const side: string[] = [];
  for (const page of pages) {
    const lines = toLines(page.items);
    if (!lines.length) continue;
    // decide on raw items: lines built across the whole width would straddle both columns
    const split = findSplit(page.items.filter((i) => i.str.trim()), page.width);
    const text = (ls: Line[]) => mergeWrapped(ls.sort((a, b) => b.y - a.y)).map((l) => l.text).join("\n");
    if (split === null) {
      main.push(text(lines));
      continue;
    }
    // rebuild lines per column so text side by side is never joined into one line
    const centre = (i: PdfItem) => i.x + i.w / 2;
    const left = toLines(page.items.filter((i) => centre(i) < split));
    const right = toLines(page.items.filter((i) => centre(i) >= split));
    // the column with the biggest text (the name) or the most text is the main one
    const weight = (c: Line[]) => Math.max(0, ...c.map((l) => l.h)) * 4 + c.reduce((n, l) => n + l.text.length, 0) / 200;
    const [m, sb] = weight(right) >= weight(left) ? [right, left] : [left, right];
    main.push(text(m));
    if (sb.length) side.push(text(sb));
  }
  return [...main, ...side].join("\n");
}
