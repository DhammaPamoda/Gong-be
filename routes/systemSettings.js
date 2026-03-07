const express = require('express');
const router = express.Router();
const systemSettingsManager = require('../lib/systemSettingsManager');

router.get('/', (req, res, next) => {
    try {
        const settings = systemSettingsManager.getSettings();
        res.json(settings);
    } catch (error) {
        next(error);
    }
});

router.post('/', (req, res, next) => {
    try {
        const newSettings = req.body;
        systemSettingsManager.updateSettings(newSettings);
        res.json(systemSettingsManager.getSettings());
    } catch (error) {
        next(error);
    }
});

module.exports = router;
