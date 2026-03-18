import type { DiffFile } from "../../core/types";

export interface HunkCursor {
  fileId: string;
  hunkIndex: number;
}

export function buildHunkCursors(files: DiffFile[]): HunkCursor[] {
  return files.flatMap((file) => file.metadata.hunks.map((_, hunkIndex) => ({ fileId: file.id, hunkIndex })));
}

export function findNextHunkCursor(
  cursors: HunkCursor[],
  currentFileId: string | undefined,
  currentHunkIndex: number,
  delta: number,
): HunkCursor | null {
  if (cursors.length === 0) {
    return null;
  }

  const currentIndex = cursors.findIndex((cursor) => cursor.fileId === currentFileId && cursor.hunkIndex === currentHunkIndex);
  const nextIndex =
    currentIndex >= 0
      ? Math.min(Math.max(currentIndex + delta, 0), cursors.length - 1)
      : delta >= 0
        ? 0
        : cursors.length - 1;

  return cursors[nextIndex] ?? null;
}
