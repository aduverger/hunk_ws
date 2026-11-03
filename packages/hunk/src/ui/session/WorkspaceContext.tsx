import { createContext, useContext, useLayoutEffect } from "react";
import type { ExtensionDialogQueue } from "../lib/extensionDialogs";
import type { WorkspaceInitialization } from "../../core/session/initialization";
import { sanitizeTerminalLine } from "../../lib/terminalText";

export interface WorkspaceControls {
  repositories: WorkspaceInitialization["repositories"];
  selectedRepositoryPath: string;
  switching: boolean;
  error: string | null;
  selectorVisible: boolean;
  switchRepository(path: string): Promise<void>;
  toggleSelector(): void;
  requestPicker(): void;
  registerPicker(open: () => void): () => void;
}

export const WorkspaceContext = createContext<WorkspaceControls | null>(null);

/** Use the mounted review's native dialog queue for repository selection. */
export function useWorkspaceRepositoryPicker(createDialogs: ExtensionDialogQueue["createDialogs"]) {
  const workspace = useContext(WorkspaceContext);
  const open = () => {
    if (!workspace || workspace.switching) return;
    const labels = workspace.repositories.map(
      (repo, index) => `${index + 1}. ${sanitizeTerminalLine(repo.name)}`,
    );
    void createDialogs("hunk", { showAttribution: false })
      .select({ title: "Repository", options: labels })
      .then(async (selected) => {
        const index = selected === null ? -1 : labels.indexOf(selected);
        const repo = workspace.repositories[index];
        if (repo) await workspace.switchRepository(repo.path);
      });
  };
  useLayoutEffect(() => workspace?.registerPicker(open));
  return { workspace, open };
}
