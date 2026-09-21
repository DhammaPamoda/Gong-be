const moment = require('moment');
const responder = require('../../lib/responder');

const authenticateFunc = require('../../auth/authenticate');
const scheduleManager = require('../../lib/scheduleManager');
const relayAndSoundManager = require('../../lib/relayAndSoundManager');
const Gong = require('../../model/gong');
const hk4Manager = require('../../lib/hk4Manager');
const systemSettingsManager = require('../../lib/systemSettingsManager');
const areasDal = require('../../db/dal/areasDal');
const dataFreshnessDal = require('../../db/dal/dataFreshnessDal');

const authenticate = async (req, res, next) => {
  const isLocal = req.ip === '::ffff:127.0.0.1';
  const token = await authenticateFunc({
    username: req.body.username,
    password: req.body.password,
    isLocal,
  });
  if (token) {
    responder.send200Response(res, { token });
  } else {
    responder.sendErrorResponse(res, 400, 'Username or password is incorrect');
  }
};

const getNextGong = async (req, res, next) => {
  try {
    const settings = systemSettingsManager.getSettings();
    const nextScheduledJob = scheduleManager.getNextScheduledJob();
    const currentServerTime = moment().valueOf();
    const retObject = {
      currentServerTime,
      nextScheduledJob,
      staticDataLastUpdateTime: await dataFreshnessDal.getLastUpdatedTime(),
      areas: await areasDal.getAllAsMap(),
      runSecurityCheck: !!settings.runSecurityCheck,
    };
    responder.send200Response(res, retObject);
  } catch (error) {
    next(error);
  }
};

// Rolling buffer for HK4 key sequences (max 4 keys)
const hk4KeyBuffer = [];
let hk4BufferClearTimer = null;
const HK4_SEQUENCE_LENGTH = 4;
const HK4_SEQUENCE_TIMEOUT_MS = 5000;

const handleHK4Key = (req, res, next) => {
  const { key } = req.body;
  const remoteAddress = req.socket.remoteAddress;

  // Security check: only allow requests from localhost
  if (remoteAddress !== '127.0.0.1' && remoteAddress !== '::1' && remoteAddress !== '::ffff:127.0.0.1') {
    responder.sendErrorResponse(res, 403, 'Forbidden: Hardware events only allowed from localhost');
    return;
  }

  if (!['1', '2', '3', '4'].includes(key)) {
    responder.sendErrorResponse(res, 400, 'Invalid key');
    return;
  }
  const config = hk4Manager.getSequences();
  if (!systemSettingsManager.getSettings().hk4Enabled) {
    responder.send200Response(res, { success: true, key });
    return;
  }

  // Reset the inactivity timer on each key press
  if (hk4BufferClearTimer) clearTimeout(hk4BufferClearTimer);
  hk4BufferClearTimer = setTimeout(() => {
    hk4KeyBuffer.length = 0;
  }, HK4_SEQUENCE_TIMEOUT_MS);

  // Maintain rolling buffer of the last 4 keys
  hk4KeyBuffer.push(key);
  if (hk4KeyBuffer.length > HK4_SEQUENCE_LENGTH) hk4KeyBuffer.shift();

  if (hk4KeyBuffer.length === HK4_SEQUENCE_LENGTH) {
    const sequence = hk4KeyBuffer.join('');
    const gongConfig = config.sequences[sequence];
    if (gongConfig) {
      const gongToPlay = new Gong(gongConfig.gongType, gongConfig.areas, gongConfig.volume, gongConfig.repeat);
      relayAndSoundManager.playImmediateGong(gongToPlay);
    }
  }

  responder.send200Response(res, { success: true, key });
};


module.exports = {
  authenticate,
  getNextGong,
  handleHK4Key,
};
