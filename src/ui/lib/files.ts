import type { DiffFile } from "../../core/types";

export interface FileListEntry {
  id: string;
  label: string;
  description: string;
}

export function buildFileListEntry(file: DiffFile): FileListEntry {
  const prefix =
    file.metadata.type === "new"
      ? "A"
      : file.metadata.type === "deleted"
        ? "D"
        : file.metadata.type.startsWith("rename")
          ? "R"
          : "M";

  const pathLabel = file.previousPath && file.previousPath !== file.path ? `${file.previousPath} -> ${file.path}` : file.path;

  return {
    id: file.id,
    label: `${prefix} ${pathLabel}`,
    description: `+${file.stats.additions}  -${file.stats.deletions}${file.agent ? "  agent" : ""}`,
  };
}

export function fileLabel(file: DiffFile | undefined) {
  if (!file) {
    return "No file selected";
  }

  return file.previousPath && file.previousPath !== file.path ? `${file.previousPath} -> ${file.path}` : file.path;
}
