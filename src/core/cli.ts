import { Command } from "commander";
import type { CliInput, CommonOptions, LayoutMode } from "./types";

/** Validate one requested layout mode from CLI input. */
function parseLayoutMode(value: string): LayoutMode {
  if (value === "auto" || value === "split" || value === "stack") {
    return value;
  }

  throw new Error(`Invalid layout mode: ${value}`);
}

/** Read one paired positive/negative boolean flag directly from raw argv. */
function resolveBooleanFlag(argv: string[], enabledFlag: string, disabledFlag: string) {
  let resolved: boolean | undefined;

  for (const arg of argv) {
    if (arg === enabledFlag) {
      resolved = true;
      continue;
    }

    if (arg === disabledFlag) {
      resolved = false;
    }
  }

  return resolved;
}

/** Normalize the flags shared by every input mode. */
function buildCommonOptions(
  options: {
    mode?: LayoutMode;
    theme?: string;
    agentContext?: string;
    pager?: boolean;
  },
  argv: string[],
): CommonOptions {
  return {
    mode: options.mode,
    theme: options.theme,
    agentContext: options.agentContext,
    pager: options.pager ? true : undefined,
    lineNumbers: resolveBooleanFlag(argv, "--line-numbers", "--no-line-numbers"),
    wrapLines: resolveBooleanFlag(argv, "--wrap", "--no-wrap"),
    hunkHeaders: resolveBooleanFlag(argv, "--hunk-headers", "--no-hunk-headers"),
    agentNotes: resolveBooleanFlag(argv, "--agent-notes", "--no-agent-notes"),
  };
}

/** Parse CLI arguments into one normalized input shape for the app loader layer. */
export async function parseCli(argv: string[]): Promise<CliInput> {
  if (argv.length <= 2) {
    return {
      kind: "git",
      staged: false,
      options: buildCommonOptions({}, argv),
    };
  }

  let selected: CliInput | null = null;
  const program = new Command();

  program
    .name("hunk")
    .description("Desktop-inspired terminal diff viewer for agent-authored changesets.")
    .showHelpAfterError();

  /** Attach the shared mode/theme/agent-context flags to a subcommand. */
  const applyCommonOptions = (command: Command) =>
    command
      .option("--mode <mode>", "layout mode: auto, split, stack", parseLayoutMode)
      .option("--theme <theme>", "named theme override")
      .option("--agent-context <path>", "JSON sidecar with agent rationale")
      .option("--pager", "use pager-style chrome and controls")
      .option("--line-numbers", "show line numbers")
      .option("--no-line-numbers", "hide line numbers")
      .option("--wrap", "wrap long diff lines")
      .option("--no-wrap", "truncate long diff lines to one row")
      .option("--hunk-headers", "show hunk metadata rows")
      .option("--no-hunk-headers", "hide hunk metadata rows")
      .option("--agent-notes", "show agent notes by default")
      .option("--no-agent-notes", "hide agent notes by default");

  applyCommonOptions(program.command("git"))
    .argument("[range]", "revision or range to diff")
    .option("--staged", "show staged changes instead of the working tree")
    .action((range: string | undefined, options: Record<string, unknown>) => {
      selected = {
        kind: "git",
        range,
        staged: Boolean(options.staged),
        options: buildCommonOptions(options, argv),
      };
    });

  applyCommonOptions(program.command("diff"))
    .argument("<left>", "left-hand file")
    .argument("<right>", "right-hand file")
    .action((left: string, right: string, options: Record<string, unknown>) => {
      selected = {
        kind: "diff",
        left,
        right,
        options: buildCommonOptions(options, argv),
      };
    });

  applyCommonOptions(program.command("patch"))
    .argument("[file]", "patch file path, or omit / pass - for stdin")
    .action((file: string | undefined, options: Record<string, unknown>) => {
      selected = {
        kind: "patch",
        file,
        options: buildCommonOptions(options, argv),
      };
    });

  applyCommonOptions(program.command("difftool"))
    .argument("<left>", "left-hand file from git")
    .argument("<right>", "right-hand file from git")
    .argument("[path]", "display path")
    .action((left: string, right: string, path: string | undefined, options: Record<string, unknown>) => {
      selected = {
        kind: "difftool",
        left,
        right,
        path,
        options: buildCommonOptions(options, argv),
      };
    });

  await program.parseAsync(argv);

  if (!selected) {
    throw new Error("No command selected.");
  }

  return selected;
}
