# Contributing

Thanks for contributing to Hunk.

## Before you open a PR

- open an issue or discussion first for large behavior or UX changes
- keep PRs focused
- include tests for parser, CLI, or rendering changes where practical
- update `README.md` when the public workflow changes
- refresh `.hunk/latest.json` for local review context when you change code

## Development setup

```bash
git clone https://github.com/modem-dev/hunk.git
cd hunk
bun install
```

Run from source:

```bash
bun run src/main.tsx -- diff
```

## Validation

For most changes, run:

```bash
bun run typecheck
bun test
```

For rendering or terminal interaction changes, also run:

```bash
bun run test:tty-smoke
```

If you touch packaging or release-related files, also run:

```bash
bun run build:npm
bun run check:pack
```

## Pull request checklist

- [ ] scope is focused
- [ ] tests or rationale added for behavior changes
- [ ] `bun run typecheck` passes
- [ ] `bun test` passes
- [ ] `README.md` updated if the CLI or install flow changed

## Design notes

Hunk is review-first:

- the main pane is a single multi-file review stream
- the sidebar is navigation, not a single-file mode switcher
- split and stack views come from the same normalized diff model
- agent notes should stay attached to the code they explain

## Code of conduct

Be respectful, assume good intent, and focus review on the code and user impact.
