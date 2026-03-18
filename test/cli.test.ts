import { describe, expect, test } from "bun:test";
import { parseCli } from "../src/core/cli";

describe("parseCli", () => {
  test("defaults to git mode when no subcommand is passed", async () => {
    const parsed = await parseCli(["bun", "hunk"]);

    expect(parsed.kind).toBe("git");
    expect(parsed.options.mode).toBe("auto");
    expect(parsed.options.theme).toBeUndefined();
  });

  test("parses diff mode with shared options", async () => {
    const parsed = await parseCli([
      "bun",
      "hunk",
      "diff",
      "left.ts",
      "right.ts",
      "--mode",
      "split",
      "--theme",
      "paper",
      "--agent-context",
      "notes.json",
      "--pager",
    ]);

    expect(parsed).toMatchObject({
      kind: "diff",
      left: "left.ts",
      right: "right.ts",
      options: {
        mode: "split",
        theme: "paper",
        agentContext: "notes.json",
        pager: true,
      },
    });
  });

  test("parses git mode with range and staged flag", async () => {
    const parsed = await parseCli(["bun", "hunk", "git", "HEAD~1..HEAD", "--staged", "--theme", "ember"]);

    expect(parsed).toMatchObject({
      kind: "git",
      range: "HEAD~1..HEAD",
      staged: true,
      options: {
        mode: "auto",
        theme: "ember",
        pager: false,
      },
    });
  });

  test("parses patch mode from a file", async () => {
    const parsed = await parseCli(["bun", "hunk", "patch", "changes.patch", "--pager"]);

    expect(parsed).toMatchObject({
      kind: "patch",
      file: "changes.patch",
      options: {
        mode: "auto",
        pager: true,
      },
    });
  });

  test("parses difftool mode with display path", async () => {
    const parsed = await parseCli(["bun", "hunk", "difftool", "left.ts", "right.ts", "src/example.ts", "--mode", "stack"]);

    expect(parsed).toMatchObject({
      kind: "difftool",
      left: "left.ts",
      right: "right.ts",
      path: "src/example.ts",
      options: {
        mode: "stack",
        pager: false,
      },
    });
  });
});
