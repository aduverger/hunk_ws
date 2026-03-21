#!/usr/bin/env bun

import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { binaryFilenameForSpec, buildOptionalDependencyMap, getHostPlatformPackageSpec, releaseNpmDir } from "./prebuilt-package-helpers";

type RootPackageJson = {
  name: string;
  version: string;
  description?: string;
  keywords?: string[];
  repository?: unknown;
  homepage?: string;
  bugs?: unknown;
  license?: string;
  engines?: Record<string, string>;
};

const repoRoot = path.resolve(import.meta.dir, "..");
const rootPackage = JSON.parse(await Bun.file(path.join(repoRoot, "package.json")).text()) as RootPackageJson;
const hostSpec = getHostPlatformPackageSpec();
const hostBinaryName = binaryFilenameForSpec(hostSpec);
const compiledBinary = path.join(repoRoot, "dist", "hunk");
const releaseRoot = releaseNpmDir(repoRoot);
const metaDir = path.join(releaseRoot, rootPackage.name);
const hostPackageDir = path.join(releaseRoot, hostSpec.packageName);

if (!existsSync(compiledBinary)) {
  throw new Error(`Missing compiled binary at ${compiledBinary}. Run \`bun run build:bin\` first.`);
}

rmSync(releaseRoot, { recursive: true, force: true });
mkdirSync(releaseRoot, { recursive: true });

mkdirSync(path.join(metaDir, "bin"), { recursive: true });
cpSync(path.join(repoRoot, "bin", "hunk.cjs"), path.join(metaDir, "bin", "hunk.cjs"));
cpSync(path.join(repoRoot, "README.md"), path.join(metaDir, "README.md"));
cpSync(path.join(repoRoot, "LICENSE"), path.join(metaDir, "LICENSE"));

writeFileSync(
  path.join(metaDir, "package.json"),
  JSON.stringify(
    {
      name: rootPackage.name,
      version: rootPackage.version,
      description: rootPackage.description,
      bin: {
        hunk: "./bin/hunk.cjs",
      },
      files: ["bin", "README.md", "LICENSE"],
      keywords: rootPackage.keywords,
      repository: rootPackage.repository,
      homepage: rootPackage.homepage,
      bugs: rootPackage.bugs,
      engines: rootPackage.engines,
      optionalDependencies: buildOptionalDependencyMap(rootPackage.version),
      license: rootPackage.license,
      publishConfig: {
        access: "public",
      },
    },
    null,
    2,
  ) + "\n",
);

mkdirSync(path.join(hostPackageDir, "bin"), { recursive: true });
cpSync(compiledBinary, path.join(hostPackageDir, "bin", hostBinaryName));
cpSync(path.join(repoRoot, "LICENSE"), path.join(hostPackageDir, "LICENSE"));

writeFileSync(
  path.join(hostPackageDir, "package.json"),
  JSON.stringify(
    {
      name: hostSpec.packageName,
      version: rootPackage.version,
      description: `${rootPackage.description} (${hostSpec.os} ${hostSpec.cpu} binary)`,
      os: [hostSpec.os === "windows" ? "win32" : hostSpec.os],
      cpu: [hostSpec.cpu],
      files: ["bin", "LICENSE"],
      bin: {
        hunk: `./bin/${hostBinaryName}`,
      },
      license: rootPackage.license,
      publishConfig: {
        access: "public",
      },
    },
    null,
    2,
  ) + "\n",
);

console.log(`Staged prebuilt npm packages in ${releaseRoot}`);
console.log(`- ${metaDir}`);
console.log(`- ${hostPackageDir}`);
