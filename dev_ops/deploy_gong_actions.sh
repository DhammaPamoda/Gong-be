#!/bin/bash

set -x

USER=$1
USER_PASS=$2
IS_DOCKER=$3
GONG_BE_BRANCH=$4
GONG_FE_BRANCH=$5

BASE_DIR="/home/${USER}/projects"
GONG_DEV_OPS_DIR="${BASE_DIR}/gong_dev_ops"
DEV_OPS_FILES_DIR="${GONG_DEV_OPS_DIR}/dev_ops"

set -v

cd "${BASE_DIR}/"

export HISTIGNORE='*sudo -S*'

# Function to validate branch exists on remote
validate_branch() {
  local repo_url=$1
  local branch_name=$2
  
  if [ -z "$branch_name" ]; then
    return 0  # Empty branch name means use default
  fi
  
  if git ls-remote --heads "$repo_url" "$branch_name" | grep -q "refs/heads/$branch_name"; then
    return 0  # Branch exists
  else
    echo "Error: Branch '$branch_name' does not exist on remote repository $repo_url"
    return 1  # Branch does not exist
  fi
}

# Getting the FE and BE
GONG_BE_REPO="https://github.com/DhammaPamoda/Gong-be.git"
GONG_FE_REPO="https://github.com/DhammaPamoda/Gong_fe.git"

if [ -n "${GONG_BE_BRANCH}" ]; then
  validate_branch "${GONG_BE_REPO}" "${GONG_BE_BRANCH}" || exit 1
  git clone -b "${GONG_BE_BRANCH}" "${GONG_BE_REPO}"
else
  git clone "${GONG_BE_REPO}"
fi

if [ -n "${GONG_FE_BRANCH}" ]; then
  validate_branch "${GONG_FE_REPO}" "${GONG_FE_BRANCH}" || exit 1
  git clone -b "${GONG_FE_BRANCH}" "${GONG_FE_REPO}"
else
  git clone "${GONG_FE_REPO}"
fi

# Populating the dev_ops
cp -rf "${BASE_DIR}/Gong-be/dev_ops" "${GONG_DEV_OPS_DIR}/"
cp -f "${DEV_OPS_FILES_DIR}/refresh_dev_ops.sh" "${GONG_DEV_OPS_DIR}/"
cp -f "${DEV_OPS_FILES_DIR}/refresh_gong_server.sh" "${GONG_DEV_OPS_DIR}/"

# Building the BE and FE
"${DEV_OPS_FILES_DIR}"/refresh_gong_server_be.sh "${USER}" "${USER_PASS}" "${GONG_BE_BRANCH}"
"${DEV_OPS_FILES_DIR}"/refresh_gong_server_fe.sh "${USER}" "${USER_PASS}" "${GONG_FE_BRANCH}"

# logrotate
sudo -S cp -f "${DEV_OPS_FILES_DIR}/gong_logrotate" /etc/logrotate.d/gong <<< "${USER_PASS}"
sudo -S sed -i "s/dhamma/${USER}/g" /etc/logrotate.d/gong <<< "${USER_PASS}"

# pm2 shell to start the app
sudo -S sed -i "s/dhamma/${USER}/g" "${DEV_OPS_FILES_DIR}/gong_server_pm2_config.json" <<< "${USER_PASS}"
"${DEV_OPS_FILES_DIR}"/create_pm2_gong_server_process.sh "${USER}" "${USER_PASS}" "${IS_DOCKER}"

# neutrelizing the old pathces scripts
PATCHES_INSTALLED_DIR="${DEV_OPS_FILES_DIR}/patches_installed"
mkdir -p "${PATCHES_INSTALLED_DIR}"
for path in $(find "${DEV_OPS_FILES_DIR}"/patches/*.sh ); do
  path_installed="${PATCHES_INSTALLED_DIR}/patches_installed/${path##*/}"
  touch "${path_installed}"
  echo neutrelizing patch "${path##*/}"
done
