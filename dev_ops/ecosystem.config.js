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
      env: {
        NODE_ENV: 'production',
        NO_OF_PORTS: '8'
      }
    }
  ]
};

