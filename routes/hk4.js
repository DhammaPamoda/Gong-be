const express = require('express');

const router = express.Router();
const hk4Manager = require('../lib/hk4Manager');

router.get('/', (req, res, next) => {
  try {
    const settings = hk4Manager.getSettings();
    res.json(settings);
  } catch (error) {
    next(error);
  }
});

router.post('/', (req, res, next) => {
  try {
    const newSettings = req.body;
    hk4Manager.saveSettings(newSettings);
    res.json(hk4Manager.getSettings());
  } catch (error) {
    next(error);
  }
});

router.post('/status', (req, res, next) => {
  try {
    const { enabled } = req.body;
    hk4Manager.setStatus(enabled);
    res.json(hk4Manager.getSettings());
  } catch (error) {
    next(error);
  }
});

module.exports = router;
