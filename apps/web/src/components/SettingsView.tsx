"use client";

import { DOC_LANGUAGES, PROVIDERS, providerInfo, type ProviderId } from "@cvtuner/core";
import { TEMPLATES, type TemplateId, type Theme } from "@cvtuner/render";
import { useState } from "react";
import { activeModel, aiChat, aiModels } from "@/lib/ai";
import type { Settings } from "@/lib/store";
import { Badge, Button, Card, Segmented } from "./ui";


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
          <Row
            label="Confirm missing skills"
            hint="Manual: you tap each missing skill you really have. Auto: skills proven by a line in your resume are confirmed for you (with AI, the model must quote that line). You can untick any of them."
          >
            <Segmented
              label="Confirm missing skills"
              value={settings.skillConfirm}
              onChange={(skillConfirm) => setSettings({ ...settings, skillConfirm })}
              options={[
                { value: "manual", label: "Manual" },
                { value: "auto", label: "Auto" },
              ]}
            />
          </Row>
          <Row
            label="Metric placeholders (AI)"
            hint="Numbers make bullets stand out. AI keeps every number from your resume and, where a line has none, adds a placeholder like [X%] for you to fill in. It never makes up figures."
          >
            <Segmented
              label="Metric placeholders"
              value={settings.suggestMetrics ? "on" : "off"}
              onChange={(v) => setSettings({ ...settings, suggestMetrics: v === "on" })}
              options={[
                { value: "on", label: "On" },
                { value: "off", label: "Off" },
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
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(Object.values(TEMPLATES) as Theme[]).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSettings({ ...settings, template: t.id })}
                  aria-pressed={settings.template === t.id}
                  className={`rounded-xl border p-2.5 text-left transition-colors ${settings.template === t.id ? "border-brand-500 bg-brand-500/10" : "border-[var(--border)] hover:border-brand-500/50"}`}
                >
                  <TemplateThumb theme={t} />
                  <p className="mt-2 text-sm font-medium">{t.name}</p>
                  <p className="muted text-xs">{t.description}</p>
                  <span className="mt-1 inline-block">{t.singleColumn ? <Badge tone="good">ATS-safe</Badge> : <Badge tone="warn">Sidebar</Badge>}</span>
                </button>
              ))}
            </div>
            <p className="muted mt-2 text-xs">
              ATS-safe templates are single column. Sidebar designs look great to people and parse fine in modern ATS; the Word export of every template is single column.
              Photo templates show your photo from the Profile tab.
            </p>
          </div>
          <Row label="Bold numbers" hint="Numbers, percentages and amounts in your bullets are set in bold so results stand out.">
            <Segmented
              label="Bold numbers"
              value={settings.boldMetrics ? "on" : "off"}
              onChange={(v) => setSettings({ ...settings, boldMetrics: v === "on" })}
              options={[
                { value: "on", label: "On" },
                { value: "off", label: "Off" },
              ]}
            />
          </Row>
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

function TemplateThumb({ theme: t }: { theme: Theme }) {
  const accent = t.nameColor ?? t.accent;
  const sb = t.sidebar;
  const sx = sb ? (sb.side === "left" ? 0 : 42) : 0;
  const mainX = sb?.side === "left" ? 22 : 5;
  const mainW = sb ? 34 : 50;
  return (
    <svg viewBox="0 0 60 44" className="h-16 w-full rounded border border-black/5 bg-white" aria-hidden>
      {sb ? <rect x={sx} y="0" width="18" height="44" fill={sb.bg === "#ffffff" ? "#f8f8f8" : sb.bg} /> : null}
      {t.band ? <rect x="0" y="0" width="60" height="11" fill={t.band.bg} /> : null}
      {t.photo ? <circle cx={sb?.side === "left" ? 8 : 9} cy="5.5" r="3.6" fill="#c7cdd6" /> : null}
      <rect x={t.photo ? 15 : t.align === "center" ? 18 : mainX} y="3" width="20" height="3" rx="1" fill={t.band ? t.band.fg : accent} />
      <rect x={t.photo ? 15 : t.align === "center" ? 22 : mainX} y="7.5" width="13" height="1.4" rx="0.7" fill="#999" />
      {t.contactRight && !sb ? <rect x="44" y="3.5" width="11" height="4" rx="0.6" fill="#bbb" /> : null}
      {sb
        ? [15, 22, 29].map((y) => <rect key={y} x={sx + 3} y={y} width="11" height="1.2" rx="0.6" fill={sb.fg === "#ffffff" ? "#9fb3d1" : "#bbb"} />)
        : null}
      {[15, 28].map((y) => (
        <g key={y}>
          {t.heading === "bar" ? <rect x={mainX - 2} y={y} width="1.2" height="2.4" fill={t.accent} /> : null}
          {t.heading === "rule" ? <rect x={mainX} y={y + 3} width={mainW} height="0.5" fill={t.accent} /> : null}
          <rect x={t.align === "center" && !sb ? 24 : mainX} y={y} width="12" height="2" rx="1" fill={t.accent} />
          <rect x={mainX} y={y + 5} width={mainW - 2} height="1.2" rx="0.6" fill="#ccc" />
          <rect x={mainX} y={y + 7.5} width={mainW - 10} height="1.2" rx="0.6" fill="#ccc" />
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
