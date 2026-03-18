import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadAppBootstrap } from "../src/core/loaders";

const tempDirs: string[] = [];

function cleanupTempDirs() {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
}

function git(cwd: string, ...cmd: string[]) {
  const proc = Bun.spawnSync(["git", ...cmd], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
    stdin: "ignore",
  });

  if (proc.exitCode !== 0) {
    const stderr = Buffer.from(proc.stderr).toString("utf8");
    throw new Error(stderr.trim() || `git ${cmd.join(" ")} failed`);
  }
}

afterEach(() => {
  cleanupTempDirs();
});

describe("loadAppBootstrap", () => {
  test("loads file-pair diffs and agent context", async () => {
    const dir = mkdtempSync(join(tmpdir(), "hunk-diff-"));
    tempDirs.push(dir);

    const left = join(dir, "before.ts");
    const right = join(dir, "after.ts");
    const agent = join(dir, "agent.json");

    writeFileSync(left, "export const answer = 41;\n");
    writeFileSync(right, "export const answer = 42;\nexport const bonus = true;\n");
    writeFileSync(
      agent,
      JSON.stringify({
        version: 1,
        summary: "Agent added the bonus export.",
        files: [
          {
            path: "after.ts",
            annotations: [{ newRange: [2, 2], summary: "Introduces the bonus flag." }],
          },
        ],
      }),
    );

    const bootstrap = await loadAppBootstrap({
      kind: "diff",
      left,
      right,
      options: {
        mode: "auto",
        agentContext: agent,
      },
    });

    expect(bootstrap.changeset.files).toHaveLength(1);
    expect(bootstrap.changeset.agentSummary).toBe("Agent added the bonus export.");
    expect(bootstrap.changeset.files[0]?.stats.additions).toBeGreaterThan(0);
    expect(bootstrap.changeset.files[0]?.agent?.annotations).toHaveLength(1);
  });

  test("loads git working tree changes from a temporary repo", async () => {
    const dir = mkdtempSync(join(tmpdir(), "hunk-git-"));
    tempDirs.push(dir);

    git(dir, "init");
    git(dir, "config", "user.name", "Test User");
    git(dir, "config", "user.email", "test@example.com");

    writeFileSync(join(dir, "example.ts"), "export const value = 1;\n");
    git(dir, "add", "example.ts");
    git(dir, "commit", "-m", "initial");

    writeFileSync(join(dir, "example.ts"), "export const value = 2;\nexport const extra = true;\n");

    const previousCwd = process.cwd();
    process.chdir(dir);

    try {
      const bootstrap = await loadAppBootstrap({
        kind: "git",
        staged: false,
        options: { mode: "auto" },
      });

      expect(bootstrap.changeset.files).toHaveLength(1);
      expect(bootstrap.changeset.files[0]?.path).toBe("example.ts");
      expect(bootstrap.changeset.files[0]?.stats.additions).toBeGreaterThan(0);
    } finally {
      process.chdir(previousCwd);
    }
  });
});
