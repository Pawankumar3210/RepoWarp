import type { Theme } from "../types/domain";
import type { FileCategory } from "../features/snapshots/codebaseLayout";

export interface SceneTheme {
  background: string;
  backgroundDeep: string;
  fog: string;
  gridMajor: string;
  gridMinor: string;
  text: string;
  muted: string;
  node: string;
  nodeDim: string;
  nodeSelected: string;
  merge: string;
  tag: string;
  boundary: string;
  edge: string;
  edgeDim: string;
  mergeEdge: string;
  platform: string;
  platformEdge: string;
  selection: string;
  hover: string;
  lanePalette: string[];
  fileCategories: Record<FileCategory, string>;
  additiveGlow: boolean;
}

export const SCENE_THEMES: Record<Theme, SceneTheme> = {
  dark: {
    background: "#060a13",
    backgroundDeep: "#03060c",
    fog: "#060a13",
    gridMajor: "#1c3450",
    gridMinor: "#101d2e",
    text: "#dbe9e3",
    muted: "#8ea3b2",
    node: "#66e7d3",
    nodeDim: "#263c4c",
    nodeSelected: "#e6fff9",
    merge: "#b694ff",
    tag: "#ffc978",
    boundary: "#61738f",
    edge: "#45d8c5",
    edgeDim: "#223343",
    mergeEdge: "#9f7cff",
    platform: "#0d1a2b",
    platformEdge: "#2a4a62",
    selection: "#b6fff2",
    hover: "#8ef4e3",
    lanePalette: [
      "#4de3d1",
      "#7aa2ff",
      "#c39bff",
      "#ffc978",
      "#ff8fab",
      "#64d8ff",
      "#9ee37d",
      "#ffb86b",
      "#b7a6ff",
      "#66e0b8",
      "#f28bd6",
      "#8ab4ff",
    ],
    fileCategories: {
      code: "#5ce6d2",
      style: "#ff8fb8",
      docs: "#ffc978",
      data: "#b699ff",
      config: "#8ca6c4",
      asset: "#6fd8ff",
      test: "#9ee37d",
      other: "#7f96b3",
    },
    additiveGlow: true,
  },
  light: {
    background: "#e6ece8",
    backgroundDeep: "#dce6e0",
    fog: "#e6ece8",
    gridMajor: "#8ba79d",
    gridMinor: "#b3c7bf",
    text: "#102320",
    muted: "#4f635e",
    node: "#0b6b62",
    nodeDim: "#93aba2",
    nodeSelected: "#063a34",
    merge: "#5b39b2",
    tag: "#8c5300",
    boundary: "#687d76",
    edge: "#0b6b62",
    edgeDim: "#aec3bb",
    mergeEdge: "#5b39b2",
    platform: "#d6e4dd",
    platformEdge: "#6e9187",
    selection: "#063a34",
    hover: "#0b6b62",
    lanePalette: [
      "#0b6b62",
      "#1d4b9e",
      "#5e35a2",
      "#8c4e00",
      "#9b1f45",
      "#075e75",
      "#356b12",
      "#874500",
      "#503b95",
      "#0a6d49",
      "#8f2477",
      "#2c558d",
    ],
    fileCategories: {
      code: "#0b6b62",
      style: "#95234f",
      docs: "#805200",
      data: "#5937a6",
      config: "#455d6a",
      asset: "#075d78",
      test: "#356b12",
      other: "#566b65",
    },
    additiveGlow: false,
  },
};

export const EXPORT_THEME = SCENE_THEMES;
