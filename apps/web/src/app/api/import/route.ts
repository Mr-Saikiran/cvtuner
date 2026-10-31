import { parseResume, parseResumeText } from "@cvtuner/core";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_BYTES = 5 * 1024 * 1024;

/** Turns an uploaded resume (PDF, DOCX, TXT/MD or JSON Resume) into the CVTuner schema. Nothing is stored. */
export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "File is larger than 5 MB" }, { status: 413 });

  const name = file.name.toLowerCase();
  const buf = new Uint8Array(await file.arrayBuffer());
  try {
    if (name.endsWith(".json")) {
      return NextResponse.json({ resume: parseResume(JSON.parse(new TextDecoder().decode(buf))) });
    }
    let text: string;
    if (name.endsWith(".pdf")) {
      const { extractText, getDocumentProxy } = await import("unpdf");
      const doc = await getDocumentProxy(buf);
      const out = await extractText(doc, { mergePages: false });
      text = (out.text as string[]).join("\n");
    } else if (name.endsWith(".docx")) {
      const mammoth = await import("mammoth");
      text = (await mammoth.extractRawText({ buffer: Buffer.from(buf) })).value;
    } else if (/\.(txt|md|markdown)$/.test(name)) {
      text = new TextDecoder().decode(buf);
    } else {
      return NextResponse.json({ error: "Use a PDF, DOCX, TXT, MD or JSON file" }, { status: 415 });
    }
    return NextResponse.json({ resume: parseResumeText(text), text });
  } catch (e) {
    return NextResponse.json({ error: `Could not read the file: ${(e as Error).message}` }, { status: 422 });
  }
}
