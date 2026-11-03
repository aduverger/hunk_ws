import { useContext } from "react";
import type { ExtensionPaneTheme } from "../../../extension-api/types";
import { sanitizeTerminalLine } from "../../../lib/terminalText";
import { WorkspaceContext } from "../../session/WorkspaceContext";

/** Show the selected repository above the native Files tree. */
export function WorkspaceRepositorySelector({
  theme,
  showError = true,
}: {
  theme: ExtensionPaneTheme;
  showError?: boolean;
}) {
  const workspace = useContext(WorkspaceContext);
  if (!workspace || !workspace.selectorVisible) return null;
  const selected = workspace.repositories.find(
    (repo) => repo.path === workspace.selectedRepositoryPath,
  );
  return (
    <box style={{ width: "100%", flexDirection: "column", flexShrink: 0 }}>
      <box
        id="workspace-repository-selector"
        height={1}
        onMouseUp={() => workspace.requestPicker()}
      >
        <text fg={theme.accent}>
          {workspace.switching
            ? "Loading repository…"
            : `▾ ${sanitizeTerminalLine(selected?.name ?? "Repository")}`}
        </text>
      </box>
      {showError && workspace.error ? (
        <text fg={theme.muted}>{sanitizeTerminalLine(workspace.error)}</text>
      ) : null}
    </box>
  );
}
