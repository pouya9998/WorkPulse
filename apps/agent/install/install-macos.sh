#!/usr/bin/env bash
# WorkPulse desktop agent installer (macOS amd64 / arm64)
set -euo pipefail

API_BASE="${API_BASE:-http://localhost:4000/api}"
API_BASE="${API_BASE%/}"
INSTALL_DIR="${INSTALL_DIR:-${HOME}/.local/bin}"
BIN_NAME="workpulse-agent"
CONFIG_DIR="${HOME}/.workpulse"
INSTALL_SERVICE="${INSTALL_SERVICE:-1}"

ARCH="$(uname -m)"
case "${ARCH}" in
  arm64|aarch64) PLATFORM="macos-arm64" ;;
  x86_64|amd64)  PLATFORM="macos" ;;
  *)
    echo "Unsupported macOS arch: ${ARCH}" >&2
    exit 1
    ;;
esac

DOWNLOAD_URL="${API_BASE}/agent/releases/${PLATFORM}/download"

echo "WorkPulse Agent installer (macOS)"
echo "  API: ${API_BASE}"
echo "  Platform: ${PLATFORM}"
echo "  Install dir: ${INSTALL_DIR}"

tmpdir="$(mktemp -d)"
cleanup() { rm -rf "${tmpdir}"; }
trap cleanup EXIT

echo "Downloading agent..."
curl -fsSL "${DOWNLOAD_URL}" -o "${tmpdir}/${BIN_NAME}"
chmod +x "${tmpdir}/${BIN_NAME}"

mkdir -p "${INSTALL_DIR}" "${CONFIG_DIR}"
install -m 755 "${tmpdir}/${BIN_NAME}" "${INSTALL_DIR}/${BIN_NAME}"

printf '{\n  "apiUrl": "%s"\n}\n' "${API_BASE}" > "${CONFIG_DIR}/defaults.json"
chmod 600 "${CONFIG_DIR}/defaults.json"

case ":${PATH}:" in
  *":${INSTALL_DIR}:"*) ;;
  *)
    echo
    echo "Note: ${INSTALL_DIR} is not on your PATH."
    echo "Add this to your shell profile, then open a new terminal:"
    echo "  export PATH=\"${INSTALL_DIR}:\$PATH\""
    ;;
esac

echo
echo "Installed: ${INSTALL_DIR}/${BIN_NAME}"
"${INSTALL_DIR}/${BIN_NAME}" version || true

if [[ "${INSTALL_SERVICE}" == "1" || "${INSTALL_SERVICE}" == "true" ]]; then
  echo
  echo "Enabling login auto-start..."
  "${INSTALL_DIR}/${BIN_NAME}" service install || echo "Auto-start install skipped (run: workpulse-agent service install)"
fi

echo
echo "Start the agent (it will ask for email and password):"
echo "  ${BIN_NAME}"
echo
echo "Then open WorkPulse → Attendance and use Start/End work in the panel."
