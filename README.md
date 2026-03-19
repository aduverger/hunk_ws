# hunk

Hunk is a terminal diff viewer for reviewing agent-authored changesets with a desktop-style UI.

It is built for code review, not patch dumping:

- full-screen multi-file review stream
- split, stacked, and responsive auto layouts
- keyboard and mouse navigation
- optional agent rationale shown next to annotated hunks
- Git pager and difftool integration

## Requirements

- [Bun](https://bun.sh) 1.3.10+
- Git for `hunk diff`, `hunk show`, `hunk stash show`, and `hunk pager`

> `npm i -g hunkdiff` installs the package, but the `hunk` executable still runs with Bun via its shebang. Install Bun first.

## Install

### Global install from npm

```bash
npm i -g hunkdiff
```

Then run:

```bash
hunk diff
```

### Global install with Bun

```bash
bun install -g hunkdiff
```

### Run from source

```bash
git clone https://github.com/modem-dev/hunk.git
cd hunk
bun install
bun run src/main.tsx -- diff
```

### Build a standalone binary locally

```bash
bun run build:bin
./dist/hunk diff
```

To install that binary into `~/.local/bin`:

```bash
bun run install:bin
```

Set `HUNK_INSTALL_DIR` first if you want a different install location.

## Quick start

Review your current working tree:

```bash
hunk diff
```

Review staged changes:

```bash
hunk diff --staged
```

Review a commit:

```bash
hunk show HEAD~1
```

Compare two files directly:

```bash
hunk diff before.ts after.ts
```

Open a patch from stdin:

```bash
git diff --no-color | hunk patch -
```

## Common workflows

- `hunk` — print CLI help
- `hunk diff` — review working tree changes
- `hunk diff --staged` / `hunk diff --cached` — review staged changes
- `hunk diff <ref>` — review changes versus a branch, tag, or commit-ish
- `hunk diff <ref1>..<ref2>` / `hunk diff <ref1>...<ref2>` — review Git ranges
- `hunk diff -- <pathspec...>` — limit review to selected paths
- `hunk show [ref]` — review the last commit or a specific ref
- `hunk stash show [ref]` — review a stash entry
- `hunk patch [file|-]` — review a patch file or stdin
- `hunk pager` — act as a Git pager wrapper, opening Hunk for diff-like stdin and falling back to plain text paging otherwise
- `hunk difftool <left> <right> [path]` — integrate with Git difftool

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

## Git integration

Use Hunk directly for full-screen review:

```bash
hunk diff
hunk diff --staged
hunk diff main...feature
hunk show
hunk stash show
```

Use Hunk as a pager for `git diff` and `git show`:

```bash
git config --global core.pager 'hunk patch -'
```

Or scope it just to diff/show:

```bash
git config --global pager.diff 'hunk patch -'
git config --global pager.show 'hunk patch -'
```

Use Hunk as a Git difftool:

```bash
git config --global diff.tool hunk
git config --global difftool.hunk.cmd 'hunk difftool "$LOCAL" "$REMOTE" "$MERGED"'
```

## Configuration

Hunk reads layered TOML config with this precedence:

1. built-in defaults
2. global config: `$XDG_CONFIG_HOME/hunk/config.toml` or `~/.config/hunk/config.toml`
3. repo-local config: `.hunk/config.toml`
4. command-specific sections like `[diff]`, `[show]`, `[stash-show]`, `[patch]`, `[difftool]`
5. `[pager]` when Hunk is running in pager mode
6. explicit CLI flags

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

Supported one-off CLI overrides:

- `--mode <auto|split|stack>`
- `--theme <theme>`
- `--line-numbers` / `--no-line-numbers`
- `--wrap` / `--no-wrap`
- `--hunk-headers` / `--no-hunk-headers`
- `--agent-notes` / `--no-agent-notes`

## Agent context sidecar

Use `--agent-context <file>` to load a JSON sidecar and show agent rationale next to the diff.

The order of `files` in the sidecar is significant. Hunk uses that order for the sidebar and the main review stream so an agent can present a review narrative instead of raw patch order.

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
    }
  ]
}
```

For local agent-driven review, keep a transient sidecar at `.hunk/latest.json` and load it with:

```bash
hunk diff --agent-context .hunk/latest.json
```

## Development

Install dependencies:

```bash
bun install
```

Run the source entrypoint:

```bash
bun run src/main.tsx -- diff
```

Validate a change:

```bash
bun run typecheck
bun test
bun run test:tty-smoke
```

Build the npm runtime bundle used for publishing:

```bash
bun run build:npm
bun run check:pack
```

## Open source project docs

- Contributing: [CONTRIBUTING.md](CONTRIBUTING.md)
- Security: [SECURITY.md](SECURITY.md)
- License: [MIT](LICENSE)
