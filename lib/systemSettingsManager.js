const fs = require('fs');
const dataPaths = require('./config/dataPaths');
const EventEmitter = require('events');

class SystemSettingsManager extends EventEmitter {
    constructor() {
        super();
        this.settingsFilePath = dataPaths.getDataFilePath('systemSettings.json');
        this.settings = null;
        this.loadSettings();
    }

    loadSettings() {
        try {
            const content = fs.readFileSync(this.settingsFilePath, 'utf8');
            this.settings = JSON.parse(content);
        } catch (err) {
            console.error('[SystemSettingsManager] Error reading settings:', err.message);
            this.settings = {
                runSecurityCheck: false,
                alertLocation: "דגניה",
                pollingInterval: 10
            };
        }
    }

    getSettings() {
        if (!this.settings) {
            this.loadSettings();
        }
        return this.settings;
    }

    updateSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
        try {
            dataPaths.atomicWriteFileSync(this.settingsFilePath, JSON.stringify(this.settings, null, 2));
            this.emit('settingsUpdated', this.settings);
        } catch (err) {
            console.error('[SystemSettingsManager] Error saving settings:', err.message);
            throw err;
        }
    }
}

module.exports = new SystemSettingsManager();
