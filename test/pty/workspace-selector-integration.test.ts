import { afterEach, expect, setDefaultTimeout, test } from "bun:test";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
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

/** Run fixture Git commands without depending on the developer's identity or signing settings. */
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
  return result.stdout.toString();
}

/** Choose a repository with the native select dialog's keyboard interaction. */
async function selectTestRepository(
  session: Session,
  current: string,
  index: number,
  destination: string | RegExp,
) {
  await harness.clickAndWaitForText(session, `▾ ${current}`, "Repository", { timeout: 10_000 });
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
  "review info follows menu and remapped keys across refreshes and isolated repository switches",
  async () => {
    const root = createTestWorkspace();
    const home = harness.createIsolatedConfigHome();
    mkdirSync(join(home, "hunk"), { recursive: true });
    writeFileSync(
      join(home, "hunk", "config.toml"),
      '[keybindings]\n"hunk.view.toggleReviewInfo" = "I"\n',
    );
    mkdirSync(join(root, "b-web", ".hunk"));
    writeFileSync(join(root, "b-web", ".hunk", "config.toml"), "review_info = false\n");
    const session = await harness.launchHunk({
      args: ["diff", "origin/main...HEAD", "--sidebar", "--no-extensions"],
      cwd: root,
      cols: 140,
      rows: 30,
      env: { XDG_CONFIG_HOME: home },
    });
    try {
      await session.waitForText("api changed", { timeout: 15_000 });
      const menu = await harness.clickAndWaitForText(session, /View/, "Review info");
      expect(menu).toMatch(/\[x\]\s+Review info/);
      const hidden = await harness.clickAndWaitForSnapshot(
        session,
        "Review info",
        (text) =>
          !text.includes("Review info") &&
          !text.includes("api changed") &&
          text.includes("api after"),
      );
      expect(hidden).toContain("▾ a-api");
      expect(hidden).toMatch(/M\s+file\.ts/);
      await harness.pressAndWaitForText(session, ["shift", "i"], "api changed");
      await harness.pressAndWaitForSnapshot(
        session,
        ["shift", "i"],
        (text) => !text.includes("api changed") && text.includes("api after"),
      );

      writeFileSync(join(root, "a-api", "file.ts"), "export const value = 'api refreshed';\n");
      runTestGit(join(root, "a-api"), "commit", "-qam", "api refresh metadata");
      const refreshed = await harness.pressAndWaitForText(session, "r", "api refreshed");
      expect(refreshed).not.toContain("api refresh metadata");
      const web = await selectTestRepository(session, "a-api", 1, "web after");
      expect(web).not.toContain("web changed");
      await harness.pressAndWaitForText(session, ["shift", "i"], "web changed");
      const api = await selectTestRepository(session, "b-web", 0, "api refreshed");
      expect(api).not.toContain("api refresh metadata");
      const failed = await selectTestRepository(session, "a-api", 2, "Could not open");
      expect(failed).toContain("api refreshed");
      expect(failed).not.toContain("api refresh metadata");
      const restored = await selectTestRepository(session, "a-api", 1, "web changed");
      expect(restored).toContain("web after");
    } finally {
      session.close();
    }
  },
);

test.skipIf(process.platform === "win32")(
  "saves hidden commit metadata and restores it after reopening without hiding Files",
  async () => {
    const root = createTestWorkspace();
    const home = harness.createIsolatedConfigHome();
    const configPath = join(home, "hunk", "config.toml");
    mkdirSync(join(home, "hunk"), { recursive: true });
    writeFileSync(configPath, "# Personal defaults\n");
    const options = {
      args: ["show", "HEAD", "--sidebar", "--no-extensions"],
      cwd: join(root, "a-api"),
      cols: 140,
      rows: 30,
      env: { XDG_CONFIG_HOME: home },
    };
    let session = await harness.launchHunk(options);
    try {
      await session.waitForText("api changed", { timeout: 15_000 });
      await harness.clickAndWaitForText(session, /View/, "Review info");
      await harness.clickAndWaitForSnapshot(
        session,
        "Review info",
        (text) =>
          !text.includes("Review info") &&
          !text.includes("api changed") &&
          text.includes("api after"),
      );
      const prompt = await harness.pressAndWaitForText(session, "q", "Save view preferences?");
      expect(prompt).toContain("- review_info = true");
      expect(prompt).toContain("+ review_info = false");
      await harness.pressAndWaitForSnapshot(
        session,
        "escape",
        (text) => !text.includes("Save view preferences?") && !text.includes("api changed"),
      );
      expect(readFileSync(configPath, "utf8")).not.toContain("review_info");
      await harness.pressAndWaitForText(session, "q", "Save view preferences?");
      await session.press("enter");
      expect(await session.waitForExit(5_000)).toBe(true);
      expect(readFileSync(configPath, "utf8")).toContain("review_info = false");
      expect(readFileSync(configPath, "utf8")).toContain("# Personal defaults");
      session.close();

      session = await harness.launchHunk(options);
      const reopened = await session.waitForText("api after", { timeout: 15_000 });
      expect(reopened).not.toContain("api changed");
      expect(reopened).toMatch(/M\s+file\.ts/);
      const menu = await harness.clickAndWaitForText(session, /View/, "Review info");
      expect(menu).toMatch(/\[ \]\s+Review info/);
      await harness.clickAndWaitForText(session, "Review info", "api changed");
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
      await harness.clickAndWaitForText(session, /Navigate/, "Repository…");
      await harness.clickAndWaitForText(session, "Repository…", "1. a-api");
      await session.press("escape");
      await harness.pressAndWaitForText(session, ["shift", "r"], "Repository");
      await session.press("down");
      await harness.pressAndWaitForText(session, "enter", "web after");
      await harness.clickAndWaitForText(session, /View/, "Repository selector");
      const hidden = await harness.clickAndWaitForSnapshot(
        session,
        "Repository selector",
        (text) => !text.includes("▾ b-web") && !text.includes("Repository selector"),
      );
      expect(hidden).toMatch(/M\s+file\.ts/);
      await harness.clickAndWaitForText(session, /View/, "Repository selector");
      await harness.clickAndWaitForText(session, "Repository selector", "▾ b-web");
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
      await session.press("f10");
      await session.press("right");
      await harness.pressAndWaitForText(session, "right", "Choose repository…");
      await session.press("up");
      await harness.pressAndWaitForText(session, "enter", "1. a-api");
      await session.press("down");
      await harness.pressAndWaitForText(session, "enter", "web changed");
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
    const startupGate = join(root, "release-startup");
    const repoConfig = join(root, "b-web", ".hunk");
    mkdirSync(repoConfig);
    writeFileSync(
      join(repoConfig, "config.toml"),
      `[extension.slow-startup]\ngate = ${JSON.stringify(startupGate)}\n`,
    );
    writeFileSync(
      extension,
      `import { existsSync, writeFileSync } from "node:fs";
export default async function (hunk) {
  const gate = hunk.config.gate;
  if (typeof gate !== "string") return;
  writeFileSync(gate + ".started", "started");
  const deadline = Date.now() + 15_000;
  while (!existsSync(gate)) {
    if (Date.now() >= deadline) throw new Error("Test startup gate was not released.");
    await new Promise(resolve => setTimeout(resolve, 20));
  }
}
`,
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
      await harness.pressAndWaitForText(session, ["shift", "r"], "Repository");
      await session.press("down");
      session.sendKey("enter");
      const loading = await harness.waitForSnapshot(
        session,
        (text) => existsSync(`${startupGate}.started`) && text.includes("Loading repository"),
        10_000,
      );
      expect(loading).toContain("api after");
      await session.press(["shift", "r"]);
      expect(await session.text({ immediate: true })).not.toContain("Repository");
      writeFileSync(startupGate, "released");
      const web = await session.waitForText("web after", { timeout: 10_000 });
      expect(web).not.toContain("api after");
      expect(web).not.toContain("Repository");
    } finally {
      session.close();
    }
  },
);

test.skipIf(process.platform === "win32")(
  "retains a refreshed repository snapshot across switches until its next native refresh",
  async () => {
    const root = createTestWorkspace();
    const apiFile = join(root, "a-api", "file.ts");
    writeFileSync(apiFile, "export const value = 'api working';\n");
    writeFileSync(join(root, "b-web", "file.ts"), "export const value = 'web working';\n");
    const session = await harness.launchHunk({
      args: ["diff", "--sidebar", "--no-extensions", "--theme", "github-dark-default"],
      cwd: root,
      cols: 140,
      rows: 24,
    });
    try {
      await session.waitForText("api working", { timeout: 15_000 });
      writeFileSync(apiFile, "export const value = 'api refreshed';\n");
      await harness.pressAndWaitForText(session, "r", "api refreshed");
      await selectTestRepository(session, "a-api", 1, "web working");

      writeFileSync(apiFile, "export const value = 'api later on disk';\n");
      const cached = await selectTestRepository(session, "b-web", 0, "api refreshed");
      expect(cached).not.toContain("api later on disk");
      await harness.pressAndWaitForText(session, "r", "api later on disk");
      const web = await selectTestRepository(session, "a-api", 1, "web working");
      expect(web).not.toContain("api later on disk");
    } finally {
      session.close();
    }
  },
);

test.skipIf(process.platform === "win32")(
  "retains repository extension owners during switches and retires them when the window quits",
  async () => {
    const root = createTestWorkspace();
    const extension = join(root, "lifecycle.ts");
    const logPath = join(root, "lifecycle.jsonl");
    writeFileSync(
      extension,
      `import { appendFileSync } from "node:fs";
export default function (hunk) {
  let started = false;
  const record = (kind, cwd) => appendFileSync(${JSON.stringify(logPath)}, JSON.stringify({ kind, cwd }) + "\\n");
  hunk.on("startup", (_, ctx) => { started = true; record("startup", ctx.cwd); });
  hunk.on("shutdown", (_, ctx) => { if (started) record("shutdown", ctx.cwd); });
}
`,
    );
    /** Read lifecycle observations written by the fixture extension. */
    const readTestLifecycleEvents = (): Array<{ kind: string; cwd: string }> =>
      existsSync(logPath)
        ? readFileSync(logPath, "utf8")
            .trim()
            .split("\n")
            .filter(Boolean)
            .map((line) => JSON.parse(line))
        : [];
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
    });
    const repositories = [join(root, "a-api"), join(root, "b-web")].sort();
    try {
      await session.waitForText("api after", { timeout: 15_000 });
      await selectTestRepository(session, "a-api", 1, "web after");
      await harness.waitForSnapshot(
        session,
        () => readTestLifecycleEvents().filter((event) => event.kind === "startup").length === 2,
      );
      expect(readTestLifecycleEvents().filter((event) => event.kind === "shutdown")).toEqual([]);
      session.sendKey("q");

      const deadline = Date.now() + 5_000;
      while (
        readTestLifecycleEvents().filter((event) => event.kind === "shutdown").length < 2 &&
        Date.now() < deadline
      ) {
        await Bun.sleep(20);
      }
      expect(
        readTestLifecycleEvents()
          .filter((event) => event.kind === "shutdown")
          .map((event) => event.cwd)
          .sort(),
      ).toEqual(repositories);
    } finally {
      session.close();
    }
  },
);

test.skipIf(process.platform === "win32")(
  "retains history and selection after a sibling's first read fails and retries its repaired ref",
  async () => {
    const root = createTestWorkspace();
    runTestGit(join(root, "a-api"), "update-ref", "refs/remotes/origin/main", "HEAD");
    const session = await harness.launchHunk({
      args: ["log", "origin/main", "--no-extensions", "--theme", "github-dark-default"],
      cwd: root,
      cols: 140,
      rows: 24,
    });
    try {
      await session.waitForText("api changed", { timeout: 15_000 });
      await session.press("down");
      const failed = await selectTestRepository(session, "a-api", 2, "Could not open");
      expect(failed).toContain("origin/main");
      expect(failed).toContain("api changed");
      const selected = await harness.pressAndWaitForText(session, "enter", "api before", {
        timeout: 10_000,
      });
      expect(selected).not.toContain("api after");
      await harness.pressAndWaitForText(session, "q", "Git history");

      runTestGit(join(root, "c-broken"), "update-ref", "refs/remotes/origin/main", "HEAD");
      await selectTestRepository(session, "a-api", 2, "broken changed");
    } finally {
      session.close();
    }
  },
);

test.skipIf(process.platform === "win32")(
  "keeps the terminal mounted until pending repository startup is retired on quit",
  async () => {
    const root = createTestWorkspace();
    const extension = join(root, "quit-startup.ts");
    const gate = join(root, "release-quit-startup");
    const repoConfig = join(root, "b-web", ".hunk");
    mkdirSync(repoConfig);
    writeFileSync(
      join(repoConfig, "config.toml"),
      `[extension.quit-startup]\ngate = ${JSON.stringify(gate)}\n`,
    );
    writeFileSync(
      extension,
      `import { existsSync, writeFileSync } from "node:fs";
export default async function (hunk) {
  const gate = hunk.config.gate;
  if (typeof gate !== "string") return;
  hunk.on("shutdown", () => writeFileSync(gate + ".retired", "retired"));
  writeFileSync(gate + ".started", "started");
  const deadline = Date.now() + 15_000;
  while (!existsSync(gate)) {
    if (Date.now() >= deadline) throw new Error("Test quit gate was not released.");
    await new Promise(resolve => setTimeout(resolve, 20));
  }
}
`,
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
    });
    let terminalOutput = "";
    const unsubscribe = session.subscribe((chunk) => {
      terminalOutput += chunk;
    });
    const leaveAlternateScreen = /\x1b\[\?(?:47|1047|1049)l/;
    try {
      await session.waitForText("api after", { timeout: 15_000 });
      await harness.clickAndWaitForText(session, "▾ a-api", "Repository");
      await session.press("down");
      session.sendKey("enter");
      await harness.waitForSnapshot(
        session,
        (text) => existsSync(`${gate}.started`) && text.includes("Loading repository"),
      );
      terminalOutput = "";
      await session.press("q");
      expect(terminalOutput).not.toMatch(leaveAlternateScreen);
      expect(existsSync(`${gate}.retired`)).toBe(false);

      writeFileSync(gate, "released");
      expect(await session.waitForExit(5_000)).toBe(true);
      expect(existsSync(`${gate}.retired`)).toBe(true);
      expect(terminalOutput).toMatch(leaveAlternateScreen);
    } finally {
      writeFileSync(gate, "released");
      unsubscribe();
      session.close();
    }
  },
);

test.skipIf(process.platform === "win32")(
  "keeps history review preferences repository-specific while sharing the selected theme",
  async () => {
    const root = createTestWorkspace();
    for (const [name, mode, wrap] of [
      ["a-api", "split", true],
      ["b-web", "unified", false],
    ] as const) {
      const config = join(root, name, ".hunk");
      mkdirSync(config);
      writeFileSync(
        join(config, "config.toml"),
        `mode = "${mode}"\nwrap_lines = ${wrap}\nsidebar = true\n`,
      );
    }
    const session = await harness.launchHunk({
      args: ["log", "--no-extensions", "--theme", "github-dark-default"],
      cwd: root,
      cols: 220,
      rows: 28,
    });

    /** Read the review's public menu state without depending on diff-row geometry. */
    const expectTestPreferences = async (
      layout: "Split" | "Unified",
      wrap: boolean,
      showReviewInfo = true,
    ) => {
      const menu = await harness.clickAndWaitForText(session, /View/, "Line wrapping");
      expect(menu).toMatch(new RegExp(`\\[x\\]\\s+${layout} view`));
      expect(menu).toMatch(new RegExp(`\\[${wrap ? "x" : " "}\\]\\s+Line wrapping`));
      expect(menu).toMatch(new RegExp(`\\[${showReviewInfo ? "x" : " "}\\]\\s+Review info`));
      await harness.pressAndWaitForSnapshot(
        session,
        "escape",
        (text) => !text.includes("Line wrapping"),
      );
    };
    try {
      await session.waitForText("api changed", { timeout: 15_000 });
      await harness.pressAndWaitForText(session, "enter", "api after");
      await expectTestPreferences("Split", true);
      await harness.clickAndWaitForText(session, /View/, "Review info");
      await harness.clickAndWaitForSnapshot(
        session,
        "Review info",
        (text) =>
          !text.includes("Review info") &&
          !text.includes("api changed") &&
          text.includes("api after"),
      );
      await harness.pressAndWaitForText(session, "q", "Git history");

      await selectTestRepository(session, "a-api", 1, "web changed");
      await harness.pressAndWaitForText(session, "enter", "web after");
      await expectTestPreferences("Unified", false);
      await session.press("w");
      await harness.pressAndWaitForText(session, "t", "Theme selector");
      await session.click("github-light-default");
      await harness.waitForSnapshot(session, (text) => !text.includes("Theme selector"));
      await harness.pressAndWaitForText(session, "q", "Git history");

      await selectTestRepository(session, "b-web", 0, "api changed");
      await harness.pressAndWaitForText(session, "enter", "api after");
      await expectTestPreferences("Split", true, false);
      const themes = await harness.pressAndWaitForText(session, "t", "Theme selector");
      expect(themes).toMatch(/›\s+github-light-default/);
      await session.press("escape");
      await harness.pressAndWaitForText(session, "q", "Git history");

      await selectTestRepository(session, "a-api", 1, "web changed");
      await harness.pressAndWaitForText(session, "enter", "web after");
      await expectTestPreferences("Unified", true);
    } finally {
      session.close();
    }
  },
);

test.skipIf(process.platform === "win32")(
  "ignores revision and menu opens during a failed history switch and keeps the graph usable",
  async () => {
    const root = createTestWorkspace();
    const api = join(root, "a-api");
    runTestGit(api, "update-ref", "refs/remotes/origin/main", "HEAD");
    const revision = runTestGit(api, "rev-parse", "--short=8", "HEAD").trim();
    const extension = join(root, "history-open-gate.ts");
    const gate = join(root, "release-history-open");
    const config = join(root, "c-broken", ".hunk");
    mkdirSync(config);
    writeFileSync(
      join(config, "config.toml"),
      `[extension.history-open-gate]\ngate = ${JSON.stringify(gate)}\n`,
    );
    writeFileSync(
      extension,
      `import { existsSync, writeFileSync } from "node:fs";
export default async function (hunk) {
  const gate = hunk.config.gate;
  if (typeof gate !== "string") return;
  writeFileSync(gate + ".started", "started");
  const deadline = Date.now() + 15_000;
  while (!existsSync(gate)) {
    if (Date.now() >= deadline) throw new Error("Test history gate was not released.");
    await new Promise(resolve => setTimeout(resolve, 20));
  }
}
`,
    );
    const session = await harness.launchHunk({
      args: ["log", "origin/main", "--extension", extension, "--theme", "github-dark-default"],
      cwd: root,
      cols: 140,
      rows: 24,
    });
    try {
      await session.waitForText("api changed", { timeout: 15_000 });
      await harness.clickAndWaitForText(session, "▾ a-api", "Repository");
      await session.press("down");
      await session.press("down");
      session.sendKey("enter");
      await harness.waitForSnapshot(
        session,
        (text) => existsSync(`${gate}.started`) && text.includes("Loading repository"),
      );

      await session.click(revision);
      const graph = await session.text({ immediate: true });
      expect(graph).not.toContain("Preparing review");
      expect(graph).toContain("api changed");
      await harness.clickAndWaitForText(session, /File/, "Open selection");
      await harness.clickAndWaitForSnapshot(
        session,
        "Open selection",
        (text) => !text.includes("Open selection") && text.includes("api changed"),
      );

      writeFileSync(gate, "released");
      const failed = await session.waitForText("Could not open", { timeout: 10_000 });
      expect(failed).toContain("api changed");
      await harness.pressAndWaitForText(session, "enter", "api after", { timeout: 10_000 });
    } finally {
      writeFileSync(gate, "released");
      session.close();
    }
  },
);
