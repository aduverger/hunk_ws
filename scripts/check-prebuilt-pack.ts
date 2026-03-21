#!/usr/bin/env bun

import path from "node:path";
import { getHostPlatformPackageSpec, releaseNpmDir } from "./prebuilt-package-helpers";

interface PackedFile {
  path: string;
}

interface PackResult {
  name: string;
  version: string;
  files: PackedFile[];
}

function runPackDryRun(cwd: string) {
  const proc = Bun.spawnSync(["npm", "pack", "--dry-run", "--json"], {
    cwd,
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
    env: process.env,
  });

  const stdout = Buffer.from(proc.stdout).toString("utf8").trim();
  const stderr = Buffer.from(proc.stderr).toString("utf8").trim();

  if (proc.exitCode !== 0) {
    throw new Error(stderr || stdout || `npm pack --dry-run failed in ${cwd}`);
  }

  const jsonMatch = stdout.match(/(\[\s*\{[\s\S]*\}\s*\])\s*$/);
  const jsonText = jsonMatch?.[1];
  if (!jsonText) {
    throw new Error(`Could not find npm pack JSON output for ${cwd}. Full stdout:\n${stdout}`);
  }

  const [pack] = JSON.parse(jsonText) as PackResult[];
  if (!pack) {
    throw new Error(`npm pack --dry-run returned no result for ${cwd}`);
  }

  return pack;
}

function assertPaths(pack: PackResult, requiredPaths: string[], forbiddenPrefixes: string[] = []) {
  const publishedPaths = new Set(pack.files.map((file) => file.path));

  for (const requiredPath of requiredPaths) {
    if (!publishedPaths.has(requiredPath)) {
      throw new Error(`Expected ${pack.name} to include ${requiredPath}.`);
    }
  }

  for (const file of pack.files) {
    if (forbiddenPrefixes.some((prefix) => file.path.startsWith(prefix))) {
      throw new Error(`Unexpected file in ${pack.name}: ${file.path}`);
    }
  }
}

const repoRoot = path.resolve(import.meta.dir, "..");
const releaseRoot = releaseNpmDir(repoRoot);
const hostSpec = getHostPlatformPackageSpec();
const metaPack = runPackDryRun(path.join(releaseRoot, "hunkdiff"));
const hostPack = runPackDryRun(path.join(releaseRoot, hostSpec.packageName));

assertPaths(metaPack, ["bin/hunk.cjs", "README.md", "LICENSE", "package.json"]);
assertPaths(hostPack, ["bin/hunk", "LICENSE", "package.json"]);

console.log(`Verified prebuilt npm packages for ${metaPack.version}: ${metaPack.name} + ${hostPack.name}`);
