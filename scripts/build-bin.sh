#!/usr/bin/env bash
set -Eeuo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
dist_dir="${repo_root}/dist"
outfile="${dist_dir}/hunk"
legacy_outfile="${dist_dir}/otdiff"

mkdir -p "${dist_dir}"
rm -f "${legacy_outfile}"

BUN_TMPDIR="${repo_root}/.bun-tmp" \
BUN_INSTALL="${repo_root}/.bun-install" \
bun build --compile "${repo_root}/src/main.tsx" --outfile "${outfile}"

printf 'Built %s\n' "${outfile}"
