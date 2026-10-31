"use client";

import { matchScore, newId } from "@cvtuner/core";
import { useEffect, useState } from "react";
import { INCOMING_KEY, isProfileEmpty, useJobs, useMode, useProfile, useSettings, type Mode, type SavedJob } from "@/lib/store";
import { BoardsView } from "./BoardsView";
import { ExtensionCard } from "./ExtensionCard";
import { JobSearch } from "./JobSearch";
import { HistoryView } from "./HistoryView";
import { ProfileView } from "./ProfileView";
import { ScreenView } from "./ScreenView";
import { SettingsView } from "./SettingsView";
import { TailorView } from "./TailorView";

type Tab = "tune" | "profile" | "jobs" | "saved" | "screen" | "settings";

const TABS: { id: Tab; label: string }[] = [
  { id: "profile", label: "Profile" },
  { id: "tune", label: "Tune" },
  { id: "jobs", label: "Jobs" },
  { id: "saved", label: "Tracker" },
  { id: "screen", label: "Screen" },
  { id: "settings", label: "Settings" },
];

const MODES: { id: Mode; label: string }[] = [
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
  { id: "auto", label: "Auto" },
];

export function App() {
  const [profile, setProfile, profileReady] = useProfile();
  const [jobs, setJobs] = useJobs();
  const [settings, setSettings] = useSettings();
  const [mode, setMode] = useMode();
  // the profile comes first: upload it, then tune and search jobs from it
  const [tab, setTab] = useState<Tab>("profile");
  const [openJob, setOpenJob] = useState<SavedJob | null>(null);

  const [notice, setNotice] = useState<string | null>(null);

  // a job shared in from another app or the extension opens on Tune; "Save to tracker" files it instead
  useEffect(() => {
    if (!profileReady) return;
    try {
      const raw = localStorage.getItem(INCOMING_KEY);
      if (!raw) return;
      const inc = JSON.parse(raw) as { text?: string; url?: string; title?: string; company?: string; source?: string; action?: string };
      if (inc.action === "save" && inc.text) {
        localStorage.removeItem(INCOMING_KEY);
        const now = Date.now();
        const job: SavedJob = {
          id: newId("job"),
          title: inc.title || "Untitled role",
          company: inc.company || undefined,
          url: inc.url,
          jd: inc.text,
          createdAt: now,
          updatedAt: now,
          confirmedSkills: [],
          suggestions: [],
          score: matchScore(profile, inc.text).score,
          status: "saved",
        };
        setJobs((prev) => (prev.some((j) => j.url && j.url === job.url) ? prev : [job, ...prev]));
        setNotice(`Saved “${job.title}”${inc.source ? ` from ${inc.source}` : ""} to your tracker.`);
        setTab("saved");
      } else setTab("tune");
    } catch {
      // storage blocked
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileReady]);

  const needsProfile = profileReady && isProfileEmpty(profile);

  return (
    <div className="flex min-h-dvh flex-col pb-20 sm:pb-0">
      <a className="skip" href="#main">
        Skip to content
      </a>

      <header className="border-b-2 border-ink">
        <div className="mx-auto flex h-16 w-full max-w-[1440px] items-center justify-between gap-4 px-4 sm:px-6">
          <a href="/cvtuner" className="flex min-w-0 items-center gap-2.5" aria-label="CVTuner home">
            <img src="/cvtuner/icon.svg" alt="" width={28} height={28} />
            <span className="font-display text-lg leading-none font-bold tracking-tight">CVTuner</span>
            <span className="text-muted hidden text-xs sm:inline">by TechSwitch</span>
          </a>

          <nav className="hidden sm:block" aria-label="Main">
            <div className="cells">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  aria-current={tab === t.id ? "page" : undefined}
                  className="cell"
                >
                  {t.label}
                  {t.id === "saved" && jobs.length ? <span className="code ml-1.5 opacity-70">{jobs.length}</span> : null}
                </button>
              ))}
            </div>
          </nav>

          <div role="radiogroup" aria-label="Colour mode" className="cells">
            {MODES.map((m) => (
              <button key={m.id} type="button" role="radio" aria-checked={mode === m.id} onClick={() => setMode(m.id)} className="cell">
                {m.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {needsProfile && tab === "tune" ? (
        <div className="bg-paper-2 border-b border-rule">
          <div className="mx-auto flex w-full max-w-[1440px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <p className="text-sm">
              <strong className="font-medium">Start with your resume.</strong> Upload a PDF or Word file, or load the sample to try CVTuner.
            </p>
            <button type="button" className="btn" onClick={() => setTab("profile")}>
              Add resume
            </button>
          </div>
        </div>
      ) : null}

      {notice ? (
        <div className="bg-accent-soft border-b border-rule" role="status">
          <div className="mx-auto flex w-full max-w-[1440px] items-center justify-between gap-3 px-4 py-2 text-sm sm:px-6">
            <span>{notice}</span>
            <button type="button" className="btn btn--quiet" onClick={() => setNotice(null)}>
              Dismiss
            </button>
          </div>
        </div>
      ) : null}

      <main id="main" className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 sm:px-6 sm:py-8">
        {tab === "tune" && (
          <TailorView
            profile={profile}
            settings={settings}
            setSettings={setSettings}
            openJob={openJob}
            onOpenSettings={() => setTab("settings")}
            onSave={(job) => {
              setJobs((prev) => [job, ...prev.filter((j) => j.id !== job.id)]);
              setOpenJob(job);
            }}
          />
        )}
        {/* kept mounted so an unsaved draft survives switching tabs */}
        <div hidden={tab !== "profile"}>
          <ProfileView profile={profile} setProfile={setProfile} onNext={(next) => setTab(next)} />
        </div>
        {tab === "saved" && (
          <HistoryView
            jobs={jobs}
            onOpen={(j) => {
              setOpenJob(j);
              setTab("tune");
            }}
            onDelete={(id) => setJobs((prev) => prev.filter((j) => j.id !== id))}
            onUpdate={(job) => setJobs((prev) => prev.map((j) => (j.id === job.id ? job : j)))}
          />
        )}
        {tab === "jobs" && (
          <div className="flex flex-col gap-8">
            <ExtensionCard />
            <JobSearch
              profile={profile}
              settings={settings}
              onOpenSettings={() => setTab("settings")}
              onTune={() => {
                setOpenJob(null);
                setTab("tune");
              }}
            />
            <BoardsView
              profile={profile}
              onTune={() => {
                setOpenJob(null);
                setTab("tune");
              }}
            />
          </div>
        )}
        {tab === "settings" && <SettingsView settings={settings} setSettings={setSettings} />}
        {/* kept mounted so uploaded candidates survive tab switches */}
        <div hidden={tab !== "screen"}>
          <ScreenView />
        </div>
      </main>

      {/* bottom tab bar on phones */}
      <nav
        className="bg-plate fixed inset-x-0 bottom-0 z-[200] grid grid-cols-6 border-t-2 border-ink pb-[env(safe-area-inset-bottom)] sm:hidden"
        aria-label="Main"
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`min-h-11 border-l border-rule py-3 text-xs font-medium first:border-l-0 ${
              tab === t.id ? "bg-ink text-paper" : "text-muted"
            }`}
            aria-current={tab === t.id ? "page" : undefined}
          >
            {t.label}
            {t.id === "saved" && jobs.length ? <span className="code ml-1.5 opacity-70">{jobs.length}</span> : null}
          </button>
        ))}
      </nav>
    </div>
  );
}
