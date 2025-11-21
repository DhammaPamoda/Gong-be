#!/bin/bash

# Script to check PM2 running processes
# Handles nvm installation and provides various viewing options

# Detect pm2 path
PM2_PATH=$(command -v pm2 || which pm2 || find ~/.nvm -name pm2 2>/dev/null | head -1 || echo "")

# If pm2 is not in standard location, try to source nvm
if [ -z "$PM2_PATH" ] || [ "$PM2_PATH" == "" ]; then
  if [ -s "$HOME/.nvm/nvm.sh" ]; then
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    PM2_PATH=$(command -v pm2 || which pm2 || echo "")
  fi
fi

# Check if pm2 is available
if [ -z "$PM2_PATH" ] || [ "$PM2_PATH" == "" ]; then
  echo "Error: PM2 not found. Please install PM2 first:"
  echo "  npm install -g pm2"
  exit 1
fi

# Function to show usage
show_usage() {
  echo "Usage: $0 [option]"
  echo ""
  echo "Options:"
  echo "  list, ls, status    - List all PM2 processes (default)"
  echo "  show <name>         - Show detailed info about a specific process"
  echo "  logs [name]         - Show logs (all or specific process)"
  echo "  monit               - Show real-time monitoring"
  echo "  info                - Show PM2 daemon info"
  echo "  all                 - Show all information"
  echo ""
  echo "Examples:"
  echo "  $0                  # List all processes"
  echo "  $0 show gong_server # Show details for gong_server"
  echo "  $0 logs gong_server # Show logs for gong_server"
  echo "  $0 monit            # Open monitoring dashboard"
}

# Parse arguments
ACTION="${1:-list}"
PROCESS_NAME="${2:-}"

case "$ACTION" in
  list|ls|status|"")
    echo "=== PM2 Process List ==="
    "$PM2_PATH" list
    ;;
    
  show|describe|info)
    if [ -z "$PROCESS_NAME" ]; then
      echo "Error: Please specify a process name"
      echo "Usage: $0 show <process_name>"
      exit 1
    fi
    echo "=== PM2 Process Details: $PROCESS_NAME ==="
    "$PM2_PATH" show "$PROCESS_NAME"
    ;;
    
  logs|log)
    if [ -z "$PROCESS_NAME" ]; then
      echo "=== PM2 Logs (all processes) ==="
      echo "Press Ctrl+C to exit"
      "$PM2_PATH" logs
    else
      echo "=== PM2 Logs: $PROCESS_NAME ==="
      echo "Press Ctrl+C to exit"
      "$PM2_PATH" logs "$PROCESS_NAME"
    fi
    ;;
    
  monit|monitor)
    echo "=== PM2 Monitoring Dashboard ==="
    echo "Press Ctrl+C to exit"
    "$PM2_PATH" monit
    ;;
    
  daemon|info)
    echo "=== PM2 Daemon Information ==="
    "$PM2_PATH" info
    ;;
    
  all)
    echo "=== PM2 Process List ==="
    "$PM2_PATH" list
    echo ""
    echo "=== PM2 Daemon Information ==="
    "$PM2_PATH" info
    echo ""
    echo "=== System Processes (PM2 related) ==="
    ps aux | grep -E "pm2|node" | grep -v grep | head -20
    ;;
    
  help|--help|-h)
    show_usage
    ;;
    
  *)
    echo "Unknown option: $ACTION"
    echo ""
    show_usage
    exit 1
    ;;
esac

