# Building ftdi-d2xx Binary in Docker Container

## Overview

This process builds the `ftdi-d2xx` native module binary in a Docker container with GLIBC 2.31 (Ubuntu 20.04), matching the host system. The compiled binary is then copied to the host's `node_modules/ftdi-d2xx/build/Release/` directory.

## Prerequisites

- Docker installed and running
- User has permission to run Docker commands
- `ftdi-d2xx` package installed in `node_modules` (will be installed automatically if missing)

### Clean Machine Setup

For a fresh Ubuntu/Debian machine, run the bootstrap script first:

```bash
curl -O https://raw.githubusercontent.com/DhammaPamoda/Gong-be/main/installation/bootstrap_clean_machine.sh
chmod +x bootstrap_clean_machine.sh
./bootstrap_clean_machine.sh
```

This installs: Git, Node.js 18.x, Docker, PM2, and build tools.

See `/installation/README.md` for full installation documentation.

## Usage

### Manual Build

From the `dev_ops` directory, run:

```bash
./build_ftdi_d2xx.sh
```

### Automatic Build (via docker_init.sh)

The FTDI build is automatically triggered during the `docker_init.sh` deployment process:

```
docker_init.sh
  └── deploy_gong.sh
        └── deploy_gong_actions.sh
              └── refresh_gong_server_be.sh  ← FTDI build happens here
```

The script automatically detects the environment:
- **On host machine**: Uses `build_ftdi_d2xx.sh` (Docker-based build with GLIBC 2.31)
- **Inside container**: Uses `build_ftdi_d2xx_in_container.sh` (native build)

## What the Script Does

1. **Builds Docker Image**: Creates `ftdi-d2xx-builder` image from `Dockerfile.ftdi-build`
   - Base: Ubuntu 20.04 (GLIBC 2.31)
   - Node.js 18.x
   - Build tools (cmake, g++, make)
   - FTDI D2XX libraries and headers

2. **Builds Binary**: Runs container to compile `ftdi-d2xx.Linux.x86_64.node`
   - Installs npm dependencies
   - Runs `npm run cmake:rebuild-release`

3. **Copies Binary**: Extracts compiled binary to host system
   - Location: `node_modules/ftdi-d2xx/build/Release/ftdi-d2xx.Linux.x86_64.node`
   - Sets proper permissions (755)

4. **Cleanup**: Removes temporary container

## Verification

After building, verify the binary works:

```bash
cd /home/p-admin/Documents/projects/Gong-be
node -e "try { const FTDI = require('ftdi-d2xx'); console.log('✓ ftdi-d2xx loaded successfully'); } catch(e) { console.error('✗ Error:', e.message); }"
```

## Troubleshooting

- **Docker permission denied**: Add user to docker group: `sudo usermod -aG docker $USER`
- **Build fails**: Check Docker logs and ensure FTDI D2XX libraries are accessible in container
- **Binary not found**: Verify the build completed successfully and check `node_modules/ftdi-d2xx/build/Release/`

## Kernel Module Handling (Development Environment)

The `ftdi-d2xx` library requires direct access to FTDI USB devices. However, Linux's `ftdi_sio` kernel module automatically claims these devices, which prevents the library from accessing them properly.

**Symptoms when kernel module is loaded:**
- Device info shows empty identifiers: `{"serial_number":"","description":"","is_open":true,...}`
- Error: `openDevice argument must be a serial number (string) or an object containing a device identifier`
- Error: `Cannot open FTDI device: no valid identifier available`

**Solution:**

The `prestart_init.sh` script (run automatically via `npm prestart`) now unloads the kernel modules:

```bash
# Unload kernel FTDI drivers that interfere with ftdi-d2xx library
if lsmod | grep -q "ftdi_sio"; then
    sudo rmmod ftdi_sio
fi
if lsmod | grep -q "usbserial"; then
    sudo rmmod usbserial
fi
```

**Note:** These rules are also present in the deployment files for production environments. The addition to `prestart_init.sh` ensures the same behavior in the development environment when running `npm start`.

**Manual commands (if needed):**

```bash
# Unload modules (for ftdi-d2xx access)
sudo rmmod ftdi_sio usbserial 2>/dev/null

# Reload modules (to use device as /dev/ttyUSB0)
sudo modprobe ftdi_sio
```

## Notes

- The Docker image is cached after first build, subsequent runs are faster
- The binary is built for x86_64 architecture with GLIBC 2.31 compatibility
- Original pre-compiled binary (GLIBC 2.33) is replaced with the container-built version
- Kernel module unloading requires sudo privileges; the script will show a note if it cannot unload

