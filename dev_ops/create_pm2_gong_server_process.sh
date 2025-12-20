#!/bin/bash

USER=$1
USER_PASS=$2
IS_DOCKER=${3:-false}

set +o verbose
cd "/home/${USER}/projects/gong_server"

export HISTIGNORE='*sudo -S*'

# Detect pm2 and pm2-runtime paths (needed for sudo commands which reset PATH)
PM2_PATH=$(command -v pm2 || which pm2 || find ~/.nvm -name pm2 2>/dev/null | head -1 || echo "pm2")
PM2_RUNTIME_PATH=$(command -v pm2-runtime || which pm2-runtime || find ~/.nvm -name pm2-runtime 2>/dev/null | head -1 || echo "pm2-runtime")

# If pm2 is not in standard location, try to source nvm
if [[ "$PM2_PATH" == "pm2" ]] && [ -s "$HOME/.nvm/nvm.sh" ]; then
  export NVM_DIR="$HOME/.nvm"
  [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
  PM2_PATH=$(command -v pm2 || which pm2 || echo "pm2")
  PM2_RUNTIME_PATH=$(command -v pm2-runtime || which pm2-runtime || echo "pm2-runtime")
fi

# Extract directory containing pm2 to ensure node is in PATH
if [[ "$PM2_PATH" != "pm2" ]] && [ -f "$PM2_PATH" ]; then
  PM2_DIR=$(dirname "${PM2_PATH}")
else
  PM2_DIR=""
fi

# Clear any existing pm2 processes to avoid conflicts
if [[ "$PM2_PATH" != "pm2" ]] && [ -f "$PM2_PATH" ]; then
  sudo -S env "PATH=${PM2_DIR}:$PATH" "USER=${USER}" "${PM2_PATH}" delete all 2>/dev/null || true <<<"${USER_PASS}"
  sudo -S env "PATH=${PM2_DIR}:$PATH" "USER=${USER}" "${PM2_PATH}" kill 2>/dev/null || true <<<"${USER_PASS}"
else
  sudo -S env "PATH=$PATH" "USER=${USER}" pm2 delete all 2>/dev/null || true <<<"${USER_PASS}"
  sudo -S env "PATH=$PATH" "USER=${USER}" pm2 kill 2>/dev/null || true <<<"${USER_PASS}"
fi

if [ "${IS_DOCKER}" != "true" ]; then
  # Use absolute path to pm2 with sudo and ensure node is in PATH
  if [[ "$PM2_PATH" != "pm2" ]] && [ -f "$PM2_PATH" ]; then
    sudo -S env "PATH=${PM2_DIR}:$PATH" "USER=${USER}" "${PM2_PATH}" start "/home/${USER}/projects/gong_dev_ops/dev_ops/ecosystem.config.js" <<<"${USER_PASS}"
  else
    sudo -S env "PATH=$PATH" "USER=${USER}" pm2 start "/home/${USER}/projects/gong_dev_ops/dev_ops/ecosystem.config.js" <<<"${USER_PASS}"
  fi
else
  # This is relevant only when used in docker env
  if [[ "$PM2_RUNTIME_PATH" != "pm2-runtime" ]] && [ -f "$PM2_RUNTIME_PATH" ]; then
    sudo -S env "PATH=${PM2_DIR}:$PATH" "USER=${USER}" "${PM2_RUNTIME_PATH}" "/home/${USER}/projects/gong_dev_ops/dev_ops/ecosystem.config.js" <<<"${USER_PASS}"
  else
    sudo -S env "PATH=$PATH" "USER=${USER}" pm2-runtime "/home/${USER}/projects/gong_dev_ops/dev_ops/ecosystem.config.js" <<<"${USER_PASS}"
  fi
fi

# run
#   pm2 startup -u root --hp /home/dhamma/projects/gong_server/
# to get the needed sudo command to run like this :
# Use detected pm2 path for startup command
if [[ "$PM2_PATH" != "pm2" ]] && [ -f "$PM2_PATH" ]; then
  sudo -S env "PATH=${PM2_DIR}:$PATH" "USER=${USER}" "${PM2_PATH}" startup upstart -u root --hp "/home/${USER}" <<<"${USER_PASS}"
else
  sudo -S env "PATH=$PATH" "USER=${USER}" pm2 startup upstart -u root --hp "/home/${USER}" <<<"${USER_PASS}"
fi

# Save pm2 configuration
if [[ "$PM2_PATH" != "pm2" ]] && [ -f "$PM2_PATH" ]; then
  sudo -S env "PATH=${PM2_DIR}:$PATH" "USER=${USER}" "${PM2_PATH}" save <<< "${USER_PASS}"
else
  sudo -S env "PATH=$PATH" "USER=${USER}" pm2 save <<< "${USER_PASS}"
fi

# Note: The pm2-runtime startup command on line 25 was likely a mistake/leftover
# It's commented out as it doesn't make sense to run startup with pm2-runtime
# If needed for docker, it should be handled differently
