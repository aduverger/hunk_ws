import { describe, expect, test } from "bun:test";
import { resolveDaemonLaunchCommand } from "../src/mcp/daemonLauncher";

describe("MCP daemon launcher", () => {
  test("reuses the current script entrypoint when Hunk is running from source or a JS wrapper", () => {
    expect(resolveDaemonLaunchCommand(["bun", "src/main.tsx", "diff"], "/usr/bin/bun")).toEqual({
      command: "/usr/bin/bun",
      args: ["src/main.tsx", "mcp", "serve"],
    });

    expect(resolveDaemonLaunchCommand(["node", "/app/bin/hunk.cjs", "diff"], "/usr/bin/node")).toEqual({
      command: "/usr/bin/node",
      args: ["/app/bin/hunk.cjs", "mcp", "serve"],
    });
  });

  test("falls back to relaunching the current executable when no script entrypoint is present", () => {
    expect(resolveDaemonLaunchCommand(["/usr/local/bin/hunk", "diff"], "/usr/local/bin/hunk")).toEqual({
      command: "/usr/local/bin/hunk",
      args: ["mcp", "serve"],
    });
  });
});
