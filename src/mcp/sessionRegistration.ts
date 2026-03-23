import { randomUUID } from "node:crypto";
import type { AppBootstrap } from "../core/types";
import { hunkLineRange } from "../core/liveComments";
import type { HunkSessionRegistration, HunkSessionSnapshot, SessionFileSummary } from "./types";

function inferRepoRoot(bootstrap: AppBootstrap) {
  return bootstrap.input.kind === "git" ||
    bootstrap.input.kind === "show" ||
    bootstrap.input.kind === "stash-show"
    ? bootstrap.changeset.sourceLabel
    : undefined;
}

function buildSessionFiles(bootstrap: AppBootstrap): SessionFileSummary[] {
  return bootstrap.changeset.files.map((file) => ({
    id: file.id,
    path: file.path,
    previousPath: file.previousPath,
    additions: file.stats.additions,
    deletions: file.stats.deletions,
    hunkCount: file.metadata.hunks.length,
  }));
}

/** Build the daemon-facing metadata for one live Hunk TUI session. */
export function createSessionRegistration(bootstrap: AppBootstrap): HunkSessionRegistration {
  return {
    sessionId: randomUUID(),
    pid: process.pid,
    cwd: process.cwd(),
    repoRoot: inferRepoRoot(bootstrap),
    inputKind: bootstrap.input.kind,
    title: bootstrap.changeset.title,
    sourceLabel: bootstrap.changeset.sourceLabel,
    launchedAt: new Date().toISOString(),
    files: buildSessionFiles(bootstrap),
  };
}

/** Rebuild registration metadata after a live session reload while preserving session identity. */
export function updateSessionRegistration(
  current: HunkSessionRegistration,
  bootstrap: AppBootstrap,
): HunkSessionRegistration {
  return {
    ...current,
    repoRoot: inferRepoRoot(bootstrap),
    inputKind: bootstrap.input.kind,
    title: bootstrap.changeset.title,
    sourceLabel: bootstrap.changeset.sourceLabel,
    files: buildSessionFiles(bootstrap),
  };
}

/** Start with an empty-but-valid snapshot until the UI reports its first selection. */
export function createInitialSessionSnapshot(bootstrap: AppBootstrap): HunkSessionSnapshot {
  const firstFile = bootstrap.changeset.files[0];
  const firstHunk = firstFile?.metadata.hunks[0];
  const firstRange = firstHunk ? hunkLineRange(firstHunk) : null;

  return {
    selectedFileId: firstFile?.id,
    selectedFilePath: firstFile?.path,
    selectedHunkIndex: 0,
    selectedHunkOldRange: firstRange?.oldRange,
    selectedHunkNewRange: firstRange?.newRange,
    showAgentNotes: bootstrap.initialShowAgentNotes ?? false,
    liveCommentCount: 0,
    liveComments: [],
    updatedAt: new Date().toISOString(),
  };
}
