const fs = require('fs');
const moment = require('moment');
const responder = require('../../lib/responder');

const authenticateFunc = require('../../auth/authenticate');
const scheduleManager = require('../../lib/scheduleManager');
const relayAndSoundManager = require('../../lib/relayAndSoundManager');
const Gong = require('../../model/gong');


const authenticate = async (req, res, next) => {
  const token = await authenticateFunc({
    username: req.body.username,
    password: req.body.password,
  });
  if (token) {
    responder.send200Response(res, { token });
  } else {
    responder.sendErrorResponse(res, 400, 'Username or password is incorrect');
  }
};

const getNextGong = (req, res, next) => {
  const rawData = fs.readFileSync('assets/data/staticData.json');
  const { lastUpdatedTime } = JSON.parse(rawData.toString());

  const nextScheduledJob = scheduleManager.getNextScheduledJob();
  const currentServerTime = moment().valueOf();
  const retObject = {
    currentServerTime,
    nextScheduledJob,
    staticDataLastUpdateTime: lastUpdatedTime,
  };
  responder.send200Response(res, retObject);
};

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

  if (key === '1') {
    const gongToPlay = new Gong(2, [0]);
    relayAndSoundManager.playImmediateGong(gongToPlay);
  }

  responder.send200Response(res, { success: true, key });
};


module.exports = {
  authenticate,
  getNextGong,
  handleHK4Key,
};
