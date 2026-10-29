import { useCallback, useEffect, useMemo } from "react";
import type { CommitRecord } from "../types/domain";
import { getTimelineCommits, neighborsInTimeline } from "../features/history/graphLayout";
import { usePlaybackStore } from "../store/playbackStore";
import { usePreferencesStore } from "../store/preferencesStore";
import { useToastStore } from "../store/toastStore";

const SPEEDS = [0.5, 1, 2, 4] as const;

interface PlaybackOptions {
  commits: CommitRecord[];
  selectedSha: string | null;
  onSelect: (sha: string) => void;
}

export interface PlaybackControls {
  isPlaying: boolean;
  direction: 1 | -1;
  speed: number;
  speeds: readonly number[];
  toggle: () => void;
  pause: () => void;
  step: (amount: -1 | 1) => void;
  setDirection: (direction: 1 | -1) => void;
  setSpeed: (speed: number) => void;
  canGoOlder: boolean;
  canGoNewer: boolean;
}

export function usePlayback({
  commits,
  selectedSha,
  onSelect,
}: PlaybackOptions): PlaybackControls {
  const isPlaying = usePlaybackStore((state) => state.isPlaying);
  const direction = usePlaybackStore((state) => state.direction);
  const setPlaying = usePlaybackStore((state) => state.setPlaying);
  const setDirectionRaw = usePlaybackStore((state) => state.setDirection);
  const stop = usePlaybackStore((state) => state.stop);
  const speed = usePreferencesStore((state) => state.playbackSpeed);
  const setPlaybackSpeed = usePreferencesStore((state) => state.setPlaybackSpeed);

  const ascending = useMemo(() => getTimelineCommits(commits), [commits]);
  const selectedIndex = selectedSha
    ? ascending.findIndex((commit) => commit.sha === selectedSha)
    : -1;
  const canGoOlder = selectedIndex > 0;
  const canGoNewer = selectedIndex >= 0 && selectedIndex < ascending.length - 1;

  const step = useCallback(
    (amount: -1 | 1) => {
      const next = neighborsInTimeline(commits, selectedSha, amount);
      if (next) {
        stop();
        onSelect(next.sha);
      }
    },
    [commits, onSelect, selectedSha, stop],
  );

  const toggle = useCallback(() => {
    if (isPlaying) {
      stop();
      return;
    }
    if (ascending.length < 2) {
      useToastStore.getState().push({
        tone: "info",
        title: "Playback needs at least two commits",
        message: "Load more history or relax the current filters to travel further.",
      });
      return;
    }
    if (selectedIndex === -1) {
      const start = direction === 1 ? ascending[0] : ascending[ascending.length - 1];
      if (start) onSelect(start.sha);
    } else if (direction === 1 && selectedIndex === ascending.length - 1) {
      const start = ascending[0];
      if (start) onSelect(start.sha);
    } else if (direction === -1 && selectedIndex === 0) {
      const start = ascending[ascending.length - 1];
      if (start) onSelect(start.sha);
    }
    setPlaying(true);
  }, [ascending, direction, isPlaying, onSelect, selectedIndex, setPlaying, stop]);

  useEffect(() => {
    if (!isPlaying) return;
    if (ascending.length < 2) {
      setPlaying(false);
      return;
    }
    const index = selectedSha
      ? ascending.findIndex((commit) => commit.sha === selectedSha)
      : -1;
    if (index === -1) {
      setPlaying(false);
      return;
    }
    const next = ascending[index + direction];
    if (!next) {
      setPlaying(false);
      useToastStore.getState().push({
        tone: "info",
        title:
          direction === 1
            ? "Reached the newest loaded commit"
            : "Reached the oldest loaded commit",
        message:
          direction === 1
            ? "Load more history to continue traveling forward."
            : "Load more of the branch history to travel further back in time.",
      });
      return;
    }
    const timer = window.setTimeout(
      () => onSelect(next.sha),
      Math.round(1500 / speed),
    );
    return () => window.clearTimeout(timer);
  }, [ascending, direction, isPlaying, onSelect, selectedSha, setPlaying, speed]);

  const setDirection = useCallback(
    (nextDirection: 1 | -1) => {
      setDirectionRaw(nextDirection);
    },
    [setDirectionRaw],
  );

  const setSpeed = useCallback(
    (nextSpeed: number) => {
      if (SPEEDS.includes(nextSpeed as (typeof SPEEDS)[number])) {
        setPlaybackSpeed(nextSpeed);
      }
    },
    [setPlaybackSpeed],
  );

  return {
    isPlaying,
    direction,
    speed,
    speeds: SPEEDS,
    toggle,
    pause: stop,
    step,
    setDirection,
    setSpeed,
    canGoOlder,
    canGoNewer,
  };
}
