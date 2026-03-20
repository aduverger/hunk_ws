#!/usr/bin/env bash
set -Eeuo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
outdir="${repo_root}/dist/npm"

rm -rf "${outdir}"
mkdir -p "${outdir}"

BUN_TMPDIR="${repo_root}/.bun-tmp" \
BUN_INSTALL="${repo_root}/.bun-install" \
  bun build "${repo_root}/src/main.tsx" \
    --target bun \
    --format esm \
    --outdir "${outdir}" \
    --entry-naming main.js

chmod 0755 "${outdir}/main.js"

printf 'Built %s\n' "${outdir}/main.js"
