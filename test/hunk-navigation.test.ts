import { describe, expect, test } from "bun:test";
import { findNextHunkCursor, type HunkCursor } from "../src/ui/lib/hunks";

describe("hunk navigation", () => {
  const cursors: HunkCursor[] = [
    { fileId: "alpha", hunkIndex: 0 },
    { fileId: "alpha", hunkIndex: 1 },
    { fileId: "beta", hunkIndex: 0 },
  ];

  test("moves forward across hunk and file boundaries", () => {
    expect(findNextHunkCursor(cursors, "alpha", 0, 1)).toEqual({ fileId: "alpha", hunkIndex: 1 });
    expect(findNextHunkCursor(cursors, "alpha", 1, 1)).toEqual({ fileId: "beta", hunkIndex: 0 });
  });

  test("moves backward across file boundaries", () => {
    expect(findNextHunkCursor(cursors, "beta", 0, -1)).toEqual({ fileId: "alpha", hunkIndex: 1 });
    expect(findNextHunkCursor(cursors, "alpha", 1, -1)).toEqual({ fileId: "alpha", hunkIndex: 0 });
  });

  test("clamps at the ends of the review stream", () => {
    expect(findNextHunkCursor(cursors, "alpha", 0, -1)).toEqual({ fileId: "alpha", hunkIndex: 0 });
    expect(findNextHunkCursor(cursors, "beta", 0, 1)).toEqual({ fileId: "beta", hunkIndex: 0 });
  });

  test("starts at the nearest stream edge when no current hunk is selected", () => {
    expect(findNextHunkCursor(cursors, undefined, 0, 1)).toEqual({ fileId: "alpha", hunkIndex: 0 });
    expect(findNextHunkCursor(cursors, undefined, 0, -1)).toEqual({ fileId: "beta", hunkIndex: 0 });
  });
});
