# Gong Server Installation

This folder contains scripts for setting up a fresh machine to run the Gong Server.

## System Requirements

| Component | Version |
|-----------|---------|
| OS | Ubuntu 20.04+ / Debian 11+ |
| Node.js | 18.x |
| npm | 9.x+ |
| Docker | 20.x+ (for FTDI relay module build) |
| PM2 | 5.x+ (process manager) |

## Quick Start

### Step 1: Download and run the bootstrap script

```bash
# Download bootstrap script
curl -O https://raw.githubusercontent.com/DhammaPamoda/Gong-be/main/installation/bootstrap_clean_machine.sh
chmod +x bootstrap_clean_machine.sh

# Run it
./bootstrap_clean_machine.sh
```

### Step 2: Log out and log back in

This is required if you were added to the docker group (first-time Docker install).

### Step 3: Run the deployment

```bash
cd ~
./docker_init.sh <USER> <USER_PASS> <IS_DOCKER> [GONG_BE_BRANCH] [GONG_FE_BRANCH]
```

**Parameters:**
- `USER` - Your Linux username
- `USER_PASS` - Your sudo password
- `IS_DOCKER` - Set to `true` if running in Docker, `false` for bare metal
- `GONG_BE_BRANCH` - (Optional) Backend branch to deploy
- `GONG_FE_BRANCH` - (Optional) Frontend branch to deploy

## What the Bootstrap Script Does

The `bootstrap_clean_machine.sh` script automates the setup of a fresh Ubuntu/Debian machine:

### 1. Installs System Dependencies
- **Git** - Version control
- **curl, wget** - Download tools
- **build-essential, cmake, g++, make** - Build tools for native modules
- **python3** - Required by some npm packages

### 2. Installs Node.js 18.x
- Uses NodeSource repository
- Verifies installation

### 3. Installs Docker
- Uses official Docker installation script
- Adds user to `docker` group (requires re-login)
- Enables and starts Docker service

### 4. Installs PM2
- Global npm package for process management
- Used to keep the Gong server running and auto-restart on reboot

### 5. Downloads Deployment Scripts
Downloads the following scripts to your home directory (`~/`):
- `docker_init.sh` - Main initialization script
- `deploy_gong.sh` - Deployment orchestrator
- `deploy_gong_actions.sh` - Deployment actions

## Testing a Specific Branch - OPTIONAL/ADVANCED

To bootstrap using scripts from a specific branch:

```bash
./bootstrap_clean_machine.sh develop
# or
./bootstrap_clean_machine.sh feature/my-feature
```

This downloads deployment scripts from the specified branch instead of `main`.

## After Installation

Once deployment completes, the Gong server will be:
- Running via PM2
- Auto-starting on system reboot
- Located at `/home/<USER>/projects/`

### Useful Commands

```bash
# Check PM2 status
pm2 status

# View logs
pm2 logs gong_server

# Restart server
pm2 restart gong_server

# Setup PM2 to start on boot (run once)
pm2 startup
pm2 save
```

## Troubleshooting

### Docker permission denied
If you see "permission denied" errors with Docker:
```bash
# Make sure you logged out and back in after bootstrap
# Or run:
newgrp docker
```

### Node.js version mismatch
If npm packages fail due to Node version:
```bash
node --version  # Should show v18.x.x
```

### PM2 not found
```bash
sudo npm install -g pm2
```

