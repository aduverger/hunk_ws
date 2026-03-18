import { performance } from "perf_hooks";
import { parseDiffFromFile } from "@pierre/diffs";
import type { DiffFile } from "../src/core/types";
import { loadHighlightedDiff } from "../src/ui/diff/pierre";

function createBenchmarkFile(index: number): DiffFile {
  const before = Array.from({ length: 160 }, (_, lineIndex) => {
    const line = lineIndex + 1;
    return `export function feature${index}_${line}(value: number) { return value + ${line}; }\n`;
  }).join("");

  const after = Array.from({ length: 160 }, (_, lineIndex) => {
    const line = lineIndex + 1;
    if (lineIndex >= 48 && lineIndex < 112) {
      return `export function feature${index}_${line}(value: number) { return value * ${line} + ${index}; }\n`;
    }

    return `export function feature${index}_${line}(value: number) { return value + ${line}; }\n`;
  }).join("");

  const path = `src/example${index}.ts`;
  const metadata = parseDiffFromFile(
    {
      name: path,
      contents: before,
      cacheKey: `benchmark:${index}:before`,
    },
    {
      name: path,
      contents: after,
      cacheKey: `benchmark:${index}:after`,
    },
    { context: 3 },
    true,
  );

  let additions = 0;
  let deletions = 0;
  for (const hunk of metadata.hunks) {
    for (const content of hunk.hunkContent) {
      if (content.type === "change") {
        additions += content.additions;
        deletions += content.deletions;
      }
    }
  }

  return {
    id: `benchmark:${index}`,
    path,
    patch: "",
    language: "typescript",
    stats: { additions, deletions },
    metadata,
    agent: null,
  };
}

const files = Array.from({ length: 10 }, (_, index) => createBenchmarkFile(index + 1));
const start = performance.now();
const jobs = files.map((file) => loadHighlightedDiff(file));
await jobs[0];
const selectedHighlightMs = performance.now() - start;
await Promise.all(jobs);
const allHighlightsMs = performance.now() - start;

console.log(`METRIC selected_highlight_ms=${selectedHighlightMs.toFixed(2)}`);
console.log(`METRIC all_highlights_ms=${allHighlightsMs.toFixed(2)}`);
console.log(`METRIC files=${files.length}`);
console.log("METRIC lines_per_file=160");
