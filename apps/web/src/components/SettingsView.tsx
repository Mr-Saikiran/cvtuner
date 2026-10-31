import type { Settings } from "@/lib/store";
import { Badge, Card, Segmented } from "./ui";

export function SettingsView({ settings, setSettings }: { settings: Settings; setSettings: (s: Settings) => void }) {
  return (
    <div className="grid max-w-3xl gap-4">
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
        </div>
      </Card>
      <Card title={<span className="flex items-center gap-2">AI providers <Badge tone="brand">Phase 2</Badge></span>}>
        <p className="muted text-sm">
          Bring your own key for Anthropic, OpenAI, Gemini or a local model (Ollama, LM Studio). The rule engine keeps working without any key.
        </p>
      </Card>
      <Card title="Your data">
        <p className="muted text-sm">
          Your profile and saved versions are stored only in this browser. Imported files are read once to extract text and are not kept.
        </p>
      </Card>
    </div>
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
