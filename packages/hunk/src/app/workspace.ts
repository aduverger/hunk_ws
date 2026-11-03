import { readdirSync, realpathSync } from "node:fs";
import { join, resolve } from "node:path";
import type { ParsedCliInput } from "../core/run/commandInputs";
import type { WorkspaceInitialization } from "../core/session/initialization";
import { detectVcs, getVcsAdapter } from "../core/vcs";
import type { VcsCatalog } from "../core/vcs/types";
import { expandHomePath } from "../extensions/discovery";

/** Discover child Git checkouts and bind explicit file arguments to the launch directory. */
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

  if (repositories.length === 0) return;

  const flagPaths = input.kind === "history" ? input.extensionPaths : input.options.extensionPaths;
  const extensionPaths = flagPaths?.map((path) => resolve(cwd, expandHomePath(path)));
  if (input.kind === "history") {
    return { root, repositories, input: { ...input, extensionPaths: extensionPaths ?? [] } };
  }

  const options = { ...input.options };
  if (extensionPaths) options.extensionPaths = extensionPaths;
  if (options.agentContext && options.agentContext !== "-") {
    options.agentContext = resolve(cwd, options.agentContext);
  }

  return { root, repositories, input: { ...input, options } };
}
