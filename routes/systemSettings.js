const express = require('express');

const router = express.Router();
const systemSettingsManager = require('../lib/systemSettingsManager');

router.get('/', async (req, res, next) => {
  try {
    const settings = systemSettingsManager.getSettings();
    res.json(settings);
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const newSettings = req.body;
    res.json(await systemSettingsManager.updateSettings(newSettings));
  } catch (error) {
    next(error);
  }
});

module.exports = router;
