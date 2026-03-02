# Gong Server Installation

This folder contains scripts for setting up a fresh machine to run the Gong Server.

## TL;DR

```bash
curl -O https://raw.githubusercontent.com/DhammaPamoda/Gong-be/master/installation/bootstrap_clean_machine.sh
chmod +x bootstrap_clean_machine.sh
./bootstrap_clean_machine.sh
# Log out and back in, then:
./docker_init.sh <USER> <USER_PASS> <IS_DOCKER>
```

**With specific branch:**
```bash
curl -O https://raw.githubusercontent.com/DhammaPamoda/Gong-be/try-to-fix-time-change/installation/bootstrap_clean_machine.sh
chmod +x bootstrap_clean_machine.sh
./bootstrap_clean_machine.sh try-to-fix-time-change
./docker_init.sh <USER> <USER_PASS> <IS_DOCKER> try-to-fix-time-change <GONG_FE_BRANCH>
```

---

## System Requirements

| Component | Version |
|-----------|---------|
| OS | Linux (Debian/Ubuntu, Fedora/RHEL/CentOS, Arch) |
| Node.js | 18.x |
| npm | 9.x+ |
| Docker | 20.x+ (for FTDI relay module build) |
| PM2 | 5.x+ (process manager) |

**Supported Package Managers:** apt, dnf, yum, pacman

## Quick Start

### Step 1: Download and run the bootstrap script

```bash
# Download bootstrap script
curl -O https://raw.githubusercontent.com/DhammaPamoda/Gong-be/master/installation/bootstrap_clean_machine.sh
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

The `bootstrap_clean_machine.sh` script automates the setup of a fresh Linux machine:

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

This downloads deployment scripts from the specified branch instead of `master`.

## After Installation

Once deployment completes, the Gong server will be:
- Running via PM2
- Auto-starting on system reboot
- Located at `/home/<USER>/projects/`

### Running Gong Server with PM2

```bash
# Start using the config file (recommended)
pm2 start ~/projects/gong_dev_ops/dev_ops/ecosystem.config.js
```

> ⚠️ **Important:** Do NOT run pm2 with sudo. Running `sudo pm2` creates a separate PM2 daemon under `/root/.pm2` which conflicts with your user's PM2 daemon. Always run pm2 as your regular user.

### Useful PM2 Commands

```bash
# Check PM2 status
pm2 status

# View logs
pm2 logs gong_server

# Restart server
pm2 restart gong_server

# Stop server
pm2 stop gong_server

# Save current process list
pm2 save
```

### Enable PM2 Auto-Start on Reboot (One-Time Setup)

To ensure the Gong server automatically starts after a system reboot:

```bash
# Step 1: Generate the startup script command
pm2 startup
```

PM2 will output a command like this (with `sudo`):
```bash
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u p-admin --hp /home/p-admin
```

**Important:** Copy and run the exact command that PM2 outputs (it's customized to your system).

> **Note:** This sudo command is only for installing the systemd service (one-time setup). Regular pm2 commands (`pm2 start`, `pm2 restart`, etc.) should be run WITHOUT sudo.

```bash
# Step 2: Save the current process list
pm2 save
```

| Command | Purpose |
|---------|---------|
| `pm2 startup` | Generates a system service command for auto-start |
| *(run the generated sudo command)* | Installs the systemd service |
| `pm2 save` | Saves current processes to be restored on boot |

After this setup, your `gong_server` will automatically start after every system restart.

## Build Cache

The deployment scripts use caching to skip unnecessary rebuilds when the code hasn't changed.

### Cache Locations

| Cache File | Purpose |
|------------|---------|
| `~/.cache/gong/fe_last_build_commit` | Stores the last built frontend commit hash |
| `~/.cache/ftdi-d2xx/ftdi-d2xx.Linux.x86_64.node` | Cached FTDI binary (avoids Docker rebuild) |

### How it Works

- Before building the frontend, the script compares the current git commit with the cached commit
- If they match, the build is skipped (saving time)
- If they differ, a full build is performed and the cache is updated

### Force Rebuild

To force a full rebuild even when there are no changes:

```bash
# Clear frontend build cache
rm ~/.cache/gong/fe_last_build_commit

# Clear FTDI binary cache (forces Docker rebuild)
rm ~/.cache/ftdi-d2xx/ftdi-d2xx.Linux.x86_64.node

# Clear all Gong caches
rm -rf ~/.cache/gong ~/.cache/ftdi-d2xx

# Then run deployment as normal
./docker_init.sh <USER> <USER_PASS> <IS_DOCKER>
```

---

## Troubleshooting

### Relay Not Accessible After Restart

If the relay is inaccessible after a system restart, the `ftdi_sio` kernel module may be claiming the FTDI USB device.

**Check the FTDI status log:**
```bash
cat ~/.local/share/gong/logs/ftdi_status.log
```

| Log Status | Meaning | Action |
|------------|---------|--------|
| `BLACKLIST_OK` | Blacklist working correctly | No action needed |
| `BLACKLIST_FAILED` | Module loaded despite blacklist | Run fix below |
| `UNLOAD_SUCCESS` | Module was unloaded successfully | Relay should work |
| `UNLOAD_FAILED` | Could not unload module | Check sudo permissions |

**To fix blacklist not working:**
```bash
# Rebuild initramfs and reboot
sudo update-initramfs -u
sudo reboot
```

**Manual workaround (temporary):**
```bash
sudo rmmod ftdi_sio
sudo rmmod usbserial
```

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

## Hardware Support: HK4 USB Keyboard

The Gong Server supports an HK4 USB keyboard handle (4 buttons) for hardware actions. 

### Prerequisites
- HK4 USB Keyboard connected to the machine.
- User must be in the `input` group to access `/dev/input/` events.

### How it Works
A separate background service `hk4_listener` (managed by PM2) listens for raw input events. When a button (1, 2, 3, or 4) is pressed, it sends a local POST request to the main `gong_server` API.

### Troubleshooting Hardware Access
If the listener cannot access the device:
1. Ensure the user is in the `input` group: `sudo usermod -a -G input $USER`
2. **Log out and log back in** (or reboot) for group changes to take effect.
3. Check the listener logs: `pm2 logs hk4_listener`

The listener identifies the device by looking for `*HK4*event-kbd` in `/dev/input/by-id/`.

