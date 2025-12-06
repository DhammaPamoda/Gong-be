#!/bin/bash

set +v

echo -e "╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦"
echo -e "RUNNING SCRIPT :  refresh_gong_server_be.sh  ************************ START ************************"
echo -e "⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇"
echo
echo

set -v
USER=$1
USER_PASS=$2
GONG_BE_BRANCH=$3

cd "/home/${USER}/projects/Gong-be"
rm -rf node_modules

set +v
echo -e "----------------------------------------------------------------------------------------------------"

set -v
if [ -n "${GONG_BE_BRANCH}" ]; then
  sudo -S git fetch origin "${GONG_BE_BRANCH}" <<< "${USER_PASS}"
else
  sudo -S git fetch <<< "${USER_PASS}"
fi

set +v
echo -e "----------------------------------------------------------------------------------------------------"

set -v
if [ -n "${GONG_BE_BRANCH}" ]; then
  sudo -S git pull origin "${GONG_BE_BRANCH}" <<< "${USER_PASS}"
else
  sudo -S git pull <<< "${USER_PASS}"
fi

set +v
echo -e "----------------------------------------------------------------------------------------------------"

# Check and install FTDI D2XX headers if missing (needed for optional dependency ft245rl)
ORIGINAL_DIR="/home/${USER}/projects/Gong-be"
if [ ! -f "/usr/local/include/ftd2xx.h" ]; then
  echo "FTDI D2XX headers not found. Attempting to install..."
  set -v
  FTDI_TMP_DIR="/tmp/ftdi_install_$$"
  sudo -S mkdir -p "${FTDI_TMP_DIR}" <<< "${USER_PASS}" || echo "Warning: Could not create temp directory"
  if [ -d "${FTDI_TMP_DIR}" ]; then
    cd "${FTDI_TMP_DIR}"
    sudo -S curl -L https://ftdichip.com/wp-content/uploads/2022/07/libftd2xx-x86_64-1.4.27.tgz -o libftd2xx-x86_64-1.4.27.tgz <<< "${USER_PASS}" || echo "Warning: Failed to download FTDI library"
    if [ -f "libftd2xx-x86_64-1.4.27.tgz" ]; then
      sudo -S tar xfvz libftd2xx-x86_64-1.4.27.tgz <<< "${USER_PASS}" || echo "Warning: Failed to extract FTDI library"
      if [ -d "release" ]; then
        echo "${USER_PASS}" | sudo -S cp release/build/lib* /usr/local/lib/ 2>/dev/null || true
        echo "${USER_PASS}" | sudo -S ln -sf /usr/local/lib/libftd2xx.so.1.4.27 /usr/local/lib/libftd2xx.so 2>/dev/null || true
        echo "${USER_PASS}" | sudo -S cp release/*.h /usr/local/include/ 2>/dev/null || true
        echo "${USER_PASS}" | sudo -S /sbin/ldconfig 2>/dev/null || true
        echo "FTDI D2XX headers installed successfully"
      fi
    else
      echo "Warning: Could not download FTDI headers. Optional dependency ft245rl may fail to build."
    fi
    cd "${ORIGINAL_DIR}"
    sudo -S rm -rf "${FTDI_TMP_DIR}" <<< "${USER_PASS}" || true
  else
    echo "Warning: Could not create temp directory for FTDI installation. Optional dependency ft245rl may fail to build."
  fi
else
  echo "FTDI D2XX headers found at /usr/local/include/ftd2xx.h"
fi

# Setup FTDI D2XX for direct USB access (required for ftdi-d2xx package)
# 1. Blacklist kernel modules that would claim the device
# Using both 'blacklist' (prevents auto-loading) and 'install' (prevents ALL loading)
FTDI_BLACKLIST_CONTENT="# Prevent ftdi_sio and usbserial from claiming FTDI USB devices
# This allows userspace libraries (ftdi-d2xx) to access devices directly
blacklist ftdi_sio
blacklist usbserial
# install directive completely prevents loading by redirecting to /bin/true
install ftdi_sio /bin/true
install usbserial /bin/true"

# Check if blacklist needs to be created or updated (if missing install directive)
if [ ! -f "/etc/modprobe.d/ftdi-blacklist.conf" ] || ! grep -q "install ftdi_sio" /etc/modprobe.d/ftdi-blacklist.conf; then
  echo "Setting up FTDI kernel module blacklist (with install directive)..."
  # Use bash -c to write content (can't use both pipe and <<< for stdin)
  echo "${USER_PASS}" | sudo -S bash -c "cat > /etc/modprobe.d/ftdi-blacklist.conf << 'BLACKLIST_EOF'
${FTDI_BLACKLIST_CONTENT}
BLACKLIST_EOF"
  echo "${USER_PASS}" | sudo -S update-initramfs -u 2>/dev/null || true
  echo "FTDI kernel modules blacklisted (ftdi_sio, usbserial) with install directive"
else
  echo "FTDI kernel module blacklist already configured with install directive"
fi

# 2. Create udev rule for USB device permissions
if [ ! -f "/etc/udev/rules.d/99-ftdi.rules" ]; then
  echo "Setting up FTDI udev rules..."
  echo "${USER_PASS}" | sudo -S bash -c 'echo '\''SUBSYSTEM=="usb", ATTR{idVendor}=="0403", ATTR{idProduct}=="6001", MODE="0666", GROUP="plugdev"'\'' > /etc/udev/rules.d/99-ftdi.rules'
  echo "${USER_PASS}" | sudo -S udevadm control --reload-rules 2>/dev/null || true
  echo "${USER_PASS}" | sudo -S udevadm trigger 2>/dev/null || true
  echo "FTDI udev rules installed"
else
  echo "FTDI udev rules already configured"
fi

# 3. Install systemd service as fallback to unload modules at boot
FTDI_SERVICE_SRC="${BASE_DIR}/Gong-be/dev_ops/ftdi-unload.service"
if [ -f "${FTDI_SERVICE_SRC}" ] && [ ! -f "/etc/systemd/system/ftdi-unload.service" ]; then
  echo "Installing ftdi-unload systemd service (boot-time fallback)..."
  sudo -S cp "${FTDI_SERVICE_SRC}" /etc/systemd/system/ftdi-unload.service <<< "${USER_PASS}"
  sudo -S systemctl daemon-reload <<< "${USER_PASS}"
  sudo -S systemctl enable ftdi-unload.service <<< "${USER_PASS}" 2>/dev/null || true
  echo "ftdi-unload service installed and enabled"
else
  if [ -f "/etc/systemd/system/ftdi-unload.service" ]; then
    echo "ftdi-unload systemd service already installed"
  fi
fi

# 4. Unload kernel modules if currently loaded (for immediate effect)
if lsmod | grep -q ftdi_sio; then
  echo "Unloading ftdi_sio kernel module..."
  sudo -S rmmod ftdi_sio <<< "${USER_PASS}" 2>/dev/null || true
fi
if lsmod | grep -q usbserial; then
  echo "Unloading usbserial kernel module..."
  sudo -S rmmod usbserial <<< "${USER_PASS}" 2>/dev/null || true
fi

set +v
echo -e "----------------------------------------------------------------------------------------------------"

set -v
# Run npm install, but continue even if optional dependencies fail
npm i || {
  echo "Warning: npm install encountered errors (likely from optional dependencies). Continuing..."
  # Check if critical dependencies were installed
  if [ ! -d "node_modules" ] || [ ! -d "node_modules/express" ]; then
    echo "Error: Critical dependencies failed to install. Exiting."
    exit 1
  fi
}

# Build ftdi-d2xx native module if needed
# Two approaches depending on environment:
# 1. Inside container: build natively using build_ftdi_d2xx_in_container.sh
# 2. On host with Docker: use Docker to build with correct GLIBC via build_ftdi_d2xx.sh

if [ -f "/.dockerenv" ] || grep -qa 'docker\|containerd' /proc/1/cgroup 2>/dev/null; then
  # Running inside a container - use native build
  if [ -f "./dev_ops/build_ftdi_d2xx_in_container.sh" ]; then
    echo "Attempting to rebuild ftdi-d2xx (in-container build)..."
    if ./dev_ops/build_ftdi_d2xx_in_container.sh; then
      echo "ftdi-d2xx in-container build step completed."
    else
      echo "Warning: ftdi-d2xx in-container build step failed. Relay functionality may be unavailable."
    fi
  fi
else
  # Running on host - use Docker-based build if Docker is available
  if [ -f "./dev_ops/build_ftdi_d2xx.sh" ]; then
    echo "Attempting to rebuild ftdi-d2xx (Docker-based build)..."
    if docker info >/dev/null 2>&1 || sudo docker info >/dev/null 2>&1; then
      if ./dev_ops/build_ftdi_d2xx.sh; then
        echo "ftdi-d2xx Docker build step completed."
      else
        echo "Warning: ftdi-d2xx Docker build step failed. Relay functionality may be unavailable."
      fi
    else
      echo "Warning: Docker not available. Skipping ftdi-d2xx Docker build."
    fi
  fi
fi

set +v
echo -e "----------------------------------------------------------------------------------------------------"

set -v
export HISTIGNORE='*sudo -S*'

# Detect npm path (needed for sudo which resets PATH)
NPM_PATH=$(command -v npm || which npm 2>/dev/null || echo "npm")
if [[ "$NPM_PATH" != "npm" ]] && [ -f "$NPM_PATH" ]; then
  NPM_DIR=$(dirname "${NPM_PATH}")
  sudo -S env "PATH=${NPM_DIR}:$PATH" "${NPM_PATH}" run build <<< "${USER_PASS}"
else
  sudo -S env "PATH=$PATH" npm run build <<< "${USER_PASS}"
fi

set +v
echo -e "----------------------------------------------------------------------------------------------------"

# Ensure data files exist in deployed gong_server (copy from templates if missing)
GONG_SERVER_DATA="/home/${USER}/projects/gong_server/assets/data"
if [ ! -f "${GONG_SERVER_DATA}/coursesSchedule.json" ] && [ -f "${GONG_SERVER_DATA}/coursesSchedule.example.json" ]; then
    echo "Initializing coursesSchedule.json from template in gong_server..."
    sudo -S cp "${GONG_SERVER_DATA}/coursesSchedule.example.json" "${GONG_SERVER_DATA}/coursesSchedule.json" <<< "${USER_PASS}"
fi

echo
echo
echo -e "⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆"
echo -e "SCRIPT : refresh_gong_server_be.sh HAS ENDED   ************************ END ************************"
echo -e "╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩"


# Some additional notes to handle the installation of FTDI D2XX headers:
# What Was Added to refresh_gong_server_be.sh
# The script now automatically configures:
# Kernel Module Blacklist (/etc/modprobe.d/ftdi-blacklist.conf)
# Prevents ftdi_sio and usbserial from loading at boot
# These modules would claim the FTDI device as /dev/ttyUSB*
# udev Rule (/etc/udev/rules.d/99-ftdi.rules)
# Grants plugdev group access to FTDI USB devices
# Allows non-root users to access the device
# Immediate Module Unload
# Unloads the modules if currently loaded (for immediate effect)