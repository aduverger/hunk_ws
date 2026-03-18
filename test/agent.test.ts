import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { findAgentFileContext, loadAgentContext } from "../src/core/agent";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("agent context", () => {
  test("loads and matches annotations by current or previous path", async () => {
    const dir = mkdtempSync(join(tmpdir(), "hunk-agent-"));
    tempDirs.push(dir);

    const contextPath = join(dir, "agent.json");
    writeFileSync(
      contextPath,
      JSON.stringify({
        version: 1,
        summary: "Agent summary",
        files: [
          {
            path: "src/example.ts",
            summary: "Explains the file change",
            annotations: [{ newRange: [4, 8], summary: "Added a helper", confidence: "high" }],
          },
        ],
      }),
    );

    const context = await loadAgentContext(contextPath);

    expect(context?.summary).toBe("Agent summary");
    expect(findAgentFileContext(context, "src/example.ts")?.annotations).toHaveLength(1);
    expect(findAgentFileContext(context, "src/renamed.ts", "src/example.ts")?.summary).toBe(
      "Explains the file change",
    );
  });
});
