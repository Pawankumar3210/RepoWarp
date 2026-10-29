import type { FileChangeStatus } from "../../types/domain";

export const CHANGE_LABEL: Record<FileChangeStatus, string> = {
  added: "Added",
  removed: "Removed",
  modified: "Modified",
  renamed: "Renamed",
  copied: "Copied",
  changed: "Changed",
  unchanged: "Unchanged",
};

export const CHANGE_COLOR: Record<FileChangeStatus, string> = {
  added: "text-teal",
  removed: "text-rose",
  modified: "text-amber",
  renamed: "text-violet",
  copied: "text-aqua",
  changed: "text-muted",
  unchanged: "text-faint",
};

export const CHANGE_DOT: Record<FileChangeStatus, string> = {
  added: "bg-teal",
  removed: "bg-rose",
  modified: "bg-amber",
  renamed: "bg-violet",
  copied: "bg-aqua",
  changed: "bg-muted",
  unchanged: "bg-faint",
};
