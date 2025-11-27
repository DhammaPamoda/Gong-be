const path = require('path');
const homeDir = process.env.HOME || process.env.USERPROFILE;
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

