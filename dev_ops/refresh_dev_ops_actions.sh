#!/bin/bash
if [[ $EUID -ne 0 ]]; then
   echo "This script must be run as root"
   exit 1
fi


set +v
echo -e "╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦╦"
echo -e "RUNNING SCRIPT : refresh_dev_ops_actions.sh      ********************** START **********************"
echo -e "⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇"
echo
echo

set -v

GONG_BE_BRANCH=$1
GONG_BE_BRANCH=${GONG_BE_BRANCH:-master}

now=$(date +"%Y_%m_%d_%H_%M_%S")
mkdir -p /home/dhamma/projects/gong_dev_ops/dev_ops_backups
newBackupDir="/home/dhamma/projects/gong_dev_ops/dev_ops_backups/${now}"
mkdir "${newBackupDir}"

cp -r /home/dhamma/projects/gong_dev_ops/dev_ops/*.* "${newBackupDir}"

set +v
echo -e "----------------------------------------------------------------------------------------------------"

set -v
cd /home/dhamma/projects/Gong-be/

set +v
echo -e "----------------------------------------------------------------------------------------------------"

set -v
git fetch origin "${GONG_BE_BRANCH}"

set +v
echo -e "----------------------------------------------------------------------------------------------------"

set -v
git checkout "origin/${GONG_BE_BRANCH}" -- dev_ops

set +v
echo -e "----------------------------------------------------------------------------------------------------"

set -v
cp -rf /home/dhamma/projects/Gong-be/dev_ops /home/dhamma/projects/gong_dev_ops/

set +v
echo -e "----------------------------------------------------------------------------------------------------"

set -v
cp -f /home/dhamma/projects/gong_dev_ops/dev_ops/refresh_dev_ops.sh /home/dhamma/projects/gong_dev_ops/
cp -f /home/dhamma/projects/gong_dev_ops/dev_ops/refresh_gong_server.sh /home/dhamma/projects/gong_dev_ops/

set +v
echo
echo
echo -e "⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆"
echo -e "SCRIPT: refresh_dev_ops_actions.sh HAS ENDED   ************************ END ************************"
echo -e "╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩╩"
