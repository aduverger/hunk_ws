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
bun run src/main.tsx -- git
```

## Standalone binary

Build a local executable:

```bash
bun run build:bin
./dist/hunk git
```

Install it into `~/.local/bin`:

```bash
bun run install:bin
hunk git
```

If you want a different install location, set `HUNK_INSTALL_DIR` before running the install script.

## Workflows

- `hunk git [range]`
- `hunk diff <left> <right>`
- `hunk patch [file|-]`
- `hunk difftool <left> <right> [path]`

## Interaction

- `1` split view
- `2` stacked view
- `0` auto layout
- `t` cycle themes
- `a` toggle the agent panel
- `[` / `]` move between hunks
- `/` focus the file filter
- `tab` cycle focus regions
- `q` or `Esc` quit

## Agent sidecar format

Use `--agent-context <file>` to load a JSON sidecar and show agent rationale next to the diff.

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

## Git integration

Use Hunk as the viewer for `git diff` and `git show`:

```bash
git config --global pager.diff 'hunk patch -'
git config --global pager.show 'hunk patch -'
```

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
