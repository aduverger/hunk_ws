export class HunkUserError extends Error {
  readonly details: string[];

  constructor(message: string, details: string[] = []) {
    super(message);
    this.name = "HunkUserError";
    this.details = details;
  }
}

/** Format CLI and startup failures without exposing Bun internal stack frames for expected errors. */
export function formatCliError(error: unknown) {
  if (error instanceof HunkUserError) {
    const lines = [`hunk: ${error.message}`];

    if (error.details.length > 0) {
      lines.push("", ...error.details);
    }

    return `${lines.join("\n")}\n`;
  }

  if (error instanceof Error) {
    if (process.env.HUNK_DEBUG === "1" && error.stack) {
      return `${error.stack}\n`;
    }

    return `hunk: ${error.message}\n`;
  }

  return `hunk: ${String(error)}\n`;
}
