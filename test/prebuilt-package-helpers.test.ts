import { describe, expect, test } from "bun:test";
import { PLATFORM_PACKAGE_MATRIX, binaryFilenameForSpec, buildOptionalDependencyMap } from "../scripts/prebuilt-package-helpers";

describe("prebuilt package helpers", () => {
  test("buildOptionalDependencyMap includes every supported platform package at one version", () => {
    const version = "9.9.9";
    const dependencies = buildOptionalDependencyMap(version);

    expect(Object.keys(dependencies).sort()).toEqual(PLATFORM_PACKAGE_MATRIX.map((spec) => spec.packageName).sort());
    expect(new Set(Object.values(dependencies))).toEqual(new Set([version]));
  });

  test("binaryFilenameForSpec keeps unix package binaries extensionless", () => {
    expect(binaryFilenameForSpec(PLATFORM_PACKAGE_MATRIX[0]!)).toBe("hunk");
    expect(binaryFilenameForSpec(PLATFORM_PACKAGE_MATRIX[1]!)).toBe("hunk");
    expect(binaryFilenameForSpec(PLATFORM_PACKAGE_MATRIX[2]!)).toBe("hunk");
    expect(binaryFilenameForSpec(PLATFORM_PACKAGE_MATRIX[3]!)).toBe("hunk");
  });
});
