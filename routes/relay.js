const express = require('express');
const relaysModule = require('../relay');
const relayAndSoundManager = require('../lib/relayAndSoundManager');
const responder = require('../lib/responder');
const dataPaths = require('../lib/config/dataPaths');
const scheduleManager = require('../lib/scheduleManager');

const router = express.Router();

const responseJson = {
  relayNo: '',
  actionSuccess: true,
  isOn: true,
};

router.post('/playGong', (req, res) => {
  relayAndSoundManager.playImmediateGong(req.body)
    .then(() => responder.send200Response(res, { gongSuccessPlay: true }))
    .catch((err) => responder.sendErrorResponse(
      res,
      err.httpStatusCode || 500,
      'Failed to play gong ',
      err,
    ));
});

router.post('/cancelGong', (req, res) => {
  const wasCanceled = relayAndSoundManager.cancelCurrentGong();
  responder.send200Response(res, {
    gongCanceled: wasCanceled,
    message: wasCanceled ? 'Gong canceled successfully' : 'No gong was playing',
  });
});

router.get('/isGongPlaying', (req, res) => {
  const isPlaying = relayAndSoundManager.isGongPlaying();
  responder.send200Response(res, { isPlaying });
});

router.get('/diagnostics', (req, res) => {
  // Get audio/relay diagnostics
  const audioDiagnostics = relayAndSoundManager.getDiagnostics();

  // Server health info
  const memUsage = process.memoryUsage();
  const serverHealth = {
    pid: process.pid,
    nodeVersion: process.version,
    platform: process.platform,
    uptime: process.uptime(),
    uptimeFormatted: formatUptime(process.uptime()),
    memory: {
      heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)} MB`,
      heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)} MB`,
      rss: `${Math.round(memUsage.rss / 1024 / 1024)} MB`,
    },
    nodeEnv: process.env.NODE_ENV || 'development',
  };

  // Data files status
  const dataFilesStatus = {};
  for (const file of dataPaths.DYNAMIC_DATA_FILES) {
    const validation = dataPaths.validateJsonFile(dataPaths.getDataFilePath(file));
    dataFilesStatus[file] = validation.valid ? 'OK' : validation.error;
  }

  // Schedule info
  const nextJob = scheduleManager.getNextScheduledJob();
  const scheduleInfo = {
    nextScheduledJob: nextJob ? {
      time: new Date(nextJob.time).toISOString(),
      isManual: nextJob.isManual,
    } : null,
  };

  // Combine all diagnostics
  const diagnostics = {
    ...audioDiagnostics,
    server: serverHealth,
    dataFiles: dataFilesStatus,
    dataDirectory: dataPaths.DATA_DIR,
    schedule: scheduleInfo,
  };

  responder.send200Response(res, diagnostics);
});

// Helper function to format uptime
function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  parts.push(`${secs}s`);

  return parts.join(' ');
}

router.post('/toggleSwitch', (req, res) => {
  responseJson.relayNo = req.body.switch;

  const relayStatusVal = relaysModule.toggleRelay(responseJson.relayNo);

  responseJson.isOn = relayStatusVal;

  // eslint-disable-next-line max-len
  // console.log(`relay no. ${req.body.switch} was toggled to a new value of : "${responseJson.isOn}"`);

  res.send(responseJson);
});

router.post('/setAll', (req, res) => {
  const isOn = req.body.value;

  const relayStatusVal = relaysModule.setRelayAll(isOn);

  responseJson.isOn = relayStatusVal;

  // eslint-disable-next-line max-len
  // console.log(`relay no. ${req.body.switch} was toggled to a new value of : "${responseJson.isOn}"`);

  res.send(responseJson);
});

module.exports = router;
