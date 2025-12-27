const path = require('path');
// Use regular user - do NOT run pm2 with sudo to avoid creating a separate root PM2 daemon
const user = process.env.USER;
const homeDir = `/home/${user}`;
const gongServerDir = path.join(homeDir, 'projects', 'gong_server');

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
    }
  ]
};

