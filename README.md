# opentui-diff

A desktop-inspired terminal diff viewer for understanding AI-authored changesets in Bun + TypeScript with OpenTUI.

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

## Workflows

- `otdiff git [range]`
- `otdiff diff <left> <right>`
- `otdiff patch [file|-]`
- `otdiff difftool <left> <right> [path]`

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

## Git difftool

You can wire the app into git once the package is installed:

```bash
git config --global diff.tool otdiff
git config --global difftool.otdiff.cmd 'otdiff difftool "$LOCAL" "$REMOTE" "$MERGED"'
```
