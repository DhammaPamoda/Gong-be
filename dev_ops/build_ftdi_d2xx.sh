#!/bin/bash

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GONG_BE_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
DOCKER_IMAGE="ftdi-d2xx-builder"
CONTAINER_NAME="ftdi-d2xx-build-$(date +%s)"

# Detect if we need to use sudo for docker commands
DOCKER_CMD="docker"
if ! docker info >/dev/null 2>&1; then
    if command -v sudo >/dev/null 2>&1 && sudo docker info >/dev/null 2>&1; then
        DOCKER_CMD="sudo docker"
        echo "Note: Using sudo for Docker commands"
    else
        echo "Error: Cannot access Docker daemon."
        echo "Please either:"
        echo "  1. Add your user to the docker group: sudo usermod -aG docker $USER"
        echo "     (then log out and log back in)"
        echo "  2. Or ensure sudo docker works"
        exit 1
    fi
fi

echo "=========================================="
echo "Building ftdi-d2xx in Docker container"
echo "=========================================="

# Change to dev_ops directory
cd "${SCRIPT_DIR}"

# Build Docker image
echo "Building Docker image: ${DOCKER_IMAGE}"
${DOCKER_CMD} build -f Dockerfile.ftdi-build -t ${DOCKER_IMAGE} .

# Ensure node_modules/ftdi-d2xx exists
cd "${GONG_BE_DIR}"
if [ ! -d "node_modules/ftdi-d2xx" ]; then
    echo "Installing ftdi-d2xx package..."
    npm install ftdi-d2xx
fi

# Create build directory if it doesn't exist
mkdir -p node_modules/ftdi-d2xx/build/Release

# Run container to build the binary
echo "Building ftdi-d2xx binary in container..."
${DOCKER_CMD} run --name ${CONTAINER_NAME} \
    -v "${GONG_BE_DIR}/node_modules/ftdi-d2xx:/build/ftdi-d2xx" \
    ${DOCKER_IMAGE} \
    bash -c "
        cd /build/ftdi-d2xx && \
        npm install && \
        npm run cmake:rebuild-release && \
        chmod 755 build/Release/ftdi-d2xx.Linux.x86_64.node
    "

# Copy binary from container
echo "Copying binary from container..."
${DOCKER_CMD} cp ${CONTAINER_NAME}:/build/ftdi-d2xx/build/Release/ftdi-d2xx.Linux.x86_64.node \
    "${GONG_BE_DIR}/node_modules/ftdi-d2xx/build/Release/ftdi-d2xx.Linux.x86_64.node"

# Clean up container
echo "Cleaning up container..."
${DOCKER_CMD} rm ${CONTAINER_NAME}

echo "=========================================="
echo "Build complete!"
echo "Binary location: ${GONG_BE_DIR}/node_modules/ftdi-d2xx/build/Release/ftdi-d2xx.Linux.x86_64.node"
echo "=========================================="
