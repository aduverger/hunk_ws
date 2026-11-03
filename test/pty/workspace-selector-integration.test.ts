import { afterEach, expect, setDefaultTimeout, test } from "bun:test";
import {
  mkdirSync,
  mkdtempSync,
  realpathSync,
  renameSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Session } from "tuistory";
import { createPtyHarness } from "./harness";

const harness = createPtyHarness();
const roots: string[] = [];
setDefaultTimeout(45_000);

/** Build independent real checkouts with overlapping file paths and different review contents. */
function createTestWorkspace() {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "hunk-workspace-pty-")));
  roots.push(root);
  for (const [name, value] of [
    ["a-api", "api"],
    ["b-web", "web"],
    ["c-broken", "broken"],
  ] as const) {
    const repo = join(root, name);
    mkdirSync(repo);
    runTestGit(repo, "init", "-q", "-b", "main");
    writeFileSync(join(repo, "file.ts"), `export const value = '${value} before';\n`);
    runTestGit(repo, "add", "--", "file.ts");
    runTestGit(repo, "commit", "-qm", `${value} base`);
    if (value !== "broken") runTestGit(repo, "update-ref", "refs/remotes/origin/main", "HEAD");
    writeFileSync(join(repo, "file.ts"), `export const value = '${value} after';\n`);
    runTestGit(repo, "commit", "-qam", `${value} changed`);
  }
  return root;
}

/** Populate fixture history without depending on the developer's Git identity or signing settings. */
function runTestGit(cwd: string, ...args: string[]) {
  const result = Bun.spawnSync(["git", "-c", "commit.gpgsign=false", ...args], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
    stdin: "ignore",
    env: {
      ...process.env,
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_CONFIG_GLOBAL: join(cwd, ".unused-global-git-config"),
      GIT_AUTHOR_NAME: "Workspace",
      GIT_AUTHOR_EMAIL: "workspace@example.invalid",
      GIT_COMMITTER_NAME: "Workspace",
      GIT_COMMITTER_EMAIL: "workspace@example.invalid",
    },
  });
  if (result.exitCode !== 0) throw new Error(result.stderr.toString());
}

/** Choose a repository with the native select dialog's keyboard interaction. */
async function selectTestRepository(
  session: Session,
  current: string,
  index: number,
  destination: string | RegExp,
) {
  await harness.clickAndWaitForText(session, `▾ ${current}`, "1. a-api", { timeout: 10_000 });
  for (let step = 0; step < index; step++) await session.press("down");
  return harness.pressAndWaitForText(session, "enter", destination, { timeout: 10_000 });
}

/** Save a user-authored note through the real inline editor. */
async function saveTestNote(session: Session, text: string) {
  await harness.pressAndWaitForText(session, "c", "Draft note");
  await session.type(text);
  await harness.pressAndWaitForText(session, ["ctrl", "s"], "Your note");
}

afterEach(() => {
  harness.cleanup();
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

test.skipIf(process.platform === "win32")(
  "switches native reviews, isolates notes, and retries a failed repository",
  async () => {
    const root = createTestWorkspace();
    const session = await harness.launchHunk({
      args: [
        "diff",
        "origin/main...HEAD",
        "--no-extensions",
        "--sidebar",
        "--theme",
        "github-dark-default",
      ],
      cwd: root,
      cols: 140,
      rows: 30,
    });
    try {
      await session.waitForText("api after", { timeout: 15_000 });
      await saveTestNote(session, "API-specific review note");
      const web = await selectTestRepository(session, "a-api", 1, "web after");
      expect(web).not.toContain("API-specific review note");
      await saveTestNote(session, "Web-specific review note");
      const apiPath = join(root, "a-api");
      const heldApiPath = join(root, "held-api");
      renameSync(apiPath, heldApiPath);
      symlinkSync(join(root, "b-web"), apiPath, "dir");
      const redirected = await selectTestRepository(session, "b-web", 0, "Could not open");
      expect(redirected).toContain("web after");
      expect(redirected).toContain("Web-specific review note");
      unlinkSync(apiPath);
      renameSync(heldApiPath, apiPath);
      const api = await selectTestRepository(session, "b-web", 0, "api after");
      expect(api).toContain("API-specific review note");
      expect(api).not.toContain("Web-specific review note");
      const webAgain = await selectTestRepository(session, "a-api", 1, "web after");
      expect(webAgain).toContain("Web-specific review note");
      const failed = await selectTestRepository(session, "b-web", 2, "Could not open");
      expect(failed).toContain("broken:");
      expect(failed).toContain("web after");
      expect(failed).toContain("Web-specific review note");
      runTestGit(join(root, "c-broken"), "update-ref", "refs/remotes/origin/main", "HEAD~1");
      await selectTestRepository(session, "b-web", 2, "broken after");
    } finally {
      session.close();
    }
  },
);

test.skipIf(process.platform === "win32")(
  "repository commands are remappable and the selector can be hidden and restored",
  async () => {
    const root = createTestWorkspace();
    const home = harness.createIsolatedConfigHome();
    mkdirSync(join(home, "hunk"), { recursive: true });
    writeFileSync(
      join(home, "hunk", "config.toml"),
      `[keybindings]\n"hunk.view.selectRepository" = "R"\n"hunk.view.toggleRepositorySelector" = "W"\n`,
    );
    const session = await harness.launchHunk({
      args: [
        "diff",
        "origin/main...HEAD",
        "--no-extensions",
        "--sidebar",
        "--theme",
        "github-dark-default",
      ],
      cwd: root,
      cols: 140,
      rows: 24,
      env: { XDG_CONFIG_HOME: home },
    });
    try {
      await session.waitForText("▾ a-api", { timeout: 15_000 });
      await harness.pressAndWaitForSnapshot(
        session,
        ["shift", "w"],
        (text) => !text.includes("▾ a-api"),
      );
      await harness.pressAndWaitForText(session, ["shift", "w"], "▾ a-api");
      await harness.pressAndWaitForText(session, ["shift", "r"], "1. a-api");
      await session.press("down");
      await harness.pressAndWaitForText(session, "enter", "web after");
      await harness.clickAndWaitForText(session, /View/, "Repository selector");
    } finally {
      session.close();
    }
  },
);

test.skipIf(process.platform === "win32")(
  "switches history repositories and preserves each graph selection",
  async () => {
    const root = createTestWorkspace();
    const session = await harness.launchHunk({
      args: ["log", "--no-extensions", "--theme", "github-dark-default"],
      cwd: root,
      cols: 140,
      rows: 24,
    });
    try {
      await session.waitForText("api changed", { timeout: 15_000 });
      await session.press("down");
      await selectTestRepository(session, "a-api", 1, "web changed");
      await harness.pressAndWaitForText(session, "enter", "web after", { timeout: 10_000 });
      await harness.pressAndWaitForText(session, "q", "Git history");
      await selectTestRepository(session, "b-web", 0, "api changed");
      const rootReview = await harness.pressAndWaitForText(session, "enter", "api before", {
        timeout: 10_000,
      });
      expect(rootReview).not.toContain("api after");
      expect(rootReview).not.toContain("web after");
    } finally {
      session.close();
    }
  },
);

test.skipIf(process.platform === "win32")(
  "applies the original show revision when switching repositories",
  async () => {
    const root = createTestWorkspace();
    const session = await harness.launchHunk({
      args: ["show", "HEAD", "--sidebar", "--no-extensions", "--theme", "github-dark-default"],
      cwd: root,
      cols: 140,
      rows: 24,
    });
    try {
      await session.waitForText("api after", { timeout: 15_000 });
      const web = await selectTestRepository(session, "a-api", 1, "web after");
      expect(web).toContain("web changed");
      expect(web).not.toContain("api after");
    } finally {
      session.close();
    }
  },
);

test.skipIf(process.platform === "win32")(
  "ignores repeated picker requests while native repository startup is pending",
  async () => {
    const root = createTestWorkspace();
    const extension = join(root, "slow-startup.ts");
    writeFileSync(
      extension,
      "export default async function () { await new Promise(resolve => setTimeout(resolve, 500)); }\n",
    );
    const home = harness.createIsolatedConfigHome();
    mkdirSync(join(home, "hunk"), { recursive: true });
    writeFileSync(
      join(home, "hunk", "config.toml"),
      `[keybindings]\n"hunk.view.selectRepository" = "R"\n`,
    );
    const session = await harness.launchHunk({
      args: [
        "diff",
        "origin/main...HEAD",
        "--sidebar",
        "--extension",
        extension,
        "--theme",
        "github-dark-default",
      ],
      cwd: root,
      cols: 140,
      rows: 24,
      env: { XDG_CONFIG_HOME: home },
    });
    try {
      await session.waitForText("api after", { timeout: 15_000 });
      await harness.pressAndWaitForText(session, ["shift", "r"], "1. a-api");
      await session.press("down");
      const loading = await harness.pressAndWaitForText(session, "enter", "Loading repository");
      expect(loading).toContain("api after");
      await session.press(["shift", "r"]);
      const web = await session.waitForText("web after", { timeout: 10_000 });
      expect(web).not.toContain("api after");
      expect(web).not.toContain("1. a-api");
    } finally {
      session.close();
    }
  },
);
