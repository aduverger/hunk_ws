# Autoresearch: syntax highlighting startup latency

## Objective
Reduce the delay before syntax highlighting appears when `hunk` starts, especially on larger multi-file diffs.

The target is the startup path that mounts many `PierreDiffView` instances and asynchronously loads highlighted diff output. We want the first visible highlighted diff to appear sooner without regressing eventual correctness or changing the product behavior.

## Metrics
- **Primary**: `selected_highlight_ms` (ms, lower is better)
- **Secondary**: `all_highlights_ms`, `files`, `lines_per_file`

## How to Run
`./autoresearch.sh` — runs a cold-process benchmark and prints `METRIC name=value` lines.

## Files in Scope
- `src/ui/diff/PierreDiffView.tsx` — per-file highlight loading, caching, and render behavior.
- `src/ui/diff/pierre.ts` — syntax highlight loading helpers.
- `test/syntax-highlight-startup-benchmark.ts` — synthetic cold-start benchmark workload.
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
- Baseline pending.
