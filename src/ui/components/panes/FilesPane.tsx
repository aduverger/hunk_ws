import type { ScrollBoxRenderable } from "@opentui/core";
import type { RefObject } from "react";
import type { FileListEntry } from "../../lib/files";
import type { AppTheme } from "../../themes";
import { FileListItem } from "./FileListItem";

export function FilesPane({
  entries,
  focused,
  scrollRef,
  selectedFileId,
  textWidth,
  theme,
  width,
  onSelectFile,
}: {
  entries: FileListEntry[];
  focused: boolean;
  scrollRef: RefObject<ScrollBoxRenderable | null>;
  selectedFileId?: string;
  textWidth: number;
  theme: AppTheme;
  width: number;
  onSelectFile: (fileId: string) => void;
}) {
  return (
    <box
      title="Files"
      style={{
        width,
        border: ["top", "bottom"],
        borderColor: theme.border,
        backgroundColor: theme.panel,
        padding: 1,
        flexDirection: "column",
      }}
    >
      <scrollbox
        ref={scrollRef}
        width="100%"
        height="100%"
        focused={focused}
        scrollY={true}
        viewportCulling={true}
        rootOptions={{ backgroundColor: theme.panel }}
        wrapperOptions={{ backgroundColor: theme.panel }}
        viewportOptions={{ backgroundColor: theme.panel }}
        contentOptions={{ backgroundColor: theme.panel }}
        verticalScrollbarOptions={{ visible: false }}
        horizontalScrollbarOptions={{ visible: false }}
      >
        <box style={{ width: "100%", flexDirection: "column" }}>
          {entries.map((entry) => (
            <FileListItem
              key={entry.id}
              entry={entry}
              selected={entry.id === selectedFileId}
              textWidth={textWidth}
              theme={theme}
              onSelect={() => onSelectFile(entry.id)}
            />
          ))}
        </box>
      </scrollbox>
    </box>
  );
}
