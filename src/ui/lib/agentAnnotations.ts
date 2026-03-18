import type { Hunk } from "@pierre/diffs";
import type { AgentAnnotation, DiffFile } from "../../core/types";
import { fileLabel } from "./files";

export interface VisibleAgentNote {
  id: string;
  annotation: AgentAnnotation;
}

function overlap(rangeA: [number, number], rangeB: [number, number]) {
  return rangeA[0] <= rangeB[1] && rangeB[0] <= rangeA[1];
}

export function hunkLineRange(hunk: Hunk) {
  const newEnd = Math.max(hunk.additionStart, hunk.additionStart + Math.max(hunk.additionLines, 1) - 1);
  const oldEnd = Math.max(hunk.deletionStart, hunk.deletionStart + Math.max(hunk.deletionLines, 1) - 1);

  return {
    oldRange: [hunk.deletionStart, oldEnd] as [number, number],
    newRange: [hunk.additionStart, newEnd] as [number, number],
  };
}

export function annotationOverlapsHunk(annotation: AgentAnnotation, hunk: Hunk) {
  const hunkRange = hunkLineRange(hunk);

  if (annotation.newRange && overlap(annotation.newRange, hunkRange.newRange)) {
    return true;
  }

  if (annotation.oldRange && overlap(annotation.oldRange, hunkRange.oldRange)) {
    return true;
  }

  return false;
}

export function getSelectedAnnotations(file: DiffFile | undefined, hunk: Hunk | undefined) {
  if (!file?.agent || !hunk) {
    return [];
  }

  return file.agent.annotations.filter((annotation) => annotationOverlapsHunk(annotation, hunk));
}

export function getAnnotatedHunkIndices(file: DiffFile | undefined) {
  const annotated = new Set<number>();
  if (!file?.agent) {
    return annotated;
  }

  file.metadata.hunks.forEach((hunk, index) => {
    if (file.agent?.annotations.some((annotation) => annotationOverlapsHunk(annotation, hunk))) {
      annotated.add(index);
    }
  });

  return annotated;
}

function formatRange(range: [number, number]) {
  return range[0] === range[1] ? `${range[0]}` : `${range[0]}-${range[1]}`;
}

export function annotationLocationLabel(file: DiffFile, annotation: AgentAnnotation) {
  const locationParts: string[] = [];

  if (annotation.oldRange) {
    locationParts.push(`-${formatRange(annotation.oldRange)}`);
  }

  if (annotation.newRange) {
    locationParts.push(`+${formatRange(annotation.newRange)}`);
  }

  const location = locationParts.length > 0 ? ` ${locationParts.join(" ")}` : "";
  return `${fileLabel(file)}${location}`;
}
