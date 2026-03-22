import type { AppliedCommentResult, HunkSessionRegistration, HunkSessionSnapshot, SessionClientMessage, SessionServerMessage } from "./types";
import { HUNK_SESSION_SOCKET_PATH, resolveHunkMcpConfig } from "./config";
import { isHunkDaemonHealthy, launchHunkDaemon, waitForHunkDaemonHealth } from "./daemonLauncher";

export interface HunkAppBridge {
  applyComment: (message: Extract<SessionServerMessage, { command: "comment" }>) => Promise<AppliedCommentResult>;
}

/** Keep one running Hunk TUI session registered with the local MCP daemon. */
export class HunkHostClient {
  private websocket: WebSocket | null = null;
  private bridge: HunkAppBridge | null = null;
  private queuedMessages: SessionServerMessage[] = [];
  private reconnectTimer: Timer | null = null;
  private stopped = false;
  private startupPromise: Promise<void> | null = null;
  private lastDaemonLaunchStartedAt = 0;
  private readonly config = resolveHunkMcpConfig();

  constructor(
    private readonly registration: HunkSessionRegistration,
    private snapshot: HunkSessionSnapshot,
  ) {}

  start() {
    if (process.env.HUNK_MCP_DISABLE === "1") {
      return;
    }

    if (this.startupPromise) {
      return;
    }

    this.startupPromise = this.ensureDaemonAndConnect().finally(() => {
      this.startupPromise = null;
    });
  }

  stop() {
    this.stopped = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.websocket?.close();
    this.websocket = null;
  }

  private async ensureDaemonAndConnect() {
    await this.ensureDaemonAvailable();
    this.connect();
  }

  private async ensureDaemonAvailable() {
    if (await isHunkDaemonHealthy(this.config)) {
      return;
    }

    const launchCooldownMs = 5_000;
    if (Date.now() - this.lastDaemonLaunchStartedAt < launchCooldownMs) {
      return;
    }

    this.lastDaemonLaunchStartedAt = Date.now();
    launchHunkDaemon();
    await waitForHunkDaemonHealth({
      config: this.config,
    });
  }

  setBridge(bridge: HunkAppBridge | null) {
    this.bridge = bridge;
    void this.flushQueuedMessages();
  }

  updateSnapshot(snapshot: HunkSessionSnapshot) {
    this.snapshot = snapshot;
    this.send({
      type: "snapshot",
      sessionId: this.registration.sessionId,
      snapshot,
    });
  }

  private connect() {
    if (this.stopped || this.websocket) {
      return;
    }

    const websocket = new WebSocket(`${this.config.wsOrigin}${HUNK_SESSION_SOCKET_PATH}`);
    this.websocket = websocket;

    websocket.onopen = () => {
      this.lastDaemonLaunchStartedAt = 0;
      this.send({
        type: "register",
        registration: this.registration,
        snapshot: this.snapshot,
      });
      void this.flushQueuedMessages();
    };

    websocket.onmessage = (event) => {
      if (typeof event.data !== "string") {
        return;
      }

      let parsed: SessionServerMessage;
      try {
        parsed = JSON.parse(event.data) as SessionServerMessage;
      } catch {
        return;
      }

      void this.handleServerMessage(parsed);
    };

    websocket.onclose = () => {
      this.websocket = null;
      if (!this.stopped) {
        this.scheduleReconnect();
      }
    };

    websocket.onerror = () => {
      websocket.close();
    };
  }

  private scheduleReconnect() {
    if (this.reconnectTimer || this.stopped) {
      return;
    }

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.ensureDaemonAndConnect();
    }, 3_000);
    this.reconnectTimer.unref?.();
  }

  private send(message: SessionClientMessage) {
    if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
      return;
    }

    this.websocket.send(JSON.stringify(message));
  }

  private async handleServerMessage(message: SessionServerMessage) {
    if (!this.bridge) {
      this.queuedMessages.push(message);
      return;
    }

    try {
      const result = await this.bridge.applyComment(message);
      this.send({
        type: "command-result",
        requestId: message.requestId,
        ok: true,
        result,
      });
    } catch (error) {
      this.send({
        type: "command-result",
        requestId: message.requestId,
        ok: false,
        error: error instanceof Error ? error.message : "Unknown Hunk session error.",
      });
    }
  }

  private async flushQueuedMessages() {
    if (!this.bridge || this.queuedMessages.length === 0) {
      return;
    }

    const queued = [...this.queuedMessages];
    this.queuedMessages = [];

    for (const message of queued) {
      await this.handleServerMessage(message);
    }
  }
}
