#!/bin/bash 
if [[ $EUID -ne 0 ]]; then
   echo "This script must be run as root" 
   exit 1
fi
set -o verbose
/home/dhamma/projects/gong_dev_ops/restore_files.sh
pm2 start gong_server
