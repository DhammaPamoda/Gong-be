const path = require('path');
// Use SUDO_USER to get the original user when running with sudo
const user = process.env.SUDO_USER || process.env.USER || 'p-admin';
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

