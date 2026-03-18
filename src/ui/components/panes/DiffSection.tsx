import type { DiffFile, LayoutMode } from "../../../core/types";
import { PierreDiffView } from "../../diff/PierreDiffView";
import type { VisibleAgentNote } from "../../lib/agentAnnotations";
import { diffSectionId } from "../../lib/ids";
import { getAnnotatedHunkIndices } from "../../lib/agentAnnotations";
import { fileLabel } from "../../lib/files";
import { fitText } from "../../lib/text";
import type { AppTheme } from "../../themes";

export function DiffSection({
  file,
  headerLabelWidth,
  headerStatsWidth,
  layout,
  selected,
  selectedHunkIndex,
  separatorWidth,
  showSeparator,
  theme,
  visibleAgentNotes,
  viewWidth,
  onDismissAgentNote,
  onOpenAgentNotesAtHunk,
  onSelect,
}: {
  file: DiffFile;
  headerLabelWidth: number;
  headerStatsWidth: number;
  layout: Exclude<LayoutMode, "auto">;
  selected: boolean;
  selectedHunkIndex: number;
  separatorWidth: number;
  showSeparator: boolean;
  theme: AppTheme;
  visibleAgentNotes: VisibleAgentNote[];
  viewWidth: number;
  onDismissAgentNote: (id: string) => void;
  onOpenAgentNotesAtHunk: (hunkIndex: number) => void;
  onSelect: () => void;
}) {
  const additionsText = `+${file.stats.additions}`;
  const deletionsText = `-${file.stats.deletions}`;
  const annotatedHunkIndices = getAnnotatedHunkIndices(file);

  return (
    <box
      id={diffSectionId(file.id)}
      style={{
        width: "100%",
        flexDirection: "column",
        backgroundColor: theme.panel,
      }}
    >
      {showSeparator ? (
        <box
          style={{
            width: "100%",
            height: 1,
            paddingLeft: 1,
            paddingRight: 1,
            backgroundColor: theme.panel,
          }}
        >
          <text fg={theme.border}>{fitText("─".repeat(separatorWidth), separatorWidth)}</text>
        </box>
      ) : null}

      <box
        style={{
          width: "100%",
          height: 1,
          flexDirection: "row",
          justifyContent: "space-between",
          paddingLeft: 1,
          paddingRight: 1,
          backgroundColor: theme.panel,
        }}
        onMouseUp={onSelect}
      >
        <text fg={theme.text}>{fitText(fileLabel(file), headerLabelWidth)}</text>
        <box style={{ width: headerStatsWidth, height: 1, flexDirection: "row", justifyContent: "flex-end" }}>
          <text fg={theme.badgeAdded}>{additionsText}</text>
          <text fg={theme.muted}> </text>
          <text fg={theme.badgeRemoved}>{deletionsText}</text>
        </box>
      </box>

      <PierreDiffView
        file={file}
        layout={layout}
        theme={theme}
        width={viewWidth}
        annotatedHunkIndices={annotatedHunkIndices}
        visibleAgentNotes={visibleAgentNotes}
        onDismissAgentNote={onDismissAgentNote}
        onOpenAgentNotesAtHunk={onOpenAgentNotesAtHunk}
        selectedHunkIndex={selected ? selectedHunkIndex : -1}
        scrollable={false}
      />
    </box>
  );
}
