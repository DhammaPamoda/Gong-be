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

# ==========================================
# Cache Configuration
# ==========================================
CACHE_DIR="/home/${USER}/.cache/gong"
FE_CACHE_FILE="${CACHE_DIR}/fe_last_build_commit"
FE_DIST_CACHE="${CACHE_DIR}/fe_dist"
GONG_SERVER_DIST="/home/${USER}/projects/gong_server/dist"
mkdir -p "${CACHE_DIR}"

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

# ==========================================
# Cache Check: Skip build if no changes
# ==========================================
CURRENT_COMMIT=$(git rev-parse HEAD)
CACHED_COMMIT=""
if [ -f "${FE_CACHE_FILE}" ]; then
  CACHED_COMMIT=$(cat "${FE_CACHE_FILE}")
fi

echo "Current FE commit: ${CURRENT_COMMIT}"
echo "Cached FE commit:  ${CACHED_COMMIT:-none}"

if [ "${CURRENT_COMMIT}" = "${CACHED_COMMIT}" ] && [ -d "${FE_DIST_CACHE}" ]; then
  echo ">>> Frontend unchanged since last build. Skipping build-to-prod..."
  echo ">>> To force rebuild, delete: ${FE_CACHE_FILE}"
  
  # Copy cached dist to gong_server
  echo ">>> Copying cached frontend dist to gong_server..."
  rm -rf "${GONG_SERVER_DIST}"
  cp -r "${FE_DIST_CACHE}" "${GONG_SERVER_DIST}"
  echo ">>> Frontend restored from cache to: ${GONG_SERVER_DIST}"
else
  echo ">>> Frontend has changes or cache missing. Running full build..."
  
  set -v
  rm -rf node_modules
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
  
  # Copy built dist to cache
  FE_BUILD_DIST="/home/${USER}/projects/Gong_fe/dist/gong"
  if [ -d "${FE_BUILD_DIST}" ]; then
    echo ">>> Caching frontend dist..."
    rm -rf "${FE_DIST_CACHE}"
    cp -r "${FE_BUILD_DIST}" "${FE_DIST_CACHE}"
    echo ">>> Frontend cached to: ${FE_DIST_CACHE}"
    
    # Copy to gong_server
    echo ">>> Copying frontend dist to gong_server..."
    rm -rf "${GONG_SERVER_DIST}"
    cp -r "${FE_BUILD_DIST}" "${GONG_SERVER_DIST}"
    echo ">>> Frontend deployed to: ${GONG_SERVER_DIST}"
  else
    echo ">>> ERROR: Frontend build output not found at ${FE_BUILD_DIST}"
    exit 1
  fi
  
  # Update commit cache after successful build
  echo "${CURRENT_COMMIT}" > "${FE_CACHE_FILE}"
  echo ">>> Commit cache updated: ${FE_CACHE_FILE}"
fi

set +v
echo -e "----------------------------------------------------------------------------------------------------"

echo
echo
echo -e "⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆"
echo -e "SCRIPT : refresh_gong_server_fe.sh HAS ENDED    ************************ END ***********************"
echo -e "╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩"
