import type { ScrollBoxRenderable } from "@opentui/core";
import type { RefObject } from "react";
import type { DiffFile, LayoutMode } from "../../../core/types";
import type { AppTheme } from "../../themes";
import { DiffSection } from "./DiffSection";

export function DiffPane({
  diffContentWidth,
  files,
  headerLabelWidth,
  headerStatsWidth,
  layout,
  scrollRef,
  selectedFileId,
  selectedHunkIndex,
  separatorWidth,
  theme,
  width,
  onSelectFile,
}: {
  diffContentWidth: number;
  files: DiffFile[];
  headerLabelWidth: number;
  headerStatsWidth: number;
  layout: Exclude<LayoutMode, "auto">;
  scrollRef: RefObject<ScrollBoxRenderable | null>;
  selectedFileId?: string;
  selectedHunkIndex: number;
  separatorWidth: number;
  theme: AppTheme;
  width: number;
  onSelectFile: (fileId: string) => void;
}) {
  return (
    <box
      title="Diff"
      style={{
        width,
        border: ["top", "bottom"],
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
