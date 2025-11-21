#!/bin/bash


set +v
echo -e "╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦"
echo -e "RUNNING SCRIPT : refresh_gong_server_fe.sh   ************************ START ************************"
echo -e "⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇"
echo
echo

set -v
USER=$1
USER_PASS=$2
GONG_FE_BRANCH=$3

# Detect npm and node paths (needed for sudo commands which reset PATH)
NPM_PATH=$(command -v npm || which npm || find ~/.nvm -name npm 2>/dev/null | head -1 || echo "npm")
NODE_PATH=$(command -v node || which node || find ~/.nvm -name node 2>/dev/null | head -1 || echo "node")

# If npm is not in standard location, try to source nvm
if [[ "$NPM_PATH" == "npm" ]] && [ -s "$HOME/.nvm/nvm.sh" ]; then
  export NVM_DIR="$HOME/.nvm"
  [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
  NPM_PATH=$(command -v npm || which npm || echo "npm")
  NODE_PATH=$(command -v node || which node || echo "node")
fi

cd "/home/${USER}/projects/Gong_fe"
rm -rf node_modules

set +v
echo -e "----------------------------------------------------------------------------------------------------"

set -v
if [ -n "${GONG_FE_BRANCH}" ]; then
  sudo -S git fetch origin "${GONG_FE_BRANCH}" <<< "${USER_PASS}"
else
  sudo -S git fetch <<< "${USER_PASS}"
fi

set +v
echo -e "----------------------------------------------------------------------------------------------------"

set -v
if [ -n "${GONG_FE_BRANCH}" ]; then
  sudo -S git pull origin "${GONG_FE_BRANCH}" <<< "${USER_PASS}"
else
  sudo -S git pull <<< "${USER_PASS}"
fi

set +v
echo -e "----------------------------------------------------------------------------------------------------"

set -v
npm i

set +v
echo -e "----------------------------------------------------------------------------------------------------"

set -v
echo "Node version: $(${NODE_PATH} -v)"
# Use full path to npm with sudo (sudo resets PATH, so we need absolute path)
# Ensure node bin directory is in PATH for npm to find node
if [[ "$NPM_PATH" != "npm" ]] && [ -f "$NPM_PATH" ]; then
  # Extract directory containing npm and ensure it's in PATH
  NPM_DIR=$(dirname "${NPM_PATH}")
  # Use absolute path to npm and ensure node is in PATH
  sudo -S env "PATH=${NPM_DIR}:$PATH" "${NPM_PATH}" run build-to-prod <<< "${USER_PASS}"
else
  # Fallback: preserve PATH and hope npm is in system PATH
  sudo -S env "PATH=$PATH" npm run build-to-prod <<< "${USER_PASS}"
fi

set +v
echo -e "----------------------------------------------------------------------------------------------------"

echo
echo
echo -e "⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆"
echo -e "SCRIPT : refresh_gong_server_fe.sh HAS ENDED    ************************ END ***********************"
echo -e "╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩"
