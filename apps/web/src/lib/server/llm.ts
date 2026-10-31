import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { providerInfo, type ChatMessage, type ProviderId } from "@cvtuner/core";

export interface LlmRequest {
  provider: ProviderId;
  model: string;
  apiKey: string;
  messages: ChatMessage[];
}

export class LlmError extends Error {
  constructor(
    message: string,
    public status = 502,
  ) {
    super(message);
  }
}

/** Claude models that accept the server-side refusal fallback ("default" routing). */
const FALLBACK_MODELS = new Set(["claude-opus-5-5", "claude-opus-5", "claude-fable-5-1", "claude-sonnet-5-5"]);

export async function chat(req: LlmRequest): Promise<string> {
  if (req.provider === "anthropic") return anthropicChat(req);
  return openAiCompatibleChat(req);
}

async function anthropicChat({ model, apiKey, messages }: LlmRequest): Promise<string> {
  const client = new Anthropic({ apiKey, maxRetries: 1, timeout: 55_000 });
  const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
  const user = messages.filter((m) => m.role === "user").map((m) => ({ role: "user" as const, content: m.content }));
  try {
    const useFallback = FALLBACK_MODELS.has(model);
    const res = await client.beta.messages.create({
      model,
      max_tokens: 16000,
      system,
      messages: user,
      ...(useFallback ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
    });
    if (res.stop_reason === "refusal") throw new LlmError("The model declined this request.", 422);
    return res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  } catch (e) {
    if (e instanceof LlmError) throw e;
    if (e instanceof Anthropic.AuthenticationError) throw new LlmError("Anthropic rejected the API key.", 401);
    if (e instanceof Anthropic.PermissionDeniedError) throw new LlmError("This key cannot use that model.", 403);
    if (e instanceof Anthropic.NotFoundError) throw new LlmError(`Model "${model}" was not found. Load the model list and pick one.`, 404);
    if (e instanceof Anthropic.RateLimitError) throw new LlmError("Rate limited by Anthropic. Wait a moment and retry.", 429);
    if (e instanceof Anthropic.BadRequestError) throw new LlmError(`Anthropic: ${e.message}`, 400);
    if (e instanceof Anthropic.APIError) throw new LlmError(`Anthropic error ${e.status ?? ""}: ${e.message}`, 502);
    throw new LlmError(`Could not reach Anthropic: ${(e as Error).message}`, 502);
  }
}

function compatHeaders(provider: ProviderId, apiKey: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
    // OpenRouter uses these to attribute traffic; harmless elsewhere
    ...(provider === "openrouter" ? { "HTTP-Referer": "https://techswitch.in/cvtuner", "X-Title": "CVTuner" } : {}),
  };
}

async function openAiCompatibleChat({ provider, model, apiKey, messages }: LlmRequest): Promise<string> {
  const base = providerInfo(provider).baseUrl;
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: compatHeaders(provider, apiKey),
    body: JSON.stringify({ model, messages }),
    signal: AbortSignal.timeout(55_000),
  }).catch((e: Error) => {
    throw new LlmError(`Could not reach ${providerInfo(provider).name}: ${e.message}`);
  });
  const body = (await res.json().catch(() => ({}))) as {
    choices?: { message?: { content?: string } }[];
    error?: { message?: string } | string;
  };
  if (!res.ok) {
    const msg = typeof body.error === "string" ? body.error : body.error?.message;
    if (res.status === 401 || res.status === 403) throw new LlmError(`${providerInfo(provider).name} rejected the API key.`, 401);
    if (res.status === 429) throw new LlmError(`Rate limited by ${providerInfo(provider).name}. Free tiers have per-minute limits; retry shortly.`, 429);
    throw new LlmError(`${providerInfo(provider).name} error ${res.status}: ${msg ?? "unknown error"}`, res.status === 404 ? 404 : 502);
  }
  const text = body.choices?.[0]?.message?.content;
  if (!text) throw new LlmError("The model returned an empty reply.");
  return text;
}

export async function listModels(provider: ProviderId, apiKey: string): Promise<string[]> {
  if (provider === "anthropic") {
    const client = new Anthropic({ apiKey, maxRetries: 1, timeout: 20_000 });
    try {
      const ids: string[] = [];
      for await (const m of client.models.list({ limit: 100 })) ids.push(m.id);
      return ids;
    } catch (e) {
      if (e instanceof Anthropic.AuthenticationError) throw new LlmError("Anthropic rejected the API key.", 401);
      if (e instanceof Anthropic.APIError) throw new LlmError(`Anthropic error ${e.status ?? ""}: ${e.message}`);
      throw new LlmError(`Could not reach Anthropic: ${(e as Error).message}`);
    }
  }
  const info = providerInfo(provider);
  const res = await fetch(`${info.baseUrl}/models`, { headers: compatHeaders(provider, apiKey), signal: AbortSignal.timeout(20_000) }).catch((e: Error) => {
    throw new LlmError(`Could not reach ${info.name}: ${e.message}`);
  });
  if (res.status === 401 || res.status === 403) throw new LlmError(`${info.name} rejected the API key.`, 401);
  if (!res.ok) throw new LlmError(`${info.name} error ${res.status} while listing models.`);
  const body = (await res.json()) as { data?: { id: string }[] };
  return (body.data ?? []).map((m) => m.id.replace(/^models\//, ""));
}
