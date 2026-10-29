import { create } from "zustand";
import type { ViewMode } from "../types/domain";

interface SceneBus {
  fitNonce: number;
  resetNonce: number;
  panNonce: number;
  panX: number;
  panY: number;
  focusNonce: number;
  focusView: ViewMode | null;
  focusId: string | null;
  requestFit: () => void;
  requestReset: () => void;
  requestPan: (x: number, y: number) => void;
  requestFocus: (view: ViewMode, id: string) => void;
}

export const useSceneBus = create<SceneBus>((set) => ({
  fitNonce: 0,
  resetNonce: 0,
  panNonce: 0,
  panX: 0,
  panY: 0,
  focusNonce: 0,
  focusView: null,
  focusId: null,
  requestFit: () => set((state) => ({ fitNonce: state.fitNonce + 1 })),
  requestReset: () => set((state) => ({ resetNonce: state.resetNonce + 1 })),
  requestPan: (x, y) =>
    set((state) => ({
      panNonce: state.panNonce + 1,
      panX: x,
      panY: y,
    })),
  requestFocus: (view, id) =>
    set((state) => ({
      focusNonce: state.focusNonce + 1,
      focusView: view,
      focusId: id,
    })),
}));
