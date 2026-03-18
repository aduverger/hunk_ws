export function fileRowId(fileId: string) {
  return `file-row:${fileId}`;
}

export function diffSectionId(fileId: string) {
  return `diff-section:${fileId}`;
}

export function diffHunkId(fileId: string, hunkIndex: number) {
  return `diff-hunk:${fileId}:${hunkIndex}`;
}
