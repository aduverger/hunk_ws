import { afterEach, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const entrypoint = resolve(import.meta.dir, "../../packages/hunk/src/main.tsx");
const roots: string[] = [];

/** Create real independent repos and an isolated user config for CLI subprocesses. */
function createTestWorkspace() {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "hunk-workspace-cli-")));
  roots.push(root);
  const home = join(root, "home");
  mkdirSync(home);
  const env = {
    ...process.env,
    HOME: home,
    XDG_CONFIG_HOME: join(home, "config"),
    XDG_STATE_HOME: join(home, "state"),
    HUNK_DISABLE_UPDATE_NOTICE: "1",
    GIT_AUTHOR_NAME: "Workspace test",
    GIT_AUTHOR_EMAIL: "workspace@example.invalid",
    GIT_COMMITTER_NAME: "Workspace test",
    GIT_COMMITTER_EMAIL: "workspace@example.invalid",
    GIT_CONFIG_GLOBAL: process.platform === "win32" ? "NUL" : "/dev/null",
    GIT_CONFIG_NOSYSTEM: "1",
  };
  for (const name of ["api", "web"]) {
    const repo = join(root, name);
    mkdirSync(repo);
    const git = (...args: string[]) => {
      const result = Bun.spawnSync(["git", ...args], {
        cwd: repo,
        env,
        stdout: "pipe",
        stderr: "pipe",
      });
      if (result.exitCode !== 0) throw new Error(result.stderr.toString());
    };
    git("init", "-q", "-b", "main");
    git("config", "commit.gpgsign", "false");
    writeFileSync(join(repo, "file.txt"), `${name} before\n`);
    git("add", "--", "file.txt");
    git("commit", "-qm", `${name} initial`);
    git("update-ref", "refs/remotes/origin/main", "HEAD");
    writeFileSync(join(repo, "file.txt"), `${name} after\n`);
    git("commit", "-qam", `${name} changed`);
    writeFileSync(join(repo, "file.txt"), `${name} working tree\n`);
  }
  return { root, env };
}

/** Invoke the actual CLI parser and native loader with bounded, noninteractive output. */
function runTestHunk(cwd: string, env: NodeJS.ProcessEnv, ...args: string[]) {
  const result = Bun.spawnSync([process.execPath, "run", entrypoint, ...args, "--no-extensions"], {
    cwd,
    env,
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
    timeout: 10_000,
    killSignal: "SIGKILL",
  });
  return {
    code: result.exitCode,
    stdout: result.stdout.toString(),
    stderr: result.stderr.toString(),
  };
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

test.each([
  { args: ["diff"], expected: "api working tree" },
  { args: ["diff", "origin/main...HEAD"], expected: "api after" },
  { args: ["show", "HEAD"], expected: "api after" },
  { args: ["log", "--color", "never"], expected: "api changed" },
])("workspace CLI loads native $args", ({ args, expected }) => {
  const { root, env } = createTestWorkspace();
  const result = runTestHunk(root, env, ...args);
  expect(result.code).toBe(0);
  expect(result.stderr).toBe("");
  expect(result.stdout).toContain(expected);
  expect(result.stdout).not.toContain("web after");
  expect(result.stdout).not.toContain("web changed");
  expect(result.stdout).not.toContain("web working tree");
});

test("workspace startup does not load an unopened sibling's comparison", () => {
  const { root, env } = createTestWorkspace();
  const removed = Bun.spawnSync(["git", "update-ref", "-d", "refs/remotes/origin/main"], {
    cwd: join(root, "web"),
    env,
    stdout: "pipe",
    stderr: "pipe",
  });
  expect(removed.exitCode).toBe(0);

  const result = runTestHunk(root, env, "diff", "origin/main...HEAD");
  expect(result.code).toBe(0);
  expect(result.stderr).toBe("");
  expect(result.stdout).toContain("api after");
  expect(result.stdout).not.toContain("web after");
});

test("workspace CLI fails on a missing ref and supports a subsequent valid invocation", () => {
  const { root, env } = createTestWorkspace();
  const failed = runTestHunk(root, env, "diff", "missing-ref...HEAD");
  expect(failed.code).toBe(1);
  expect(failed.stderr).not.toBe("");
  expect(failed.stdout).not.toContain("\x1b[?1049h");
  const retry = runTestHunk(root, env, "diff", "origin/main...HEAD");
  expect(retry.code).toBe(0);
  expect(retry.stdout).toContain("api after");
});

test("launching inside a child preserves the native repository instead of selecting siblings", () => {
  const { root, env } = createTestWorkspace();
  const result = runTestHunk(join(root, "web"), env, "diff");
  expect(result.code).toBe(0);
  expect(result.stdout).toContain("web working tree");
  expect(result.stdout).not.toContain("api working tree");
});
