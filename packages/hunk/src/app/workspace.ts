import { readdirSync, realpathSync } from "node:fs";
import { join } from "node:path";
import type { ParsedCliInput } from "../core/run/commandInputs";
import type { WorkspaceInitialization } from "../core/session/initialization";
import { detectVcs, getVcsAdapter } from "../core/vcs";
import type { VcsCatalog } from "../core/vcs/types";

/** Discover direct child Git checkouts only after normal, extension-aware detection fails. */
export function discoverWorkspace(
  cwd: string,
  input: ParsedCliInput,
  catalog: VcsCatalog,
): WorkspaceInitialization | undefined {
  if (input.kind !== "vcs" && input.kind !== "show" && input.kind !== "history") return;
  if (detectVcs(cwd, catalog)) return;

  const root = realpathSync(cwd);
  const git = getVcsAdapter("git", catalog);
  const repositories = readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => {
      const path = join(root, entry.name);
      try {
        return git.detect(path)?.repoRoot === path ? [{ name: entry.name, path }] : [];
      } catch {
        return [];
      }
    })
    .sort((left, right) => (left.name < right.name ? -1 : left.name > right.name ? 1 : 0));

  return repositories.length ? { root, repositories, input } : undefined;
}
