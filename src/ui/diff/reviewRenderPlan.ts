import type { AgentAnnotation } from "../../core/types";
import { annotationAnchor, type VisibleAgentNote } from "../lib/agentAnnotations";
import { diffHunkId } from "../lib/ids";
import type { DiffRow } from "./pierre";

const EMPTY_VISIBLE_AGENT_NOTES: VisibleAgentNote[] = [];

type DiffLineRow = Extract<DiffRow, { type: "split-line" | "stack-line" }>;

interface PrimaryVisibleInlineNote {
  anchorKey: string;
  anchorSide?: "old" | "new";
  guidedRowKeys: Set<string>;
  endGuideAfterKey?: string;
  note: VisibleAgentNote;
  noteCount: number;
  noteIndex: number;
}

export type PlannedReviewRow =
  | {
      kind: "diff-row";
      key: string;
      fileId: string;
      hunkIndex: number;
      row: DiffRow;
      anchorId?: string;
      noteGuideSide?: "old" | "new";
    }
  | {
      kind: "inline-note";
      key: string;
      fileId: string;
      hunkIndex: number;
      annotationId: string;
      annotation: AgentAnnotation;
      anchorSide?: "old" | "new";
      noteCount: number;
      noteIndex: number;
    }
  | {
      kind: "note-guide-cap";
      key: string;
      fileId: string;
      hunkIndex: number;
      side: "old" | "new";
    };

function hunkRows(rows: DiffRow[], hunkIndex: number) {
  return rows.filter((row) => row.hunkIndex === hunkIndex);
}

function hunkLineRows(rows: DiffRow[], hunkIndex: number) {
  return hunkRows(rows, hunkIndex).filter(
    (row): row is DiffLineRow => row.type === "split-line" || row.type === "stack-line",
  );
}

/** Check whether a rendered diff row visually covers the note anchor line. */
function rowMatchesNote(row: DiffLineRow, annotation: AgentAnnotation) {
  const anchor = annotationAnchor(annotation);
  if (!anchor) {
    return false;
  }

  if (row.type === "split-line") {
    return anchor.side === "new"
      ? row.right.lineNumber === anchor.lineNumber
      : row.left.lineNumber === anchor.lineNumber;
  }

  return anchor.side === "new"
    ? row.cell.newLineNumber === anchor.lineNumber
    : row.cell.oldLineNumber === anchor.lineNumber;
}

/** Check whether one rendered diff row falls inside the annotation range on either side. */
function rowOverlapsAnnotation(row: DiffLineRow, annotation: AgentAnnotation) {
  const matchesOld =
    annotation.oldRange &&
    (row.type === "split-line"
      ? row.left.lineNumber !== undefined &&
        row.left.lineNumber >= annotation.oldRange[0] &&
        row.left.lineNumber <= annotation.oldRange[1]
      : row.cell.oldLineNumber !== undefined &&
        row.cell.oldLineNumber >= annotation.oldRange[0] &&
        row.cell.oldLineNumber <= annotation.oldRange[1]);

  if (matchesOld) {
    return true;
  }

  return Boolean(
    annotation.newRange &&
    (row.type === "split-line"
      ? row.right.lineNumber !== undefined &&
        row.right.lineNumber >= annotation.newRange[0] &&
        row.right.lineNumber <= annotation.newRange[1]
      : row.cell.newLineNumber !== undefined &&
        row.cell.newLineNumber >= annotation.newRange[0] &&
        row.cell.newLineNumber <= annotation.newRange[1]),
  );
}

/**
 * Resolve the rendered diff row before which the inline note should appear.
 * Range-less notes intentionally anchor beside the first code row in the hunk,
 * not above the hunk header metadata.
 */
function findInlineNoteAnchorRow(
  rows: DiffRow[],
  annotation: AgentAnnotation,
  selectedHunkIndex: number,
) {
  const selectedHunkRows = hunkRows(rows, selectedHunkIndex);
  const lineRows = hunkLineRows(rows, selectedHunkIndex);
  const headerRow = selectedHunkRows.find((row) => row.type === "hunk-header");

  return lineRows.find((row) => rowMatchesNote(row, annotation)) ?? lineRows[0] ?? headerRow;
}

/**
 * The render plan shows at most one inline note at a time.
 * The first entry in visibleAgentNotes is the primary visible note, while
 * noteIndex/noteCount preserve its position within the current visible list.
 */
function selectPrimaryVisibleNote(visibleAgentNotes: VisibleAgentNote[]) {
  if (visibleAgentNotes.length === 0) {
    return null;
  }

  return {
    note: visibleAgentNotes[0]!,
    noteIndex: 0,
    noteCount: visibleAgentNotes.length,
  };
}

/** Return the primary visible note, plus the diff rows that should show its guide rail. */
function buildPrimaryVisibleInlineNote(
  rows: DiffRow[],
  visibleAgentNotes: VisibleAgentNote[],
  selectedHunkIndex: number,
) {
  if (selectedHunkIndex < 0) {
    return null;
  }

  const selectedNote = selectPrimaryVisibleNote(visibleAgentNotes);
  if (!selectedNote) {
    return null;
  }

  const anchorRow = findInlineNoteAnchorRow(rows, selectedNote.note.annotation, selectedHunkIndex);
  if (!anchorRow) {
    return null;
  }

  const selectedHunkLineRows = hunkLineRows(rows, selectedHunkIndex);
  const anchorSide = annotationAnchor(selectedNote.note.annotation)?.side;
  const coveredRows = selectedHunkLineRows.filter((row) =>
    rowOverlapsAnnotation(row, selectedNote.note.annotation),
  );
  const fallbackGuideRow =
    anchorSide && (anchorRow.type === "split-line" || anchorRow.type === "stack-line")
      ? anchorRow
      : undefined;
  const guideRows =
    coveredRows.length > 0 ? coveredRows : fallbackGuideRow ? [fallbackGuideRow] : [];

  return {
    anchorKey: anchorRow.key,
    anchorSide,
    guidedRowKeys: new Set(guideRows.map((row) => row.key)),
    endGuideAfterKey: guideRows.at(-1)?.key,
    note: selectedNote.note,
    noteIndex: selectedNote.noteIndex,
    noteCount: selectedNote.noteCount,
  } satisfies PrimaryVisibleInlineNote;
}

function rowCanAnchorHunk(row: DiffRow, showHunkHeaders: boolean) {
  if (showHunkHeaders) {
    return row.type === "hunk-header";
  }

  return row.type !== "collapsed" && row.type !== "hunk-header";
}

/**
 * Build the explicit presentational row plan for one file diff body.
 * The plan always preserves diff-row order and may insert one inline note plus
 * one trailing guide cap for the primary visible note.
 */
export function buildReviewRenderPlan({
  fileId,
  rows,
  selectedHunkIndex,
  showHunkHeaders,
  visibleAgentNotes = EMPTY_VISIBLE_AGENT_NOTES,
}: {
  fileId: string;
  rows: DiffRow[];
  selectedHunkIndex: number;
  showHunkHeaders: boolean;
  visibleAgentNotes?: VisibleAgentNote[];
}) {
  const primaryVisibleNote = buildPrimaryVisibleInlineNote(
    rows,
    visibleAgentNotes,
    selectedHunkIndex,
  );
  const plannedRows: PlannedReviewRow[] = [];
  const anchoredHunks = new Set<number>();

  for (const row of rows) {
    const shouldAnchorHunk =
      rowCanAnchorHunk(row, showHunkHeaders) && !anchoredHunks.has(row.hunkIndex);
    const anchorId = shouldAnchorHunk ? diffHunkId(fileId, row.hunkIndex) : undefined;

    if (shouldAnchorHunk) {
      anchoredHunks.add(row.hunkIndex);
    }

    if (primaryVisibleNote?.anchorKey === row.key) {
      plannedRows.push({
        kind: "inline-note",
        key: `inline-note:${primaryVisibleNote.note.id}:${row.key}`,
        fileId,
        hunkIndex: row.hunkIndex,
        annotationId: primaryVisibleNote.note.id,
        annotation: primaryVisibleNote.note.annotation,
        anchorSide: primaryVisibleNote.anchorSide,
        noteCount: primaryVisibleNote.noteCount,
        noteIndex: primaryVisibleNote.noteIndex,
      });
    }

    plannedRows.push({
      kind: "diff-row",
      key: `diff-row:${row.key}`,
      fileId: row.fileId,
      hunkIndex: row.hunkIndex,
      row,
      anchorId,
      noteGuideSide: primaryVisibleNote?.guidedRowKeys.has(row.key)
        ? primaryVisibleNote.anchorSide
        : undefined,
    });

    if (primaryVisibleNote?.anchorSide && primaryVisibleNote.endGuideAfterKey === row.key) {
      plannedRows.push({
        kind: "note-guide-cap",
        key: `note-guide-cap:${primaryVisibleNote.note.id}:${row.key}`,
        fileId,
        hunkIndex: row.hunkIndex,
        side: primaryVisibleNote.anchorSide,
      });
    }
  }

  return plannedRows;
}
