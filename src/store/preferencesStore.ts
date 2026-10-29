import { create } from "zustand";
import type {
  RecentRepository,
  RepositoryInfo,
  Theme,
  UserPreferences,
  ViewMode,
} from "../types/domain";
import {
  addRecentRepository,
  loadPreferences,
  loadRecentRepositories,
  removeRecentRepository,
  savePreferences,
  saveRecentRepositories,
  clearRecentRepositories,
} from "../services/storage/localPersistence";

const THEME_COLORS: Record<Theme, string> = {
  dark: "#060a13",
  light: "#e6ece8",
};

export function applyPreferencesToDocument(preferences: UserPreferences): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.dataset.theme = preferences.theme;
  root.classList.toggle("dark", preferences.theme === "dark");
  root.style.colorScheme = preferences.theme;
  root.dataset.reduceMotion =
    preferences.reduceMotion === "system" ? "system" : String(preferences.reduceMotion);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", THEME_COLORS[preferences.theme]);
}

interface PreferencesStore extends UserPreferences {
  recentRepositories: RecentRepository[];
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  setPlaybackSpeed: (speed: number) => void;
  setLastView: (view: ViewMode) => void;
  setReduceMotion: (value: UserPreferences["reduceMotion"]) => void;
  setShowSceneGrid: (value: boolean) => void;
  rememberRepository: (
    repository: RepositoryInfo,
    selectedCommitSha: string | null,
    view: ViewMode,
  ) => void;
  updateRecentContext: (
    owner: string,
    name: string,
    selectedCommitSha: string | null,
    view: ViewMode,
  ) => void;
  removeRecent: (owner: string, name: string) => void;
  clearRecents: () => void;
}

const initialPreferences = loadPreferences();
const initialRecents = loadRecentRepositories();

if (typeof document !== "undefined") {
  applyPreferencesToDocument(initialPreferences);
}

function persist(state: PreferencesStore): void {
  const snapshot: UserPreferences = {
    theme: state.theme,
    playbackSpeed: state.playbackSpeed,
    lastView: state.lastView,
    reduceMotion: state.reduceMotion,
    showSceneGrid: state.showSceneGrid,
  };
  try {
    if (localStorage.getItem("repowarp.preferences.v1") !== JSON.stringify(snapshot)) {
      savePreferences(snapshot);
    }
  } catch {
    savePreferences(snapshot);
  }
}

export const usePreferencesStore = create<PreferencesStore>((set, get) => ({
  ...initialPreferences,
  recentRepositories: initialRecents,

  setTheme(theme) {
    set((state) => {
      const next = { ...state, theme };
      persist(next);
      applyPreferencesToDocument(next);
      return { theme };
    });
  },

  toggleTheme() {
    const nextTheme = get().theme === "dark" ? "light" : "dark";
    get().setTheme(nextTheme);
  },

  setPlaybackSpeed(speed) {
    set((state) => {
      const next = { ...state, playbackSpeed: speed };
      persist(next);
      return { playbackSpeed: speed };
    });
  },

  setLastView(view) {
    set((state) => {
      const next = { ...state, lastView: view };
      persist(next);
      return { lastView: view };
    });
  },

  setReduceMotion(value) {
    set((state) => {
      const next = { ...state, reduceMotion: value };
      persist(next);
      applyPreferencesToDocument(next);
      return { reduceMotion: value };
    });
  },

  setShowSceneGrid(value) {
    set((state) => {
      const next = { ...state, showSceneGrid: value };
      persist(next);
      return { showSceneGrid: value };
    });
  },

  rememberRepository(repository, selectedCommitSha, view) {
    if (repository.source === "demo") return;
    const item: RecentRepository = {
      owner: repository.identity.owner,
      name: repository.identity.name,
      description: repository.description,
      language: repository.language,
      stars: repository.stars,
      defaultBranch: repository.defaultBranch,
      lastOpenedAt: Date.now(),
      lastCommitSha: selectedCommitSha,
      lastView: view,
    };
    const next = addRecentRepository(get().recentRepositories, item);
    saveRecentRepositories(next);
    set({ recentRepositories: next });
  },

  updateRecentContext(owner, name, selectedCommitSha, view) {
    const current = get().recentRepositories;
    const existing = current.find(
      (item) =>
        item.owner.toLowerCase() === owner.toLowerCase() &&
        item.name.toLowerCase() === name.toLowerCase(),
    );
    if (!existing) return;
    if (existing.lastCommitSha === selectedCommitSha && existing.lastView === view) return;
    const next = current.map((item) =>
      item === existing ? { ...item, lastCommitSha: selectedCommitSha, lastView: view } : item,
    );
    saveRecentRepositories(next);
    set({ recentRepositories: next });
  },

  removeRecent(owner, name) {
    const next = removeRecentRepository(get().recentRepositories, owner, name);
    saveRecentRepositories(next);
    set({ recentRepositories: next });
  },

  clearRecents() {
    clearRecentRepositories();
    set({ recentRepositories: [] });
  },
}));
