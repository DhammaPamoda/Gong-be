#!/bin/bash

USER=$1
USER_PASS=$2
IS_DOCKER=${3:-false}

# Port used by gong_server (from config/production.json)
GONG_PORT=3000

set +v

echo -e "╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦"
echo -e "RUNNING SCRIPT :  server_stop.sh       ************************    START    ************************"
echo -e "⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇"
echo
echo

set -v
export HISTIGNORE='*sudo -S*'
if [ "${IS_DOCKER}" != "true" ]; then
  sudo -S pm2 stop gong_server <<< "${USER_PASS}"
else
  sudo -S pm2-runtime stop gong_server <<< "${USER_PASS}"
fi

set +v
echo -e "----------------------------------------------------------------------------------------------------"
echo "Waiting for graceful shutdown (max 12 seconds)..."

# Wait for pm2 process to fully terminate (up to 12 seconds)
for i in {1..12}; do
  if ! sudo -S pm2 pid gong_server <<< "${USER_PASS}" 2>/dev/null | grep -q '[0-9]'; then
    echo "PM2 process terminated after ${i} seconds"
    break
  fi
  sleep 1
done

# Force kill any process still holding the port
echo "Checking for processes holding port ${GONG_PORT}..."
PORT_PIDS=$(sudo -S lsof -ti :${GONG_PORT} <<< "${USER_PASS}" 2>/dev/null)
if [ -n "$PORT_PIDS" ]; then
  echo "⚠️  Found processes holding port ${GONG_PORT}: $PORT_PIDS"
  echo "Sending SIGTERM..."
  echo "$PORT_PIDS" | xargs -r sudo -S kill <<< "${USER_PASS}" 2>/dev/null || true
  sleep 2
  
  # Check again and force kill if still running
  PORT_PIDS=$(sudo -S lsof -ti :${GONG_PORT} <<< "${USER_PASS}" 2>/dev/null)
  if [ -n "$PORT_PIDS" ]; then
    echo "⚠️  Processes still holding port, sending SIGKILL..."
    echo "$PORT_PIDS" | xargs -r sudo -S kill -9 <<< "${USER_PASS}" 2>/dev/null || true
    sleep 1
  fi
fi

# Final verification
PORT_PIDS=$(sudo -S lsof -ti :${GONG_PORT} <<< "${USER_PASS}" 2>/dev/null)
if [ -n "$PORT_PIDS" ]; then
  echo "❌ ERROR: Port ${GONG_PORT} still occupied by: $PORT_PIDS"
else
  echo "✅ Port ${GONG_PORT} is now free"
fi

set -v

set +v
echo -e "----------------------------------------------------------------------------------------------------"

set -v
sudo -S logrotate "/home/${USER}/projects/gong_dev_ops/dev_ops/gong_logrotate"  -fv -s "/home/${USER}/projects/gong_dev_ops/t_logrotate_state" <<< "${USER_PASS}"

set +v
echo -e "----------------------------------------------------------------------------------------------------"

set -v
/home/"${USER}"/projects/gong_dev_ops/dev_ops/backup_files.sh "${USER}" "${USER_PASS}"

set +v
echo -e "----------------------------------------------------------------------------------------------------"

set -v
rm -rf "/home/${USER}/projects/gong_server/*"

set +v
echo -e "----------------------------------------------------------------------------------------------------"


echo
echo
echo -e "⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆"
echo -e "SCRIPT  :  server_stop.sh HAS ENDED      ************************    END    ************************"
echo -e "╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩"
