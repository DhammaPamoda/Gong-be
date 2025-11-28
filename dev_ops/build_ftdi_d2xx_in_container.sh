#!/bin/bash

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FTDI_DIR="${PROJECT_ROOT}/node_modules/ftdi-d2xx"
BINARY_PATH="${FTDI_DIR}/build/Release/ftdi-d2xx.Linux.x86_64.node"

# Detect container environment ( /.dockerenv or cgroup contains docker )
if [ ! -f "/.dockerenv" ] && ! grep -qa 'docker\|containerd' /proc/1/cgroup 2>/dev/null; then
  echo "[ftdi-d2xx] Not running inside a container. Skipping in-container build."
  exit 0
fi

if [ ! -d "${FTDI_DIR}" ]; then
  echo "[ftdi-d2xx] Package directory not found. Skipping build."
  exit 0
fi

if NODE_PATH="${PROJECT_ROOT}/node_modules" node -e "require('ftdi-d2xx');" >/dev/null 2>&1; then
  echo "[ftdi-d2xx] Module loads successfully. No rebuild needed."
  exit 0
fi

echo "[ftdi-d2xx] Building native binary inside container..."

cd "${FTDI_DIR}"

# Ensure dependencies installed
npm install

# Build release binary
npm run cmake:rebuild-release

if [ -f "${BINARY_PATH}" ]; then
  chmod 755 "${BINARY_PATH}"
  echo "[ftdi-d2xx] Build completed: ${BINARY_PATH}"
else
  echo "[ftdi-d2xx] ERROR: Build finished but binary not found." >&2
  exit 1
fi
