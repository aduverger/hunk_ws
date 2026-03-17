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

## Planned workflows

- `otdiff git [range]`
- `otdiff diff <left> <right>`
- `otdiff patch [file|-]`
- `otdiff difftool <left> <right> [path]`
