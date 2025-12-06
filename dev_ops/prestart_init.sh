#!/bin/bash

# Pre-start initialization script for Gong backend
# Runs before server startup to ensure environment is ready
#
# Tasks:
#   1. Unload kernel FTDI drivers (for direct device access)
#   2. Initialize data files from templates (for new environments)
#   3. Ensure ftdi-d2xx binary is in place (uses cached binary if available)

# ==========================================
# FTDI Status Logging Setup
# ==========================================
FTDI_LOG_DIR="${HOME}/.local/share/gong/logs"
FTDI_LOG_FILE="${FTDI_LOG_DIR}/ftdi_status.log"
mkdir -p "${FTDI_LOG_DIR}"

# Function to log FTDI status with timestamp
log_ftdi_status() {
    local status="$1"
    local details="$2"
    local timestamp
    timestamp=$(date "+%Y-%m-%d %H:%M:%S")
    echo "${timestamp} | ${status} | ${details}" >> "${FTDI_LOG_FILE}"
}

# ==========================================
# Unload kernel FTDI drivers
# ==========================================
# The ftdi_sio kernel module claims FTDI devices, preventing direct access
# NOTE: If the blacklist in /etc/modprobe.d/ftdi-blacklist.conf is working correctly,
#       these modules should NOT be loaded. If they are, it indicates a configuration issue.

if lsmod | grep -q "ftdi_sio"; then
    echo "WARNING: ftdi_sio module is loaded despite blacklist!"
    echo "  This may indicate the blacklist in /etc/modprobe.d/ftdi-blacklist.conf is not working."
    echo "  Consider running: sudo update-initramfs -u && sudo reboot"
    echo "Attempting to unload ftdi_sio kernel module..."
    log_ftdi_status "BLACKLIST_FAILED" "ftdi_sio module was loaded despite blacklist - attempting unload"
    
    if sudo rmmod ftdi_sio 2>/dev/null; then
        echo "Successfully unloaded ftdi_sio module."
        log_ftdi_status "UNLOAD_SUCCESS" "ftdi_sio module unloaded successfully"
    else
        echo "ERROR: Could not unload ftdi_sio (may need sudo privileges). Relay may be inaccessible!"
        log_ftdi_status "UNLOAD_FAILED" "Could not unload ftdi_sio - relay may be inaccessible"
    fi
else
    log_ftdi_status "BLACKLIST_OK" "ftdi_sio module not loaded - blacklist working correctly"
fi

if lsmod | grep -q "usbserial"; then
    echo "Note: usbserial module is loaded, attempting to unload..."
    if sudo rmmod usbserial 2>/dev/null; then
        log_ftdi_status "UNLOAD_SUCCESS" "usbserial module unloaded successfully"
    else
        log_ftdi_status "UNLOAD_FAILED" "Could not unload usbserial"
    fi
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GONG_BE_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

# ==========================================
# XDG Data Directory Setup
# ==========================================
# Application data is stored in ~/.local/share/gong/ following XDG Base Directory Specification
# This avoids permission issues when deploying with sudo

XDG_DATA_HOME="${XDG_DATA_HOME:-${HOME}/.local/share}"
GONG_DATA_DIR="${XDG_DATA_HOME}/gong"

# Create XDG data directory if it doesn't exist
if [ ! -d "${GONG_DATA_DIR}" ]; then
    echo "Creating Gong data directory: ${GONG_DATA_DIR}"
    mkdir -p "${GONG_DATA_DIR}"
fi

# Initialize dynamic data files if they don't exist
# These files are writable by the application at runtime
init_data_file() {
    local filename="$1"
    local default_content="$2"
    local filepath="${GONG_DATA_DIR}/${filename}"
    
    if [ ! -f "${filepath}" ]; then
        echo "Initializing ${filename}..."
        echo "${default_content}" > "${filepath}"
    fi
}

init_data_file "coursesSchedule.json" "[]"
init_data_file "archivedCoursesSchedule.json" "[]"
init_data_file "manualGong.json" "[]"
init_data_file "obsoleteManualGong.json" "[]"

echo "Gong data directory ready: ${GONG_DATA_DIR}"

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

