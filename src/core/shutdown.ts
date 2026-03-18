/** Minimal root contract needed for app shutdown. */
export interface ShutdownRoot {
  unmount: () => void;
}

/** Minimal renderer contract needed for app shutdown. */
export interface ShutdownRenderer {
  destroy: () => void;
}

/** Minimal stdout surface needed to clear the restored terminal. */
export interface ShutdownStdout {
  isTTY?: boolean;
  write: (chunk: string) => unknown;
}

/**
 * Tear down the TUI session and clear the restored terminal before exiting.
 * The caller owns any once-only guard around this helper.
 */
export function shutdownSession({
  root,
  renderer,
  stdout = process.stdout,
  exit = (code: number) => process.exit(code),
}: {
  root: ShutdownRoot;
  renderer: ShutdownRenderer;
  stdout?: ShutdownStdout;
  exit?: (code: number) => never | void;
}) {
  root.unmount();
  renderer.destroy();

  if (stdout.isTTY) {
    stdout.write("\x1b[2J\x1b[H");
  }

  exit(0);
}
