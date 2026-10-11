#!/usr/bin/env bash
# WorkPulse desktop agent installer (Linux amd64)
set -euo pipefail

API_BASE="${API_BASE:-http://localhost:4000/api}"
API_BASE="${API_BASE%/}"
INSTALL_DIR="${INSTALL_DIR:-${HOME}/.local/bin}"
BIN_NAME="workpulse-agent"
DOWNLOAD_URL="${API_BASE}/agent/releases/linux/download"
CONFIG_DIR="${HOME}/.workpulse"
INSTALL_SERVICE="${INSTALL_SERVICE:-1}"

echo "WorkPulse Agent installer"
echo "  API: ${API_BASE}"
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
  echo "Enabling login auto-start (user systemd)..."
  "${INSTALL_DIR}/${BIN_NAME}" service install || echo "Auto-start install skipped (run: workpulse-agent service install)"
fi

echo
echo "Start the agent (it will ask for email and password):"
echo "  ${BIN_NAME}"
echo
echo "Then open WorkPulse → Attendance and use Start/End work in the panel."
