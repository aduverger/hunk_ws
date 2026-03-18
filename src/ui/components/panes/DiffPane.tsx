import type { ScrollBoxRenderable } from "@opentui/core";
import type { RefObject } from "react";
import type { AgentAnnotation, DiffFile, LayoutMode } from "../../../core/types";
import type { VisibleAgentNote } from "../../lib/agentAnnotations";
import type { AppTheme } from "../../themes";
import { DiffSection } from "./DiffSection";

export function DiffPane({
  activeAnnotations,
  diffContentWidth,
  dismissedAgentNoteIds,
  files,
  headerLabelWidth,
  headerStatsWidth,
  layout,
  scrollRef,
  selectedFileId,
  selectedHunkIndex,
  separatorWidth,
  showAgentNotes,
  theme,
  width,
  onDismissAgentNote,
  onOpenAgentNotesAtHunk,
  onSelectFile,
}: {
  activeAnnotations: AgentAnnotation[];
  diffContentWidth: number;
  dismissedAgentNoteIds: string[];
  files: DiffFile[];
  headerLabelWidth: number;
  headerStatsWidth: number;
  layout: Exclude<LayoutMode, "auto">;
  scrollRef: RefObject<ScrollBoxRenderable | null>;
  selectedFileId?: string;
  selectedHunkIndex: number;
  separatorWidth: number;
  showAgentNotes: boolean;
  theme: AppTheme;
  width: number;
  onDismissAgentNote: (id: string) => void;
  onOpenAgentNotesAtHunk: (fileId: string, hunkIndex: number) => void;
  onSelectFile: (fileId: string) => void;
}) {
  const visibleAgentNotesByFile = new Map<string, VisibleAgentNote[]>();

  if (showAgentNotes && selectedFileId) {
    const visibleNotes = activeAnnotations
      .map((annotation, index) => ({
        id: `annotation:${selectedFileId}:${selectedHunkIndex}:${index}`,
        annotation,
      }))
      .filter((note) => !dismissedAgentNoteIds.includes(note.id));

    visibleAgentNotesByFile.set(selectedFileId, visibleNotes);
  }

  return (
    <box
      style={{
        width,
        border: ["top"],
        borderColor: theme.border,
        backgroundColor: theme.panel,
        padding: 1,
        flexDirection: "column",
      }}
    >
      {files.length > 0 ? (
        <scrollbox
          ref={scrollRef}
          width="100%"
          height="100%"
          scrollY={true}
          viewportCulling={true}
          focused={false}
          rootOptions={{ backgroundColor: theme.panel }}
          wrapperOptions={{ backgroundColor: theme.panel }}
          viewportOptions={{ backgroundColor: theme.panel }}
          contentOptions={{ backgroundColor: theme.panel }}
          verticalScrollbarOptions={{ visible: false }}
          horizontalScrollbarOptions={{ visible: false }}
        >
          <box style={{ width: "100%", flexDirection: "column" }}>
            {files.map((file, index) => (
              <DiffSection
                key={file.id}
                file={file}
                headerLabelWidth={headerLabelWidth}
                headerStatsWidth={headerStatsWidth}
                layout={layout}
                selected={file.id === selectedFileId}
                selectedHunkIndex={selectedHunkIndex}
                separatorWidth={separatorWidth}
                showSeparator={index > 0}
                theme={theme}
                viewWidth={diffContentWidth}
                visibleAgentNotes={visibleAgentNotesByFile.get(file.id) ?? []}
                onDismissAgentNote={onDismissAgentNote}
                onOpenAgentNotesAtHunk={(hunkIndex) => onOpenAgentNotesAtHunk(file.id, hunkIndex)}
                onSelect={() => onSelectFile(file.id)}
              />
            ))}
          </box>
        </scrollbox>
      ) : (
        <box style={{ flexGrow: 1, alignItems: "center", justifyContent: "center" }}>
          <text fg={theme.muted}>No files match the current filter.</text>
        </box>
      )}
    </box>
  );
}
