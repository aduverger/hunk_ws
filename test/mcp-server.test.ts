import { afterEach, describe, expect, test } from "bun:test";
import { createServer } from "node:net";
import { serveHunkMcpServer } from "../src/mcp/server";

const originalHost = process.env.HUNK_MCP_HOST;
const originalPort = process.env.HUNK_MCP_PORT;
const originalUnsafeRemote = process.env.HUNK_MCP_UNSAFE_ALLOW_REMOTE;

afterEach(() => {
  if (originalHost === undefined) {
    delete process.env.HUNK_MCP_HOST;
  } else {
    process.env.HUNK_MCP_HOST = originalHost;
  }

  if (originalPort === undefined) {
    delete process.env.HUNK_MCP_PORT;
  } else {
    process.env.HUNK_MCP_PORT = originalPort;
  }

  if (originalUnsafeRemote === undefined) {
    delete process.env.HUNK_MCP_UNSAFE_ALLOW_REMOTE;
  } else {
    process.env.HUNK_MCP_UNSAFE_ALLOW_REMOTE = originalUnsafeRemote;
  }
});

describe("Hunk MCP server", () => {
  test("refuses non-loopback binding unless explicitly allowed", () => {
    process.env.HUNK_MCP_HOST = "0.0.0.0";
    process.env.HUNK_MCP_PORT = "47657";
    delete process.env.HUNK_MCP_UNSAFE_ALLOW_REMOTE;

    expect(() => serveHunkMcpServer()).toThrow("local-only by default");
  });

  test("reports a clear error when the daemon port is already in use", async () => {
    const listener = createServer(() => undefined);
    await new Promise<void>((resolve, reject) => {
      listener.once("error", reject);
      listener.listen(0, "127.0.0.1", () => resolve());
    });

    const address = listener.address();
    const port = typeof address === "object" && address ? address.port : 0;
    process.env.HUNK_MCP_HOST = "127.0.0.1";
    process.env.HUNK_MCP_PORT = String(port);

    try {
      expect(() => serveHunkMcpServer()).toThrow("port is already in use");
    } finally {
      await new Promise<void>((resolve) => listener.close(() => resolve()));
    }
  });
});
