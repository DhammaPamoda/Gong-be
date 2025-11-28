#!/bin/bash

# Pre-start initialization script for Gong backend
# Runs before server startup to ensure environment is ready
#
# Tasks:
#   1. Unload kernel FTDI drivers (for direct device access)
#   2. Initialize data files from templates (for new environments)
#   3. Ensure ftdi-d2xx binary is in place (uses cached binary if available)

# Unload kernel FTDI drivers that interfere with ftdi-d2xx library
# The ftdi_sio kernel module claims FTDI devices, preventing direct access
# This requires sudo - will silently fail if not available (non-fatal)
if lsmod | grep -q "ftdi_sio"; then
    echo "Unloading ftdi_sio kernel module to allow direct FTDI access..."
    sudo rmmod ftdi_sio 2>/dev/null || echo "Note: Could not unload ftdi_sio (may need sudo privileges)"
fi
if lsmod | grep -q "usbserial"; then
    sudo rmmod usbserial 2>/dev/null || true
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GONG_BE_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Ensure data files exist (copy from example templates if missing)
DATA_DIR="${GONG_BE_DIR}/assets/data"
if [ ! -f "${DATA_DIR}/coursesSchedule.json" ] && [ -f "${DATA_DIR}/coursesSchedule.example.json" ]; then
    echo "Initializing coursesSchedule.json from template..."
    cp "${DATA_DIR}/coursesSchedule.example.json" "${DATA_DIR}/coursesSchedule.json"
fi

CACHE_DIR="${HOME}/.cache/ftdi-d2xx"
CACHED_BINARY="${CACHE_DIR}/ftdi-d2xx.Linux.x86_64.node"
TARGET_DIR="${GONG_BE_DIR}/node_modules/ftdi-d2xx/build/Release"
TARGET_BINARY="${TARGET_DIR}/ftdi-d2xx.Linux.x86_64.node"

# Check if ftdi-d2xx package is installed
if [ ! -d "${GONG_BE_DIR}/node_modules/ftdi-d2xx" ]; then
    echo "ftdi-d2xx package not installed - skipping binary setup (optional dependency)"
    exit 0
fi

# Always prefer cached binary (Docker-built for GLIBC compatibility)
# The npm-installed binary may not work due to GLIBC version mismatch
if [ -f "${CACHED_BINARY}" ]; then
    # Check if we need to copy (cache is different from target)
    if [ -f "${TARGET_BINARY}" ]; then
        if cmp -s "${CACHED_BINARY}" "${TARGET_BINARY}"; then
            # Binaries are identical, nothing to do
            exit 0
        fi
    fi
    echo "=========================================="
    echo "Setting up ftdi-d2xx binary from cache..."
    echo "=========================================="
    
    # Ensure target directory exists
    mkdir -p "${TARGET_DIR}"
    
    # Copy from cache
    cp "${CACHED_BINARY}" "${TARGET_BINARY}"
    chmod 755 "${TARGET_BINARY}"
    
    echo "Copied from: ${CACHED_BINARY}"
    echo "Binary ready at: ${TARGET_BINARY}"
    echo "=========================================="
    exit 0
fi

# No cached binary - warn user
echo "=========================================="
echo "WARNING: ftdi-d2xx binary not found!"
echo "=========================================="
echo ""
echo "The ftdi-d2xx native binary is not available."
echo "FTDI relay functionality will not work until built."
echo ""
echo "To build the binary, run:"
echo "  ${SCRIPT_DIR}/build_ftdi_d2xx.sh"
echo ""
echo "The binary will be cached at: ${CACHED_BINARY}"
echo "=========================================="
echo ""
echo "Continuing server startup without FTDI support..."
exit 0

