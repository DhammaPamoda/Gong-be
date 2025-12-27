const fs = require('fs');
const { exec } = require('child_process');
const config = require('config');
const http = require('http');
const https = require('https');
const app = require('./app');
// const db = require('../lib/db');
const logger = require('../lib/logger');
const dataPaths = require('../lib/config/dataPaths');

const scheduleManager = require('../lib/scheduleManager');
const gongsManager = require('../lib/gongsManager');
const relayAndSoundManager = require('../lib/relayAndSoundManager');

const PORT = config.get('server.port') || 3001;
const USE_HTTPS = !!process.env.HTTPS;

// Initialize data files on startup - ensure all required files exist and are valid
const initResult = dataPaths.initializeDataFiles();
if (!initResult.success) {
  logger.log('error', `Failed to initialize data files: ${initResult.errors.join(', ')}`);
} else {
  if (initResult.initialized.length > 0) {
    logger.log('info', `Created missing data files: ${initResult.initialized.join(', ')}`);
  }
  if (initResult.repaired.length > 0) {
    logger.log('warn', `Repaired corrupted data files: ${initResult.repaired.join(', ')}`);
  }
}

const server = USE_HTTPS ? https.createServer({
  key: fs.readFileSync('certs/server.key'),
  cert: fs.readFileSync('certs/server.pem'),
}, app) : http.createServer(app);

server.listen(PORT, () => {
  exec('whoami', (err, stdout, stderr) => {
    logger.log('info', '\n');
    logger.log('info', `Server listening on port ${PORT} using ${USE_HTTPS ? 'https' : 'http'}`);
    logger.log('info', 'Press CTRL-C to stop');
    if (err !== null) {
      logger.error('Failed to retrieve whoami\n', err);
    } else {
      logger.log('info', `Whomai = ${stdout}\n`);
    }
  });
});

// db.connection.on('error', (err) => {
//   logger.log('error', `connection error:${err}`);
// });

scheduleManager.start();
scheduleManager.setExecutor(relayAndSoundManager.playGongForJob);

gongsManager.addOnGongActionListener(scheduleManager.jobActionFunction.bind(scheduleManager));
gongsManager.init();

// ==========================================
// Startup Logging
// ==========================================
const serverStartTime = new Date();
logger.log('info', `Server starting - PID: ${process.pid}, NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
logger.log('info', `Data directory: ${dataPaths.DATA_DIR}`);

// ==========================================
// Graceful Shutdown Handler
// ==========================================
let isShuttingDown = false;

const gracefulShutdown = (signal) => {
  if (isShuttingDown) {
    logger.log('warn', `Shutdown already in progress, ignoring ${signal}`);
    return;
  }
  isShuttingDown = true;
  
  logger.log('info', `Received ${signal}. Starting graceful shutdown...`);
  
  // Close the HTTP server first (stops accepting new connections)
  server.close(() => {
    logger.log('info', 'HTTP server closed');
    
    // Stop the schedule manager
    scheduleManager.stop();
    logger.log('info', 'Schedule manager stopped');
    
    // Cleanup audio processes
    relayAndSoundManager.forceCleanup();
    logger.log('info', 'Relay and sound manager cleaned up');
    
    logger.log('info', 'Graceful shutdown complete. Exiting.');
    process.exit(0);
  });
  
  // Force exit after 10 seconds if graceful shutdown takes too long
  setTimeout(() => {
    logger.log('error', 'Graceful shutdown timed out after 10 seconds. Force exiting.');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// ==========================================
// Uncaught Exception Handler
// ==========================================
process.on('uncaughtException', (err) => {
  logger.log('error', `UNCAUGHT EXCEPTION: ${err.message}`);
  logger.log('error', `Stack: ${err.stack}`);
  // Give logger time to write, then exit
  setTimeout(() => process.exit(1), 1000);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.log('error', `UNHANDLED REJECTION at: ${promise}, reason: ${reason}`);
});

// Export serverStartTime for diagnostics
module.exports = { serverStartTime };

// const time = new Date().getTime() + 60000;
// scheduleManager.addJob({
//   time,
//   data: { stam: 1 },
// });

// const aaaa = scheduleManager.getNextScheduledJob();
// if (aaaa) {
//   console.log('11111', moment(aaaa.time).format('YY-MM-DD HH:mm:ss'), aaaa);
// }

// scheduleManager.start();

// db.connection.once('open', () => {
//   app.listen(PORT, (err) => {
//     if (err) {
//       logger.log('error', `Error starting server: ${err}`);
//       return;
//     }
//     logger.log('info', `server listening on ${PORT}`);
//   });
// });
