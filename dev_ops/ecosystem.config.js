const path = require('path');
// Use regular user - do NOT run pm2 with sudo to avoid creating a separate root PM2 daemon
// Resolve relative to this file: ${BASE_DIR}/gong_dev_ops/dev_ops/ -> ../../Gong-be = ${BASE_DIR}/Gong-be
const gongServerDir = path.resolve(__dirname, '../../Gong-be');

module.exports = {
  apps: [
    {
      name: 'gong_server',
      script: path.join(gongServerDir, 'server', 'index.js'),
      cwd: gongServerDir,

      // Graceful shutdown settings
      kill_timeout: 10000,        // Wait 10 seconds for graceful shutdown before SIGKILL
      restart_delay: 4000,        // Wait 4 seconds between restarts to avoid EADDRINUSE

      // Log settings - add timestamps to all log entries
      log_date_format: 'YYYY-MM-DD HH:mm:ss',

      env: {
        NODE_ENV: 'production',
        NO_OF_PORTS: '8'
      }
    },
    {
      name: 'hk4_listener',
      script: path.join(gongServerDir, 'dev_ops', 'hk4_listener.js'),
      cwd: gongServerDir,
      restart_delay: 10000,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      env: {
        NODE_ENV: 'production',
        GONG_SERVER_PORT: '3000'
      }
    }
  ]
};

