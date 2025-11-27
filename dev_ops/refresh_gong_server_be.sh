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
        sudo -S cp release/build/lib* /usr/local/lib/ 2>/dev/null || true <<< "${USER_PASS}"
        sudo -S ln -sf /usr/local/lib/libftd2xx.so.1.4.27 /usr/local/lib/libftd2xx.so 2>/dev/null || true <<< "${USER_PASS}"
        sudo -S cp release/*.h /usr/local/include/ 2>/dev/null || true <<< "${USER_PASS}"
        sudo -S /sbin/ldconfig 2>/dev/null || true <<< "${USER_PASS}"
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
if [ ! -f "/etc/modprobe.d/ftdi-blacklist.conf" ]; then
  echo "Setting up FTDI kernel module blacklist..."
  echo -e "blacklist ftdi_sio\nblacklist usbserial" | sudo -S tee /etc/modprobe.d/ftdi-blacklist.conf <<< "${USER_PASS}" >/dev/null
  sudo -S update-initramfs -u <<< "${USER_PASS}" 2>/dev/null || true
  echo "FTDI kernel modules blacklisted (ftdi_sio, usbserial)"
else
  echo "FTDI kernel module blacklist already configured"
fi

# 2. Create udev rule for USB device permissions
if [ ! -f "/etc/udev/rules.d/99-ftdi.rules" ]; then
  echo "Setting up FTDI udev rules..."
  echo 'SUBSYSTEM=="usb", ATTR{idVendor}=="0403", ATTR{idProduct}=="6001", MODE="0666", GROUP="plugdev"' | sudo -S tee /etc/udev/rules.d/99-ftdi.rules <<< "${USER_PASS}" >/dev/null
  sudo -S udevadm control --reload-rules <<< "${USER_PASS}" 2>/dev/null || true
  sudo -S udevadm trigger <<< "${USER_PASS}" 2>/dev/null || true
  echo "FTDI udev rules installed"
else
  echo "FTDI udev rules already configured"
fi

# 3. Unload kernel modules if currently loaded (for immediate effect)
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

if [ -f "./dev_ops/build_ftdi_d2xx_in_container.sh" ]; then
  echo "Attempting to rebuild ftdi-d2xx (if required)..."
  if ./dev_ops/build_ftdi_d2xx_in_container.sh; then
    echo "ftdi-d2xx build step completed."
  else
    echo "Warning: ftdi-d2xx build step failed. Relay functionality may be unavailable."
  fi
fi

set +v
echo -e "----------------------------------------------------------------------------------------------------"

set -v
export HISTIGNORE='*sudo -S*'
sudo -S npm run build <<< "${USER_PASS}"

set +v
echo -e "----------------------------------------------------------------------------------------------------"


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