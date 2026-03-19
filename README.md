# hunk

Hunk is a desktop-inspired terminal diff viewer for understanding AI-authored changesets in Bun + TypeScript with OpenTUI.

## Requirements

- Bun
- Zig

## Install

```bash
bun install
```

## Run

```bash
bun run src/main.tsx -- diff
```

## Standalone binary

Build a local executable:

```bash
bun run build:bin
./dist/hunk diff
```

Install it into `~/.local/bin`:

```bash
bun run install:bin
hunk
hunk diff
```

If you want a different install location, set `HUNK_INSTALL_DIR` before running the install script.

## Workflows

- `hunk` — print standard CLI help with the most common commands
- `hunk diff` — review local working tree changes in the full Hunk UI
- `hunk diff --staged` / `hunk diff --cached` — review staged changes in the full Hunk UI
- `hunk diff <ref>` — review changes versus a branch, tag, or commit-ish
- `hunk diff <ref1>..<ref2>` / `hunk diff <ref1>...<ref2>` — review common Git ranges
- `hunk diff -- <pathspec...>` — review only selected paths
- `hunk show [ref]` — review the last commit or a given ref in the full Hunk UI
- `hunk stash show [ref]` — review a stash entry in the full Hunk UI
- `hunk diff <left> <right>` — compare two concrete files directly
- `hunk patch [file|-]` — review a patch file or stdin, including pager mode
- `hunk difftool <left> <right> [path]` — integrate with Git difftool
- `hunk git [range]` — legacy alias for the original Git-style diff entrypoint

## Interaction

- `1` split view
- `2` stacked view
- `0` auto layout
- `t` cycle themes
- `a` toggle the agent panel
- `l` toggle line numbers
- `w` toggle line wrapping
- `m` toggle hunk metadata
- `[` / `]` move between hunks
- `space` / `b` page forward and backward
- `/` focus the file filter
- `tab` cycle focus regions
- `q` or `Esc` quit

## Configuration

Hunk reads layered TOML config with this precedence:

1. built-in defaults
2. global config: `$XDG_CONFIG_HOME/hunk/config.toml` or `~/.config/hunk/config.toml`
3. repo-local config: `.hunk/config.toml`
4. command-specific sections like `[git]`, `[diff]`, `[show]`, `[stash-show]`, `[patch]`, `[difftool]`
5. `[pager]` when Hunk is running in pager mode
6. explicit CLI flags

When you change persistent view settings inside Hunk, it writes them back to `.hunk/config.toml` in the current repo when possible, or to the global config file outside a repo.

Example:

```toml
theme = "midnight"
mode = "auto"
line_numbers = true
wrap_lines = false
hunk_headers = true
agent_notes = false

[pager]
mode = "stack"
line_numbers = false

[diff]
mode = "split"
```

CLI overrides are available when you want one-off or pager-specific behavior:

```bash
hunk diff --mode split --line-numbers
hunk show HEAD~1 --theme paper
hunk patch - --mode stack --no-line-numbers
hunk diff before.ts after.ts --theme paper --wrap
```

Supported persistent CLI overrides:

- `--mode <auto|split|stack>`
- `--theme <theme>`
- `--line-numbers` / `--no-line-numbers`
- `--wrap` / `--no-wrap`
- `--hunk-headers` / `--no-hunk-headers`
- `--agent-notes` / `--no-agent-notes`

## Agent sidecar format

Use `--agent-context <file>` to load a JSON sidecar and show agent rationale next to the diff.

The order of `files` in the sidecar is significant. Hunk uses that order for the sidebar and main review stream so an agent can tell a story instead of relying on raw patch order.

```json
{
  "version": 1,
  "summary": "High-level change summary from the agent.",
  "files": [
    {
      "path": "src/core/loaders.ts",
      "summary": "Normalizes git and patch inputs into one changeset model.",
      "annotations": [
        {
          "newRange": [120, 156],
          "summary": "Adds the patch loader entrypoint.",
          "rationale": "Keeps all diff sources flowing through one normalized shape.",
          "tags": ["parser", "architecture"],
          "confidence": "high"
        }
      ]
    },
    {
      "path": "src/ui/App.tsx",
      "summary": "Presents the new workflow after the loader changes.",
      "annotations": [
        {
          "newRange": [90, 136],
          "summary": "Uses the normalized model in the review shell.",
          "rationale": "The reader should inspect this after understanding the loader changes.",
          "tags": ["ui"],
          "confidence": "medium"
        }
      ]
    }
  ]
}
```

Files omitted from the sidecar keep their original diff order and appear after the explicitly ordered files.

## Codex workflow

For Codex-driven changes, keep a transient sidecar at `.hunk/latest.json` and load it during review:

```bash
hunk diff --agent-context .hunk/latest.json
```

Suggested pattern:

- Codex makes code changes.
- Codex refreshes `.hunk/latest.json` with a concise changeset summary, file summaries, and hunk-level rationale.
- You open `hunk diff`, `hunk diff --staged`, or `hunk show <ref>` with that sidecar.

Keep the sidecar concise. It should explain why a hunk exists, what risk to review, and how the files fit together. It should not narrate obvious syntax edits line by line.

## Comparison

### Feature comparison

| Capability | hunk | difftastic | delta | diff |
| --- | --- | --- | --- | --- |
| Dedicated interactive review UI | ✅ | ❌ | ❌ | ❌ |
| Multi-file review stream with navigation sidebar | ✅ | ❌ | ❌ | ❌ |
| Agent / AI rationale sidecar | ✅ | ❌ | ❌ | ❌ |
| Split diffs | ✅ | ✅ | ✅ | ✅ |
| Stacked diffs | ✅ | ✅ | ✅ | ✅ |
| Auto responsive layouts | ✅ | ❌ | ❌ | ❌ |
| Themes | ✅ | ❌ | ✅ | ❌ |
| Syntax highlighting | ✅ | ✅ | ✅ | ❌ |
| Syntax-aware / structural diffing | ❌ | ✅ | ❌ | ❌ |
| Mouse support inside the diff viewer | ✅ | ❌ | ❌ | ❌ |
| Runtime toggles for wrapping / line numbers / hunk metadata | ✅ | ❌ | ❌ | ❌ |
| Pager-compatible mode | ✅ | ✅ | ✅ | ✅ |

### Local timing snapshot

These numbers are **not a universal benchmark**. They are a quick local comparison from one Linux machine using tmux panes, measuring **time until a changed marker first became visible** on the same 120-line TypeScript file pair.

Commands used:

- `hunk diff before.ts after.ts`
- `difft --display side-by-side before.ts after.ts`
- `delta --paging=never before.ts after.ts`
- `diff -u before.ts after.ts`

| Tool | Avg first-visible changed output |
| --- | ---: |
| `diff` | ~37 ms |
| `delta --paging=never` | ~35 ms |
| `hunk diff` | ~219 ms |
| `difft --display side-by-side` | ~266 ms |

Interpretation:

- `diff` and `delta` are fastest here because they emit plain diff text and exit.
- `hunk` pays extra startup cost for an interactive terminal UI, syntax highlighting, navigation state, and optional agent context.
- `difftastic` pays extra cost for syntax-aware / structural diffing.
- For larger review sessions, Hunk is optimized for **navigating and understanding** a changeset, not just dumping the quickest possible patch text.

## Git integration

For full-screen review, you can invoke Hunk directly with Git-shaped commands:

```bash
hunk diff
hunk diff --staged
hunk diff main...feature
hunk show
hunk show HEAD~1
hunk stash show
```

Use Hunk as the default Git pager when you want it to behave like a normal pager under `git diff` / `git show`:

```bash
git config --global core.pager 'hunk patch -'
```

Or scope it just to `git diff` and `git show`:

```bash
git config --global pager.diff 'hunk patch -'
git config --global pager.show 'hunk patch -'
```

When Hunk reads a patch from stdin, it automatically switches to pager-style chrome, strips Git's color escape sequences before parsing, and binds keyboard input to the controlling terminal so it works correctly as a Git pager.

Then:

```bash
git diff
git show HEAD
```

If you want Git to launch Hunk as a difftool for file-to-file comparisons:

```bash
git config --global diff.tool hunk
git config --global difftool.hunk.cmd 'hunk difftool "$LOCAL" "$REMOTE" "$MERGED"'
```
