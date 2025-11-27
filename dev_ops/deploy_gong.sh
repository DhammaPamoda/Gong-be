#!/bin/bash

set -x

USER=$1
USER_PASS=$2
IS_DOCKER=$3
GONG_BE_BRANCH=$4
GONG_FE_BRANCH=$5

# Essential dirs
BASE_DIR="/home/${USER}/projects"
GONG_DEV_OPS_DIR="${BASE_DIR}/gong_dev_ops"
mkdir -p "${BASE_DIR}"
mkdir -p "${GONG_DEV_OPS_DIR}"
mkdir -p "${GONG_DEV_OPS_DIR}/dev_ops_logs"
mkdir -p "${BASE_DIR}/gong_server"

log_file=${GONG_DEV_OPS_DIR}/dev_ops_logs/0_initial_deployment_$(date +"%Y_%m_%d_%H_%M_%S").log

/home/"${USER}"/deploy_gong_actions.sh "${USER}" "${USER_PASS}" "${IS_DOCKER}" "${GONG_BE_BRANCH}" "${GONG_FE_BRANCH}" 2>&1 | tee -a "${log_file}"
