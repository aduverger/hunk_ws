#!/usr/bin/env bash
set -Eeuo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
binary_path="${repo_root}/dist/otdiff"
install_dir="${OTDIFF_INSTALL_DIR:-${HOME}/.local/bin}"
install_path="${install_dir}/otdiff"

if [[ ! -x "${binary_path}" ]]; then
  bash "${repo_root}/scripts/build-bin.sh"
fi

mkdir -p "${install_dir}"
install -m 0755 "${binary_path}" "${install_path}"

printf 'Installed %s\n' "${install_path}"

case ":${PATH}:" in
  *":${install_dir}:"*) ;;
  *)
    printf 'Warning: %s is not on PATH\n' "${install_dir}" >&2
    ;;
esac
