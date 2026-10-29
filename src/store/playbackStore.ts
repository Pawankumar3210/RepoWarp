import { create } from "zustand";

interface PlaybackStore {
  isPlaying: boolean;
  direction: 1 | -1;
  setPlaying: (playing: boolean) => void;
  setDirection: (direction: 1 | -1) => void;
  toggle: () => void;
  stop: () => void;
}

export const usePlaybackStore = create<PlaybackStore>((set) => ({
  isPlaying: false,
  direction: 1,
  setPlaying: (isPlaying) => set({ isPlaying }),
  setDirection: (direction) => set({ direction }),
  toggle: () => set((state) => ({ isPlaying: !state.isPlaying })),
  stop: () => set({ isPlaying: false }),
}));
