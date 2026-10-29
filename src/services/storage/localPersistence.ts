import type {
  RecentRepository,
  Theme,
  UserPreferences,
  ViewMode,
} from "../../types/domain";

export const PREFERENCES_KEY = "repowarp.preferences.v1";
export const RECENTS_KEY = "repowarp.recents.v1";
export const MAX_RECENT_REPOSITORIES = 8;

export const DEFAULT_PREFERENCES: UserPreferences = {
  theme: "dark",
  playbackSpeed: 1,
  lastView: "history",
  reduceMotion: "system",
  showSceneGrid: true,
};

function storageAvailable(): boolean {
  try {
    if (typeof window === "undefined" || !window.localStorage) return false;
    const probe = "__repowarp_probe__";
    window.localStorage.setItem(probe, "1");
    window.localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

function safeRead(key: string): unknown {
  if (!storageAvailable()) return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function safeWrite(key: string, value: unknown): boolean {
  if (!storageAvailable()) return false;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function safeRemove(key: string): void {
  if (!storageAvailable()) return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore storage failures (private mode, quota, etc.).
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sanitizeTheme(value: unknown): Theme {
  return value === "light" ? "light" : "dark";
}

function sanitizeView(value: unknown): ViewMode {
  return value === "codebase" ? "codebase" : "history";
}

export function normalizePreferences(value: unknown): UserPreferences {
  if (!isRecord(value)) return { ...DEFAULT_PREFERENCES };
  const speed = Number(value.playbackSpeed);
  return {
    theme: sanitizeTheme(value.theme),
    playbackSpeed: [0.5, 1, 2, 4].includes(speed) ? speed : 1,
    lastView: sanitizeView(value.lastView),
    reduceMotion:
      value.reduceMotion === true || value.reduceMotion === false
        ? value.reduceMotion
        : "system",
    showSceneGrid: value.showSceneGrid !== false,
  };
}

export function loadPreferences(): UserPreferences {
  return normalizePreferences(safeRead(PREFERENCES_KEY));
}

export function savePreferences(preferences: UserPreferences): void {
  safeWrite(PREFERENCES_KEY, preferences);
}

function sanitizeRecent(value: unknown): RecentRepository | null {
  if (!isRecord(value)) return null;
  const owner = typeof value.owner === "string" ? value.owner.slice(0, 100) : "";
  const name = typeof value.name === "string" ? value.name.slice(0, 100) : "";
  if (!owner || !name) return null;
  const stars = Number(value.stars);
  const lastOpenedAt = Number(value.lastOpenedAt);
  return {
    owner,
    name,
    description:
      typeof value.description === "string" ? value.description.slice(0, 240) : null,
    language:
      typeof value.language === "string" ? value.language.slice(0, 60) : null,
    stars: Number.isFinite(stars) && stars >= 0 ? stars : 0,
    defaultBranch:
      typeof value.defaultBranch === "string" && value.defaultBranch
        ? value.defaultBranch.slice(0, 255)
        : "main",
    lastOpenedAt:
      Number.isFinite(lastOpenedAt) && lastOpenedAt > 0 ? lastOpenedAt : Date.now(),
    lastCommitSha:
      typeof value.lastCommitSha === "string"
        ? value.lastCommitSha.slice(0, 64)
        : null,
    lastView: sanitizeView(value.lastView),
  };
}

export function loadRecentRepositories(): RecentRepository[] {
  const raw = safeRead(RECENTS_KEY);
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const result: RecentRepository[] = [];
  for (const item of raw) {
    const recent = sanitizeRecent(item);
    if (!recent) continue;
    const key = `${recent.owner}/${recent.name}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(recent);
    if (result.length >= MAX_RECENT_REPOSITORIES) break;
  }
  return result.sort((a, b) => b.lastOpenedAt - a.lastOpenedAt);
}

export function saveRecentRepositories(recents: RecentRepository[]): void {
  safeWrite(RECENTS_KEY, recents.slice(0, MAX_RECENT_REPOSITORIES));
}

export function addRecentRepository(
  recents: RecentRepository[],
  item: RecentRepository,
): RecentRepository[] {
  const key = `${item.owner}/${item.name}`.toLowerCase();
  const withoutExisting = recents.filter(
    (recent) => `${recent.owner}/${recent.name}`.toLowerCase() !== key,
  );
  return [item, ...withoutExisting]
    .sort((a, b) => b.lastOpenedAt - a.lastOpenedAt)
    .slice(0, MAX_RECENT_REPOSITORIES);
}

export function removeRecentRepository(
  recents: RecentRepository[],
  owner: string,
  name: string,
): RecentRepository[] {
  const key = `${owner}/${name}`.toLowerCase();
  return recents.filter(
    (recent) => `${recent.owner}/${recent.name}`.toLowerCase() !== key,
  );
}

export function clearRecentRepositories(): void {
  safeRemove(RECENTS_KEY);
}

export function clearPreferences(): void {
  safeRemove(PREFERENCES_KEY);
}
