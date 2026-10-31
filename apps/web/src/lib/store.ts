"use client";

import { emptyResume, parseResume, type Resume, type Suggestion, type Voice } from "@cvtuner/core";
import { useCallback, useEffect, useState } from "react";

export interface Settings {
  voice: Voice;
  /** 2 = strict two pages; 3 = allow up to three when content needs it */
  maxPages: 2 | 3;
}

export interface SavedJob {
  id: string;
  title: string;
  company?: string;
  jd: string;
  createdAt: number;
  updatedAt: number;
  confirmedSkills: string[];
  suggestions: Suggestion[];
  score: number;
}

const KEYS = { profile: "cvtuner.profile.v1", jobs: "cvtuner.jobs.v1", settings: "cvtuner.settings.v1", draft: "cvtuner.draft.v1", mode: "cvtuner.mode.v1" };

export type Mode = "light" | "dark" | "auto";

/**
 * Colour mode. "auto" follows the OS by removing the attribute, so the
 * prefers-color-scheme block in tokens.css takes over. Stored as a raw string,
 * not JSON, because the inline script in layout.tsx reads it before first paint.
 */
export function useMode() {
  const [mode, setMode] = useState<Mode>("auto");
  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEYS.mode);
      if (saved === "light" || saved === "dark") setMode(saved);
    } catch {
      // blocked storage: stay on auto
    }
  }, []);
  const update = useCallback((next: Mode) => {
    setMode(next);
    const root = document.documentElement;
    if (next === "auto") delete root.dataset.mode;
    else root.dataset.mode = next;
    try {
      if (next === "auto") localStorage.removeItem(KEYS.mode);
      else localStorage.setItem(KEYS.mode, next);
    } catch {
      // the choice still holds for this session
    }
  }, []);
  return [mode, update] as const;
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage full or blocked (private mode) — the app still works for this session
  }
}

/** localStorage-backed state. Phase 1 keeps everything on the device; accounts come in Phase 2. */
function usePersisted<T>(key: string, fallback: T, revive?: (v: T) => T) {
  const [value, setValue] = useState<T>(fallback);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const v = read(key, fallback);
    setValue(revive ? revive(v) : v);
    setReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const update = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const v = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
        write(key, v);
        return v;
      });
    },
    [key],
  );
  return [value, update, ready] as const;
}

export const useProfile = () =>
  usePersisted<Resume>(KEYS.profile, emptyResume(), (v) => {
    try {
      return parseResume(v);
    } catch {
      return emptyResume();
    }
  });
export const useJobs = () => usePersisted<SavedJob[]>(KEYS.jobs, []);
export const useSettings = () => usePersisted<Settings>(KEYS.settings, { voice: "passive", maxPages: 2 });
export const useDraftJd = () => usePersisted<string>(KEYS.draft, "");

export function isProfileEmpty(r: Resume): boolean {
  return !r.basics.name && r.work.length === 0 && r.skills.every((s) => s.keywords.length === 0);
}
