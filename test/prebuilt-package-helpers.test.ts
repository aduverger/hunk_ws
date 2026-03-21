import { describe, expect, test } from "bun:test";
import {
  PLATFORM_PACKAGE_MATRIX,
  binaryFilenameForSpec,
  buildOptionalDependencyMap,
  getPlatformPackageSpecByName,
  sortPlatformPackageSpecs,
} from "../scripts/prebuilt-package-helpers";

describe("prebuilt package helpers", () => {
  test("buildOptionalDependencyMap includes every supported platform package at one version", () => {
    const version = "9.9.9";
    const dependencies = buildOptionalDependencyMap(version);

    expect(Object.keys(dependencies).sort()).toEqual(PLATFORM_PACKAGE_MATRIX.map((spec) => spec.packageName).sort());
    expect(new Set(Object.values(dependencies))).toEqual(new Set([version]));
  });

  test("binaryFilenameForSpec keeps unix package binaries extensionless", () => {
    for (const spec of PLATFORM_PACKAGE_MATRIX) {
      expect(binaryFilenameForSpec(spec)).toBe("hunk");
    }
  });

  test("getPlatformPackageSpecByName returns known package specs", () => {
    expect(getPlatformPackageSpecByName("hunkdiff-linux-x64")?.cpu).toBe("x64");
    expect(getPlatformPackageSpecByName("hunkdiff-darwin-arm64")?.os).toBe("darwin");
    expect(getPlatformPackageSpecByName("hunkdiff-does-not-exist")).toBeUndefined();
  });

  test("sortPlatformPackageSpecs keeps package publish order stable", () => {
    const reversed = [...PLATFORM_PACKAGE_MATRIX].reverse();
    expect(sortPlatformPackageSpecs(reversed).map((spec) => spec.packageName)).toEqual([
      "hunkdiff-darwin-arm64",
      "hunkdiff-darwin-x64",
      "hunkdiff-linux-x64",
    ]);
  });
});
