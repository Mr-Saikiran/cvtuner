"use client";

import { DOC_LANGUAGES, PROVIDERS, providerInfo, type ProviderId } from "@cvtuner/core";
import { useState } from "react";
import { activeModel, aiChat, aiModels } from "@/lib/ai";
import type { Settings } from "@/lib/store";
import { Badge, Button, Card, Segmented } from "./ui";

const TEMPLATE_INFO = [
  { value: "classic" as const, label: "Classic", hint: "Navy headings with rules" },
  { value: "modern" as const, label: "Modern", hint: "Teal accent bars" },
  { value: "serif" as const, label: "Serif", hint: "Centered, Times" },
];

export function SettingsView({ settings, setSettings }: { settings: Settings; setSettings: (s: Settings) => void }) {
  return (
    <div className="mx-auto grid max-w-3xl gap-4">
      <Card title="Writing">
        <div className="flex flex-col gap-4">
          <Row label="Sentence voice" hint="Passive: “Vendor contracts were managed.” Action verbs: “Managed vendor contracts.” Recruiters often prefer action verbs.">
            <Segmented
              label="Sentence voice"
              value={settings.voice}
              onChange={(voice) => setSettings({ ...settings, voice })}
              options={[
                { value: "passive", label: "Passive" },
                { value: "active", label: "Action verbs" },
              ]}
            />
          </Row>
          <Row label="Page limit" hint="Two pages is the target. “Up to 3” keeps more content when you have a long history. Never more than 3.">
            <Segmented
              label="Page limit"
              value={settings.maxPages}
              onChange={(maxPages) => setSettings({ ...settings, maxPages })}
              options={[
                { value: 2, label: "2 pages" },
                { value: 3, label: "Up to 3" },
              ]}
            />
          </Row>
          <Row label="Cover letter tone" hint="Used by both the rule engine and AI.">
            <Segmented
              label="Tone"
              value={settings.tone}
              onChange={(tone) => setSettings({ ...settings, tone })}
              options={[
                { value: "formal", label: "Formal" },
                { value: "friendly", label: "Friendly" },
              ]}
            />
          </Row>
        </div>
      </Card>

      <Card title="Documents">
        <div className="flex flex-col gap-4">
          <div>
            <p className="mb-2 text-sm font-medium">Template</p>
            <div className="grid grid-cols-3 gap-2">
              {TEMPLATE_INFO.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setSettings({ ...settings, template: t.value })}
                  aria-pressed={settings.template === t.value}
                  className={`rounded-xl border p-3 text-left transition-colors ${settings.template === t.value ? "border-brand-500 bg-brand-500/10" : "border-[var(--border)] hover:border-brand-500/50"}`}
                >
                  <TemplateThumb id={t.value} />
                  <p className="mt-2 text-sm font-medium">{t.label}</p>
                  <p className="muted text-xs">{t.hint}</p>
                </button>
              ))}
            </div>
            <p className="muted mt-2 text-xs">All templates are single column with real text, so applicant tracking systems can read them.</p>
          </div>
          <Row label="Document language" hint="Section headings in the PDF and Word file. AI mode also writes new lines in this language; the rule engine writes English.">
            <select className="field max-w-48" value={settings.lang} onChange={(e) => setSettings({ ...settings, lang: e.target.value })} aria-label="Document language">
              {Object.entries(DOC_LANGUAGES).map(([code, l]) => (
                <option key={code} value={code}>
                  {l.name}
                </option>
              ))}
            </select>
          </Row>
        </div>
      </Card>

      <AiCard settings={settings} setSettings={setSettings} />

      <Card title="Your data">
        <p className="muted text-sm">
          Your profile, saved versions, watched boards and API keys are stored only in this browser. Imported files are read once and not kept. When you use a
          cloud AI provider, your resume and the job description are sent to that provider through CVTuner&apos;s server, which does not store them or your key.
        </p>
      </Card>
    </div>
  );
}

function AiCard({ settings, setSettings }: { settings: Settings; setSettings: (s: Settings) => void }) {
  const ai = settings.ai;
  const info = providerInfo(ai.provider);
  const [models, setModels] = useState<string[]>([]);
  const [status, setStatus] = useState<{ tone: "good" | "bad" | "neutral"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const setAi = (patch: Partial<Settings["ai"]>) => setSettings({ ...settings, ai: { ...ai, ...patch } });

  const pick = (provider: ProviderId) => {
    setModels([]);
    setStatus(null);
    setAi({ provider });
  };

  const test = async () => {
    setBusy(true);
    setStatus({ tone: "neutral", text: "Checking…" });
    try {
      const list = await aiModels(ai).catch(() => [] as string[]);
      setModels(list);
      const reply = await aiChat(ai, [{ role: "user", content: 'Reply with the single word "ok".' }]);
      setStatus({ tone: "good", text: `Connected. ${activeModel(ai)} replied “${reply.trim().slice(0, 30)}”.${list.length ? ` ${list.length} models available.` : ""}` });
    } catch (e) {
      setStatus({ tone: "bad", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title={<span className="flex items-center gap-2">AI provider <Badge tone="brand">Advanced</Badge></span>}>
      <p className="muted mb-3 text-sm">
        Optional. Use your own key from any major provider — several have free tiers. Without a key, CVTuner uses its rule engine. AI suggestions go through the same
        truth check: lines that mention skills you haven&apos;t got are removed.
      </p>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {PROVIDERS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => pick(p.id)}
            aria-pressed={ai.provider === p.id}
            className={`flex flex-col items-start gap-1 rounded-xl border p-2.5 text-left text-sm transition-colors ${ai.provider === p.id ? "border-brand-500 bg-brand-500/10" : "border-[var(--border)] hover:border-brand-500/50"}`}
          >
            <span className="font-medium">{p.name}</span>
            <span className="flex flex-wrap gap-1">
              {p.free === "yes" ? <Badge tone="good">Free tier</Badge> : p.free === "some-models" ? <Badge tone="good">Free models</Badge> : <Badge>Paid</Badge>}
              {ai.keys[p.id] || (p.direct && ai.provider === p.id) ? <Badge tone="brand">Set</Badge> : null}
            </span>
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-col gap-3">
        {info.note ? <p className="muted text-xs">{info.note}</p> : null}
        {info.direct ? (
          <label className="flex flex-col gap-1 text-sm">
            <span className="muted text-xs font-medium">Server URL (OpenAI-compatible)</span>
            <input className="field" value={ai.customBaseUrl} onChange={(e) => setAi({ customBaseUrl: e.target.value })} placeholder="http://localhost:11434/v1" />
          </label>
        ) : null}
        <label className="flex flex-col gap-1 text-sm">
          <span className="muted flex items-center justify-between text-xs font-medium">
            API key {info.direct ? "(optional)" : ""}
            <a href={info.keyUrl} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline">
              Get a {info.name} key ↗
            </a>
          </span>
          <input
            className="field font-mono"
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={ai.keys[ai.provider] ?? ""}
            onChange={(e) => setAi({ keys: { ...ai.keys, [ai.provider]: e.target.value.trim() } })}
            placeholder="Paste your key"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="muted text-xs font-medium">Model</span>
          <input
            className="field font-mono"
            list="cvtuner-models"
            value={ai.models[ai.provider] ?? ""}
            onChange={(e) => setAi({ models: { ...ai.models, [ai.provider]: e.target.value.trim() } })}
            placeholder={info.defaultModel}
          />
          <datalist id="cvtuner-models">
            {models.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
          <span className="muted text-xs">Leave empty for {info.defaultModel}. “Test” loads the full list from the provider.</span>
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="primary" onClick={test} disabled={busy || (!info.direct && !ai.keys[ai.provider])}>
            {busy ? "Testing…" : "Test & load models"}
          </Button>
          {ai.keys[ai.provider] ? (
            <Button variant="ghost" onClick={() => setAi({ keys: { ...ai.keys, [ai.provider]: "" } })}>
              Remove key
            </Button>
          ) : null}
          <Segmented
            label="Engine"
            value={settings.engine}
            onChange={(engine) => setSettings({ ...settings, engine })}
            options={[
              { value: "rules", label: "Rule engine" },
              { value: "ai", label: "Use AI" },
            ]}
          />
        </div>
        {status ? (
          <p className={`text-sm ${status.tone === "good" ? "text-green-700 dark:text-green-400" : status.tone === "bad" ? "text-red-600" : "muted"}`} role="status">
            {status.text}
          </p>
        ) : null}
        <p className="muted text-xs">Keys are saved in this browser only. Anyone using this browser profile can see them — remove them on shared computers.</p>
      </div>
    </Card>
  );
}

function TemplateThumb({ id }: { id: "classic" | "modern" | "serif" }) {
  const accent = id === "modern" ? "#0f766e" : id === "serif" ? "#111" : "#1f3a5f";
  const center = id === "serif";
  return (
    <svg viewBox="0 0 60 40" className="h-14 w-full rounded bg-white" aria-hidden>
      {id === "modern" ? <rect x="4" y="4" width="1.6" height="8" fill={accent} /> : null}
      <rect x={center ? 18 : 8} y="5" width="24" height="3" rx="1" fill={accent} />
      <rect x={center ? 22 : 8} y="9.5" width="16" height="1.6" rx="0.8" fill="#999" />
      {[16, 27].map((y) => (
        <g key={y}>
          {id === "modern" ? <rect x="4" y={y} width="1.2" height="2.4" fill={accent} /> : <rect x="4" y={y + 3} width="52" height="0.5" fill={accent} />}
          <rect x={id === "modern" ? 7 : center ? 24 : 4} y={y} width="12" height="2" rx="1" fill={accent} />
          <rect x="6" y={y + 5} width="46" height="1.2" rx="0.6" fill="#ccc" />
          <rect x="6" y={y + 7.5} width="38" height="1.2" rx="0.6" fill="#ccc" />
        </g>
      ))}
    </svg>
  );
}

function Row({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="max-w-md">
        <p className="text-sm font-medium">{label}</p>
        <p className="muted text-xs">{hint}</p>
      </div>
      {children}
    </div>
  );
}
