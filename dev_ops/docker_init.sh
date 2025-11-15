#!/bin/bash
set -e

USER=$1
USER_PASS=$2
IS_DOCKER=$3
GONG_BE_BRANCH=$4
GONG_FE_BRANCH=$5

git clone https://github.com/DhammaPamoda/Gong-be.git ~/Gong-be
cp ~/Gong-be/dev_ops/deploy_gong.sh .
cp ~/Gong-be/dev_ops/deploy_gong_actions.sh .
rm -rf Gong-be
sudo -S chmod +x ./deploy_gong.sh <<< "${USER_PASS}"
sudo -S chmod +x ./deploy_gong_actions.sh <<< "${USER_PASS}" 
./deploy_gong.sh "${USER}" "${USER_PASS}" "${IS_DOCKER}" "${GONG_BE_BRANCH}" "${GONG_FE_BRANCH}"
bash
