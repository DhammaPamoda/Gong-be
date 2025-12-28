#!/bin/bash

USER=$1
USER_PASS=$2
IS_DOCKER=${3:-false}

# Port used by gong_server (from config/production.json)
GONG_PORT=3000

set +v
echo -e "╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦"
echo -e "RUNNING SCRIPT :  server_start.sh      ************************    START    ************************"
echo -e "⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇"
echo
echo


echo -e "----------------------------------------------------------------------------------------------------"
echo "Pre-start port check for port ${GONG_PORT}..."

export HISTIGNORE='*sudo -S*'

# Safety check: ensure port is free before starting
PORT_PIDS=$(sudo -S lsof -ti :${GONG_PORT} <<< "${USER_PASS}" 2>/dev/null)
if [ -n "$PORT_PIDS" ]; then
  echo "⚠️  Port ${GONG_PORT} is still occupied by: $PORT_PIDS"
  echo "Force killing these processes..."
  echo "$PORT_PIDS" | xargs -r sudo -S kill -9 <<< "${USER_PASS}" 2>/dev/null || true
  sleep 2
  
  # Final check
  PORT_PIDS=$(sudo -S lsof -ti :${GONG_PORT} <<< "${USER_PASS}" 2>/dev/null)
  if [ -n "$PORT_PIDS" ]; then
    echo "❌ ERROR: Cannot free port ${GONG_PORT}. Aborting start!"
    exit 1
  fi
fi
echo "✅ Port ${GONG_PORT} is available"

echo -e "----------------------------------------------------------------------------------------------------"

set -v
/home/"${USER}"/projects/gong_dev_ops/dev_ops/restore_files.sh "${USER}" "${USER_PASS}" "${IS_DOCKER}"

set +v
echo -e "----------------------------------------------------------------------------------------------------"

set -v
if [ "${IS_DOCKER}" != "true" ]; then
  sudo -S pm2 start gong_server <<< "${USER_PASS}"
else
  sudo -S pm2-runtime start gong_server <<< "${USER_PASS}"
fi

set +v
echo -e "----------------------------------------------------------------------------------------------------"


echo
echo
echo -e "⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆"
echo -e "SCRIPT  :  server_start.sh HAS ENDED     ************************    END    ************************"
echo -e "╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩"
