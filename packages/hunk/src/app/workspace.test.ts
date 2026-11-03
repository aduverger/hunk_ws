import { afterEach, describe, expect, test } from "bun:test";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CliInput, HistoryCommandInput } from "../core/run/commandInputs";
import { retireExtensionLoadResult } from "../extensions/events";
import { discoverWorkspace } from "./workspace";
import { prepareStartupPlan, type StartupPlan } from "./startup";
import { getBundledVcsCatalog } from "./vcsCatalog";

const roots: string[] = [];
const plans: StartupPlan[] = [];
const catalog = getBundledVcsCatalog();
const input: CliInput = { kind: "vcs", staged: false, options: { extensions: false } };
const historyInput: HistoryCommandInput = {
  kind: "history",
  color: "never",
  format: "compact",
  ascii: true,
  static: true,
  extensionsEnabled: false,
  extensionPaths: [],
};

/** Create an isolated workspace outside the source checkout. */
function createTestWorkspace() {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "hunk-workspace-")));
  roots.push(root);
  return root;
}

/** Invoke Git directly for real repository fixtures. */
function git(cwd: string, ...args: string[]) {
  const result = Bun.spawnSync(["git", ...args], {
    cwd,
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: "Workspace test",
      GIT_AUTHOR_EMAIL: "workspace@example.invalid",
      GIT_COMMITTER_NAME: "Workspace test",
      GIT_COMMITTER_EMAIL: "workspace@example.invalid",
      GIT_CONFIG_GLOBAL: process.platform === "win32" ? "NUL" : "/dev/null",
      GIT_CONFIG_NOSYSTEM: "1",
    },
  });
  if (result.exitCode !== 0) throw new Error(result.stderr.toString());
  return result.stdout.toString();
}

/** Create a committed checkout with a baseline ref and a distinct working-tree change. */
function createTestRepo(path: string, label: string) {
  mkdirSync(path, { recursive: true });
  git(path, "init", "-q", "-b", "main");
  git(path, "config", "commit.gpgsign", "false");
  writeFileSync(join(path, "file.txt"), `${label} before\n`);
  git(path, "add", "--", "file.txt");
  git(path, "commit", "-qm", label);
  git(path, "update-ref", "refs/remotes/origin/main", "HEAD");
  writeFileSync(join(path, "file.txt"), `${label} after\n`);
}

/** Exercise the real application bootstrap without opening a terminal or user config. */
async function prepareTestWorkspace(
  root: string,
  command: CliInput | HistoryCommandInput = input,
  interactive = false,
) {
  const home = join(root, "test-home");
  mkdirSync(home, { recursive: true });
  const plan = await prepareStartupPlan(["bun", "hunk", "diff"], {
    cwd: root,
    parseCliImpl: async () => command,
    stdinIsTTY: true,
    stdoutIsTTY: interactive,
    env: { HOME: home, XDG_CONFIG_HOME: join(home, "config"), XDG_STATE_HOME: join(home, "state") },
    terminalThemeMode: "dark",
  });
  plans.push(plan);
  return plan;
}

afterEach(async () => {
  for (const plan of plans.splice(0)) {
    if (plan.kind === "static-diff" || plan.kind === "app")
      await retireExtensionLoadResult(plan.bootstrap.extensions);
    if (plan.kind === "history-static" || plan.kind === "history-interactive") {
      await plan.bootstrap.close();
      await plan.bootstrap.extensionSession.shutdown();
    }
  }
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("workspace discovery", () => {
  test("sorts immediate child repositories, ignores other folders and does not recurse", () => {
    const root = createTestWorkspace();
    createTestRepo(join(root, "z-api"), "api");
    createTestRepo(join(root, "a-web"), "web");
    createTestRepo(join(root, "ordinary", "nested"), "nested");
    writeFileSync(join(root, "not-a-folder"), "plain file\n");
    const result = discoverWorkspace(root, input, catalog);
    expect(result).toEqual({
      root,
      input,
      repositories: [
        { name: "a-web", path: join(root, "a-web") },
        { name: "z-api", path: join(root, "z-api") },
      ],
    });
  });

  test("accepts one repo and Git worktrees", () => {
    const root = createTestWorkspace();
    const outside = createTestWorkspace();
    createTestRepo(join(outside, "source"), "worktree");
    git(join(outside, "source"), "worktree", "add", "--detach", join(root, "checkout"), "HEAD");
    expect(discoverWorkspace(root, input, catalog)?.repositories).toEqual([
      { name: "checkout", path: join(root, "checkout") },
    ]);
  });

  test.skipIf(process.platform === "win32")("does not follow directory symlinks", () => {
    const root = createTestWorkspace();
    const outside = createTestWorkspace();
    createTestRepo(join(outside, "private"), "private");
    symlinkSync(join(outside, "private"), join(root, "linked"), "dir");
    expect(discoverWorkspace(root, input, catalog)).toBeUndefined();
  });

  test("does not replace a normal repo, its subdirectory, or non-repository input", () => {
    const root = createTestWorkspace();
    createTestRepo(root, "outer");
    createTestRepo(join(root, "child"), "child");
    mkdirSync(join(root, "nested"));
    expect(discoverWorkspace(root, input, catalog)).toBeUndefined();
    expect(discoverWorkspace(join(root, "nested"), input, catalog)).toBeUndefined();
    expect(
      discoverWorkspace(root, { kind: "patch", text: "", options: {} }, catalog),
    ).toBeUndefined();
  });

  test("preserves an extension provider that recognizes the launch directory", () => {
    const root = createTestWorkspace();
    createTestRepo(join(root, "child"), "child");
    expect(
      discoverWorkspace(root, input, {
        ...catalog,
        adapters: [
          {
            id: "custom",
            name: "Custom",
            operations: {},
            detect: () => ({ id: "custom", repoRoot: root }),
          },
          ...catalog.adapters,
        ],
      }),
    ).toBeUndefined();
  });
});

describe("workspace invocation file identity", () => {
  test.each(["diff", "show", "log"])(
    "%s retains the explicit launch-directory extension",
    async (kind) => {
      const root = createTestWorkspace();
      const repo = join(root, "api");
      createTestRepo(repo, "api");
      const extensionPath = join(root, "review.ts");
      const childMarker = join(root, "child-extension-executed");
      const startupMarker = join(root, "extension-startup-directory");
      writeFileSync(
        extensionPath,
        `import { writeFileSync } from "node:fs";
    export default (hunk) => {
      hunk.on("startup", (_event, ctx) => writeFileSync(${JSON.stringify(startupMarker)}, ctx.cwd));
      hunk.transformChangeset((changeset) => ({ ...changeset, title: "Launch extension retained" }));
    };`,
      );
      writeFileSync(
        join(repo, "review.ts"),
        `import { writeFileSync } from "node:fs";
      export default () => writeFileSync(${JSON.stringify(childMarker)}, "unexpected");`,
      );

      let command: CliInput | HistoryCommandInput;
      if (kind === "log") {
        command = { ...historyInput, extensionsEnabled: true, extensionPaths: ["./review.ts"] };
      } else {
        const options = { extensions: true, extensionPaths: ["./review.ts"] };
        command = kind === "show" ? { kind: "show", ref: "HEAD", options } : { ...input, options };
      }
      const plan = await prepareTestWorkspace(root, command);
      expect(existsSync(childMarker)).toBe(false);
      if (plan.kind === "history-static") {
        expect(readFileSync(startupMarker, "utf8")).toBe(repo);
      } else if (plan.kind === "static-diff") {
        expect(plan.bootstrap.changeset.title).toBe("Launch extension retained");
      } else {
        throw new Error("Expected native static review or history");
      }
    },
  );

  test("loads a relative sidecar from the launch directory, not the selected checkout", async () => {
    const root = createTestWorkspace();
    const repo = join(root, "api");
    createTestRepo(repo, "api");
    const sidecar = (summary: string) =>
      JSON.stringify({
        files: [{ path: "file.txt", annotations: [{ summary, newRange: [1, 1] }] }],
      });
    writeFileSync(join(root, "notes.json"), sidecar("Launch note"));
    writeFileSync(join(repo, "notes.json"), sidecar("Checkout note"));
    const plan = await prepareTestWorkspace(root, {
      ...input,
      options: { ...input.options, agentContext: "./notes.json" },
    });
    if (plan.kind !== "static-diff") throw new Error("Expected static review");
    expect(
      plan.bootstrap.changeset.files
        .find((file) => file.path === "file.txt")
        ?.agent?.annotations?.map((note) => note.summary),
    ).toEqual(["Launch note"]);
  });

  test("keeps stdin sidecars and repository-relative Git pathspecs unchanged", () => {
    const root = createTestWorkspace();
    createTestRepo(join(root, "api"), "api");
    const workspace = discoverWorkspace(
      root,
      { ...input, pathspecs: ["src"], options: { agentContext: "-" } },
      catalog,
    );
    if (workspace?.input.kind !== "vcs") throw new Error("Expected workspace diff");
    expect(workspace.input.options.agentContext).toBe("-");
    expect(workspace.input.pathspecs).toEqual(["src"]);
  });
});

describe("native workspace launch", () => {
  test("uses the selected child's watch override and still rejects explicit noninteractive watch", async () => {
    const root = createTestWorkspace();
    const repo = join(root, "api");
    createTestRepo(repo, "api");
    const userConfig = join(root, "test-home", "config", "hunk");
    mkdirSync(userConfig, { recursive: true });
    writeFileSync(join(userConfig, "config.toml"), "watch = true\n");
    mkdirSync(join(repo, ".hunk"));
    writeFileSync(join(repo, ".hunk", "config.toml"), "watch = false\n");

    const plan = await prepareTestWorkspace(root);
    if (plan.kind !== "static-diff") throw new Error("Expected static review");
    expect(plan.bootstrap.input.options.watch).toBe(false);
    expect(plan.bootstrap.changeset.sourceLabel).toBe(repo);

    await expect(
      prepareTestWorkspace(root, {
        ...input,
        options: { ...input.options, watch: true },
      }),
    ).rejects.toThrow("`--watch` requires an interactive output terminal.");
  });

  test("loads only the first repo through native diff and retains workspace launch facts", async () => {
    const root = createTestWorkspace();
    createTestRepo(join(root, "b-api"), "api");
    createTestRepo(join(root, "a-web"), "web");
    const plan = await prepareTestWorkspace(root, input, true);
    expect(plan.kind).toBe("app");
    if (plan.kind !== "app") throw new Error("Expected interactive app");
    expect(plan.bootstrap.reloadContext.cwd).toBe(join(root, "a-web"));
    expect(plan.bootstrap.changeset.sourceLabel).toBe(join(root, "a-web"));
    expect(plan.bootstrap.changeset.files.map((file) => file.path)).toEqual(["file.txt"]);
    expect(plan.initialization.workspace?.repositories.map((repo) => repo.name)).toEqual([
      "a-web",
      "b-api",
    ]);
    expect(plan.initialization.workspace?.input).toMatchObject(input);
  });

  test("keeps revision comparisons and options intact", async () => {
    const root = createTestWorkspace();
    const repo = join(root, "api");
    createTestRepo(repo, "api");
    git(repo, "commit", "-qam", "second");
    const command: CliInput = {
      ...input,
      range: "origin/main...HEAD",
      options: { ...input.options, lineNumbers: false },
    };
    const plan = await prepareTestWorkspace(root, command);
    if (plan.kind !== "static-diff") throw new Error("Expected static review");
    expect(plan.bootstrap.input).toMatchObject(command);
    expect(plan.bootstrap.changeset.files.map((file) => file.path)).toEqual(["file.txt"]);
  });

  test("show uses native commit loading from the selected repository", async () => {
    const root = createTestWorkspace();
    createTestRepo(join(root, "api"), "api");
    const plan = await prepareTestWorkspace(root, {
      kind: "show",
      ref: "HEAD",
      options: { extensions: false },
    });
    if (plan.kind !== "static-diff") throw new Error("Expected static review");
    expect(plan.bootstrap.input.kind).toBe("show");
    expect(plan.bootstrap.changeset.sourceLabel).toBe(join(root, "api"));
    expect(plan.bootstrap.changeset.files.map((file) => file.path)).toEqual(["file.txt"]);
  });

  test("log retains native history and workspace identity", async () => {
    const root = createTestWorkspace();
    createTestRepo(join(root, "api"), "api history");
    const home = createTestWorkspace();
    const plan = await prepareStartupPlan(["bun", "hunk", "log"], {
      cwd: root,
      parseCliImpl: async () => historyInput,
      stdinIsTTY: true,
      stdoutIsTTY: false,
      env: { HOME: home, XDG_CONFIG_HOME: join(home, "config") },
    });
    plans.push(plan);
    if (plan.kind !== "history-static") throw new Error("Expected native history");
    expect(plan.bootstrap.repoRoot).toBe(join(root, "api"));
    expect(plan.bootstrap.initialization.workspace?.root).toBe(root);
    const page = await plan.bootstrap.source.read({ limit: 10 });
    expect(page.commits[0]?.subject).toBe("api history");
  });

  test("an invalid comparison fails instead of trying another repo", async () => {
    const root = createTestWorkspace();
    createTestRepo(join(root, "a-api"), "api");
    createTestRepo(join(root, "b-web"), "web");
    git(join(root, "b-web"), "update-ref", "refs/heads/only-in-web", "HEAD");
    await expect(
      prepareTestWorkspace(root, { ...input, range: "only-in-web...HEAD" }),
    ).rejects.toThrow();
    git(join(root, "a-api"), "update-ref", "refs/heads/only-in-web", "HEAD");
    const retry = await prepareTestWorkspace(root, { ...input, range: "only-in-web...HEAD" });
    expect(retry.kind).toBe("static-diff");
  });

  test("an empty workspace fails normally", async () => {
    const root = createTestWorkspace();
    mkdirSync(join(root, "ordinary"));
    await expect(prepareTestWorkspace(root)).rejects.toThrow();
  });
});
