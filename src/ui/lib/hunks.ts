import type { DiffFile } from "../../core/types";
import { getAnnotatedHunkIndices } from "./agentAnnotations";

export interface HunkCursor {
  fileId: string;
  hunkIndex: number;
}

/** Flatten the visible files into one review-stream hunk cursor list. */
export function buildHunkCursors(files: DiffFile[]): HunkCursor[] {
  return files.flatMap((file) =>
    file.metadata.hunks.map((_, hunkIndex) => ({ fileId: file.id, hunkIndex })),
  );
}

/** Flatten only the annotated hunks into a cursor list for comment navigation. */
export function buildAnnotatedHunkCursors(files: DiffFile[]): HunkCursor[] {
  return files.flatMap((file) => {
    const annotated = getAnnotatedHunkIndices(file);
    return file.metadata.hunks
      .map((_, hunkIndex) => ({ fileId: file.id, hunkIndex }))
      .filter((cursor) => annotated.has(cursor.hunkIndex));
  });
}

/** Move forward or backward through the review-stream hunk cursor list. */
export function findNextHunkCursor(
  cursors: HunkCursor[],
  currentFileId: string | undefined,
  currentHunkIndex: number,
  delta: number,
): HunkCursor | null {
  if (cursors.length === 0) {
    return null;
  }

  const currentIndex = cursors.findIndex(
    (cursor) => cursor.fileId === currentFileId && cursor.hunkIndex === currentHunkIndex,
  );
  const nextIndex =
    currentIndex >= 0
      ? Math.min(Math.max(currentIndex + delta, 0), cursors.length - 1)
      : delta >= 0
        ? 0
        : cursors.length - 1;

  return cursors[nextIndex] ?? null;
}
