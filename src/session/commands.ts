import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { resolve } from "node:path";
import type {
  SessionCommandInput,
  SessionCommandOutput,
  SessionCommentAddCommandInput,
  SessionGetCommandInput,
  SessionNavigateCommandInput,
  SessionSelectorInput,
} from "../core/types";
import { isHunkDaemonHealthy, isLoopbackPortReachable } from "../mcp/daemonLauncher";
import { resolveHunkMcpConfig } from "../mcp/config";
import type { AppliedCommentResult, ListedSession, NavigatedSelectionResult, SelectedSessionContext } from "../mcp/types";

interface HunkDaemonCliClient {
  connect(): Promise<void>;
  close(): Promise<void>;
  listSessions(): Promise<ListedSession[]>;
  getSession(selector: SessionSelectorInput): Promise<ListedSession>;
  getSelectedContext(selector: SessionSelectorInput): Promise<SelectedSessionContext>;
  navigateToHunk(input: SessionNavigateCommandInput): Promise<NavigatedSelectionResult>;
  addComment(input: SessionCommentAddCommandInput): Promise<AppliedCommentResult>;
}

function extractToolValue<ResultType>(
  result: Awaited<ReturnType<Client["callTool"]>>,
  key: string,
): ResultType | undefined {
  const structured = result.structuredContent as Record<string, ResultType> | undefined;
  if (structured && key in structured) {
    return structured[key];
  }

  const content = (result.content ?? []) as Array<{ type?: string; text?: string }>;
  const text = content.find((entry) => entry.type === "text")?.text;
  if (!text) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(text) as ResultType | Record<string, ResultType>;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && key in parsed) {
      return (parsed as Record<string, ResultType>)[key];
    }

    return parsed as ResultType;
  } catch {
    return undefined;
  }
}

class McpHunkDaemonCliClient implements HunkDaemonCliClient {
  private readonly transport = new StreamableHTTPClientTransport(new URL(`${resolveHunkMcpConfig().httpOrigin}/mcp`));
  private readonly client = new Client({ name: "hunk-session-cli", version: "1.0.0" });

  async connect() {
    await this.client.connect(this.transport);
  }

  async close() {
    await this.transport.close().catch(() => undefined);
  }

  async listSessions() {
    const result = await this.client.callTool({
      name: "list_sessions",
      arguments: {},
    });

    return extractToolValue<ListedSession[]>(result, "sessions") ?? [];
  }

  async getSession(selector: SessionSelectorInput) {
    const result = await this.client.callTool({
      name: "get_session",
      arguments: selector as Record<string, unknown>,
    });

    const session = extractToolValue<ListedSession>(result, "session");
    if (!session) {
      throw new Error("The Hunk daemon returned no session payload.");
    }

    return session;
  }

  async getSelectedContext(selector: SessionSelectorInput) {
    const result = await this.client.callTool({
      name: "get_selected_context",
      arguments: selector as Record<string, unknown>,
    });

    const context = extractToolValue<SelectedSessionContext>(result, "context");
    if (!context) {
      throw new Error("The Hunk daemon returned no selected-context payload.");
    }

    return context;
  }

  async navigateToHunk(input: SessionNavigateCommandInput) {
    const result = await this.client.callTool({
      name: "navigate_to_hunk",
      arguments: {
        ...input.selector,
        filePath: input.filePath,
        hunkIndex: input.hunkNumber !== undefined ? input.hunkNumber - 1 : undefined,
        side: input.side,
        line: input.line,
      },
    });

    const navigated = extractToolValue<NavigatedSelectionResult>(result, "result");
    if (!navigated) {
      throw new Error("The Hunk daemon returned no navigation result.");
    }

    return navigated;
  }

  async addComment(input: SessionCommentAddCommandInput) {
    const result = await this.client.callTool({
      name: "comment",
      arguments: {
        ...input.selector,
        filePath: input.filePath,
        side: input.side,
        line: input.line,
        summary: input.summary,
        rationale: input.rationale,
        author: input.author,
        reveal: input.reveal,
      },
    });

    const comment = extractToolValue<AppliedCommentResult>(result, "result");
    if (!comment) {
      throw new Error("The Hunk daemon returned no comment result.");
    }

    return comment;
  }
}

function stringifyJson(value: unknown) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function formatSelector(selector: SessionSelectorInput) {
  if (selector.sessionId) {
    return `session ${selector.sessionId}`;
  }

  if (selector.repoRoot) {
    return `repo ${selector.repoRoot}`;
  }

  return "session";
}

function formatSelectedSummary(session: ListedSession) {
  const filePath = session.snapshot.selectedFilePath ?? "(none)";
  const hunkNumber = session.snapshot.selectedFilePath ? session.snapshot.selectedHunkIndex + 1 : 0;
  return filePath === "(none)" ? filePath : `${filePath} hunk ${hunkNumber}`;
}

function formatListOutput(sessions: ListedSession[]) {
  if (sessions.length === 0) {
    return "No active Hunk sessions.\n";
  }

  return `${sessions
    .map((session) => [
      `${session.sessionId}  ${session.title}`,
      `  repo: ${session.repoRoot ?? session.cwd}`,
      `  focus: ${formatSelectedSummary(session)}`,
      `  files: ${session.fileCount}`,
      `  comments: ${session.snapshot.liveCommentCount}`,
    ].join("\n"))
    .join("\n\n")}\n`;
}

function formatSessionOutput(session: ListedSession) {
  return [
    `Session: ${session.sessionId}`,
    `Title: ${session.title}`,
    `Source: ${session.sourceLabel}`,
    `Repo: ${session.repoRoot ?? session.cwd}`,
    `Input: ${session.inputKind}`,
    `Launched: ${session.launchedAt}`,
    `Selected: ${formatSelectedSummary(session)}`,
    `Agent notes visible: ${session.snapshot.showAgentNotes ? "yes" : "no"}`,
    `Live comments: ${session.snapshot.liveCommentCount}`,
    "Files:",
    ...session.files.map((file) => `  - ${file.path} (+${file.additions} -${file.deletions}, hunks: ${file.hunkCount})`),
    "",
  ].join("\n");
}

function formatContextOutput(context: SelectedSessionContext) {
  const selectedFile = context.selectedFile?.path ?? "(none)";
  const hunkNumber = context.selectedHunk ? context.selectedHunk.index + 1 : 0;
  const oldRange = context.selectedHunk?.oldRange ? `${context.selectedHunk.oldRange[0]}..${context.selectedHunk.oldRange[1]}` : "-";
  const newRange = context.selectedHunk?.newRange ? `${context.selectedHunk.newRange[0]}..${context.selectedHunk.newRange[1]}` : "-";

  return [
    `Session: ${context.sessionId}`,
    `Title: ${context.title}`,
    `Repo: ${context.repoRoot ?? "-"}`,
    `File: ${selectedFile}`,
    `Hunk: ${context.selectedHunk ? hunkNumber : "-"}`,
    `Old range: ${oldRange}`,
    `New range: ${newRange}`,
    `Agent notes visible: ${context.showAgentNotes ? "yes" : "no"}`,
    `Live comments: ${context.liveCommentCount}`,
    "",
  ].join("\n");
}

function formatNavigationOutput(selector: SessionSelectorInput, result: NavigatedSelectionResult) {
  return `Focused ${result.filePath} hunk ${result.hunkIndex + 1} in ${formatSelector(selector)}.\n`;
}

function formatCommentOutput(selector: SessionSelectorInput, result: AppliedCommentResult) {
  return `Added live comment ${result.commentId} on ${result.filePath}:${result.line} (${result.side}) in hunk ${result.hunkIndex + 1} for ${formatSelector(selector)}.\n`;
}

function normalizeRepoRoot(selector: SessionSelectorInput) {
  if (!selector.repoRoot) {
    return selector;
  }

  return {
    ...selector,
    repoRoot: resolve(selector.repoRoot),
  };
}

async function resolveDaemonAvailability(action: SessionCommandInput["action"]) {
  const config = resolveHunkMcpConfig();
  const healthy = await isHunkDaemonHealthy(config);
  if (healthy) {
    return true;
  }

  const portReachable = await isLoopbackPortReachable(config);
  if (portReachable) {
    throw new Error(
      `Hunk MCP port ${config.host}:${config.port} is already in use by another process. ` +
        `Stop the conflicting process or set HUNK_MCP_PORT to a different loopback port.`,
    );
  }

  if (action === "list") {
    return false;
  }

  throw new Error("No active Hunk sessions are registered with the daemon. Open Hunk and wait for it to connect.");
}

function renderOutput(output: SessionCommandOutput, value: unknown, formatText: () => string) {
  return output === "json" ? stringifyJson(value) : formatText();
}

export async function runSessionCommand(input: SessionCommandInput) {
  const daemonAvailable = await resolveDaemonAvailability(input.action);
  if (!daemonAvailable && input.action === "list") {
    return renderOutput(input.output, { sessions: [] }, () => formatListOutput([]));
  }

  const client = new McpHunkDaemonCliClient();
  await client.connect();

  try {
    switch (input.action) {
      case "list": {
        const sessions = await client.listSessions();
        return renderOutput(input.output, { sessions }, () => formatListOutput(sessions));
      }
      case "get": {
        const session = await client.getSession(normalizeRepoRoot(input.selector));
        return renderOutput(input.output, { session }, () => formatSessionOutput(session));
      }
      case "context": {
        const context = await client.getSelectedContext(normalizeRepoRoot(input.selector));
        return renderOutput(input.output, { context }, () => formatContextOutput(context));
      }
      case "navigate": {
        const result = await client.navigateToHunk({
          ...input,
          selector: normalizeRepoRoot(input.selector),
        });
        return renderOutput(input.output, { result }, () => formatNavigationOutput(input.selector, result));
      }
      case "comment-add": {
        const result = await client.addComment({
          ...input,
          selector: normalizeRepoRoot(input.selector),
        });
        return renderOutput(input.output, { result }, () => formatCommentOutput(input.selector, result));
      }
    }
  } finally {
    await client.close();
  }
}
