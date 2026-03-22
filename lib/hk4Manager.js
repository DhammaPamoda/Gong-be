const fs = require('fs');
const dataPaths = require('./config/dataPaths');

class Hk4Manager {
    constructor() {
        this.settingsFilePath = dataPaths.getDataFilePath('hk4KeyMap.json');
        this.settings = null;
        this.loadSettings();
    }

    loadSettings() {
        try {
            const content = fs.readFileSync(this.settingsFilePath, 'utf8');
            this.settings = JSON.parse(content);
        } catch (err) {
            console.error('[Hk4Manager] Error reading config:', err.message);
            this.settings = dataPaths.DEFAULT_FILE_CONTENTS['hk4KeyMap.json'];
        }
    }

    getSettings() {
        this.loadSettings(); // Always reload to assure we have latest if modified externally
        return this.settings;
    }

    saveSettings(newSettings) {
        this.settings = newSettings;
        try {
            dataPaths.atomicWriteFileSync(this.settingsFilePath, JSON.stringify(this.settings, null, 2));
        } catch (err) {
            console.error('[Hk4Manager] Error saving config:', err.message);
            throw err;
        }
    }

    setStatus(enabled) {
        const current = this.getSettings();
        current.enabled = enabled;
        this.saveSettings(current);
        return current;
    }
}

module.exports = new Hk4Manager();
