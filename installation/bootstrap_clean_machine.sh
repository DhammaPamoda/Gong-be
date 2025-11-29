#!/bin/bash

set -e

# ==========================================
# System Requirements for Gong Server:
# ==========================================
# OS:      Linux (Debian/Ubuntu, Fedora/RHEL/CentOS, Arch)
# Node.js: 18.x
# npm:     9.x+
# Docker:  20.x+ (for FTDI relay module build)
# PM2:     5.x+ (process manager)
# ==========================================
#
# Usage: ./bootstrap_clean_machine.sh [GONG_BE_BRANCH]
#   GONG_BE_BRANCH: Optional. Branch to download scripts from (default: master)
#
# Examples:
#   ./bootstrap_clean_machine.sh              # Uses master branch
#   ./bootstrap_clean_machine.sh develop      # Uses develop branch
#   ./bootstrap_clean_machine.sh feature/xyz  # Uses feature/xyz branch
# ==========================================

GONG_BE_BRANCH="${1:-master}"
REPO_BASE_URL="https://raw.githubusercontent.com/DhammaPamoda/Gong-be/${GONG_BE_BRANCH}"

# ==========================================
# Package Manager Detection
# ==========================================
detect_package_manager() {
  if command -v apt &> /dev/null; then
    PKG_MANAGER="apt"
    PKG_UPDATE="sudo apt update"
    PKG_INSTALL="sudo apt install -y"
    # Package name mappings for apt
    PKG_GIT="git"
    PKG_CURL="curl"
    PKG_WGET="wget"
    PKG_GPG="gnupg"
    PKG_CA_CERTS="ca-certificates"
    PKG_BUILD_ESSENTIAL="build-essential"
    PKG_CMAKE="cmake"
    PKG_GPP="g++"
    PKG_MAKE="make"
    PKG_PYTHON3="python3"
    PKG_NODEJS="nodejs"
  elif command -v dnf &> /dev/null; then
    PKG_MANAGER="dnf"
    PKG_UPDATE="sudo dnf check-update || true"
    PKG_INSTALL="sudo dnf install -y"
    # Package name mappings for dnf
    PKG_GIT="git"
    PKG_CURL="curl"
    PKG_WGET="wget"
    PKG_GPG="gnupg2"
    PKG_CA_CERTS="ca-certificates"
    PKG_BUILD_ESSENTIAL="gcc gcc-c++ kernel-devel"
    PKG_CMAKE="cmake"
    PKG_GPP="gcc-c++"
    PKG_MAKE="make"
    PKG_PYTHON3="python3"
    PKG_NODEJS="nodejs"
  elif command -v yum &> /dev/null; then
    PKG_MANAGER="yum"
    PKG_UPDATE="sudo yum check-update || true"
    PKG_INSTALL="sudo yum install -y"
    # Package name mappings for yum
    PKG_GIT="git"
    PKG_CURL="curl"
    PKG_WGET="wget"
    PKG_GPG="gnupg2"
    PKG_CA_CERTS="ca-certificates"
    PKG_BUILD_ESSENTIAL="gcc gcc-c++ kernel-devel"
    PKG_CMAKE="cmake"
    PKG_GPP="gcc-c++"
    PKG_MAKE="make"
    PKG_PYTHON3="python3"
    PKG_NODEJS="nodejs"
  elif command -v pacman &> /dev/null; then
    PKG_MANAGER="pacman"
    PKG_UPDATE="sudo pacman -Sy"
    PKG_INSTALL="sudo pacman -S --noconfirm"
    # Package name mappings for pacman
    PKG_GIT="git"
    PKG_CURL="curl"
    PKG_WGET="wget"
    PKG_GPG="gnupg"
    PKG_CA_CERTS="ca-certificates"
    PKG_BUILD_ESSENTIAL="base-devel"
    PKG_CMAKE="cmake"
    PKG_GPP="gcc"
    PKG_MAKE="make"
    PKG_PYTHON3="python"
    PKG_NODEJS="nodejs"
  else
    echo "Error: No supported package manager found (apt, dnf, yum, pacman)."
    exit 1
  fi
  echo "Detected package manager: $PKG_MANAGER"
}

# Install Node.js 18.x based on distro
install_nodejs() {
  if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo "Node.js already installed: $NODE_VERSION"
    if [[ ! "$NODE_VERSION" =~ ^v18\. ]]; then
      echo "Warning: Node.js version is not 18.x. Installing 18.x..."
    else
      return 0
    fi
  fi

  echo "Installing Node.js 18.x..."
  case "$PKG_MANAGER" in
    apt)
      curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
      $PKG_INSTALL $PKG_NODEJS
      ;;
    dnf|yum)
      curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
      $PKG_INSTALL $PKG_NODEJS
      ;;
    pacman)
      # Arch typically has recent Node.js in repos, or use nvm
      $PKG_INSTALL nodejs npm
      ;;
  esac
}

# Remove old Docker versions based on distro
remove_old_docker() {
  case "$PKG_MANAGER" in
    apt)
      sudo apt remove -y docker docker-engine docker.io containerd runc 2>/dev/null || true
      ;;
    dnf|yum)
      sudo $PKG_MANAGER remove -y docker docker-client docker-client-latest docker-common docker-latest docker-latest-logrotate docker-logrotate docker-engine 2>/dev/null || true
      ;;
    pacman)
      sudo pacman -R --noconfirm docker 2>/dev/null || true
      ;;
  esac
}

# ==========================================
# Main Script
# ==========================================

echo "=========================================="
echo "Gong Server - Clean Machine Bootstrap"
echo "=========================================="
if [ "$GONG_BE_BRANCH" != "master" ]; then
  echo "Using branch: $GONG_BE_BRANCH"
fi
echo

# Detect package manager first
detect_package_manager
echo

# Check if running as root (not recommended)
if [ "$EUID" -eq 0 ]; then
  echo "Warning: Running as root is not recommended."
  echo "Please run as a regular user with sudo privileges."
  read -p "Continue anyway? (y/N): " confirm
  if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi

echo "This script will install (if not already present):"
echo "  - Git, curl, wget"
echo "  - Node.js 18.x & npm"
echo "  - Docker"
echo "  - PM2"
echo "  - Build tools (gcc, cmake, g++, make, python3)"
echo
echo "And download deployment scripts to ~/:"
echo "  - docker_init.sh"
echo "  - deploy_gong.sh"
echo "  - deploy_gong_actions.sh"
echo
read -p "Proceed with installation? (y/N): " confirm
if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
  echo "Aborted."
  exit 0
fi

echo
echo ">>> Updating package lists..."
$PKG_UPDATE

echo
echo ">>> Installing essential tools (if needed)..."
ESSENTIAL_TOOLS=""
command -v git &> /dev/null || ESSENTIAL_TOOLS="$ESSENTIAL_TOOLS $PKG_GIT"
command -v curl &> /dev/null || ESSENTIAL_TOOLS="$ESSENTIAL_TOOLS $PKG_CURL"
command -v wget &> /dev/null || ESSENTIAL_TOOLS="$ESSENTIAL_TOOLS $PKG_WGET"
command -v gpg &> /dev/null || ESSENTIAL_TOOLS="$ESSENTIAL_TOOLS $PKG_GPG"
# ca-certificates is always needed for HTTPS
ESSENTIAL_TOOLS="$ESSENTIAL_TOOLS $PKG_CA_CERTS"

if [ -n "$(echo $ESSENTIAL_TOOLS | tr -d ' ')" ]; then
  echo "Installing:$ESSENTIAL_TOOLS"
  $PKG_INSTALL $ESSENTIAL_TOOLS
else
  echo "All essential tools already installed."
fi

echo
echo ">>> Installing build tools (for native modules, if needed)..."
BUILD_TOOLS=""
command -v gcc &> /dev/null || BUILD_TOOLS="$BUILD_TOOLS $PKG_BUILD_ESSENTIAL"
command -v cmake &> /dev/null || BUILD_TOOLS="$BUILD_TOOLS $PKG_CMAKE"
command -v g++ &> /dev/null || BUILD_TOOLS="$BUILD_TOOLS $PKG_GPP"
command -v make &> /dev/null || BUILD_TOOLS="$BUILD_TOOLS $PKG_MAKE"
command -v python3 &> /dev/null || BUILD_TOOLS="$BUILD_TOOLS $PKG_PYTHON3"

if [ -n "$(echo $BUILD_TOOLS | tr -d ' ')" ]; then
  echo "Installing:$BUILD_TOOLS"
  $PKG_INSTALL $BUILD_TOOLS
else
  echo "All build tools already installed."
fi

echo
echo ">>> Installing Node.js 18.x..."
install_nodejs

echo
echo ">>> Verifying Node.js installation..."
node --version
npm --version

echo
echo ">>> Installing Docker..."
if command -v docker &> /dev/null; then
  echo "Docker already installed: $(docker --version)"
else
  # Remove old versions if any
  remove_old_docker
  
  # Install Docker using official script (works on most distros)
  curl -fsSL https://get.docker.com | sudo sh
  
  echo "Docker installed: $(docker --version)"
fi

echo
echo ">>> Adding user to docker group..."
if groups $USER | grep -q '\bdocker\b'; then
  echo "User already in docker group."
else
  sudo usermod -aG docker $USER
  echo "User added to docker group."
  echo "NOTE: You need to log out and log back in for this to take effect."
  NEED_RELOGIN=true
fi

echo
echo ">>> Starting Docker service..."
sudo systemctl enable docker
sudo systemctl start docker

echo
echo ">>> Installing PM2 globally..."
if command -v pm2 &> /dev/null; then
  echo "PM2 already installed: $(pm2 --version)"
else
  sudo npm install -g pm2
  echo "PM2 installed: $(pm2 --version)"
fi

echo
echo ">>> Downloading deployment scripts to home directory..."
echo "    (from branch: ${GONG_BE_BRANCH})"
cd ~
curl -fsSL -O "${REPO_BASE_URL}/dev_ops/docker_init.sh"
curl -fsSL -O "${REPO_BASE_URL}/dev_ops/deploy_gong.sh"
curl -fsSL -O "${REPO_BASE_URL}/dev_ops/deploy_gong_actions.sh"
chmod +x docker_init.sh deploy_gong.sh deploy_gong_actions.sh
echo "Deployment scripts downloaded to: $(pwd)"
ls -la docker_init.sh deploy_gong.sh deploy_gong_actions.sh

echo
echo "=========================================="
echo "Bootstrap Complete!"
echo "=========================================="
echo
echo "System Requirements Met:"
echo "  Git:    $(git --version | cut -d' ' -f3)"
echo "  Node:   $(node --version)"
echo "  npm:    $(npm --version)"
echo "  Docker: $(docker --version | cut -d' ' -f3 | tr -d ',')"
echo "  PM2:    $(pm2 --version)"
echo
echo "Deployment scripts in ~/:"
echo "  - docker_init.sh"
echo "  - deploy_gong.sh"
echo "  - deploy_gong_actions.sh"
echo

BRANCH_HINT=""
if [ "$GONG_BE_BRANCH" != "master" ]; then
  BRANCH_HINT=" ${GONG_BE_BRANCH}"
fi

if [ "$NEED_RELOGIN" = true ]; then
  echo "⚠️  IMPORTANT: You were added to the docker group."
  echo "   Please LOG OUT and LOG BACK IN, then run docker_init.sh"
  echo
  echo "After re-login, run:"
  echo "  cd ~"
  echo "  ./docker_init.sh <USER> <USER_PASS> <IS_DOCKER>${BRANCH_HINT}"
else
  echo "You can now run docker_init.sh:"
  echo "  cd ~"
  echo "  ./docker_init.sh <USER> <USER_PASS> <IS_DOCKER>${BRANCH_HINT}"
fi
echo
