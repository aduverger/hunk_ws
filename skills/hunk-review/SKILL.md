---
name: hunk-review
description: Use when the task involves Hunk or Hunk MCP review sessions. Helps Pi briefly explain what Hunk is, prefer live Hunk MCP inspection over shell parsing, inspect current review focus, navigate hunks, and leave inline review comments.
compatibility: Requires Hunk from this repo or the published hunkdiff package. Works best with a real TTY for interactive review.
---

# Hunk Review

Use this skill when working with Hunk itself or when the user wants a code-review workflow centered on Hunk.

When this skill activates, start by briefly explaining what Hunk is in plain language before jumping into MCP details.

## What Hunk is

Hunk is a review-first terminal diff viewer for agent-authored changesets.

Keep these product rules in mind:
- the main pane is one top-to-bottom multi-file review stream
- the sidebar is for navigation, not single-file mode switching
- layouts are `auto`, `split`, and `stack`
- `[` and `]` navigate hunks across the full review stream
- agent notes belong beside the code they explain

## Default rule: prefer live MCP review

If a live Hunk session already exists, prefer Hunk's MCP tools over launching new shell commands or scraping terminal output.

The MCP daemon is local-only and brokers commands to one or more live Hunk sessions.

Important behavior:
- normal Hunk sessions auto-start and register with the daemon when MCP is enabled
- `hunk mcp serve` exists for manual startup or debugging
- `HUNK_MCP_DISABLE=1` disables MCP registration for a session
- one daemon can serve many Hunk sessions

## Recommended MCP review loop

Use this flow by default:
1. `list_sessions`
2. `get_selected_context`
3. `navigate_to_hunk` only if the current focus is wrong
4. `comment`

Use `get_session` only when you need broader session metadata.

Guidelines:
- if multiple sessions are live, pass `sessionId` explicitly
- prefer `get_selected_context` before navigating blindly
- use `navigate_to_hunk` for hunk-level movement; do not invent extra remote-control behavior
- use `comment` for concise inline review notes tied to real diff lines
- prefer `reveal: true` unless the user wants a quieter action

For concrete MCP tool behavior and examples, read [references/mcp-review.md](references/mcp-review.md).

## Start Hunk only when needed

If no live Hunk session exists and the user wants an interactive review UI, launch Hunk itself with a minimal command and let it auto-start/register with the MCP daemon.

After launching Hunk, go back to `list_sessions` rather than suggesting manual daemon management.

Inside the Hunk repo, prefer the source entrypoint:

```bash
bun run src/main.tsx -- diff
bun run src/main.tsx -- show HEAD~1
```

Outside the repo, prefer the installed CLI:

```bash
hunk diff
hunk show
```

For more CLI entrypoints, read [references/commands.md](references/commands.md).

## Repo-specific review notes

When using Hunk for agent changes:
- prefer a real TTY or tmux session over redirected stdout captures
- if a repo already has a fresh local sidecar, you can load it with `hunk diff --agent-context <file>`
- treat `.hunk/latest.json` as an optional local convention, not required repo hygiene
- if new files should show up before commit, use `git add -N <path>`

## What this skill should steer Pi toward

Prefer a skill over a prompt dump:
- keep always-loaded context small
- load the full Hunk workflow only when the task is actually about review
- use Hunk's existing MCP tools rather than ad hoc shell parsing

Prefer review-oriented actions:
- inspect the current live diff session
- move to the right hunk only when needed
- attach concise inline review comments
- keep agent rationale spatially tied to the code
