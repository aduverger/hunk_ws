# Autoresearch: syntax highlighting startup latency

## Objective
Reduce the delay before syntax highlighting appears when `hunk` starts, especially on larger multi-file diffs.

The target is the startup path that mounts many `PierreDiffView` instances and asynchronously loads highlighted diff output. We want the first visible highlighted diff to appear sooner without regressing eventual correctness or changing the product behavior.

## Metrics
- **Primary**: `selected_highlight_ms` (ms, lower is better)
- **Secondary**: `all_highlights_ms`, `samples`, `files`, `lines_per_file`

## How to Run
`./autoresearch.sh` — runs three cold-process benchmark samples and prints averaged `METRIC name=value` lines.

## Files in Scope
- `src/ui/diff/pierre.ts` — syntax highlight loading helpers and startup queueing.
- `src/ui/diff/PierreDiffView.tsx` — per-file highlight loading and render behavior.
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
- Initial single-sample baseline: `selected_highlight_ms=2381.47`.
- Reusing a per-language in-flight highlighter-preparation promise improved the single-sample startup metric slightly to `2349.96ms`.
- Queueing startup highlight rendering in arrival order produced the first large win, cutting the single-sample selected-file metric to `1065.82ms` while keeping total completion time roughly flat.
- The benchmark now averages three cold-process runs. Re-baselined 3-run average on the queued startup strategy: `1050.10ms`.
- Switching the shared syntax startup path from Shiki JS to the Shiki wasm engine cut the 3-run average selected-file metric to `231.56ms` and total completion to `527.68ms`.
- Preparing and rendering only the active appearance theme instead of both light and dark at startup cut the 3-run average selected-file metric further to `153.37ms` and total completion to `300.62ms`.
- Removing the local per-language/theme prep cache was effectively neutral on the primary metric and slightly simpler; current best is `153.36ms` with `all_highlights_ms=303.68ms`.
- Discarded on top of the new best:
  - two concurrent startup highlight renders (`203.65ms`)
  - no startup queue (`305.71ms`)
  - first-highlight immediate fast path (`299.80ms`)
  - JavaScript Shiki engine after the active-appearance change (`761.56ms`)
  - earlier experiments also discarded warmup-at-import and synchronous queue execution because they regressed badly.
