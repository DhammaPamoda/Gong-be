const express = require('express');

const router = express.Router();
const hk4Manager = require('../lib/hk4Manager');
const systemSettingsManager = require('../lib/systemSettingsManager');

router.get('/', (req, res, next) => {
  try {
    res.json({
      enabled: systemSettingsManager.getSettings().hk4Enabled,
      sequences: hk4Manager.getSequences(),
    });
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const newSettings = req.body;
    const sequences = await hk4Manager.saveSettings(newSettings);
    const systemSettings = await systemSettingsManager.updateHk4Enabled(newSettings.enabled);
    res.json({ enabled: systemSettings.hk4Enabled, sequences });
  } catch (error) {
    next(error);
  }
});

router.post('/status', async (req, res, next) => {
  try {
    const { enabled } = req.body;
    await systemSettingsManager.updateHk4Enabled(enabled);
    res.json({
      enabled: systemSettingsManager.getSettings().hk4Enabled,
      sequences: hk4Manager.getSequences(),
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
