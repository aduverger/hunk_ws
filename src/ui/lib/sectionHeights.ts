import type { FileDiffMetadata } from "@pierre/diffs";
import type { DiffFile, LayoutMode } from "../../core/types";

/** Count hidden unchanged lines after the final visible hunk when Pierre omits them. */
function trailingCollapsedLines(metadata: FileDiffMetadata) {
  const lastHunk = metadata.hunks.at(-1);
  if (!lastHunk || metadata.isPartial) {
    return 0;
  }

  const additionRemaining = metadata.additionLines.length - (lastHunk.additionLineIndex + lastHunk.additionCount);
  const deletionRemaining = metadata.deletionLines.length - (lastHunk.deletionLineIndex + lastHunk.deletionCount);

  if (additionRemaining !== deletionRemaining) {
    return 0;
  }

  return Math.max(additionRemaining, 0);
}

/** Estimate the number of diff-body rows for one file when wrapping and note cards are off. */
export function estimateDiffBodyRows(
  file: DiffFile,
  layout: Exclude<LayoutMode, "auto">,
  showHunkHeaders: boolean,
) {
  if (file.metadata.hunks.length === 0) {
    return 1;
  }

  let rows = 0;

  for (const hunk of file.metadata.hunks) {
    if (hunk.collapsedBefore > 0) {
      rows += 1;
    }

    if (showHunkHeaders) {
      rows += 1;
    }

    for (const content of hunk.hunkContent) {
      if (content.type === "context") {
        rows += content.lines;
        continue;
      }

      rows += layout === "split" ? Math.max(content.deletions, content.additions) : content.deletions + content.additions;
    }
  }

  if (trailingCollapsedLines(file.metadata) > 0) {
    rows += 1;
  }

  return rows;
}
