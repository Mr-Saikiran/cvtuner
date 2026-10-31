import { PROVIDERS, type ChatMessage, type ProviderId } from "@cvtuner/core";
import { NextResponse } from "next/server";
import { chat, listModels, LlmError } from "@/lib/server/llm";

export const runtime = "nodejs";
export const maxDuration = 60;

const SERVER_PROVIDERS = new Set(PROVIDERS.filter((p) => !p.direct).map((p) => p.id));

/**
 * Forwards a request to the user's chosen AI provider with the user's own key.
 * The key is used for this one call and is never stored or logged.
 */
export async function POST(req: Request) {
  const raw = await req.text();
  if (raw.length > 300_000) return NextResponse.json({ error: "Request too large." }, { status: 413 });
  let body: { action?: string; provider?: ProviderId; model?: string; apiKey?: string; messages?: ChatMessage[] };
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const { action, provider, model, apiKey, messages } = body;
  if (!provider || !SERVER_PROVIDERS.has(provider)) return NextResponse.json({ error: "Unknown provider." }, { status: 400 });
  if (!apiKey || apiKey.length > 500) return NextResponse.json({ error: "Add your API key in Settings." }, { status: 400 });

  try {
    if (action === "models") return NextResponse.json({ models: await listModels(provider, apiKey) });
    if (!model || !Array.isArray(messages) || !messages.length) return NextResponse.json({ error: "Missing model or messages." }, { status: 400 });
    const clean = messages
      .filter((m) => (m.role === "system" || m.role === "user") && typeof m.content === "string")
      .map((m) => ({ role: m.role, content: m.content }));
    return NextResponse.json({ text: await chat({ provider, model, apiKey, messages: clean }) });
  } catch (e) {
    const status = e instanceof LlmError ? e.status : 500;
    return NextResponse.json({ error: (e as Error).message }, { status });
  }
}
