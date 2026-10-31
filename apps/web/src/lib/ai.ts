"use client";

import { providerInfo, type ChatMessage, type ProviderId } from "@cvtuner/core";
import type { AiSettings } from "./store";

export function activeModel(ai: AiSettings): string {
  return ai.models[ai.provider] || providerInfo(ai.provider).defaultModel;
}

export function aiReady(ai: AiSettings): boolean {
  return ai.provider === "custom" ? !!ai.customBaseUrl : !!ai.keys[ai.provider];
}

/** Local servers (Ollama, LM Studio) are called straight from the browser; everything else goes through /api/ai. */
async function direct(ai: AiSettings, path: string, init?: RequestInit) {
  const base = ai.customBaseUrl.replace(/\/+$/, "");
  const key = ai.keys.custom;
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(key ? { Authorization: `Bearer ${key}` } : {}) },
  }).catch(() => {
    throw new Error(`Could not reach ${base}. Is the server running and does it allow this site (for Ollama set OLLAMA_ORIGINS=https://techswitch.in)?`);
  });
  if (!res.ok) throw new Error(`Local server error ${res.status}`);
  return res.json();
}

async function viaServer(body: object) {
  const res = await fetch("/cvtuner/api/ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = (await res.json().catch(() => ({}))) as { text?: string; models?: string[]; error?: string };
  if (!res.ok) throw new Error(data.error ?? `AI request failed (${res.status})`);
  return data;
}

export async function aiChat(ai: AiSettings, messages: ChatMessage[]): Promise<string> {
  const model = activeModel(ai);
  if (providerInfo(ai.provider).direct) {
    const data = (await direct(ai, "/chat/completions", { method: "POST", body: JSON.stringify({ model, messages }) })) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = data.choices?.[0]?.message?.content;
    if (!text) throw new Error("The model returned an empty reply.");
    return text;
  }
  const data = await viaServer({ action: "chat", provider: ai.provider, model, apiKey: ai.keys[ai.provider], messages });
  return data.text ?? "";
}

export async function aiModels(ai: AiSettings, provider: ProviderId = ai.provider): Promise<string[]> {
  if (providerInfo(provider).direct) {
    const data = (await direct(ai, "/models")) as { data?: { id: string }[] };
    return (data.data ?? []).map((m) => m.id);
  }
  const data = await viaServer({ action: "models", provider, apiKey: ai.keys[provider] });
  const models = data.models ?? [];
  // free models first on OpenRouter, then alphabetical
  return provider === "openrouter" ? [...models].sort((a, b) => Number(b.endsWith(":free")) - Number(a.endsWith(":free")) || a.localeCompare(b)) : models;
}

export async function fetchJob(url: string, mode: "job" | "board" = "job") {
  const res = await fetch("/cvtuner/api/job", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url, mode }) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `Could not fetch the link (${res.status})`);
  return data as { job?: import("@cvtuner/core").JobPosting; jobs?: import("@cvtuner/core").JobPosting[] };
}
