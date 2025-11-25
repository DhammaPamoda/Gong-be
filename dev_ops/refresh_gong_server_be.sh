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
