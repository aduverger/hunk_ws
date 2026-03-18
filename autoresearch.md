# Autoresearch: syntax highlighting startup latency

## Objective
Reduce the delay before syntax highlighting visibly appears when `hunk` starts, especially on larger multi-file diffs.

The benchmark now targets the real app startup path instead of calling `loadHighlightedDiff()` directly. It measures from app mount until the selected file visibly paints highlighted emphasis spans in the terminal output. This is more representative of what the user actually waits for.

## Metrics
- **Primary**: `selected_highlight_ms` (ms, lower is better)
- **Secondary**: `iterations`, `samples`, `files`, `lines_per_file`

## How to Run
`./autoresearch.sh` — runs three cold-process app-startup benchmark samples and prints averaged `METRIC name=value` lines.

## Files in Scope
- `src/ui/diff/pierre.ts` — syntax highlight loading helpers and startup queueing.
- `src/ui/diff/PierreDiffView.tsx` — per-file highlight loading and render behavior.
- `src/ui/App.tsx` — real app startup flow, selection, and pane mounting.
- `test/app-syntax-highlight-startup-benchmark.ts` — synthetic app-startup benchmark workload.
- `autoresearch.sh` — benchmark entrypoint.
- `autoresearch.checks.sh` — correctness backpressure.

## Off Limits
- Major dependency changes.
- Replacing Pierre diffs.
- Removing syntax highlighting.
- Product behavior changes beyond making startup highlighting faster.

## Constraints
- All tests must pass.
- Keep syntax highlighting support intact.
- Do not cheat or overfit the benchmark.
- Preserve the current diff model and renderer architecture.

## What's Been Tried
- On the earlier helper-level benchmark, the biggest wins came from switching to the Shiki wasm engine, preparing only the active appearance theme, and serializing startup highlight work with a lean promise chain.
- The current code on that helper benchmark reached `selected_highlight_ms=95.31ms` after caching Pierre highlighter options per appearance/language.
- The benchmark has now changed to the real app startup path, so a fresh baseline is required before further experiments.
