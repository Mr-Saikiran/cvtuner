"use client";

import { useState } from "react";
import { isProfileEmpty, useJobs, useProfile, useSettings, type SavedJob } from "@/lib/store";
import { HistoryView } from "./HistoryView";
import { ProfileView } from "./ProfileView";
import { SettingsView } from "./SettingsView";
import { TailorView } from "./TailorView";

type Tab = "tune" | "profile" | "saved" | "settings";

const TABS: { id: Tab; label: string }[] = [
  { id: "tune", label: "Tune" },
  { id: "profile", label: "Profile" },
  { id: "saved", label: "Saved" },
  { id: "settings", label: "Settings" },
];

export function App() {
  const [profile, setProfile, profileReady] = useProfile();
  const [jobs, setJobs] = useJobs();
  const [settings, setSettings] = useSettings();
  const [tab, setTab] = useState<Tab>("tune");
  const [openJob, setOpenJob] = useState<SavedJob | null>(null);

  const needsProfile = profileReady && isProfileEmpty(profile);

  return (
    <div className="mx-auto flex min-h-dvh max-w-7xl flex-col px-4 pb-24 sm:px-6 sm:pb-10">
      <header className="flex items-center justify-between gap-3 py-4">
        <a href="/cvtuner" className="flex items-center gap-2" aria-label="CVTuner home">
          <img src="/cvtuner/icon.svg" alt="" width={32} height={32} className="rounded-lg" />
          <span className="text-lg font-bold tracking-tight">
            CV<span className="text-brand-600">Tuner</span>
          </span>
          <span className="muted hidden text-xs sm:inline">by TechSwitch</span>
        </a>
        <nav className="hidden gap-1 sm:flex" aria-label="Main">
          {TABS.map((t) => (
            <TabButton key={t.id} active={tab === t.id} onClick={() => setTab(t.id)}>
              {t.label}
              {t.id === "saved" && jobs.length ? <span className="muted ml-1 text-xs">{jobs.length}</span> : null}
            </TabButton>
          ))}
        </nav>
      </header>

      {needsProfile && tab === "tune" ? (
        <div className="surface mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border-brand-500/40 bg-brand-50/40 p-4 dark:bg-brand-500/10">
          <p className="text-sm">
            <strong>Start with your resume.</strong> Upload a PDF or Word file, or load the sample to try CVTuner.
          </p>
          <button type="button" className="rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-medium text-white" onClick={() => setTab("profile")}>
            Add resume
          </button>
        </div>
      ) : null}

      <main className="flex-1">
        {tab === "tune" && (
          <TailorView
            profile={profile}
            settings={settings}
            setSettings={setSettings}
            openJob={openJob}
            onSave={(job) => {
              setJobs((prev) => [job, ...prev.filter((j) => j.id !== job.id)]);
              setOpenJob(job);
            }}
          />
        )}
        {tab === "profile" && <ProfileView profile={profile} setProfile={setProfile} />}
        {tab === "saved" && (
          <HistoryView
            jobs={jobs}
            onOpen={(j) => {
              setOpenJob(j);
              setTab("tune");
            }}
            onDelete={(id) => setJobs((prev) => prev.filter((j) => j.id !== id))}
          />
        )}
        {tab === "settings" && <SettingsView settings={settings} setSettings={setSettings} />}
      </main>

      {/* bottom tab bar on phones */}
      <nav
        className="surface fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 border-x-0 border-b-0 pb-[env(safe-area-inset-bottom)] sm:hidden"
        aria-label="Main"
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`py-3 text-sm font-medium ${tab === t.id ? "text-brand-600" : "muted"}`}
            aria-current={tab === t.id ? "page" : undefined}
          >
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  );
}

function TabButton({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${active ? "bg-brand-600 text-white" : "muted hover:bg-black/5 dark:hover:bg-white/10"}`}
    >
      {children}
    </button>
  );
}
