import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { COMPILE_ENTRYPOINTS } from "../build/build-bin";

const definition = readFileSync(path.resolve(import.meta.dir, "../../nix/package.nix"), "utf8");

describe("Nix package-first paths", () => {
  test("reads the publishable manifest and compiles the moved application entry", () => {
    expect(definition).toContain("../packages/hunk/package.json");
    expect(definition).toContain('"./packages/hunk/src/main.tsx"');
    expect(definition).not.toContain('"./src/main.tsx"');
  });

  test("compiles the same entrypoints as scripts/build/build-bin.ts", () => {
    // Bun only embeds the entrypoints it is given, so an entry added to build-bin.ts but not
    // here ships a Nix binary that cannot find it at runtime.
    const compileArgs = definition.match(/build --compile([\s\S]*?)--outfile/);
    expect(compileArgs).not.toBeNull();

    const nixEntrypoints = [
      ...compileArgs![1]!.matchAll(/"\.\/packages\/hunk\/src\/([^"]+)"/g),
    ].map((match) => match[1]);
    expect(nixEntrypoints).toEqual([...COMPILE_ENTRYPOINTS]);
  });

  test("installs the two shipped skills from the Hunk package", () => {
    expect(definition).toContain("cp -r ./packages/hunk/skills $out/");
  });
});
