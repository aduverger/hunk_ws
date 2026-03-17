# opentui-diff agent notes

## purpose

- Terminal-first diff viewer for understanding coding-agent changesets.
- Bun + TypeScript + OpenTUI React.
- UI target is "desktop diff tool in a terminal", not a classic text-mode pager.

## current architecture

```text
argv
  -> src/core/cli.ts
  -> src/core/loaders.ts
  -> src/core/types.ts Changeset model
  -> src/main.tsx
  -> src/ui/App.tsx shell
  -> src/ui/PierreDiffView.tsx terminal renderer
  -> src/ui/pierre.ts Pierre adapter/highlighting/row model
```

- Input modes: `git`, `diff`, `patch`, `difftool`.
- All inputs normalize into one `Changeset` / `DiffFile` model.
- Agent rationale sidecar loading lives in `src/core/agent.ts`.

## important rendering rule

- Do not switch the main diff pane back to OpenTUI's built-in `<diff>` widget.
- Current renderer is Pierre-first:
  - `src/ui/pierre.ts` uses public Pierre primitives such as `getHighlighterOptions`, `getSharedHighlighter`, and `renderDiffWithHighlighter`.
  - `src/ui/PierreDiffView.tsx` renders the resulting row model with OpenTUI primitives.
- Split and stack views are both terminal-native and share the same normalized row model.

## file map

- `src/core/cli.ts`: command parsing and shared flags.
- `src/core/loaders.ts`: loads git diffs, file pairs, patches, difftool temp files.
- `src/core/agent.ts`: loads/matches agent sidecar JSON.
- `src/core/types.ts`: central app types.
- `src/ui/App.tsx`: layout, sidebar, theme tabs, hunk/file selection, agent rail.
- `src/ui/pierre.ts`: Pierre highlighting + conversion into split/stack rows.
- `src/ui/PierreDiffView.tsx`: renders Pierre row model in OpenTUI.
- `src/ui/themes.ts`: built-in themes; includes `appearance` used to pick Pierre light/dark token colors.

## commands

- install deps: `bun install`
- run from source: `bun run src/main.tsx -- git`
- fast smoke test: `bun run src/main.tsx diff /tmp/before.ts /tmp/after.ts`
- typecheck: `bun run typecheck`
- tests: `bun test`
- build binary: `bun run build:bin`
- install binary: `bun run install:bin`

## binary notes

- Installed `otdiff` is a compiled snapshot, not linked to source.
- After source changes, rebuild/reinstall with `bun run install:bin`.
- Alt-screen capture through stdout redirection can be misleading for the compiled binary. If you need to verify rendering, prefer:
  - a real TTY session
  - or `bun run src/main.tsx ...` for quick smoke checks

## ui behavior

- Layout modes: `auto`, `split`, `stack`.
- `auto` uses split at wider terminals and stack on narrow terminals.
- Keys:
  - `1` split
  - `2` stack
  - `0` auto
  - `[` / `]` hunk nav
  - `/` filter
  - `t` theme
  - `a` agent rail
  - `q` quit

## testing focus

- `test/cli.test.ts`: command parsing
- `test/loaders.test.ts`: changeset loading
- `test/agent.test.ts`: sidecar matching
- `test/pierre.test.ts`: Pierre adapter row model / highlighted emphasis spans

When changing rendering:

- run `bun run typecheck`
- run `bun test`
- do one real smoke run in a TTY on an actual diff

## known repo details

- There is an unrelated untracked file named `md` in the repo root. Leave it alone unless the user asks.
- User asked for commits along the way. Prefer small milestone commits rather than one large final commit.
- Keep the doc small if you update it later. This file is meant for fresh-context agents and should stay token-efficient.
